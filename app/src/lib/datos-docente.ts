// Lo que ve un docente en modo demostración: su curso, las entregas que le
// llegaron y las notas que puso.
//
// Vive aparte de datos-demo.ts porque es otra mirada sobre los mismos ramos:
// allá el eje es "mi ramo desde el asiento del alumno", acá es "mi curso
// desde el escritorio del profesor".

import type { EntregaDeCurso, NotaDeCurso } from "../dominio/curso.ts";

const ahora = Date.now();
const enDias = (d: number) => new Date(ahora + d * 86_400_000).toISOString();

/** Veinte inscritos en Cálculo I, que es la escala real de un curso. */
export const CURSO: Record<string, { id: string; nombre: string }[]> = {
  cal: [
    "Eduardo Q.", "Josefa Pérez", "Matías Contreras", "Valentina Soto",
    "Diego Aravena", "Antonia Muñoz", "Benjamín Rojas", "Catalina Vera",
    "Tomás Salinas", "Fernanda Godoy", "Ignacio Bravo", "Camila Tapia",
    "Vicente Herrera", "Isidora Fuentes", "Joaquín Cáceres", "Amanda Silva",
    "Lucas Morales", "Emilia Navarro", "Gabriel Pinto", "Florencia Ruiz",
  ].map((nombre, i) => ({ id: `a${i + 1}`, nombre })),
};

// Diecisiete de veinte entregaron la guía; cinco siguen sin corregir. Es el
// desorden normal de un curso a mitad de semestre, no una tabla perfecta.
const PUNTAJES: (number | null)[] = [
  18, null, 20, 15, null, 17, 19, null, 14, 16,
  null, 20, 18, null, 13, 19, 17,
];

export const ENTREGAS: Record<string, EntregaDeCurso[]> = {
  t1: (CURSO.cal ?? []).slice(0, PUNTAJES.length).map((a, i) => ({
    id: `en-${a.id}`,
    tarea_id: "t1",
    estudiante_id: a.id,
    estudiante: a.nombre,
    entregado_en: enDias(-1 - (i % 3)),
    puntos_obtenidos: PUNTAJES[i] ?? null,
  })),
  t2: (CURSO.cal ?? []).map((a, i) => ({
    id: `en2-${a.id}`,
    tarea_id: "t2",
    estudiante_id: a.id,
    estudiante: a.nombre,
    entregado_en: enDias(-7),
    puntos_obtenidos: 30 - ((i * 7) % 14),
  })),
};

// Control 1 ya publicado; Control 2 corregido pero todavía sin publicar, que
// es el estado donde el profesor de verdad tiene que decidir algo.
const NOTAS_C1 = [6.2, 5.4, 6.8, 4.1, 3.6, 5.9, 6.5, 4.8, 3.2, 5.1,
                  6.0, 4.4, 5.7, 6.9, 3.9, 5.3, 4.6, 6.1, 5.8, 4.2];
const NOTAS_C2 = [6.3, 5.1, 6.5, 3.8, 4.0, 6.1, 6.7, 5.2, 3.4, 5.6,
                  5.9, 4.7, 6.2, 7.0, 4.3, 5.5, 4.9, 6.4, 5.0, 3.7];

const filasDeNotas = (valores: number[], evaluacion: string, publicada: boolean): NotaDeCurso[] =>
  (CURSO.cal ?? []).map((a, i) => ({
    evaluacion_id: evaluacion,
    estudiante_id: a.id,
    estudiante: a.nombre,
    nota: valores[i] ?? null,
    publicada,
  }));

export const NOTAS: Record<string, NotaDeCurso[]> = {
  e1: filasDeNotas(NOTAS_C1, "e1", true),
  e2: filasDeNotas(NOTAS_C2, "e2", false),
  e3: (CURSO.cal ?? []).map((a) => ({
    evaluacion_id: "e3", estudiante_id: a.id, estudiante: a.nombre,
    nota: null, publicada: false,
  })),
  e4: (CURSO.cal ?? []).map((a) => ({
    evaluacion_id: "e4", estudiante_id: a.id, estudiante: a.nombre,
    nota: null, publicada: false,
  })),
};

const dormir = () => new Promise((r) => setTimeout(r, 90));
const copiar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export async function cursoDe(asignaturaId: string) {
  await dormir();
  return copiar(CURSO[asignaturaId] ?? []);
}

export async function entregasDe(tareaId: string): Promise<EntregaDeCurso[]> {
  await dormir();
  return copiar(ENTREGAS[tareaId] ?? []);
}

export async function notasDe(evaluacionId: string): Promise<NotaDeCurso[]> {
  await dormir();
  return copiar(NOTAS[evaluacionId] ?? []);
}

/** Poner el puntaje de una entrega. */
export async function corregir(tareaId: string, entregaId: string, puntos: number | null): Promise<void> {
  const entrega = (ENTREGAS[tareaId] ?? []).find((e) => e.id === entregaId);
  if (entrega) entrega.puntos_obtenidos = puntos;
}

export async function ponerNota(evaluacionId: string, estudianteId: string, nota: number | null): Promise<void> {
  const fila = (NOTAS[evaluacionId] ?? []).find((n) => n.estudiante_id === estudianteId);
  if (fila) fila.nota = nota;
}

/** Publicar deja al curso ver lo que ya estaba puesto. */
export async function publicarNotas(evaluacionId: string): Promise<void> {
  for (const n of NOTAS[evaluacionId] ?? []) {
    if (n.nota !== null) n.publicada = true;
  }
}
