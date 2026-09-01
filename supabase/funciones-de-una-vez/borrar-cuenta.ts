// StudIA · función "borrar-cuenta", en un solo archivo.
//
// Generado por herramientas/juntar-funciones.mjs para poder pegarla en el
// editor del panel de Supabase. No lo edites acá: lo que vale es
// supabase/functions/borrar-cuenta/index.ts, y este se rehace.

// StudIA · función `borrar-cuenta`
//
// Borra la cuenta de quien la pide, y con ella todo lo suyo.
//
// Existe por dos razones y las dos pesan. La primera es que Play Store lo
// exige desde 2024 a toda aplicación con registro: si no hay un camino dentro
// de la app para borrar la cuenta, la aplicación se rechaza. La segunda es que
// la política de privacidad de StudIA lo promete, y una promesa que no se
// puede cumplir con un botón no es una promesa.
//
// Tiene que vivir en el servidor porque borrar un usuario de `auth.users`
// necesita la llave de servicio, y esa llave no puede estar dentro de un APK
// que cualquiera puede abrir. Acá sí: las funciones la reciben del entorno.
//
// El borrado en cascada hace el resto. `perfiles.id` referencia a
// `auth.users(id) on delete cascade`, y de `perfiles` cuelgan con la misma
// regla los apuntes, las notas, las entregas, las conversaciones con el tutor,
// los quizzes, las fichas y lo oído en clase. Lo que NO se borra es lo
// publicado en el foro: ahí el autor queda en nulo —`on delete set null`— y el
// texto se mantiene, porque es parte de una conversación de otras personas.
// Eso es exactamente lo que dice la política de privacidad.

import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Lo que hay que escribir para confirmar.
 *
 * Un botón rojo con un «¿seguro?» se aprieta sin leer. Escribir la palabra
 * obliga a detenerse un segundo, que es todo lo que hace falta para que esto
 * no le pase a nadie sin querer. Va acá además de en la pantalla: si estuviera
 * solo en la pantalla, cualquiera podría llamar a la función sin ella.
 */
const PALABRA = "BORRAR";

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origen);

  if (!CLAVE_SERVICIO) {
    return json({ error: "El borrado de cuentas no está configurado en el servidor." }, 503, origen);
  }

  const autorizacion = req.headers.get("Authorization") ?? "";
  if (!autorizacion.startsWith("Bearer ")) return json({ error: "Falta la sesión." }, 401, origen);

  // Quién pide el borrado sale de su propio token y de ninguna otra parte. Si
  // el identificador viniera en el cuerpo, cualquiera con una sesión podría
  // borrar la cuenta de otro escribiendo otro identificador.
  const comoQuienPide = createClient(URL_SUPABASE, CLAVE_ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: sesion, error: errorSesion } = await comoQuienPide.auth.getUser();
  if (errorSesion || !sesion?.user) return json({ error: "Sesión inválida o vencida." }, 401, origen);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "El cuerpo no es JSON válido." }, 400, origen);
  }

  if (typeof cuerpo.confirmacion !== "string" || cuerpo.confirmacion.trim().toUpperCase() !== PALABRA) {
    return json({ error: `Para borrar la cuenta hay que escribir ${PALABRA}.` }, 400, origen);
  }

  const conServicio = createClient(URL_SUPABASE, CLAVE_SERVICIO, {
    auth: { persistSession: false },
  });

  const { error } = await conServicio.auth.admin.deleteUser(sesion.user.id);
  if (error) {
    console.error("no se pudo borrar la cuenta", error.message);
    return json({ error: "No pude borrar la cuenta. Inténtalo de nuevo o escríbenos." }, 500, origen);
  }

  return json({ borrada: true }, 200, origen);
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
