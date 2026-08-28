// Cliente de la función `tutor`. Acá no hay ninguna regla del tutor: todas
// viven en el servidor, que es lo único que impide que se puedan evadir.

import { MODO_DEMO } from "./config.ts";
import { responderDemo } from "../dominio/tutor-demo.ts";
import { supabase, urlFuncion } from "./supabase.ts";

/** El guion del demo avanza entre llamadas; no hay servidor que lo recuerde. */
let pasoDemo = 0;

export type RespuestaTutor = { conversacionId: string; respuesta: string };

export async function preguntarAlTutor(entrada: {
  asignaturaId: string;
  mensaje: string;
  conversacionId?: string | null;
  contexto?: string | null;
}): Promise<RespuestaTutor> {
  if (MODO_DEMO) {
    const r = responderDemo(entrada.mensaje, pasoDemo);
    pasoDemo = r.paso;
    await new Promise((listo) => setTimeout(listo, 500));
    return { conversacionId: "demo", respuesta: r.texto };
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const respuesta = await fetch(urlFuncion("tutor"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      asignatura_id: entrada.asignaturaId,
      mensaje: entrada.mensaje,
      conversacion_id: entrada.conversacionId ?? undefined,
      contexto: entrada.contexto ?? undefined,
    }),
  });

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { conversacion_id?: string; respuesta?: string; error?: string }
    | null;

  if (!respuesta.ok || !cuerpo?.respuesta || !cuerpo.conversacion_id) {
    throw new Error(cuerpo?.error ?? "El tutor no está disponible en este momento.");
  }

  return { conversacionId: cuerpo.conversacion_id, respuesta: cuerpo.respuesta };
}
