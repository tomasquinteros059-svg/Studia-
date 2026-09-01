// Cliente de la función `asistente`.
//
// Es el reverso de lib/tutor.ts, y por el mismo motivo: acá no hay ninguna
// regla del asistente. Quién puede preguntarle, cuántas veces por minuto y con
// qué datos, todo vive en el servidor. Lo único que hace este archivo es
// mandar la pregunta y traer la respuesta.
//
// La diferencia con el tutor está en los datos. El tutor recibe el ramo por
// parámetro; el asistente no recibe nada: la función va a buscar sola los
// ramos de quien pregunta, con el token de esa persona, así que las políticas
// de acceso se aplican igual que en cualquier otra consulta. Mandar los datos
// desde el teléfono habría sido más rápido y habría significado creerle al
// cliente cuando dice de qué curso es profesor.

import { MODO_DEMO } from "./config.ts";
import { responder, type CursoParaElAsistente, type Respuesta } from "../dominio/asistente-demo.ts";
import { supabase, urlFuncion } from "./supabase.ts";

/** Un turno de la conversación, como los espera Claude. */
export type Turno = { role: "user" | "assistant"; content: string };

/**
 * Cuántos turnos anteriores viajan. El servidor recorta igual —no le cree al
 * cliente—, pero mandar la conversación entera de una tarde sería pagar por
 * releerla en cada pregunta.
 */
export const TURNOS_QUE_VIAJAN = 20;

export async function preguntarAlAsistente(entrada: {
  pregunta: string;
  turnos: Turno[];
  /** Solo para la demostración: conectado, los datos los busca el servidor. */
  cursos: CursoParaElAsistente[];
}): Promise<Respuesta> {
  if (MODO_DEMO) {
    // El demo contesta al tiro; la espera es para que se vea que pensó.
    await new Promise((listo) => setTimeout(listo, 350));
    return responder(entrada.pregunta, entrada.cursos);
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const respuesta = await fetch(urlFuncion("asistente"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      pregunta: entrada.pregunta,
      turnos: entrada.turnos.slice(-TURNOS_QUE_VIAJAN),
    }),
  });

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { respuesta?: string; error?: string }
    | null;

  if (!respuesta.ok || !cuerpo?.respuesta) {
    throw new Error(cuerpo?.error ?? "El asistente no está disponible en este momento.");
  }

  // Las filas —la lista de nombres bajo la respuesta— son cosa del demo, que
  // sabe qué está contestando. Claude contesta en prosa y ahí no hay lista que
  // separar.
  return { texto: cuerpo.respuesta, filas: [], intencion: null };
}
