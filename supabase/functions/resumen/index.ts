// StudIA · función `resumen`
//
// Toma los apuntes de una clase y devuelve un resumen, los temas del ramo que
// el apunte no menciona, y consejos para estudiar ese contenido.
//
// La regla del tutor sigue en pie: resumir lo que el estudiante escribió está
// permitido; terminarle un ejercicio a medias, no.

import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

import { cabecerasCors, json } from "../_compartido/cors.ts";
import { claveAnon, claveServicio } from "../_compartido/entorno.ts";
import {
  partirRespuesta, promptResumen, validarApunte,
} from "../_compartido/resumen-nucleo.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = claveAnon();
const CLAVE_SERVICIO = claveServicio();

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
