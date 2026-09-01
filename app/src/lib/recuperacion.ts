// Abrir la sesión que viene dentro del enlace del correo.
//
// Separado del dominio porque acá sí se toca el servidor. Lo que se puede
// probar sin red —qué trae el enlace— está en `dominio/recuperacion.ts`.

import { supabase } from "./supabase.ts";

/**
 * Deja la sesión abierta con los tokens del enlace.
 *
 * Devuelve el mensaje del problema, o null si quedó abierta. Falla cuando el
 * enlace ya se usó: los tokens vienen bien formados y el servidor los rechaza,
 * cosa que solo se sabe preguntándole.
 */
export async function abrirConEnlace(acceso: string, refresco: string): Promise<string | null> {
  try {
    const { error } = await supabase.auth.setSession({
      access_token: acceso,
      refresh_token: refresco,
    });
    if (!error) return null;
    return "Este enlace ya no sirve. Pide uno nuevo desde la pantalla de entrada.";
  } catch {
    return "No pude conectar. Revisa tu internet y vuelve a abrir el enlace.";
  }
}
