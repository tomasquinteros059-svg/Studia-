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

import { cabecerasCors, json } from "../_compartido/cors.ts";
import { claveAnon, claveServicio } from "../_compartido/entorno.ts";
import {
  cuantasPedir, leerPreguntas, promptQuiz, suficientes,
} from "../_compartido/quiz-nucleo.ts";

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
