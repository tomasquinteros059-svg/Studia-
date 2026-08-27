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

import { cabecerasCors, json } from "../_compartido/cors.ts";
import {
  BUSQUEDAS_MAXIMAS,
  normalizarTurnos,
  promptAsistente,
  RESPUESTA_DE_RESPALDO,
  TURNOS_DE_CONTEXTO,
  validarPregunta,
  type Papel,
  type RamoResumido,
  type Turno,
} from "../_compartido/asistente-nucleo.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

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
