// El registro del curso: todas las evaluaciones, todas las notas, y cuánto
// pesa cada una.
//
// Es la vista que un profesor tiene en su libro antes de subir nada: la tabla
// completa, para mirar de una vez cómo va cada alumno y decidir si algo hay
// que ajustar. Distinto de mirar una evaluación a la vez, que es lo que había:
// evaluación por evaluación se ve el promedio de la prueba, pero no se ve
// quién viene arrastrando un problema desde marzo.
//
// Todo lo de acá es aritmética sobre lo que ya se cargó, así que se prueba sin
// red y sin pantalla.

import { NOTA_APROBACION } from "./notas.ts";

export type Evaluacion = { id: string; titulo: string; peso: number; orden: number };

export type NotaPuesta = {
  evaluacion_id: string;
  estudiante_id: string;
  estudiante: string;
  nota: number | null;
  publicada: boolean;
};

// ── Las ponderaciones ─────────────────────────────────────────────────────

/** Cuánto suman los pesos de todas las evaluaciones. */
export const pesoUsado = (evs: readonly Evaluacion[]): number =>
  Math.round(evs.reduce((suma, e) => suma + e.peso, 0) * 100) / 100;

/**
 * Cuánto queda por repartir.
 *
 * Puede quedar de sobra —el semestre todavía no está armado— pero nunca puede
 * faltar: la base rechaza que los pesos pasen de cien. Acá se calcula para
 * poder decirlo antes de que el servidor lo rechace, que es más útil que un
 * error después de escribir el formulario entero.
 */
export const pesoLibre = (evs: readonly Evaluacion[]): number =>
  Math.round((100 - pesoUsado(evs)) * 100) / 100;

/** Si el semestre está completamente repartido. */
export const estaRepartido = (evs: readonly Evaluacion[]): boolean => pesoLibre(evs) === 0;

/** Si un peso nuevo cabe en lo que queda. */
export const cabe = (evs: readonly Evaluacion[], peso: number): boolean =>
  peso > 0 && peso <= pesoLibre(evs);

// ── La fila de cada alumno ────────────────────────────────────────────────

export type FilaDeRegistro = {
  estudiante_id: string;
  estudiante: string;
  /** La nota de cada evaluación, en el orden de las evaluaciones. */
  notas: (number | null)[];
  /**
   * Cómo va hasta ahora, ponderado solo sobre lo que ya tiene nota.
   *
   * Nulo mientras no tenga ninguna. Contar como cero lo que todavía no se ha
   * hecho convertiría a todo el curso en reprobado en marzo, que es la manera
   * más rápida de que un promedio deje de significar algo.
   */
  hastaAhora: number | null;
  /** Qué porcentaje del semestre está ya evaluado para este alumno. */
  cubierto: number;
  /** Cuántas de sus notas el curso todavía no ve. */
  sinPublicar: number;
};

/**
 * Arma la tabla: una fila por alumno, una columna por evaluación.
 *
 * El curso manda la lista de quiénes están: alguien sin ninguna nota tiene que
 * aparecer igual, porque es justamente a quien hay que mirar.
 */
export function armarRegistro(
  curso: readonly { id: string; nombre: string }[],
  evaluaciones: readonly Evaluacion[],
  notas: readonly NotaPuesta[],
): FilaDeRegistro[] {
  const evs = [...evaluaciones].sort((a, b) => a.orden - b.orden);

  return curso.map((alumno) => {
    const suyas = evs.map(
      (ev) => notas.find((n) => n.evaluacion_id === ev.id && n.estudiante_id === alumno.id) ?? null,
    );

    let pesoConNota = 0;
    let acumulado = 0;
    for (const [i, puesta] of suyas.entries()) {
      const ev = evs[i];
      if (!ev || !puesta || puesta.nota === null) continue;
      pesoConNota += ev.peso;
      acumulado += puesta.nota * ev.peso;
    }

    return {
      estudiante_id: alumno.id,
      estudiante: alumno.nombre,
      notas: suyas.map((n) => n?.nota ?? null),
      hastaAhora: pesoConNota === 0 ? null : Math.round((acumulado / pesoConNota) * 10) / 10,
      cubierto: Math.round(pesoConNota * 100) / 100,
      sinPublicar: suyas.filter((n) => n !== null && n.nota !== null && !n.publicada).length,
    };
  });
}

// ── Lo que se puede decir del registro ────────────────────────────────────

/** Cuántas notas puestas todavía no ve el curso, en todo el registro. */
export const porPublicar = (filas: readonly FilaDeRegistro[]): number =>
  filas.reduce((suma, f) => suma + f.sinPublicar, 0);

/** Quiénes van bajo la nota de aprobación con lo que llevan. */
export const enRiesgo = (filas: readonly FilaDeRegistro[]): FilaDeRegistro[] =>
  filas.filter((f) => f.hastaAhora !== null && f.hastaAhora < NOTA_APROBACION);

/**
 * Cómo se le cuenta al profesor en qué está el registro.
 *
 * Se dice lo que falta antes que lo que hay: quien abre el registro viene a
 * ver qué le queda por hacer.
 */
export function comoVaElRegistro(
  evs: readonly Evaluacion[], filas: readonly FilaDeRegistro[],
): string {
  if (evs.length === 0) return "Todavía no hay evaluaciones en este ramo.";

  const libre = pesoLibre(evs);
  const faltan = porPublicar(filas);
  const partes: string[] = [];

  if (libre > 0) partes.push(`falta repartir ${libre}%`);
  if (faltan > 0) {
    partes.push(`${faltan} ${faltan === 1 ? "nota puesta que el curso no ve" : "notas puestas que el curso no ve"}`);
  }
  if (partes.length === 0) return "Todo repartido y todo publicado.";
  return partes.join(" · ");
}
