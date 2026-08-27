// Lo que un docente necesita saber de su curso, calculado de sus datos.
//
// Son unos veinte alumnos por ramo y no siempre entregan todos. Las cuentas
// que importan son tres: quién falta por corregir, cómo le fue al curso, y
// qué queda sin publicar.

export type EntregaDeCurso = {
  id: string;
  tarea_id: string;
  estudiante_id: string;
  estudiante: string;
  entregado_en: string | null;
  puntos_obtenidos: number | null;
};

export type NotaDeCurso = {
  evaluacion_id: string;
  estudiante_id: string;
  estudiante: string;
  nota: number | null;
  publicada: boolean;
};

/** En Chile se aprueba con 4,0. */
export const NOTA_MINIMA_APROBACION = 4.0;

// ── Entregas ────────────────────────────────────────────────────────────

/** Entregada y todavía sin puntaje: es la fila de trabajo del docente. */
export function porRevisar(entregas: EntregaDeCurso[]): EntregaDeCurso[] {
  return entregas
    .filter((e) => e.entregado_en !== null && e.puntos_obtenidos === null)
    .sort((a, b) => (a.entregado_en ?? "").localeCompare(b.entregado_en ?? ""));
}

export type EstadoTarea = {
  /** Cuántos entregaron, de los inscritos. */
  entregadas: number;
  corregidas: number;
  porRevisar: number;
  /** Inscritos que no entregaron. Puede ser cero. */
  sinEntregar: number;
  inscritos: number;
};

export function estadoDeTarea(entregas: EntregaDeCurso[], inscritos: number): EstadoTarea {
  const entregadas = entregas.filter((e) => e.entregado_en !== null).length;
  const corregidas = entregas.filter((e) => e.puntos_obtenidos !== null).length;
  return {
    entregadas,
    corregidas,
    porRevisar: entregadas - corregidas,
    sinEntregar: Math.max(0, inscritos - entregadas),
    inscritos,
  };
}

// ── Notas ───────────────────────────────────────────────────────────────

const puestas = (notas: NotaDeCurso[]): number[] =>
  notas.map((n) => n.nota).filter((n): n is number => n !== null);

/** Promedio de una evaluación, redondeado a una décima como se informa. */
export function promedioDelCurso(notas: NotaDeCurso[]): number | null {
  const valores = puestas(notas);
  if (valores.length === 0) return null;
  const suma = valores.reduce((a, b) => a + b, 0);
  return Math.round((suma / valores.length) * 10) / 10;
}

export function aprobacion(notas: NotaDeCurso[]): { aprobados: number; conNota: number } {
  const valores = puestas(notas);
  return {
    aprobados: valores.filter((n) => n >= NOTA_MINIMA_APROBACION).length,
    conNota: valores.length,
  };
}

/**
 * Cuántos cayeron en cada tramo. Es lo que deja ver de una mirada si la
 * prueba estuvo demasiado difícil, cosa que un promedio solo esconde.
 */
export type Tramo = { desde: number; hasta: number; cuantos: number };

export function distribucion(notas: NotaDeCurso[]): Tramo[] {
  const tramos: Tramo[] = [
    { desde: 1.0, hasta: 2.0, cuantos: 0 },
    { desde: 2.0, hasta: 3.0, cuantos: 0 },
    { desde: 3.0, hasta: 4.0, cuantos: 0 },
    { desde: 4.0, hasta: 5.0, cuantos: 0 },
    { desde: 5.0, hasta: 6.0, cuantos: 0 },
    { desde: 6.0, hasta: 7.0, cuantos: 0 },
  ];
  for (const n of puestas(notas)) {
    // El 7,0 cae en el último tramo, no fuera de la tabla.
    const i = n >= 7 ? tramos.length - 1 : Math.min(tramos.length - 1, Math.floor(n) - 1);
    const tramo = tramos[Math.max(0, i)];
    if (tramo) tramo.cuantos += 1;
  }
  return tramos;
}

/** Notas puestas que el curso todavía no ve. */
export function sinPublicar(notas: NotaDeCurso[]): number {
  return notas.filter((n) => n.nota !== null && !n.publicada).length;
}

/** Quiénes quedaron sin nota en una evaluación ya corregida. */
export function faltanNota(notas: NotaDeCurso[]): string[] {
  return notas.filter((n) => n.nota === null).map((n) => n.estudiante);
}

// ── Quién puede qué ─────────────────────────────────────────────────────

export type Papel = "profesor" | "ayudante";

/**
 * El ayudante corrige, carga material y responde el foro. Publicar notas es
 * del profesor, y esta regla también vive en las políticas de la base: acá
 * está solo para no ofrecer un botón que el servidor va a rechazar.
 */
export function puedePublicarNotas(papel: Papel): boolean {
  return papel === "profesor";
}

export function puedeCorregir(_papel: Papel): boolean {
  return true;
}
