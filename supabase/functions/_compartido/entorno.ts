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
export function delEntorno(...nombres: string[]): string {
  for (const nombre of nombres) {
    const valor = Deno.env.get(nombre)?.trim();
    if (valor) return valor;
  }
  return "";
}

/** La clave pública, la que lleva la aplicación. */
export function claveAnon(): string {
  return delEntorno("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
}

/** La clave que se salta las políticas de acceso. No sale de acá adentro. */
export function claveServicio(): string {
  return delEntorno("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

/**
 * Todas las claves de servicio que el proyecto tenga puestas.
 *
 * Para comparar contra lo que llega en una cabecera: quien llama pudo mandar
 * cualquiera de las dos, y son igual de válidas.
 */
export function clavesDeServicio(): string[] {
  return ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]
    .map((n) => Deno.env.get(n)?.trim())
    .filter((v): v is string => Boolean(v));
}
