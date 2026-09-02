// StudIA · función "quiz", en un solo archivo.
//
// Generado por herramientas/juntar-funciones.mjs para poder pegarla en el
// editor del panel de Supabase. No lo edites acá: lo que vale es
// supabase/functions/quiz/index.ts, y este se rehace.

// StudIA · función `quiz`
//
// Prepara preguntas de repaso sobre un módulo del ramo, a partir del material
// que ese ramo tiene cargado.
//
// Dos cosas la separan del tutor. La primera es que acá Claude escribe algo
// que después se corrige solo, así que una pregunta mal formada no se muestra
// a medias: se descarta antes de guardarla, y si no quedan suficientes, no hay
// quiz. La segunda es que el resultado no es de nadie más: no lo ve quien
// dicta el ramo ni la administración, porque en el momento en que un repaso
// cuenta para algo, deja de servir para repasar.
//
// El material se lee con el token de quien pregunta, así que las políticas de
// acceso deciden de qué ramos se puede pedir un quiz. Un prompt se da vuelta
// con insistencia; una política de la base, no.

import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = claveAnon();
const CLAVE_SERVICIO = claveServicio();

const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
const servicio = createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origen);

  const autorizacion = req.headers.get("Authorization") ?? "";
  if (!autorizacion.startsWith("Bearer ")) return json({ error: "Falta la sesión." }, 401, origen);

  const comoEstudiante = createClient(URL_SUPABASE, CLAVE_ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: sesion, error: errorSesion } = await comoEstudiante.auth.getUser();
  if (errorSesion || !sesion?.user) return json({ error: "Sesión inválida o vencida." }, 401, origen);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "El cuerpo no es JSON válido." }, 400, origen);
  }

  const moduloId = typeof cuerpo.modulo_id === "string" ? cuerpo.modulo_id : null;
  if (!moduloId) return json({ error: "Falta el tema." }, 400, origen);
  const cuantas = cuantasPedir(cuerpo.cuantas);

  // Con el token del estudiante: si no está inscrito en el ramo, RLS esconde
  // el módulo y acá no llega nada que preguntar.
  const { data: modulo } = await comoEstudiante
    .from("modulos")
    .select("id, titulo, asignatura_id, materiales(titulo, texto, orden)")
    .eq("id", moduloId)
    .maybeSingle();

  if (!modulo) return json({ error: "Ese tema no es de un ramo tuyo." }, 403, origen);

  const { data: asignatura } = await comoEstudiante
    .from("asignaturas")
    .select("id, nombre, codigo")
    .eq("id", modulo.asignatura_id)
    .maybeSingle();

  if (!asignatura) return json({ error: "No encontré la asignatura." }, 404, origen);

  const materiales = (modulo.materiales ?? []) as { titulo: string; texto: string | null; orden: number }[];
  const ordenados = [...materiales].sort((a, b) => a.orden - b.orden);

  if (ordenados.length === 0) {
    return json(
      { error: "Este tema todavía no tiene material cargado, así que no hay de qué preguntar." },
      422, origen,
    );
  }

  let salidaTexto = "";
  try {
    const respuesta = await claude.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: promptQuiz({
        asignatura: asignatura.nombre,
        codigo: asignatura.codigo,
        tema: modulo.titulo,
        materiales: ordenados.map((m) => m.titulo),
        texto: ordenados.map((m) => m.texto ?? "").filter(Boolean).join("\n\n"),
        cuantas,
      }),
      messages: [{ role: "user", content: `Prepárame ${cuantas} preguntas de «${modulo.titulo}».` }],
    });

    if (respuesta.stop_reason === "refusal") {
      return json({ error: "No pude preparar preguntas de este material." }, 422, origen);
    }

    salidaTexto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (error) {
    console.error("Falló la llamada a Claude:", error);
    return json({ error: "El evaluador no está disponible en este momento." }, 503, origen);
  }

  const preguntas = leerPreguntas(salidaTexto);
  if (!suficientes(preguntas)) {
    // Preferimos no dar quiz a dar uno de dos preguntas o con una que miente.
    return json(
      { error: "No me quedaron suficientes preguntas buenas. Inténtalo otra vez." },
      503, origen,
    );
  }

  // Con la clave de servicio: el estudiante no tiene `insert` en la tabla, y
  // ese es justamente el punto —si pudiera escribir sus propias preguntas, el
  // puntaje no diría nada.
  const { data: guardado, error: errorGuardar } = await servicio
    .from("quices")
    .insert({
      estudiante_id: sesion.user.id,
      asignatura_id: asignatura.id,
      tema: modulo.titulo,
      preguntas,
    })
    .select("id, asignatura_id, tema, preguntas, respuestas, terminado_en, creado_en")
    .single();

  if (errorGuardar || !guardado) {
    console.error("No pude guardar el quiz:", errorGuardar);
    return json({ error: "Preparé las preguntas pero no pude guardarlas." }, 500, origen);
  }

  return json({ quiz: guardado }, 200, origen);
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

// ── de _compartido/quiz-nucleo.ts ──────────────────────────────────────

// El quiz: preguntas hechas a partir del material del propio ramo.
//
// Es la única parte del sistema donde Claude escribe algo que después se
// corrige solo, y eso obliga a ser más estricto que en el resto: una pregunta
// mal formada —sin respuesta correcta, con dos correctas, con alternativas
// repetidas— no se muestra a medias, se descarta. Vale más un quiz de tres
// preguntas buenas que uno de cinco con una que miente.
//
// Sin dependencias del entorno, para poder probarlo sin Deno ni Claude.

type Pregunta = {
  /** El enunciado. */
  pregunta: string;
  /** Siempre cuatro, en el orden en que se muestran. */
  opciones: string[];
  /** Índice de la correcta dentro de `opciones`. */
  correcta: number;
  /** Por qué es esa, y qué error es típico acá. Se muestra al responder. */
  explicacion: string;
};

type ContextoQuiz = {
  asignatura: string;
  codigo: string;
  /** El módulo o tema sobre el que se pregunta. */
  tema: string;
  /** Los títulos del material de ese tema: es de ahí que salen las preguntas. */
  materiales: string[];
  /** El texto de las lecturas, si lo hay. Es lo que hace que el quiz sea de este ramo. */
  texto: string;
  cuantas: number;
};

const CUANTAS_POR_DEFECTO = 5;
const MINIMO_DE_PREGUNTAS = 3;
const MAXIMO_DE_PREGUNTAS = 8;
const LARGO_MAXIMO_TEXTO = 30_000;

function promptQuiz(ctx: ContextoQuiz): string {
  const partes = [
    `Eres el evaluador de StudIA. Preparas preguntas de repaso para un estudiante de ${ctx.asignatura} (${ctx.codigo}) sobre el tema «${ctx.tema}».`,

    `Escribe ${ctx.cuantas} preguntas de alternativas sobre ESE material y nada más. No preguntes por cosas que el material no cubre: el estudiante va a creer que le falta estudiar algo que su ramo nunca pasó.`,

    `Cada pregunta tiene cuatro alternativas y una sola correcta. Las tres incorrectas tienen que ser errores plausibles —del tipo que alguien comete de verdad al estudiar esto— y no alternativas de relleno evidentemente falsas. Que la correcta no sea siempre la más larga.`,

    `Pregunta por comprensión, no por memoria: qué técnica conviene y por qué, qué pasa si cambia una condición, cuál es el error típico. Nada de «¿en qué año…?» ni de definiciones que se copian del apunte.`,

    `Responde SOLO con un arreglo JSON, sin texto antes ni después, sin bloque de código. Cada elemento:
{"pregunta": "...", "opciones": ["...", "...", "...", "..."], "correcta": 0, "explicacion": "..."}

«correcta» es el índice —de 0 a 3— de la alternativa correcta dentro de «opciones». «explicacion» son una o dos frases que digan por qué es esa y qué error es típico acá; se le muestran al estudiante justo después de que responde, así que háblale de tú.`,

    `Escribes en español de Chile.`,

    `Material del tema:\n${ctx.materiales.map((m) => `- ${m}`).join("\n") || "- (sin material cargado)"}`,
  ];

  if (ctx.texto.trim()) {
    partes.push(`Contenido de las lecturas:\n${ctx.texto.trim().slice(0, LARGO_MAXIMO_TEXTO)}`);
  } else {
    partes.push(
      "No hay lecturas cargadas de este tema, así que trabaja con los títulos del material y lo que es estándar en un curso de este nivel. No inventes contenido específico del ramo.",
    );
  }

  return partes.join("\n\n");
}

/**
 * Lee el JSON que devolvió el modelo y se queda solo con las preguntas sanas.
 *
 * Tolera lo que los modelos hacen igual aunque se les pida que no: envolver el
 * arreglo en un bloque de código, anteponer una frase de cortesía, o meterlo
 * dentro de un objeto con una llave cualquiera.
 */
function leerPreguntas(texto: string): Pregunta[] {
  const crudo = extraerArreglo(texto);
  if (!Array.isArray(crudo)) return [];
  return crudo.map(comoPregunta).filter((p): p is Pregunta => p !== null);
}

function extraerArreglo(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  const intentar = (s: string): unknown => {
    try { return JSON.parse(s); } catch { return undefined; }
  };

  const directo = intentar(limpio);
  if (Array.isArray(directo)) return directo;
  // Un objeto que envuelve el arreglo: {"preguntas": [...]}.
  if (directo && typeof directo === "object") {
    for (const v of Object.values(directo as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
    }
  }

  // Última salida: el primer arreglo que aparezca en el texto.
  const desde = limpio.indexOf("[");
  const hasta = limpio.lastIndexOf("]");
  if (desde >= 0 && hasta > desde) return intentar(limpio.slice(desde, hasta + 1));
  return undefined;
}

/**
 * Una pregunta solo pasa si está entera: enunciado, cuatro alternativas
 * distintas, un índice que existe, y explicación. Cualquier otra cosa se
 * descarta en silencio; mostrarla a medias sería peor.
 */
function comoPregunta(x: unknown): Pregunta | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;

  const pregunta = typeof o.pregunta === "string" ? o.pregunta.trim() : "";
  const explicacion = typeof o.explicacion === "string" ? o.explicacion.trim() : "";
  if (pregunta.length < 8 || explicacion.length < 8) return null;

  if (!Array.isArray(o.opciones) || o.opciones.length !== 4) return null;
  const opciones = o.opciones.map((v) => (typeof v === "string" ? v.trim() : ""));
  if (opciones.some((v) => v.length === 0)) return null;

  // Dos alternativas iguales hacen que haya dos correctas o ninguna.
  const distintas = new Set(opciones.map((v) => v.toLowerCase()));
  if (distintas.size !== 4) return null;

  // Un índice escrito como texto —"1"— se acepta: el modelo lo hace igual y
  // no hay ambigüedad. Lo que no se acepta es que falte: `Number(null)` es
  // cero, y cero es un índice válido, así que un `correcta` ausente se
  // convertiría en «la alternativa A» y el quiz mentiría con toda naturalidad.
  const crudo = o.correcta;
  const esNumero = typeof crudo === "number";
  const esTextoDeNumero = typeof crudo === "string" && crudo.trim() !== "";
  if (!esNumero && !esTextoDeNumero) return null;
  const correcta = Number(crudo);
  if (!Number.isInteger(correcta) || correcta < 0 || correcta > 3) return null;

  return { pregunta, opciones, correcta, explicacion };
}

/** Cuántas pedir: ni una sola ni una tanda que nadie termina. */
function cuantasPedir(pedidas: unknown): number {
  const n = Math.round(Number(pedidas));
  if (!Number.isFinite(n)) return CUANTAS_POR_DEFECTO;
  return Math.min(MAXIMO_DE_PREGUNTAS, Math.max(MINIMO_DE_PREGUNTAS, n));
}

/**
 * Un quiz sirve si quedaron suficientes preguntas sanas después de filtrar.
 * Con menos de tres no es un repaso, es una anécdota.
 */
function suficientes(preguntas: readonly Pregunta[]): boolean {
  return preguntas.length >= MINIMO_DE_PREGUNTAS;
}

// ── Las fichas ────────────────────────────────────────────────────────────
//
// Son primas de las preguntas del quiz: mismo material, misma exigencia al
// leer lo que devuelve el modelo. Cambia para qué sirven —una ficha vuelve, y
// vuelve más seguido la que fallaste— y por eso cambia lo que se le pide: una
// pregunta que se responda de memoria en dos segundos, no una de alternativas.

type FichaNueva = { pregunta: string; respuesta: string };

const CUANTAS_FICHAS = 10;
const MINIMO_DE_FICHAS = 4;

function promptFichas(ctx: ContextoQuiz): string {
  return [
    `Eres el evaluador de StudIA. Preparas fichas de repaso para un estudiante de ${ctx.asignatura} (${ctx.codigo}) sobre el tema «${ctx.tema}».`,

    `Una ficha es una pregunta corta y su respuesta corta. Se usan para repasar de memoria: la persona lee la pregunta, intenta responder de cabeza, y da vuelta la ficha para comprobar. Si falla, esa ficha le vuelve a aparecer antes que las demás.`,

    `Escribe ${ctx.cuantas} fichas sobre ESE material y nada más. Cada una prueba UNA sola cosa: una fórmula, una condición, una definición, cuándo se usa una técnica. Nada de preguntas que necesiten desarrollar un ejercicio, porque no se responden de memoria.`,

    `La respuesta va en una o dos frases, con lo justo para comprobar si se sabía. Si hay una fórmula, escríbela. Cuando venga al caso, agrega en la misma respuesta el error típico, que es lo que hace que la ficha enseñe algo y no solo mida.`,

    `Responde SOLO con un arreglo JSON, sin texto antes ni después, sin bloque de código. Cada elemento:
{"pregunta": "...", "respuesta": "..."}`,

    `Escribes en español de Chile, tratando de tú.`,

    `Material del tema:\n${ctx.materiales.map((m) => `- ${m}`).join("\n") || "- (sin material cargado)"}`,

    ctx.texto.trim()
      ? `Contenido de las lecturas:\n${ctx.texto.trim().slice(0, LARGO_MAXIMO_TEXTO)}`
      : "No hay lecturas cargadas de este tema, así que trabaja con los títulos del material y lo que es estándar en un curso de este nivel. No inventes contenido específico del ramo.",
  ].join("\n\n");
}

/**
 * Lee las fichas que devolvió el modelo, con la misma desconfianza que las
 * preguntas: una ficha sin respuesta no es media ficha, es basura.
 */
function leerFichas(texto: string): FichaNueva[] {
  const crudo = extraerArreglo(texto);
  if (!Array.isArray(crudo)) return [];

  const vistas = new Set<string>();
  const fichas: FichaNueva[] = [];

  for (const x of crudo) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const pregunta = typeof o.pregunta === "string" ? o.pregunta.trim() : "";
    const respuesta = typeof o.respuesta === "string" ? o.respuesta.trim() : "";
    // Los topes son los mismos que los de la tabla: lo que no cabría se
    // descarta acá y no en un error de la base a mitad de la escritura.
    if (pregunta.length < 8 || pregunta.length > 300) continue;
    if (respuesta.length < 2 || respuesta.length > 600) continue;

    // Dos fichas con la misma pregunta son una ficha y una molestia.
    const llave = pregunta.toLowerCase();
    if (vistas.has(llave)) continue;
    vistas.add(llave);

    fichas.push({ pregunta, respuesta });
  }
  return fichas;
}

const suficientesFichas = (fichas: readonly FichaNueva[]): boolean =>
  fichas.length >= MINIMO_DE_FICHAS;
