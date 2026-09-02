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
const CLAVE_ANON = claveAnon();
const CLAVE_SERVICIO = claveServicio();

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
