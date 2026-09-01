// StudIA · función "resumen", en un solo archivo.
//
// Generado por herramientas/juntar-funciones.mjs para poder pegarla en el
// editor del panel de Supabase. No lo edites acá: lo que vale es
// supabase/functions/resumen/index.ts, y este se rehace.

// StudIA · función `resumen`
//
// Toma los apuntes de una clase y devuelve un resumen, los temas del ramo que
// el apunte no menciona, y consejos para estudiar ese contenido.
//
// La regla del tutor sigue en pie: resumir lo que el estudiante escribió está
// permitido; terminarle un ejercicio a medias, no.

import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
const servicio = createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });

/** Cuánta transcripción se le pasa al modelo, en caracteres. */
const MAXIMO_TRANSCRIPCION = 40_000;

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

  const apunteId = typeof cuerpo.apunte_id === "string" ? cuerpo.apunte_id : null;
  if (!apunteId) return json({ error: "Falta el apunte." }, 400, origen);

  // Se lee con el token del estudiante: si el apunte no es suyo, RLS lo esconde.
  const { data: apunte } = await comoEstudiante
    .from("apuntes")
    .select("id, contenido, clase_id, asignatura_id")
    .eq("id", apunteId)
    .maybeSingle();

  if (!apunte) return json({ error: "Ese apunte no es tuyo." }, 403, origen);

  const validacion = validarApunte(apunte.contenido);
  if (!validacion.ok) return json({ error: validacion.motivo }, 400, origen);

  const { data: asignatura } = await comoEstudiante
    .from("asignaturas")
    .select("nombre, codigo, profesor")
    .eq("id", apunte.asignatura_id)
    .maybeSingle();

  if (!asignatura) return json({ error: "No encontré la asignatura." }, 404, origen);

  // Temario: los títulos del material del ramo, para detectar lo que falta.
  const { data: modulos } = await comoEstudiante
    .from("modulos")
    .select("titulo, materiales(titulo)")
    .eq("asignatura_id", apunte.asignatura_id)
    .order("orden");

  const temario = (modulos ?? []).flatMap((m) => [
    m.titulo,
    ...(m.materiales ?? []).map((x: { titulo: string }) => `  ${x.titulo}`),
  ]);

  // Transcripción de la clase, si el transporte de audio ya la produce.
  let transcripcion = "";
  if (apunte.clase_id) {
    const { data: lineas } = await comoEstudiante
      .from("transcripciones")
      .select("segundo, texto")
      .eq("clase_id", apunte.clase_id)
      .order("segundo");
    transcripcion = (lineas ?? [])
      .map((l) => l.texto)
      .join(" ")
      .slice(0, MAXIMO_TRANSCRIPCION);
  }

  let salidaTexto = "";
  try {
    const respuesta = await claude.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: promptResumen({
        asignatura: asignatura.nombre,
        codigo: asignatura.codigo,
        profesor: asignatura.profesor,
        temario,
        transcripcion,
        apunte: validacion.texto,
      }),
      messages: [{ role: "user", content: "Resume mis apuntes de esta clase." }],
    });

    if (respuesta.stop_reason === "refusal") {
      return json({ error: "No pude resumir estos apuntes." }, 422, origen);
    }

    salidaTexto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (error) {
    console.error("Falló la llamada a Claude:", error);
    return json({ error: "El tutor no está disponible en este momento." }, 503, origen);
  }

  if (!salidaTexto) {
    return json({ error: "El tutor no devolvió nada. Inténtalo otra vez." }, 503, origen);
  }

  const resumen = partirRespuesta(salidaTexto);

  // Un apunte tiene un resumen; si se pide de nuevo, se reemplaza.
  const { error: errorGuardar } = await servicio
    .from("resumenes")
    .upsert(
      {
        apunte_id: apunteId,
        cuerpo: resumen.cuerpo,
        vacios: resumen.vacios,
        consejos: resumen.consejos,
      },
      { onConflict: "apunte_id" },
    );

  if (errorGuardar) console.error("No pude guardar el resumen:", errorGuardar);

  return json({ ...resumen, con_transcripcion: transcripcion.length > 0 }, 200, origen);
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

// ── de _compartido/resumen-nucleo.ts ───────────────────────────────────

// Resumen de fin de clase: cruza lo que el estudiante escribió con la materia
// del ramo y, cuando exista, con lo que se dijo en la sala.
//
// Sin dependencias del entorno, para poder probarlo sin Deno ni Claude.

type ContextoResumen = {
  asignatura: string;
  codigo: string;
  profesor: string;
  /** Títulos del material del ramo, para detectar lo que el apunte no menciona. */
  temario: string[];
  /** Lo que se dijo en clase, si hay transcripción. Vacío mientras no la haya. */
  transcripcion: string;
  apunte: string;
};

type Resumen = { cuerpo: string; vacios: string[]; consejos: string[] };

const LARGO_MAXIMO_APUNTE = 20_000;

function promptResumen(ctx: ContextoResumen): string {
  const partes = [
    `Eres el tutor de StudIA acompañando a un estudiante de ${ctx.asignatura} (${ctx.codigo}), ramo que dicta ${ctx.profesor}. El estudiante acaba de terminar una clase y te entrega los apuntes que tomó.`,

    `Tu tarea es devolverle un resumen útil de SUS apuntes, señalarle qué de la materia no quedó registrado, y darle consejos concretos de estudio sobre este contenido.`,

    `SIGUE VALIENDO LA REGLA DE FONDO: no resuelves ejercicios. Si en los apuntes hay un ejercicio a medias, no lo terminas; señalas qué falta y qué pregunta debería hacerse para seguir. Resumir lo que el propio estudiante escribió sí está permitido: eso no es hacerle la tarea.`,

    `Responde EXACTAMENTE en este formato, sin nada antes ni después:

RESUMEN
(dos o tres párrafos cortos, en segunda persona, con las ideas centrales tal como quedaron en sus apuntes. Si algo quedó anotado de forma confusa o incorrecta, dilo con cuidado y explica el concepto.)

VACIOS
- (un punto por cada tema del temario que la clase probablemente cubrió y el apunte no menciona. Si no falta nada, escribe una sola línea: "- ninguno")

CONSEJOS
- (dos a cuatro consejos concretos para estudiar ESTE contenido: qué repasar primero, con qué ejercicio comprobar que se entendió, qué error es típico aquí. Nada genérico como "estudia todos los días".)`,

    `Escribes en español de Chile, tratando de tú, sin encabezados extra ni listas anidadas.`,

    `Temario del ramo:\n${ctx.temario.map((t) => `- ${t}`).join("\n") || "- (sin material cargado)"}`,
  ];

  if (ctx.transcripcion.trim()) {
    partes.push(
      `Lo que se dijo en la clase (transcripción):\n${ctx.transcripcion.trim()}`,
    );
  } else {
    partes.push(
      "No hay transcripción de esta clase, así que trabaja solo con los apuntes y el temario. No inventes lo que el profesor dijo.",
    );
  }

  partes.push(`Apuntes del estudiante:\n${ctx.apunte.trim()}`);

  return partes.join("\n\n");
}

/** Convierte las viñetas de un bloque en una lista limpia. */
function vinetas(bloque: string): string[] {
  return bloque
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((l) => l.length > 0)
    .filter((l) => l.toLowerCase() !== "ninguno" && l.toLowerCase() !== "ninguna");
}

/**
 * Parte la respuesta en sus tres bloques. Si el modelo no respeta el formato,
 * se prefiere devolver todo como resumen antes que perder el contenido.
 */
function partirRespuesta(texto: string): Resumen {
  const limpio = texto.trim();
  if (!limpio) return { cuerpo: "", vacios: [], consejos: [] };

  // Tolerante a acentos, minúsculas y adornos tipo "## RESUMEN" o "**VACÍOS**".
  const encabezado = (nombre: string) =>
    new RegExp(`^[\\s#*_>]*${nombre}[\\s:*_]*$`, "im");

  const iResumen = limpio.search(encabezado("RESUMEN"));
  const iVacios = limpio.search(encabezado("VAC[IÍ]OS"));
  const iConsejos = limpio.search(encabezado("CONSEJOS"));

  // Sin ningún encabezado reconocible, todo es el resumen.
  if (iVacios < 0 && iConsejos < 0) {
    return { cuerpo: quitarEncabezado(limpio), vacios: [], consejos: [] };
  }

  // El resumen llega hasta el PRIMERO de los otros dos encabezados, venga en
  // el orden que venga: tomar el primero del arreglo se comía una sección.
  const siguientes = [iVacios, iConsejos].filter((i) => i >= 0);
  const finResumen = siguientes.length ? Math.min(...siguientes) : limpio.length;
  const inicioResumen = iResumen >= 0 ? iResumen : 0;

  const cuerpo = quitarEncabezado(limpio.slice(inicioResumen, finResumen));

  let vacios: string[] = [];
  if (iVacios >= 0) {
    const fin = iConsejos > iVacios ? iConsejos : limpio.length;
    vacios = vinetas(quitarEncabezado(limpio.slice(iVacios, fin)));
  }

  let consejos: string[] = [];
  if (iConsejos >= 0) {
    const fin = iVacios > iConsejos ? iVacios : limpio.length;
    consejos = vinetas(quitarEncabezado(limpio.slice(iConsejos, fin)));
  }

  return { cuerpo, vacios, consejos };
}

function quitarEncabezado(bloque: string): string {
  return bloque
    .replace(/^[\s#*_>]*(RESUMEN|VAC[IÍ]OS|CONSEJOS)[\s:*_]*\n?/i, "")
    .trim();
}

function validarApunte(contenido: unknown): { ok: true; texto: string } | { ok: false; motivo: string } {
  if (typeof contenido !== "string") return { ok: false, motivo: "El apunte debe ser texto." };
  const texto = contenido.trim();
  if (texto.length < 40) {
    return { ok: false, motivo: "Escribe un poco más antes de pedir el resumen: con dos líneas no hay mucho que resumir." };
  }
  if (texto.length > LARGO_MAXIMO_APUNTE) {
    return { ok: false, motivo: "El apunte es demasiado largo para resumirlo de una vez. Divídelo por clase." };
  }
  return { ok: true, texto };
}
