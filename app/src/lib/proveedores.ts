// Entrar con Google o con Microsoft, en el navegador y en el teléfono.
//
// Son dos caminos distintos y no hay manera de que sean uno solo:
//
//   En el navegador la página se va al proveedor y vuelve sola. Supabase se
//   encarga entero; acá no hay nada que esperar.
//
//   En el teléfono no hay a dónde volver: hay que abrir el navegador del
//   sistema, esperar a que termine y leer los datos que vienen pegados a la
//   dirección de retorno. Eso último es lo que hace `sesionDesdeUrl`, que
//   vive en el dominio y se prueba sin abrir nada.
//
// Lo que NO se puede comprobar desde acá: que el proveedor esté configurado
// en el servidor. Eso se activa en el panel de Supabase, con el identificador
// y el secreto que da Google o Microsoft. Mientras no lo esté, el servidor
// responde que no y la portada lo dice con todas sus letras en vez de quedar
// en silencio.

import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase.ts";
import { motivoDeFalla, sesionDesdeUrl, type Proveedor } from "../dominio/acceso-proveedores.ts";

/** Vacío significa que salió bien, o que la persona canceló a propósito. */
export type Resultado = { ok: true } | { ok: false; motivo: string };

export async function entrarCon(proveedor: Proveedor): Promise<Resultado> {
  try {
    return Platform.OS === "web"
      ? await enElNavegador(proveedor)
      : await enElTelefono(proveedor);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    return { ok: false, motivo: motivoDeFalla(proveedor, mensaje) };
  }
}

async function enElNavegador(proveedor: Proveedor): Promise<Resultado> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: proveedor,
    // Vuelve a la misma dirección desde donde salió: así funciona igual en
    // el sitio publicado y en el servidor de desarrollo, sin configurar una
    // dirección fija que después no calce.
    options: { redirectTo: globalThis.location?.origin },
  });
  if (error) return { ok: false, motivo: motivoDeFalla(proveedor, error.message) };
  // La página se está yendo al proveedor: no hay nada más que hacer acá.
  return { ok: true };
}

async function enElTelefono(proveedor: Proveedor): Promise<Resultado> {
  const volverA = Linking.createURL("/entrar");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: proveedor,
    // Sin esto, supabase-js intentaría navegar la ventana, que en el
    // teléfono no existe. Lo que se quiere es la dirección para abrirla.
    options: { redirectTo: volverA, skipBrowserRedirect: true },
  });
  if (error) return { ok: false, motivo: motivoDeFalla(proveedor, error.message) };
  if (!data?.url) return { ok: false, motivo: motivoDeFalla(proveedor, "sin dirección") };

  const vuelta = await WebBrowser.openAuthSessionAsync(data.url, volverA);
  // Cancelar no es un error: es alguien que se arrepintió.
  if (vuelta.type !== "success") return { ok: false, motivo: "" };

  const sesion = sesionDesdeUrl(vuelta.url);
  if (!sesion) return { ok: false, motivo: motivoDeFalla(proveedor, "vuelta sin sesión") };

  const { error: fallaSesion } = await supabase.auth.setSession(sesion);
  if (fallaSesion) return { ok: false, motivo: motivoDeFalla(proveedor, fallaSesion.message) };
  return { ok: true };
}
