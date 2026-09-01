// Borrar la cuenta.
//
// La llamada va a una función del servidor y no a `auth.admin` desde acá,
// porque borrar un usuario necesita la llave de servicio y esa llave no puede
// estar dentro de un APK que cualquiera puede abrir.

import { MODO_DEMO } from "./config.ts";
import { supabase, urlFuncion } from "./supabase.ts";

/** Lo que hay que escribir para confirmar. Lo comprueba también el servidor. */
export const PALABRA_PARA_BORRAR = "BORRAR";

/**
 * Borra la cuenta de quien está con la sesión abierta, y todo lo suyo.
 *
 * Cuando termina bien cierra la sesión, porque el token que quedaba en el
 * teléfono ya no corresponde a ninguna cuenta y dejarlo puesto produce
 * pantallas vacías sin explicación.
 */
export async function borrarMiCuenta(confirmacion: string): Promise<void> {
  if (MODO_DEMO) {
    throw new Error(
      "Esta es la versión de demostración: no hay cuenta que borrar. Los datos "
      + "de ejemplo se van al desinstalar la aplicación.",
    );
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  let respuesta: Response;
  try {
    respuesta = await fetch(urlFuncion("borrar-cuenta"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmacion }),
    });
  } catch {
    throw new Error("No pude conectar. Revisa tu internet.");
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { borrada?: boolean; error?: string }
    | null;

  if (!respuesta.ok || !cuerpo?.borrada) {
    throw new Error(cuerpo?.error ?? "No pude borrar la cuenta. Inténtalo de nuevo.");
  }

  // Si esto fallara, la cuenta ya no existe igual: no se avisa como error.
  await supabase.auth.signOut().catch(() => undefined);
}
