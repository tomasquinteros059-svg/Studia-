// Manda el reporte de una respuesta de la IA.
//
// La fila la escribe el propio aparato con la sesión de quien reporta: la
// política de acceso solo deja escribir reportes a nombre de uno mismo, y
// leerlos es de la administración.

import { MODO_DEMO } from "./config.ts";
import { supabase } from "./supabase.ts";
import type { Reporte } from "../dominio/reportes.ts";

export async function reportar(reporte: Reporte): Promise<void> {
  if (MODO_DEMO) {
    // Sin servidor no hay dónde dejarlo. Se espera un momento para que el
    // botón no parpadee, y se dice que sí: en la demostración nadie está
    // esperando este aviso al otro lado.
    await new Promise((listo) => setTimeout(listo, 300));
    return;
  }

  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const { error } = await supabase.from("reportes").insert({
    persona_id: sesion.user.id,
    origen: reporte.origen,
    contenido: reporte.contenido,
    motivo: reporte.motivo,
    detalle: reporte.detalle ?? null,
  });

  if (error) throw new Error("No pude mandar el reporte. Inténtalo de nuevo.");
}
