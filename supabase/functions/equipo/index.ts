// Función `equipo`
//
// Corre el equipo de tres sobre una reunión y guarda lo que sale.
//
//   escucha   ordena la transcripción y separa quién habló
//   redacta   arma el documento que corresponde al rubro
//   entiende  saca la conclusión: qué se hizo, qué falta, qué hay que hacer
//
// Los tres corren con la instrucción del rubro de la reunión. La reunión se
// lee con el token de quien pide, así que si no es suya, no la ve.

import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

import { cabecerasCors, json } from "../_compartido/cors.ts";
import {
  ESQUEMA_ANALISIS, leerAnalisis, promptEntiende, promptEscucha, promptRedacta,
  validarTranscripcion, type Analisis, type Reunion,
} from "../_compartido/equipo-nucleo.ts";
import { EQUIPOS, type Rubro } from "../_compartido/rubros-generado.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
const servicio = createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });

/** Analizar una reunión larga cuesta. Sin tope, un botón trabado es una cuenta. */
const ANALISIS_POR_HORA = 30;

const MODELO = "claude-opus-5";
const COMUNES = {
  model: MODELO,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
} as const;

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origen);

  const autorizacion = req.headers.get("Authorization") ?? "";
  if (!autorizacion.startsWith("Bearer ")) return json({ error: "Falta la sesión." }, 401, origen);

  const comoQuienPide = createClient(URL_SUPABASE, CLAVE_ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: sesion, error: errorSesion } = await comoQuienPide.auth.getUser();
  if (errorSesion || !sesion?.user) return json({ error: "Sesión inválida o vencida." }, 401, origen);

  let cuerpo: { reunion_id?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "El cuerpo no es JSON válido." }, 400, origen);
  }

  const reunionId = typeof cuerpo.reunion_id === "string" ? cuerpo.reunion_id : null;
  if (!reunionId) return json({ error: "Falta la reunión." }, 400, origen);

  // -------------------------------------------------------- límite de uso
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recientes } = await servicio
    .from("usos_equipo")
    .select("id", { count: "exact", head: true })
    .eq("persona_id", sesion.user.id)
    .gte("creado_en", desde);

  if ((recientes ?? 0) >= ANALISIS_POR_HORA) {
    return json({ error: "Analizaste muchas reuniones seguidas. Prueba en un rato." }, 429, origen);
  }

  // ----------------------------------------------------------- la reunión
  // Con el token de quien pide: una reunión ajena no aparece.
  const { data: reunion } = await comoQuienPide
    .from("reuniones")
    .select("id, titulo, rubro, ocurrio_en, participantes, tabla, transcripcion")
    .eq("id", reunionId)
    .maybeSingle();

  if (!reunion) return json({ error: "No encontré esa reunión." }, 404, origen);

  const validacion = validarTranscripcion(reunion.transcripcion);
  if (!validacion.ok) return json({ error: validacion.motivo }, 400, origen);

  const equipo = EQUIPOS[reunion.rubro as Rubro] as (typeof EQUIPOS)[Rubro] | undefined;
  if (!equipo) return json({ error: "Esa reunión no tiene un rubro que yo conozca." }, 400, origen);

  const contexto: Reunion = {
    titulo: reunion.titulo,
    rubro: equipo.nombre,
    fecha: String(reunion.ocurrio_en).slice(0, 10),
    participantes: Array.isArray(reunion.participantes) ? reunion.participantes.map(String) : [],
    tabla: Array.isArray(reunion.tabla) ? reunion.tabla.map(String) : [],
  };

  await servicio.from("usos_equipo").insert({ persona_id: sesion.user.id });
  await servicio.from("reuniones").update({ estado: "analizando" }).eq("id", reunionId);

  try {
    // 1 · escucha ------------------------------------------------------
    const transcripcion = await texto(
      promptEscucha(equipo.escucha, contexto),
      validacion.texto,
      8192,
    );

    // 2 · redacta ------------------------------------------------------
    const documento = await texto(
      promptRedacta(equipo.redacta, contexto, transcripcion),
      "Redacta el documento de esta reunión.",
      8192,
    );

    // 3 · entiende -----------------------------------------------------
    const analisis = await analizar(
      promptEntiende(equipo.entiende, contexto, documento),
    );

    await servicio.from("reuniones").update({
      estado: "listo",
      transcripcion_limpia: transcripcion,
      documento,
      analizada_en: new Date().toISOString(),
    }).eq("id", reunionId);

    await guardarAnalisis(reunionId, analisis);

    return json({ documento, analisis }, 200, origen);
  } catch (e) {
    await servicio.from("reuniones").update({ estado: "falló" }).eq("id", reunionId);
    console.error("equipo:", e);
    return json(
      { error: "No pude analizar la reunión. La transcripción quedó guardada; puedes reintentar." },
      502, origen,
    );
  }
});

/** Un turno de texto normal. */
async function texto(sistema: string, entrada: string, maximo: number): Promise<string> {
  const salida = await claude.beta.messages.create({
    ...COMUNES,
    max_tokens: maximo,
    thinking: { type: "adaptive" },
    system: sistema,
    messages: [{ role: "user", content: entrada }],
  });
  return salida.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * El análisis se pide con una herramienta y no en prosa: así el modelo tiene
 * que respetar el esquema, y las tareas llegan como tareas y no como viñetas
 * que después habría que adivinar.
 */
async function analizar(sistema: string): Promise<Analisis> {
  const salida = await claude.beta.messages.create({
    ...COMUNES,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: sistema,
    tools: [{
      name: "entregar_analisis",
      description: "Entrega el análisis de la reunión.",
      input_schema: ESQUEMA_ANALISIS as unknown as Anthropic.Tool.InputSchema,
    }],
    tool_choice: { type: "tool", name: "entregar_analisis" },
    messages: [{ role: "user", content: "Analiza esta reunión." }],
  });

  const uso = salida.content.find((b) => b.type === "tool_use");
  return leerAnalisis(uso && "input" in uso ? uso.input : null);
}

/** Las tareas y los acuerdos se rehacen enteros: es el resultado de este análisis. */
async function guardarAnalisis(reunionId: string, a: Analisis): Promise<void> {
  await servicio.from("analisis").delete().eq("reunion_id", reunionId);
  await servicio.from("tareas_reunion").delete().eq("reunion_id", reunionId).eq("lista", false);

  await servicio.from("analisis").insert({
    reunion_id: reunionId,
    resumen: a.resumen,
    acuerdos: a.acuerdos,
    pendientes: a.pendientes,
    sin_tratar: a.sinTratar,
    aportes: a.aportes,
    contradicciones: a.contradicciones,
  });

  if (a.tareas.length > 0) {
    await servicio.from("tareas_reunion").insert(a.tareas.map((t) => ({
      reunion_id: reunionId,
      que: t.que,
      responsable: t.responsable,
      plazo: t.plazo,
      prioridad: t.prioridad,
      acuerdo: t.acuerdo,
    })));
  }
}
