// El quiz, del lado de quien lo responde.
//
// Las preguntas las escribe el evaluador y las guarda la base; acá vive lo
// que pasa después: en cuál vas, cuántas llevas buenas, y qué se te dice al
// terminar. Nada de eso toca la red, así que se prueba solo.
//
// Una decisión que ordena todo lo demás: una respuesta se guarda apenas se
// da, y el quiz se puede dejar a medias. Por eso `respuestas` es un arreglo
// con huecos —null en las que no se contestaron— y no una lista que crece.
// Alguien que responde tres preguntas, cierra la aplicación y vuelve al día
// siguiente tiene que encontrar el quiz donde lo dejó.

export type Pregunta = {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
};

/** Lo elegido en cada pregunta, o null en las que todavía no se contestan. */
export type Respuestas = (number | null)[];

export const LETRAS = ["A", "B", "C", "D"] as const;

/**
 * Las respuestas guardadas, llevadas al largo de las preguntas.
 *
 * La base guarda lo que se mandó, que puede ser más corto —un quiz a medias—
 * y en teoría más largo si algo salió mal. Acá se empareja de una vez para
 * que ninguna pantalla tenga que preguntarse si el índice existe.
 */
export function acomodar(respuestas: unknown, cuantas: number): Respuestas {
  const crudo = Array.isArray(respuestas) ? respuestas : [];
  return Array.from({ length: cuantas }, (_, i) => {
    const v = crudo[i];
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 3 ? v : null;
  });
}

/** En qué pregunta va: la primera sin contestar, o el final si ya están todas. */
export function enQueVoy(respuestas: Respuestas): number {
  const i = respuestas.findIndex((r) => r === null);
  return i === -1 ? respuestas.length : i;
}

export const cuantasRespondidas = (respuestas: Respuestas): number =>
  respuestas.filter((r) => r !== null).length;

/** Cuánto se lleva del quiz, de 0 a 1. Para la barra de arriba. */
export function avance(respuestas: Respuestas): number {
  if (respuestas.length === 0) return 0;
  return cuantasRespondidas(respuestas) / respuestas.length;
}

export const estaTerminado = (respuestas: Respuestas): boolean =>
  respuestas.length > 0 && respuestas.every((r) => r !== null);

// ── Cómo te fue ───────────────────────────────────────────────────────────

export type Revision = {
  correctas: number;
  total: number;
  detalle: { pregunta: string; acerto: boolean }[];
};

export function revisar(preguntas: readonly Pregunta[], respuestas: Respuestas): Revision {
  const detalle = preguntas.map((p, i) => ({
    pregunta: p.pregunta,
    acerto: respuestas[i] === p.correcta,
  }));
  return {
    correctas: detalle.filter((d) => d.acerto).length,
    total: preguntas.length,
    detalle,
  };
}

export type Veredicto = { titulo: string; mensaje: string };

/**
 * Lo que se le dice a alguien al terminar.
 *
 * El caso de abajo es el que importa y es el que casi siempre se escribe mal.
 * Alguien que sacó una de cinco ya sabe que le fue mal: decírselo otra vez no
 * agrega nada, y decirle «¡buen intento!» es peor, porque es falso y se nota.
 * Lo único útil es que el próximo paso esté ahí mismo y no suene a castigo.
 */
export function comoTeFue(correctas: number, total: number): Veredicto {
  if (total === 0) return { titulo: "Sin preguntas", mensaje: "Este quiz quedó vacío." };

  if (correctas === total) {
    return {
      titulo: "Perfecto",
      mensaje: "Este tema lo tienes. Puedes pasar al siguiente sin deuda pendiente.",
    };
  }
  if (correctas * 2 >= total) {
    const faltan = total - correctas;
    return {
      titulo: "Vas bien",
      mensaje: `Sólido, pero ${faltan === 1 ? "quedó una" : `quedaron ${faltan}`} para repasar. `
        + "Están marcadas abajo: empieza por ahí.",
    };
  }
  return {
    titulo: "Todavía no, y está bien",
    mensaje: "Este tema necesita otra pasada. Justo para eso es el quiz: para "
      + "descubrirlo ahora y no en la prueba. El tutor te lo explica desde el principio.",
  };
}

/**
 * Cómo se pinta cada alternativa una vez contestada.
 *
 * La correcta se marca siempre, se haya elegido o no: si alguien se equivocó,
 * lo que necesita saber no es que se equivocó —eso ya lo sabe— sino cuál era.
 */
export type Pinta = "correcta" | "equivocada" | "apagada" | "sinResponder";

export function pintaDe(
  indice: number, correcta: number, elegida: number | null,
): Pinta {
  if (elegida === null) return "sinResponder";
  if (indice === correcta) return "correcta";
  if (indice === elegida) return "equivocada";
  return "apagada";
}
