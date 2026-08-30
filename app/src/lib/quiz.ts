// Pedir un quiz. La generación pasa por la función `quiz`, igual que el
// tutor y el resumen: la clave de Anthropic no puede vivir en el teléfono.

import { MODO_DEMO } from "./config.ts";
import { supabase, urlFuncion } from "./supabase.ts";
import { quizDemo } from "./quiz-demo.ts";
import { generarFichasDemo } from "./fichas-demo.ts";
import type { Ficha, Quiz } from "./tipos.ts";

/**
 * Pedir preguntas de un tema.
 *
 * `tema` y `asignaturaId` van solo para la demostración, que no tiene base
 * donde consultarlos. El servidor los ignora: lee el título y el ramo del
 * módulo con el token de quien pregunta, así que lo que mande el cliente da
 * lo mismo y no hay forma de pedir un quiz de un ramo ajeno.
 */
export async function generarQuiz(entrada: {
  moduloId: string;
  asignaturaId: string;
  tema: string;
  cuantas?: number;
}): Promise<Quiz> {
  const { moduloId, cuantas = 5 } = entrada;

  if (MODO_DEMO) {
    await new Promise<void>((listo) => setTimeout(listo, 900));
    return quizDemo({ asignaturaId: entrada.asignaturaId, tema: entrada.tema, cuantas });
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const respuesta = await fetch(urlFuncion("quiz"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ modulo_id: moduloId, cuantas }),
  });

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { quiz?: Quiz; error?: string }
    | null;

  if (!respuesta.ok || !cuerpo?.quiz) {
    throw new Error(cuerpo?.error ?? "El evaluador no está disponible en este momento.");
  }

  return cuerpo.quiz;
}

/**
 * Pedir un mazo de fichas de un tema. Reemplaza el que hubiera de ese mismo
 * tema: pedirlas de nuevo es querer otras, no querer el doble.
 */
export async function generarFichas(entrada: {
  moduloId: string;
  asignaturaId: string;
  tema: string;
}): Promise<Ficha[]> {
  if (MODO_DEMO) {
    await new Promise<void>((listo) => setTimeout(listo, 900));
    return generarFichasDemo(entrada.asignaturaId, entrada.tema);
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const respuesta = await fetch(urlFuncion("fichas"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ modulo_id: entrada.moduloId }),
  });

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { fichas?: Ficha[]; error?: string }
    | null;

  if (!respuesta.ok || !cuerpo?.fichas) {
    throw new Error(cuerpo?.error ?? "El evaluador no está disponible en este momento.");
  }
  return cuerpo.fichas;
}
