// StudIA · función "asistente", en un solo archivo.
//
// Generado por herramientas/juntar-funciones.mjs para poder pegarla en el
// editor del panel de Supabase. No lo edites acá: lo que vale es
// supabase/functions/asistente/index.ts, y este se rehace.

// StudIA · función `asistente`
//
// El asistente del docente y de la administración. Como el tutor, es la única
// puerta hacia Claude: la clave de la API no baja nunca al teléfono.
//
// Lo que hace distinto al tutor:
//   · responde derecho en vez de preguntar de vuelta;
//   · puede buscar en internet;
//   · lee los datos del curso para responder sobre gente concreta.
//
// Lo que NO hace, y no por una regla del prompt sino porque la base de datos
// no se lo entrega: leer los apuntes de un alumno, sus resúmenes de clase o lo
// que le pregunta al tutor. Todo lo que lee acá lo lee con el token de quien
// pregunta, así que las políticas de acceso deciden qué vuelve. Un prompt se
// puede dar vuelta con insistencia; una política de la base, no.

import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = claveAnon();
const CLAVE_SERVICIO = claveServicio();

const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

// Lleva la cuenta de uso. Va con la clave de servicio a propósito: si el
// cliente pudiera escribir o borrar esas filas, el tope no sería un tope.
const servicio = createClient(URL_SUPABASE, CLAVE_SERVICIO, {
  auth: { persistSession: false },
});

const comaDecimal = (n: number | null) => (n === null ? "—" : n.toFixed(1).replace(".", ","));

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405, origen);
  }

  const autorizacion = req.headers.get("Authorization") ?? "";
  if (!autorizacion.startsWith("Bearer ")) {
    return json({ error: "Falta la sesión." }, 401, origen);
  }

  // Con el token de quien pregunta: cada consulta pasa por las políticas.
  const comoDocente = createClient(URL_SUPABASE, CLAVE_ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: sesion, error: errorSesion } = await comoDocente.auth.getUser();
  if (errorSesion || !sesion?.user) {
    return json({ error: "Sesión inválida o vencida." }, 401, origen);
  }

  let cuerpo: { pregunta?: unknown; turnos?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400, origen);
  }

  const validacion = validarPregunta(cuerpo.pregunta);
  if (!validacion.ok) return json({ error: validacion.motivo }, 400, origen);

  // ------------------------------------------------------- quién pregunta
  const { data: perfil } = await comoDocente
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", sesion.user.id)
    .maybeSingle();

  if (!perfil || perfil.rol === "estudiante") {
    // El alumno tiene el tutor, que es otra cosa y con otras reglas.
    return json({ error: "Este asistente es para docentes y administración." }, 403, origen);
  }

  // --------------------------------------------------------- límite de uso
  // Cada pregunta llega a Claude con búsqueda activada: sin tope, un dedo
  // apoyado en el botón es una cuenta que crece sola.
  const desde = new Date(Date.now() - 60_000).toISOString();
  const { count: recientes } = await servicio
    .from("usos_asistente")
    .select("id", { count: "exact", head: true })
    .eq("docente_id", sesion.user.id)
    .gte("creado_en", desde);

  if ((recientes ?? 0) >= PREGUNTAS_POR_MINUTO) {
    return json({ error: "Vas muy rápido. Espera un momento." }, 429, origen);
  }
  await servicio.from("usos_asistente").insert({ docente_id: sesion.user.id });

  const { data: dictados } = await comoDocente
    .from("dictados")
    .select("papel, asignatura_id")
    .eq("docente_id", sesion.user.id);

  const papel: Papel = perfil.rol === "administrador"
    ? "administrador"
    : ((dictados?.[0]?.papel as Papel | undefined) ?? "ayudante");

  // ------------------------------------------------------- datos del curso
  // Todo esto vuelve ya filtrado: un ramo ajeno no aparece aunque se pida.
  const ramos: RamoResumido[] = [];

  const { data: asignaturas } = await comoDocente
    .from("asignaturas")
    .select("id, codigo, nombre");

  for (const a of asignaturas ?? []) {
    const [inscritos, tareas, evaluaciones, bloques, modulos, curso] = await Promise.all([
      comoDocente.from("inscripciones").select("estudiante_id").eq("asignatura_id", a.id),
      comoDocente.from("tareas").select("id, titulo, puntos, vence_en").eq("asignatura_id", a.id),
      comoDocente.from("evaluaciones").select("id, titulo, peso").eq("asignatura_id", a.id),
      comoDocente.from("bloques_horario").select("dia, hora_inicio, hora_fin, sala, tipo")
        .eq("asignatura_id", a.id),
      comoDocente.from("modulos").select("id, materiales(id)").eq("asignatura_id", a.id),
      comoDocente.rpc("alumnos_de", { p_asignatura: a.id }),
    ]);

    const cuantosInscritos = inscritos.data?.length ?? 0;

    const lineasTareas: string[] = [];
    for (const t of tareas.data ?? []) {
      const { data: entregas } = await comoDocente
        .from("entregas")
        .select("estudiante_id, entregado_en, puntos_obtenidos")
        .eq("tarea_id", t.id);
      const entregadas = entregas?.length ?? 0;
      const corregidas = entregas?.filter((e) => e.puntos_obtenidos !== null).length ?? 0;
      lineasTareas.push(
        `${t.titulo} · vence ${String(t.vence_en).slice(0, 10)} · ${t.puntos} pts · ` +
        `entregaron ${entregadas} de ${cuantosInscritos} · ${entregadas - corregidas} sin corregir`,
      );
    }

    const lineasEvaluaciones: string[] = [];
    for (const ev of evaluaciones.data ?? []) {
      const { data: notas } = await comoDocente
        .from("notas")
        .select("nota, publicada_en")
        .eq("evaluacion_id", ev.id);
      const puestas = (notas ?? []).map((n) => Number(n.nota)).filter((n) => !Number.isNaN(n));
      const promedio = puestas.length === 0
        ? null
        : Math.round((puestas.reduce((s, n) => s + n, 0) / puestas.length) * 10) / 10;
      const aprobados = puestas.filter((n) => n >= 4).length;
      const sinPublicar = (notas ?? []).filter((n) => n.publicada_en === null).length;
      lineasEvaluaciones.push(
        `${ev.titulo} · ${ev.peso}% · promedio ${comaDecimal(promedio)} · ` +
        `aprueban ${aprobados} de ${puestas.length} · ${sinPublicar} sin publicar`,
      );
    }

    // Quién viene quedándose atrás: cuánto del material marcó como visto.
    // Es el dato que responde "quién ha estudiado" sin abrir un solo apunte.
    const materiales = (modulos.data ?? []).flatMap(
      (m: { materiales?: { id: string }[] }) => (m.materiales ?? []).map((x) => x.id));
    const lineasRezagados: string[] = [];

    if (materiales.length > 0) {
      const { data: progreso } = await comoDocente
        .from("progreso_material")
        .select("estudiante_id, material_id, completado_en")
        .in("material_id", materiales);

      const hechosPor = new Map<string, { cuantos: number; ultimo: string | null }>();
      for (const p of progreso ?? []) {
        const fila = hechosPor.get(p.estudiante_id) ?? { cuantos: 0, ultimo: null };
        fila.cuantos += 1;
        if (!fila.ultimo || String(p.completado_en) > fila.ultimo) {
          fila.ultimo = String(p.completado_en);
        }
        hechosPor.set(p.estudiante_id, fila);
      }

      const alumnos = (curso.data ?? []) as { id: string; nombre: string }[];
      for (const alumno of alumnos) {
        const fila = hechosPor.get(alumno.id) ?? { cuantos: 0, ultimo: null };
        const dias = fila.ultimo
          ? Math.floor((Date.now() - new Date(fila.ultimo).getTime()) / 86_400_000)
          : null;
        // Bajo la mitad del material, o más de una semana sin marcar nada.
        if (fila.cuantos / materiales.length >= 0.5 && dias !== null && dias <= 7) continue;
        lineasRezagados.push(
          `${alumno.nombre} · ${fila.cuantos} de ${materiales.length} materiales · ` +
          (dias === null ? "nunca ha marcado material" : `último hace ${dias} días`),
        );
      }
    }

    ramos.push({
      codigo: a.codigo,
      nombre: a.nombre,
      inscritos: cuantosInscritos,
      tareas: lineasTareas,
      evaluaciones: lineasEvaluaciones,
      rezagados: lineasRezagados,
      horario: (bloques.data ?? []).map((b) =>
        `día ${b.dia} · ${String(b.hora_inicio).slice(0, 5)} a ${String(b.hora_fin).slice(0, 5)} · ${b.sala} · ${b.tipo}`),
    });
  }

  // ------------------------------------------------------------- responder
  const previos: Turno[] = Array.isArray(cuerpo.turnos)
    ? (cuerpo.turnos as Turno[])
        .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .slice(-TURNOS_DE_CONTEXTO)
    : [];

  const turnos = normalizarTurnos([...previos, { role: "user", content: validacion.texto }]);

  try {
    const salida = await claude.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      // La búsqueda es lo que hace falta para preguntar por material de apoyo
      // o normativa sin salir de la app. Los datos de los alumnos no están en
      // internet, y el prompt lo dice.
      tools: [{
        type: "web_search_20260209",
        name: "web_search",
        max_uses: BUSQUEDAS_MAXIMAS,
      }],
      system: promptAsistente(perfil.nombre, papel, ramos),
      messages: turnos,
    });

    if (salida.stop_reason === "refusal") {
      return json({ error: "No puedo ayudarte con eso. ¿Te sirve algo del curso?" }, 422, origen);
    }

    const texto = salida.content
      .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("")
      .trim();

    return json({ respuesta: texto || RESPUESTA_DE_RESPALDO }, 200, origen);
  } catch (error) {
    console.error("asistente:", error);
    return json({ respuesta: RESPUESTA_DE_RESPALDO }, 200, origen);
  }
});

// ── de _compartido/cors.ts ─────────────────────────────────────────────

const ORIGENES = (Deno.env.get("ORIGENES_PERMITIDOS") ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function cabecerasCors(origen: string | null): Record<string, string> {
  const permitido = ORIGENES.includes("*")
    ? "*"
    : (origen && ORIGENES.includes(origen) ? origen : ORIGENES[0] ?? "");
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(cuerpo: unknown, estado: number, origen: string | null): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabecerasCors(origen), "Content-Type": "application/json; charset=utf-8" },
  });
}

// ── de _compartido/entorno.ts ──────────────────────────────────────────

// De dónde salen las claves del propio proyecto.
//
// Supabase le pone estas variables a cada función; no se cargan a mano. El
// problema es que hay dos generaciones de nombres conviviendo: los proyectos
// viejos traen `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, y los que se
// crean con el formato nuevo de claves —`sb_publishable_…` y `sb_secret_…`—
// pueden traerlas como `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`.
//
// Leer solo un par de nombres deja la función en pie pero muerta: arranca sin
// quejarse, y cada consulta se cae con «Invalid API key» sin decir por qué.
// Acá se aceptan los dos, que además es lo correcto mientras dure la
// transición: un proyecto puede tener puestos los cuatro.

/** El valor del primero de estos nombres que esté puesto y no venga vacío. */
function delEntorno(...nombres: string[]): string {
  for (const nombre of nombres) {
    const valor = Deno.env.get(nombre)?.trim();
    if (valor) return valor;
  }
  return "";
}

/** La clave pública, la que lleva la aplicación. */
function claveAnon(): string {
  return delEntorno("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
}

/** La clave que se salta las políticas de acceso. No sale de acá adentro. */
function claveServicio(): string {
  return delEntorno("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

/**
 * Todas las claves de servicio que el proyecto tenga puestas.
 *
 * Para comparar contra lo que llega en una cabecera: quien llama pudo mandar
 * cualquiera de las dos, y son igual de válidas.
 */
function clavesDeServicio(): string[] {
  return ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]
    .map((n) => Deno.env.get(n)?.trim())
    .filter((v): v is string => Boolean(v));
}

// ── de _compartido/asistente-nucleo.ts ─────────────────────────────────

// StudIA · el asistente del docente
//
// Es el reverso del tutor y conviene tener clara la diferencia. Al alumno no
// se le da nunca la respuesta, porque el objetivo es que la encuentre. Al
// docente se le da derecho: su problema no es aprender, es no perder media
// hora cruzando planillas para saber a quién le escribe.
//
// Puede buscar en internet, y por eso hay una regla que no se negocia: lo que
// venga de una búsqueda se dice con su fuente y se separa de lo que salió del
// curso. Un dato del curso es verificable; uno de internet, no necesariamente.

type Papel = "profesor" | "ayudante" | "administrador";

type RamoResumido = {
  codigo: string;
  nombre: string;
  inscritos: number;
  /** Una línea por tarea: título, cuántos entregaron, cuántos sin corregir. */
  tareas: string[];
  /** Una línea por evaluación: título, peso, promedio, aprobados, publicada. */
  evaluaciones: string[];
  /** Una línea por alumno rezagado: nombre, avance, último acceso. */
  rezagados: string[];
  /** Una línea por bloque: día, hora, sala. */
  horario: string[];
};

const LARGO_MAXIMO = 2000;
const PREGUNTAS_POR_MINUTO = 20;
const TURNOS_DE_CONTEXTO = 20;

/** Cuántas búsquedas puede hacer en una respuesta. */
const BUSQUEDAS_MAXIMAS = 5;

function promptAsistente(
  nombre: string,
  papel: Papel,
  ramos: RamoResumido[],
): string {
  const quien = papel === "administrador"
    ? "la administración académica del colegio"
    : papel === "ayudante"
      ? "ayudante de cátedra"
      : "profesora o profesor";

  const partes = [
    `Eres el asistente de StudIA para ${quien}. Hablas con ${nombre}. StudIA es una aplicación de estudio para estudiantes de Ingeniería Civil Industrial en Chile.`,

    `Tu trabajo es responder rápido y derecho preguntas sobre sus cursos: quién no ha entregado, quién viene quedándose atrás, qué falta por corregir, cómo le fue al curso en una evaluación, a quién conviene escribirle. Cuando la respuesta es una lista de personas, dala como lista de nombres, no como prosa.`,

    `REGLA PRIMERA: no inventas datos. Todo lo que digas sobre el curso sale de los DATOS DEL CURSO que vienen más abajo. Si algo no está ahí, dices que no lo tienes y qué haría falta para tenerlo. Nunca estimas un número, nunca completas una lista "probable", nunca supones que un alumno entregó porque sería raro que no.`,

    `REGLA SEGUNDA: puedes buscar en internet, y cuando lo hagas separas claramente las dos cosas. Los datos del curso son verificables; lo que encuentres afuera no necesariamente. Di de dónde viene lo que traes de una búsqueda. Usa la búsqueda para lo que sirve —material de apoyo, cómo se enseña un tema, referencias bibliográficas, normativa— y no para adivinar datos de tus alumnos, que no están en internet.`,

    `REGLA TERCERA: no tienes los apuntes de los alumnos, ni sus resúmenes de clase, ni lo que le preguntan al tutor. No es un olvido: ese material es privado y la base de datos no te lo entrega. Si te lo piden, dilo en una frase y ofrece lo que sí tienes, que es su actividad en el curso. No especules sobre lo que un alumno "estaría" pensando o entendiendo.`,

    `Cuidado con una distinción que importa: "no entregó" no es lo mismo que "no ha estudiado". Lo primero es un hecho registrado; lo segundo es una interpretación de cuánto material marcó como visto y hace cuánto no entra. Cuando hables de avance, di el dato y deja la conclusión al docente.`,

    papel === "ayudante"
      ? `Eres ayudante: puedes corregir, cargar material y responder el foro, pero publicar notas es del profesor. Si te preguntan por publicar, dilo.`
      : ``,

    `Cómo escribes: en español de Chile, tratando de tú. Directo y corto. Sin encabezados ni relleno. Si la respuesta cabe en una frase, es una frase.`,
  ].filter(Boolean);

  partes.push(datosParaElPrompt(ramos));

  return partes.join("\n\n");
}

/**
 * Los datos del curso, en texto plano. Van al final del prompt a propósito:
 * es la parte que cambia en cada pregunta, y dejarla al final permite que
 * todo lo anterior se sirva desde la caché.
 */
function datosParaElPrompt(ramos: RamoResumido[]): string {
  if (ramos.length === 0) {
    return "DATOS DEL CURSO\n\nEsta persona no tiene ramos asignados.";
  }

  const bloques = ramos.map((r) => {
    const lineas = [`## ${r.nombre} (${r.codigo}) · ${r.inscritos} inscritos`];

    const seccion = (titulo: string, filas: string[], vacio: string) => {
      lineas.push(`\n### ${titulo}`);
      lineas.push(filas.length > 0 ? filas.map((f) => `- ${f}`).join("\n") : `- ${vacio}`);
    };

    seccion("Tareas", r.tareas, "Sin tareas publicadas.");
    seccion("Evaluaciones", r.evaluaciones, "Sin evaluaciones cargadas.");
    seccion("Quién viene quedándose atrás", r.rezagados, "Nadie: el curso viene al día.");
    seccion("Horario", r.horario, "Sin bloques cargados.");

    return lineas.join("\n");
  });

  return `DATOS DEL CURSO\n\nEs todo lo que tienes. No hay más.\n\n${bloques.join("\n\n")}`;
}

type Validacion = { ok: true; texto: string } | { ok: false; motivo: string };

function validarPregunta(entrada: unknown): Validacion {
  if (typeof entrada !== "string") return { ok: false, motivo: "La pregunta debe ser texto." };
  const texto = entrada.trim();
  if (texto.length === 0) return { ok: false, motivo: "Escribe una pregunta." };
  if (texto.length > LARGO_MAXIMO) {
    return { ok: false, motivo: `La pregunta no puede pasar de ${LARGO_MAXIMO} caracteres.` };
  }
  return { ok: true, texto };
}

type Turno = { role: "user" | "assistant"; content: string };

/**
 * Claude exige que los turnos alternen y que el primero sea del usuario. Un
 * historial guardado puede no cumplirlo si algo falló a mitad de camino.
 */
function normalizarTurnos(turnos: Turno[]): Turno[] {
  const limpios = turnos.filter((t) => t.content.trim().length > 0);
  const salida: Turno[] = [];
  for (const t of limpios) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.role === t.role) {
      ultimo.content = `${ultimo.content}\n\n${t.content}`;
      continue;
    }
    if (salida.length === 0 && t.role !== "user") continue;
    salida.push({ ...t });
  }
  return salida;
}

const RESPUESTA_DE_RESPALDO =
  "No pude responderte ahora. Vuelve a intentarlo en un momento; si sigue fallando, los datos del curso están igual en la pantalla de tu ramo.";
