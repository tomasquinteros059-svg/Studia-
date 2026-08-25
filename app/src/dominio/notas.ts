// Aritmética de notas, en la escala chilena: 1,0 a 7,0, se aprueba con 4,0.

export const NOTA_MINIMA = 1.0;
export const NOTA_MAXIMA = 7.0;
export const NOTA_APROBACION = 4.0;

export type Evaluacion = {
  titulo: string;
  /** Porcentaje de la nota final. */
  peso: number;
  /** Null mientras no esté rendida o publicada. */
  nota: number | null;
};

export type NotaDelRamo = {
  /** Ponderada solo entre lo rendido. Null si no hay nada rendido. */
  nota: number | null;
  /** Porcentaje del curso ya evaluado. */
  rendido: number;
  /** Porcentaje que falta por evaluar. */
  pendiente: number;
};

/**
 * Pondera SOLO las evaluaciones ya rendidas. Contar como cero lo que todavía
 * no ocurre hundiría el promedio y desinformaría al estudiante justo cuando
 * más necesita saber dónde está parado.
 */
export function notaDelRamo(evaluaciones: Evaluacion[]): NotaDelRamo {
  let pesoRendido = 0;
  let acumulado = 0;
  let pesoTotal = 0;

  for (const e of evaluaciones) {
    pesoTotal += e.peso;
    if (e.nota !== null) {
      pesoRendido += e.peso;
      acumulado += e.peso * e.nota;
    }
  }

  return {
    nota: pesoRendido > 0 ? acumulado / pesoRendido : null,
    rendido: pesoRendido,
    pendiente: Math.max(0, pesoTotal - pesoRendido),
  };
}

export type Proyeccion =
  | { tipo: "sin_datos" }
  | { tipo: "todo_evaluado" }
  | { tipo: "ya_aprobado" }
  | { tipo: "inalcanzable"; pendiente: number }
  | { tipo: "necesita"; nota: number; pendiente: number };

/**
 * Qué nota se necesita, en lo que falta, para llegar a 4,0.
 * Se redondea hacia arriba a un decimal: pedir 3,91 y mostrar 3,9 haría creer
 * que con 3,9 alcanza, y no alcanza.
 */
export function proyeccionParaAprobar(
  evaluaciones: Evaluacion[],
  meta: number = NOTA_APROBACION,
): Proyeccion {
  const { nota, rendido, pendiente } = notaDelRamo(evaluaciones);

  if (nota === null) return { tipo: "sin_datos" };
  if (pendiente <= 0) return { tipo: "todo_evaluado" };

  const aportado = (nota * rendido) / 100;
  const requerida = (meta - aportado) / (pendiente / 100);

  if (requerida <= NOTA_MINIMA) return { tipo: "ya_aprobado" };
  if (requerida > NOTA_MAXIMA) return { tipo: "inalcanzable", pendiente };

  return { tipo: "necesita", nota: Math.ceil(requerida * 10) / 10, pendiente };
}

/** Promedio de la carrera, ponderado por créditos. */
export function promedioPonderado(
  ramos: Array<{ creditos: number; evaluaciones: Evaluacion[] }>,
): number | null {
  let creditos = 0;
  let acumulado = 0;

  for (const r of ramos) {
    const { nota } = notaDelRamo(r.evaluaciones);
    if (nota !== null) {
      creditos += r.creditos;
      acumulado += r.creditos * nota;
    }
  }

  return creditos > 0 ? acumulado / creditos : null;
}

/** "6,3" — con coma, como se escribe en Chile. Un guión si no hay nota. */
export function formatearNota(nota: number | null): string {
  if (nota === null || Number.isNaN(nota)) return "—";
  return nota.toFixed(1).replace(".", ",");
}

export function estaAprobado(nota: number | null): boolean {
  return nota !== null && nota >= NOTA_APROBACION;
}
