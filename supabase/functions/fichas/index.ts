// StudIA · función `fichas`
//
// Prepara fichas de repaso sobre un módulo del ramo: pregunta corta, respuesta
// corta, para responder de memoria.
//
// Es hermana de `quiz` y comparte con ella el núcleo y las dos reglas que
// importan: una ficha mal formada se descarta antes de guardarla —una sin
// respuesta no es media ficha— y lo que resulte no es de nadie más. Lo que
// cambia es para qué sirven: un quiz se responde una vez y dice cómo vas; una
// ficha vuelve, y vuelve más seguido justamente la que fallaste.
//
// El material se lee con el token de quien pregunta, así que las políticas de
// acceso deciden de qué ramos se puede pedir un quiz. Un prompt se da vuelta
// con insistencia; una política de la base, no.

import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

import { cabecerasCors, json } from "../_compartido/cors.ts";
import { claveAnon, claveServicio } from "../_compartido/entorno.ts";
import {
  CUANTAS_FICHAS, leerFichas, promptFichas, suficientesFichas,
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
      system: promptFichas({
        asignatura: asignatura.nombre,
        codigo: asignatura.codigo,
        tema: modulo.titulo,
        materiales: ordenados.map((m) => m.titulo),
        texto: ordenados.map((m) => m.texto ?? "").filter(Boolean).join("\n\n"),
        cuantas: CUANTAS_FICHAS,
      }),
      messages: [{ role: "user", content: `Prepárame fichas de «${modulo.titulo}».` }],
    });

    if (respuesta.stop_reason === "refusal") {
      return json({ error: "No pude preparar fichas de este material." }, 422, origen);
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

  const fichas = leerFichas(salidaTexto);
  if (!suficientesFichas(fichas)) {
    // Un mazo de dos fichas no es un mazo.
    return json(
      { error: "No me quedaron suficientes fichas buenas. Inténtalo otra vez." },
      503, origen,
    );
  }

  // Con la clave de servicio: el estudiante no tiene `insert` en la tabla, y
  // ese es justamente el punto —si pudiera escribir sus propias preguntas, el
  // puntaje no diría nada.
  // Se reemplaza el mazo anterior de ese tema: pedir fichas de nuevo es
  // querer otras, no querer el doble. El historial de las viejas se va con
  // ellas, que es lo correcto —son otras preguntas.
  await servicio
    .from("fichas")
    .delete()
    .eq("estudiante_id", sesion.user.id)
    .eq("asignatura_id", asignatura.id)
    .eq("tema", modulo.titulo);

  const { data: guardadas, error: errorGuardar } = await servicio
    .from("fichas")
    .insert(fichas.map((f) => ({
      estudiante_id: sesion.user.id,
      asignatura_id: asignatura.id,
      tema: modulo.titulo,
      pregunta: f.pregunta,
      respuesta: f.respuesta,
    })))
    .select("id, tema, pregunta, respuesta, aciertos, fallos, vuelve_en");

  if (errorGuardar || !guardadas) {
    console.error("No pude guardar las fichas:", errorGuardar);
    return json({ error: "Preparé las fichas pero no pude guardarlas." }, 500, origen);
  }

  return json({ fichas: guardadas }, 200, origen);
});
