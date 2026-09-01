// StudIA · función "sala", en un solo archivo.
//
// Generado por herramientas/juntar-funciones.mjs para poder pegarla en el
// editor del panel de Supabase. No lo edites acá: lo que vale es
// supabase/functions/sala/index.ts, y este se rehace.

// StudIA · función `sala`
//
// Entrega el token para entrar al audio de una clase en vivo. La clave y el
// secreto de LiveKit viven acá; el teléfono solo recibe un token acotado a una
// sala y con permisos que no puede ampliarse a sí mismo.

import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
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

// ── de _compartido/sala-nucleo.ts ──────────────────────────────────────

// Credenciales de sala para el audio en vivo.
//
// Un token de LiveKit es un JWT firmado con HMAC-SHA256 y un permiso de vídeo
// adentro. Se arma acá, sin dependencias, para poder probarlo sin Deno ni
// LiveKit: lo que decide quién puede hablar no debería depender de una
// biblioteca que no se puede ejecutar en las pruebas.

type Papel = "estudiante" | "docente";

type PermisoSala = {
  sala: string;
  identidad: string;
  nombre: string;
  papel: Papel;
};

/** Cuánto vale un token. Corto: se pide otro al volver a entrar. */
const VIGENCIA_SEGUNDOS = 6 * 60 * 60;

/** El nombre de sala sale de la clase, nunca de lo que mande el cliente. */
function nombreDeSala(claseId: string): string {
  return `clase-${claseId}`;
}

type Reclamos = {
  iss: string;
  sub: string;
  name: string;
  nbf: number;
  exp: number;
  video: {
    room: string;
    roomJoin: true;
    canSubscribe: true;
    canPublish: boolean;
    canPublishData: true;
    roomAdmin: boolean;
  };
};

/**
 * El docente publica audio desde que entra; el estudiante entra escuchando y
 * solo puede publicar cuando el profesor le da la palabra, lo que implica pedir
 * otro token. Así, un estudiante no puede abrir su micrófono por su cuenta ni
 * modificando la app: el permiso no está en el token que tiene.
 */
function construirReclamos(
  permiso: PermisoSala,
  claveApi: string,
  ahoraSegundos: number,
  puedePublicar = permiso.papel === "docente",
): Reclamos {
  return {
    iss: claveApi,
    sub: permiso.identidad,
    name: permiso.nombre,
    nbf: ahoraSegundos,
    exp: ahoraSegundos + VIGENCIA_SEGUNDOS,
    video: {
      room: permiso.sala,
      roomJoin: true,
      canSubscribe: true,
      canPublish: puedePublicar,
      canPublishData: true,
      roomAdmin: permiso.papel === "docente",
    },
  };
}

function base64url(datos: Uint8Array | string): string {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : datos;
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Firma el JWT con HMAC-SHA256, que es lo que LiveKit espera. */
async function firmarToken(reclamos: Reclamos, secreto: string): Promise<string> {
  const cabecera = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(reclamos));
  const material = `${cabecera}.${cuerpo}`;

  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(material));

  return `${material}.${base64url(new Uint8Array(firma))}`;
}

/** Deshace el JWT sin verificar. Solo para pruebas y depuración. */
function leerReclamos(token: string): Reclamos {
  const parte = token.split(".")[1];
  if (!parte) throw new Error("El token no tiene cuerpo.");

  const relleno = parte.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(relleno + "=".repeat((4 - (relleno.length % 4)) % 4));

  // `atob` devuelve bytes, no texto: sin decodificar el UTF-8 explícitamente,
  // un nombre con acentos vuelve roto.
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
