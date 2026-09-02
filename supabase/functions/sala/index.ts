// StudIA · función `sala`
//
// Entrega el token para entrar al audio de una clase en vivo. La clave y el
// secreto de LiveKit viven acá; el teléfono solo recibe un token acotado a una
// sala y con permisos que no puede ampliarse a sí mismo.

import { createClient } from "npm:@supabase/supabase-js@2.58.0";

import { cabecerasCors, json } from "../_compartido/cors.ts";
import { claveAnon } from "../_compartido/entorno.ts";
import {
  construirReclamos, firmarToken, nombreDeSala, type Papel,
} from "../_compartido/sala-nucleo.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = claveAnon();
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") ?? "";
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") ?? "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") ?? "";

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origen);

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return json(
      { error: "El audio en vivo todavía no está configurado en el servidor." },
      503, origen,
    );
  }

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

  const claseId = typeof cuerpo.clase_id === "string" ? cuerpo.clase_id : null;
  if (!claseId) return json({ error: "Falta la clase." }, 400, origen);

  // La clase se lee con el token del estudiante: si no está inscrito en ese
  // ramo, las políticas devuelven vacío y no hay token que entregar.
  const { data: clase } = await comoEstudiante
    .from("clases")
    .select("id, titulo, estado, asignatura_id")
    .eq("id", claseId)
    .maybeSingle();

  if (!clase) return json({ error: "No estás inscrito en esa clase." }, 403, origen);
  if (clase.estado !== "en_vivo") {
    return json({ error: "Esa clase no está en vivo." }, 409, origen);
  }

  const { data: perfil } = await comoEstudiante
    .from("perfiles").select("nombre").eq("id", sesion.user.id).maybeSingle();

  // Hoy solo hay estudiantes con cuenta; el papel queda listo para cuando el
  // panel docente exista (ver documentacion/arquitectura.md, simplificaciones).
  const papel: Papel = "estudiante";

  const token = await firmarToken(
    construirReclamos(
      {
        sala: nombreDeSala(clase.id),
        identidad: sesion.user.id,
        nombre: perfil?.nombre ?? "Estudiante",
        papel,
      },
      LIVEKIT_API_KEY,
      Math.floor(Date.now() / 1000),
    ),
    LIVEKIT_API_SECRET,
  );

  return json(
    { url: LIVEKIT_URL, token, sala: nombreDeSala(clase.id), titulo: clase.titulo, papel },
    200, origen,
  );
});
