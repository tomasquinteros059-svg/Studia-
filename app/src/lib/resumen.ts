// Cliente de la función `resumen`.

import { supabase, urlFuncion } from "./supabase.ts";

export type ResultadoResumen = {
  cuerpo: string;
  vacios: string[];
  consejos: string[];
  /** Si la clase tenía transcripción, el resumen cruza apuntes y lo dicho en sala. */
  conTranscripcion: boolean;
};

export async function pedirResumen(apunteId: string): Promise<ResultadoResumen> {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const respuesta = await fetch(urlFuncion("resumen"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ apunte_id: apunteId }),
  });

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { cuerpo?: string; vacios?: string[]; consejos?: string[]; con_transcripcion?: boolean; error?: string }
    | null;

  if (!respuesta.ok || typeof cuerpo?.cuerpo !== "string") {
    throw new Error(cuerpo?.error ?? "No pude generar el resumen.");
  }

  return {
    cuerpo: cuerpo.cuerpo,
    vacios: cuerpo.vacios ?? [],
    consejos: cuerpo.consejos ?? [],
    conTranscripcion: cuerpo.con_transcripcion ?? false,
  };
}
