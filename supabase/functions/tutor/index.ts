// StudIA · función `tutor`
//
// La única puerta hacia Claude. Acá viven la clave de la API y la regla de no
// dar la respuesta; ninguna de las dos baja nunca al teléfono.

import Anthropic from "npm:@anthropic-ai/sdk@0.120.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

import { cabecerasCors, json } from "../_compartido/cors.ts";
import { claveAnon, claveServicio } from "../_compartido/entorno.ts";
import {
  historialParaClaude,
  MENSAJES_POR_MINUTO,
  normalizarTurnos,
  promptSistema,
  RESPUESTA_DE_RESPALDO,
  TURNOS_DE_CONTEXTO,
  validarMensaje,
} from "../_compartido/nucleo.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = claveAnon();
const CLAVE_SERVICIO = claveServicio();

const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

// Escribe los mensajes: es el único que puede poner palabras en boca del tutor.
const servicio = createClient(URL_SUPABASE, CLAVE_SERVICIO, {
  auth: { persistSession: false },
});

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405, origen);
  }

  // ---------------------------------------------------------- quién llama
  const autorizacion = req.headers.get("Authorization") ?? "";
  if (!autorizacion.startsWith("Bearer ")) {
    return json({ error: "Falta la sesión." }, 401, origen);
  }

  // Cliente con el token del estudiante: todo lo que lea pasa por las
  // políticas de acceso, así que no puede pedir un ramo en el que no está.
  const comoEstudiante = createClient(URL_SUPABASE, CLAVE_ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: sesion, error: errorSesion } = await comoEstudiante.auth.getUser();
  if (errorSesion || !sesion?.user) {
    return json({ error: "Sesión inválida o vencida." }, 401, origen);
  }
  const estudianteId = sesion.user.id;

  // ------------------------------------------------------------- entrada
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "El cuerpo no es JSON válido." }, 400, origen);
  }

  const validacion = validarMensaje(cuerpo.mensaje);
  if (!validacion.ok) {
    return json({ error: validacion.motivo }, 400, origen);
  }
  const asignaturaId = typeof cuerpo.asignatura_id === "string" ? cuerpo.asignatura_id : null;
  if (!asignaturaId) {
    return json({ error: "Falta la asignatura." }, 400, origen);
  }
  const contexto = typeof cuerpo.contexto === "string" ? cuerpo.contexto : null;

  // --------------------------------------------------------- límite de uso
  const desde = new Date(Date.now() - 60_000).toISOString();
  const { count: recientes } = await servicio
    .from("mensajes")
    .select("id, conversaciones!inner(estudiante_id)", { count: "exact", head: true })
    .eq("conversaciones.estudiante_id", estudianteId)
    .eq("rol", "estudiante")
    .gte("creado_en", desde);

  if ((recientes ?? 0) >= MENSAJES_POR_MINUTO) {
    return json(
      { error: "Vas muy rápido. Espera un momento y sigue con calma." },
      429,
      origen,
    );
  }

  // ------------------------------------------------------ la asignatura
  // Se lee con el token del estudiante a propósito: si no está inscrito, RLS
  // devuelve vacío y la petición muere acá.
  const { data: asignatura } = await comoEstudiante
    .from("asignaturas")
    .select("id, nombre, codigo, profesor, intro_tutor")
    .eq("id", asignaturaId)
    .maybeSingle();

  if (!asignatura) {
    return json({ error: "No estás inscrito en esa asignatura." }, 403, origen);
  }

  // ------------------------------------------------------ la conversación
  let conversacionId = typeof cuerpo.conversacion_id === "string" ? cuerpo.conversacion_id : null;

  if (conversacionId) {
    const { data: existente } = await servicio
      .from("conversaciones")
      .select("id")
      .eq("id", conversacionId)
      .eq("estudiante_id", estudianteId)
      .maybeSingle();
    if (!existente) {
      return json({ error: "Esa conversación no es tuya." }, 403, origen);
    }
  } else {
    const { data: nueva, error } = await servicio
      .from("conversaciones")
      .insert({ estudiante_id: estudianteId, asignatura_id: asignaturaId, contexto })
      .select("id")
      .single();
    if (error || !nueva) {
      return json({ error: "No pude abrir la conversación." }, 500, origen);
    }
    conversacionId = nueva.id;
  }

  const { data: previos } = await servicio
    .from("mensajes")
    .select("rol, contenido")
    .eq("conversacion_id", conversacionId)
    .order("creado_en", { ascending: true })
    .limit(TURNOS_DE_CONTEXTO);

  // -------------------------------------------------------------- Claude
  const turnos = normalizarTurnos([
    ...historialParaClaude(previos ?? []),
    { role: "user" as const, content: validacion.texto },
  ]);

  let respuesta = RESPUESTA_DE_RESPALDO;
  try {
    const salida = await claude.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024, // el tutor responde en dos o tres frases, a propósito
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: promptSistema(asignatura, contexto),
      messages: turnos,
    });

    if (salida.stop_reason === "refusal") {
      return json(
        { error: "No puedo ayudarte con eso. Volvamos al ramo: ¿en qué ejercicio estás?" },
        422,
        origen,
      );
    }

    const texto = salida.content
      .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("")
      .trim();

    if (texto) respuesta = texto;
  } catch (error) {
    // Si Claude falla, el estudiante igual recibe algo fiel a la regla.
    console.error("Falló la llamada a Claude:", error);
  }

  // -------------------------------------------------------------- guardar
  const { error: errorGuardar } = await servicio.from("mensajes").insert([
    { conversacion_id: conversacionId, rol: "estudiante", contenido: validacion.texto },
    { conversacion_id: conversacionId, rol: "tutor", contenido: respuesta },
  ]);
  if (errorGuardar) {
    console.error("No pude guardar los mensajes:", errorGuardar);
  }

  await servicio
    .from("conversaciones")
    .update({ actualizado_en: new Date().toISOString() })
    .eq("id", conversacionId);

  return json({ conversacion_id: conversacionId, respuesta }, 200, origen);
});
