// Entrar con una cuenta que la persona ya tiene.
//
// Casi nadie quiere inventar otra contraseña, y en un colegio la cuenta ya
// existe: es la de Google o la de Microsoft con que revisan su correo. Que
// entren con esa es menos fricción y, de paso, menos contraseñas nuestras
// que cuidar.
//
// Acá vive solo lo que se puede razonar sin red: qué proveedores hay, cómo
// se traduce una falla y cómo se leen los datos que vuelven. Abrir el
// navegador y hablar con el servidor es cosa de `lib/proveedores.ts`.

/** Los que ofrece la portada, en el orden en que se muestran. */
export const PROVEEDORES = [
  // Supabase llama "azure" al de Microsoft, aunque la gente lo conozca por
  // Outlook o por la cuenta del colegio.
  { id: "google", nombre: "Google", marca: "G" },
  { id: "azure", nombre: "Microsoft", marca: "M" },
] as const;

export type Proveedor = (typeof PROVEEDORES)[number]["id"];

export const nombreDe = (id: Proveedor): string =>
  PROVEEDORES.find((p) => p.id === id)?.nombre ?? id;

/**
 * Traduce la falla al idioma de quien la lee.
 *
 * La que más se va a ver mientras esto se pone en marcha es la de un
 * proveedor sin configurar en el servidor. Decir "Unsupported provider" a
 * alguien que solo quería entrar es dejarlo sin saber si el error es suyo.
 */
export function motivoDeFalla(id: Proveedor, mensaje: string): string {
  const m = mensaje.toLowerCase();
  const nombre = nombreDe(id);

  if (m.includes("not enabled") || m.includes("unsupported provider")) {
    return `Entrar con ${nombre} todavía no está habilitado en el servidor. `
      + "Por ahora entra con tu correo.";
  }
  if (m.includes("cancel") || m.includes("dismiss")) return "";
  if (m.includes("network") || m.includes("fetch")) {
    return "No pude conectar. Revisa tu internet.";
  }
  return `No pude entrar con ${nombre}. Intenta con tu correo.`;
}

export type Vuelta = { access_token: string; refresh_token: string };

/**
 * Lee los datos de sesión que vuelven pegados a la dirección de retorno.
 *
 * Vienen en el fragmento —después del `#`— y no en la consulta, que es lo
 * que hace que no queden en el historial del servidor. Algunos proveedores
 * los devuelven en la consulta igual, así que se miran los dos lados.
 *
 * Devuelve null si no vienen los dos: media sesión no sirve de nada, y
 * dejarla a medias sería peor que no entrar.
 */
export function sesionDesdeUrl(url: string): Vuelta | null {
  const partes = new Map<string, string>();
  for (const trozo of [url.split("#")[1], url.split("#")[0]?.split("?")[1]]) {
    if (!trozo) continue;
    for (const par of trozo.split("&")) {
      const [k, v] = par.split("=");
      if (k && v && !partes.has(k)) partes.set(k, decodeURIComponent(v));
    }
  }
  const access_token = partes.get("access_token");
  const refresh_token = partes.get("refresh_token");
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}
