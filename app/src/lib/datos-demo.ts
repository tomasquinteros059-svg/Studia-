// Datos en memoria para el modo demostración.
//
// Implementa la misma superficie que `consultas-supabase.ts`, de modo que la
// app no sepa con cuál está hablando. TypeScript lo verifica al final del
// archivo: si allá se agrega una consulta, acá falta y no compila.

import type * as Real from "./consultas-supabase.ts";
import { TEXTOS_DEMO } from "./textos-demo.ts";
import { comoHora, type Colegio } from "../dominio/planilla.ts";
import { PERFILES_DEMO, perfilActual } from "./perfiles-demo.ts";
import {
  RAMOS_PROPIOS, horarioPropio, lecturaPropiaDe, modulosPropiosDe,
} from "./datos-propios.ts";
import {
  borrarQuizDemo, quicesDemo, quizDemoPorId, responderQuizDemo,
} from "./quiz-demo.ts";
import { fichasDemo, repasarFichaDemo } from "./fichas-demo.ts";
import type { Tramo } from "../dominio/escucha.ts";
import type {
  Apunte, ApunteEnLista, Asignatura, BloqueHorario, TramoOido, Capitulo, Clase, EvaluacionConNota,
  Dictado, Hilo, Lectura, Material, MensajeTutor, Modulo, Notificacion, Perfil,
  Ficha, Quiz, Registro, Respuesta, ResumenGuardado, SesionEstudio,
  TareaConEstado,
} from "./tipos.ts";

const ahora = Date.now();
const enDias = (d: number) => new Date(ahora + d * 86_400_000).toISOString();

/* ------------------------------------------------------------ asignaturas */
const ASIGNATURAS: Asignatura[] = [
  {
    id: "cal", codigo: "MAT1610", nombre: "Cálculo I", profesor: "Ana Ríos",
    ayudante: "Ignacio Soto", color: "#2563C9", creditos: 10,
    descripcion: "Cálculo diferencial en una variable: límites, continuidad, derivada y sus aplicaciones.",
    requisitos: "Álgebra y geometría de enseñanza media",
    bibliografia: ["Stewart, J. — Cálculo de una variable", "Spivak, M. — Calculus"],
    intro_tutor: "Cuéntame en qué problema de cálculo estás. ¿Qué te piden encontrar y qué datos tienes?",
    propio: false,
  },
  {
    id: "alg", codigo: "MAT1203", nombre: "Álgebra Lineal", profesor: "Diego Fuentes",
    ayudante: "Camila Reyes", color: "#6D3FD1", creditos: 10,
    descripcion: "Sistemas de ecuaciones, espacios vectoriales y transformaciones lineales.",
    requisitos: "Álgebra de enseñanza media",
    bibliografia: ["Grossman, S. — Álgebra lineal"],
    intro_tutor: "¿En qué andas? Antes de operar: ¿qué esperas de la solución del sistema, única, infinitas o ninguna?",
    propio: false,
  },
  {
    id: "fis", codigo: "FIS1503", nombre: "Física I", profesor: "Carla Núñez",
    ayudante: "Pedro Lagos", color: "#C25A18", creditos: 10,
    descripcion: "Mecánica clásica: cinemática, dinámica de la partícula, trabajo y energía.",
    requisitos: "Cálculo I (puede cursarse en paralelo)",
    bibliografia: ["Serway, R. — Física para ciencias e ingeniería"],
    intro_tutor: "Partamos por el diagrama de cuerpo libre. ¿Qué fuerzas actúan sobre el cuerpo?",
    propio: false,
  },
  {
    id: "io", codigo: "ICS2123", nombre: "Investigación de Operaciones", profesor: "Rodrigo Salas",
    ayudante: "Fernanda Díaz", color: "#0F6E6E", creditos: 10,
    descripcion: "Programación lineal, método simplex y dualidad. Se evalúa el modelo, no la herramienta.",
    requisitos: "Álgebra Lineal",
    bibliografia: ["Hillier & Lieberman — Introducción a la investigación de operaciones"],
    intro_tutor: "Modelemos juntos. ¿Cuáles serían tus variables de decisión, en palabras?",
    propio: false,
  },
  {
    id: "mic", codigo: "EAE1110", nombre: "Microeconomía", profesor: "Paula Vergara",
    ayudante: "Joaquín Herrera", color: "#C4326B", creditos: 8,
    descripcion: "Consumidores y productores, equilibrio de mercado y elasticidad.",
    requisitos: "Sin requisitos",
    bibliografia: ["Varian, H. — Microeconomía intermedia"],
    intro_tutor: "Vamos con un ejemplo concreto. ¿Qué cambia en el mercado y por qué crees que se mueve?",
    propio: false,
  },
  {
    id: "pro", codigo: "IIC1103", nombre: "Programación", profesor: "Matías Leiva",
    ayudante: "Valentina Ruiz", color: "#0E5A8A", creditos: 10,
    descripcion: "Fundamentos de programación en Python: control de flujo, estructuras de datos y recursión.",
    requisitos: "Sin requisitos",
    bibliografia: ["Downey, A. — Think Python"],
    intro_tutor: "Descríbeme el algoritmo en palabras. ¿Cuál sería el primer paso antes de escribir código?",
    propio: false,
  },
];

/* ---------------------------------------------------------------- horario */
const HORARIO: BloqueHorario[] = [
  { id: "h1", asignatura_id: "cal", dia: 1, hora_inicio: "08:30", hora_fin: "10:00", sala: "A-201", tipo: "Cátedra" },
  { id: "h2", asignatura_id: "cal", dia: 2, hora_inicio: "08:30", hora_fin: "10:00", sala: "A-201", tipo: "Cátedra" },
  { id: "h3", asignatura_id: "cal", dia: 4, hora_inicio: "11:30", hora_fin: "13:00", sala: "Lab B-3", tipo: "Ayudantía" },
  { id: "h4", asignatura_id: "alg", dia: 2, hora_inicio: "10:15", hora_fin: "11:45", sala: "B-104", tipo: "Cátedra" },
  { id: "h5", asignatura_id: "alg", dia: 5, hora_inicio: "08:30", hora_fin: "10:00", sala: "B-104", tipo: "Cátedra" },
  { id: "h6", asignatura_id: "fis", dia: 1, hora_inicio: "11:30", hora_fin: "13:00", sala: "C-002", tipo: "Cátedra" },
  { id: "h7", asignatura_id: "fis", dia: 3, hora_inicio: "11:30", hora_fin: "13:00", sala: "C-002", tipo: "Cátedra" },
  { id: "h8", asignatura_id: "fis", dia: 5, hora_inicio: "14:00", hora_fin: "16:00", sala: "Lab Física", tipo: "Laboratorio" },
  { id: "h9", asignatura_id: "io", dia: 2, hora_inicio: "14:00", hora_fin: "15:30", sala: "D-310", tipo: "Cátedra" },
  { id: "h10", asignatura_id: "io", dia: 4, hora_inicio: "14:00", hora_fin: "15:30", sala: "D-310", tipo: "Cátedra" },
  { id: "h11", asignatura_id: "mic", dia: 3, hora_inicio: "08:30", hora_fin: "10:00", sala: "E-105", tipo: "Cátedra" },
  { id: "h12", asignatura_id: "mic", dia: 5, hora_inicio: "10:15", hora_fin: "11:45", sala: "E-105", tipo: "Cátedra" },
  { id: "h13", asignatura_id: "pro", dia: 1, hora_inicio: "14:00", hora_fin: "15:30", sala: "Lab Comp 2", tipo: "Cátedra" },
  { id: "h14", asignatura_id: "pro", dia: 3, hora_inicio: "14:00", hora_fin: "15:30", sala: "Lab Comp 2", tipo: "Cátedra" },
];

/* ----------------------------------------------------------------- clases */
const CLASES: Clase[] = [
  { id: "c-viva", asignatura_id: "cal", titulo: "Teorema del valor medio", estado: "en_vivo",
    inicia_en: new Date(ahora - 720_000).toISOString(), duracion_seg: null, audio_url: null,
    presencial: true, escucha_permitida: true },
  { id: "c1", asignatura_id: "cal", titulo: "Clase 12 · Regla de L'Hôpital", estado: "grabada",
    inicia_en: enDias(-5), duracion_seg: 3840, audio_url: null ,
    presencial: true, escucha_permitida: false },
  { id: "c2", asignatura_id: "cal", titulo: "Clase 11 · Derivadas implícitas", estado: "grabada",
    inicia_en: enDias(-7), duracion_seg: 3300, audio_url: null ,
    presencial: true, escucha_permitida: false },
  { id: "c3", asignatura_id: "alg", titulo: "Clase 9 · Base y dimensión", estado: "grabada",
    inicia_en: enDias(-3), duracion_seg: 3480, audio_url: null ,
    presencial: true, escucha_permitida: false },
  { id: "c4", asignatura_id: "fis", titulo: "Clase 10 · Roce y planos inclinados", estado: "grabada",
    inicia_en: enDias(-5), duracion_seg: 3720, audio_url: null ,
    presencial: true, escucha_permitida: false },
  { id: "c5", asignatura_id: "pro", titulo: "Clase 14 · Diccionarios", estado: "grabada",
    inicia_en: enDias(-5), duracion_seg: 3120, audio_url: null ,
    presencial: true, escucha_permitida: false },
];

/* ---------------------------------------------------------------- materia */
// Sin `leible`: eso se deduce de TEXTOS_DEMO, así no puede quedar un material
// marcado como legible sin texto detrás.
type MaterialSemilla = Omit<Material, "leible">;
type ModuloSemilla = Omit<Modulo, "materiales"> & { materiales: MaterialSemilla[] };

const MODULOS: Record<string, ModuloSemilla[]> = {
  cal: [
    { id: "m1", titulo: "1 · Límites y continuidad", orden: 1, materiales: [
      { id: "mm1", tipo: "video", titulo: "Idea intuitiva de límite", detalle: "Video · 14 min", orden: 1, completado: true },
      { id: "mm2", tipo: "documento", titulo: "Apunte: límites laterales", detalle: "Lectura · 4 min", orden: 2, completado: true },
      { id: "mm3", tipo: "ejercicios", titulo: "Ejercicios 1.1 resueltos", detalle: "12 ítems", orden: 3, completado: true },
    ]},
    { id: "m2", titulo: "2 · La derivada", orden: 2, materiales: [
      { id: "mm4", tipo: "video", titulo: "Regla de la cadena", detalle: "Video · 19 min", orden: 1, completado: true },
      { id: "mm5", tipo: "documento", titulo: "Formulario de derivadas", detalle: "Lectura · 3 min", orden: 2, completado: true },
      { id: "mm6", tipo: "ejercicios", titulo: "Guía 3 · derivación", detalle: "15 ítems", orden: 3, completado: false },
    ]},
    { id: "m3", titulo: "3 · Aplicaciones", orden: 3, materiales: [
      { id: "mm7", tipo: "video", titulo: "Optimización", detalle: "Video · 22 min", orden: 1, completado: false },
      { id: "mm8", tipo: "documento", titulo: "Casos de estudio", detalle: "Lectura · 3 min", orden: 2, completado: false },
    ]},
  ],
  alg: [
    { id: "m4", titulo: "1 · Sistemas de ecuaciones", orden: 1, materiales: [
      { id: "mm9", tipo: "video", titulo: "Eliminación de Gauss", detalle: "Video · 17 min", orden: 1, completado: true },
      { id: "mm10", tipo: "documento", titulo: "Apunte: matriz escalonada", detalle: "Lectura · 4 min", orden: 2, completado: false },
    ]},
  ],
  fis: [
    { id: "m5", titulo: "2 · Dinámica", orden: 1, materiales: [
      { id: "mm11", tipo: "video", titulo: "Leyes de Newton", detalle: "Video · 24 min", orden: 1, completado: true },
      { id: "mm12", tipo: "documento", titulo: "Apunte: roce estático y cinético", detalle: "Lectura · 4 min", orden: 2, completado: false },
    ]},
  ],
  io: [
    { id: "m6", titulo: "1 · Programación lineal", orden: 1, materiales: [
      { id: "mm13", tipo: "video", titulo: "Formulación de modelos", detalle: "Video · 23 min", orden: 1, completado: true },
    ]},
  ],
  mic: [
    { id: "m7", titulo: "2 · Elasticidad", orden: 1, materiales: [
      { id: "mm14", tipo: "video", titulo: "Elasticidad precio", detalle: "Video · 18 min", orden: 1, completado: true },
    ]},
  ],
  pro: [
    { id: "m8", titulo: "2 · Estructuras de datos", orden: 1, materiales: [
      { id: "mm15", tipo: "video", titulo: "Listas y diccionarios", detalle: "Video · 22 min", orden: 1, completado: true },
      { id: "mm16", tipo: "documento", titulo: "Apunte: complejidad básica", detalle: "Lectura · 3 min", orden: 2, completado: true },
    ]},
  ],
};

/* ----------------------------------------------------------------- tareas */
const TAREAS: TareaConEstado[] = [
  { id: "t1", asignatura_id: "cal", titulo: "Guía 4 · Optimización",
    enunciado: "Resuelve los 9 problemas de optimización. Para cada uno entrega el planteamiento antes del cálculo.",
    criterios: ["El diagrama de la situación", "La función objetivo y su dominio",
                "Por qué el punto hallado es máximo o mínimo"],
    puntos: 20, vence_en: enDias(3), entregada_en: null, puntos_obtenidos: null },
  { id: "t2", asignatura_id: "cal", titulo: "Control 2 · Derivadas",
    enunciado: "Control escrito sobre reglas de derivación.", criterios: [],
    puntos: 30, vence_en: enDias(-7), entregada_en: enDias(-7), puntos_obtenidos: 27 },
  { id: "t3", asignatura_id: "alg", titulo: "Guía 2 · Independencia lineal",
    enunciado: "Determina si cada conjunto de vectores es linealmente independiente y justifica.",
    criterios: ["Muestra el sistema planteado", "Indica el rango", "Concluye en una frase"],
    puntos: 15, vence_en: enDias(1), entregada_en: null, puntos_obtenidos: null },
  { id: "t4", asignatura_id: "fis", titulo: "Informe de laboratorio 2",
    enunciado: "Informe del experimento de plano inclinado, en formato IMRyD.",
    criterios: ["Tabla con incertidumbre", "Gráfico con ajuste lineal", "Discusión del coeficiente de roce"],
    puntos: 25, vence_en: enDias(2), entregada_en: null, puntos_obtenidos: null },
  { id: "t5", asignatura_id: "fis", titulo: "Guía 2 · Planos inclinados",
    enunciado: "Once problemas de dinámica con roce.", criterios: [],
    puntos: 15, vence_en: enDias(-1), entregada_en: null, puntos_obtenidos: null },
  { id: "t6", asignatura_id: "io", titulo: "Caso 1 · Mezcla de producción",
    enunciado: "Formula el modelo de programación lineal del caso y resuélvelo.",
    criterios: ["Variables en palabras", "Función objetivo", "Restricciones con su interpretación"],
    puntos: 20, vence_en: enDias(7), entregada_en: null, puntos_obtenidos: null },
  { id: "t7", asignatura_id: "mic", titulo: "Control 2 · Elasticidad",
    enunciado: "Control en sala sobre elasticidad.", criterios: [],
    puntos: 25, vence_en: enDias(1), entregada_en: null, puntos_obtenidos: null },
  { id: "t8", asignatura_id: "pro", titulo: "Tarea 3 · Análisis de datos",
    enunciado: "Programa que lee un CSV de notas y entrega estadísticas por sección.",
    criterios: ["Lectura robusta", "Funciones separadas", "Casos borde: archivo vacío o filas mal formadas"],
    puntos: 30, vence_en: enDias(3), entregada_en: null, puntos_obtenidos: null },
  { id: "t9", asignatura_id: "pro", titulo: "Tarea 2 · Estructuras",
    enunciado: "Inventario con diccionarios.", criterios: [],
    puntos: 30, vence_en: enDias(-10), entregada_en: enDias(-10), puntos_obtenidos: 29 },
];

/* ------------------------------------------------------------------ notas */
const EVALUACIONES: Record<string, EvaluacionConNota[]> = {
  cal: [
    { id: "e1", titulo: "Control 1 · Límites", peso: 20, orden: 1, nota: 6.2 },
    { id: "e2", titulo: "Control 2 · Derivadas", peso: 20, orden: 2, nota: 6.3 },
    { id: "e3", titulo: "Guías y talleres", peso: 15, orden: 3, nota: 6.5 },
    { id: "e4", titulo: "Examen final", peso: 45, orden: 4, nota: null },
  ],
  alg: [
    { id: "e5", titulo: "Control 1 · Sistemas", peso: 25, orden: 1, nota: 4.8 },
    { id: "e6", titulo: "Guías", peso: 15, orden: 2, nota: 5.5 },
    { id: "e7", titulo: "Examen final", peso: 60, orden: 3, nota: null },
  ],
  fis: [
    { id: "e8", titulo: "Control 1 · Cinemática", peso: 20, orden: 1, nota: 5.2 },
    { id: "e9", titulo: "Laboratorios", peso: 20, orden: 2, nota: 6.0 },
    { id: "e10", titulo: "Examen final", peso: 60, orden: 3, nota: null },
  ],
  io: [
    { id: "e11", titulo: "Control 1 · Modelamiento", peso: 30, orden: 1, nota: 3.4 },
    { id: "e12", titulo: "Casos", peso: 20, orden: 2, nota: null },
    { id: "e13", titulo: "Examen final", peso: 50, orden: 3, nota: null },
  ],
  mic: [
    { id: "e14", titulo: "Control 1 · Oferta y demanda", peso: 25, orden: 1, nota: 6.4 },
    { id: "e15", titulo: "Trabajos", peso: 20, orden: 2, nota: 6.8 },
    { id: "e16", titulo: "Examen final", peso: 55, orden: 3, nota: null },
  ],
  pro: [
    { id: "e17", titulo: "Tarea 1", peso: 15, orden: 1, nota: 6.9 },
    { id: "e18", titulo: "Tarea 2", peso: 15, orden: 2, nota: 6.8 },
    { id: "e19", titulo: "Control 1", peso: 25, orden: 3, nota: 6.1 },
    { id: "e20", titulo: "Examen final", peso: 45, orden: 4, nota: null },
  ],
};

/* ------------------------------------------------------------------- foro */
const HILOS: Hilo[] = [
  { id: "f1", asignatura_id: "cal", autor_nombre: "Ana Ríos", autor_rol: "Profesora",
    titulo: "Sala del control del miércoles",
    cuerpo: "El control 3 se rinde en la sala A-301, no en la A-201 de siempre. Llevar calculadora y cédula.",
    fijado: true, creado_en: enDias(-1), respuestas: 2 },
  { id: "f2", asignatura_id: "cal", autor_nombre: "Matías Cortés", autor_rol: "Estudiante",
    titulo: "Duda del ejercicio 7 de la guía 4",
    cuerpo: "Me piden maximizar el área de un rectángulo inscrito en una parábola. Tengo la función objetivo pero me pierdo con el dominio.",
    fijado: false, creado_en: enDias(-0.2), respuestas: 1 },
  { id: "f3", asignatura_id: "fis", autor_nombre: "Carla Núñez", autor_rol: "Profesora",
    titulo: "Informe de laboratorio: formato IMRyD",
    cuerpo: "Máximo 6 páginas. La discusión pesa más que los resultados.",
    fijado: true, creado_en: enDias(-3), respuestas: 0 },
];

const RESPUESTAS: Record<string, Respuesta[]> = {
  f1: [
    { id: "r1", autor_nombre: "Josefa Pérez", autor_rol: "Estudiante",
      cuerpo: "Gracias por avisar. ¿Entra la materia del teorema del valor medio?", creado_en: enDias(-0.9) },
    { id: "r2", autor_nombre: "Ana Ríos", autor_rol: "Profesora",
      cuerpo: "Sí, entra todo hasta la clase de hoy inclusive.", creado_en: enDias(-0.85) },
  ],
  f2: [
    { id: "r3", autor_nombre: "Sofía Valdés", autor_rol: "Estudiante",
      cuerpo: "A mí me sirvió pensar primero qué valores de x tienen sentido geométrico.", creado_en: enDias(-0.1) },
  ],
};

const COMPANEROS = [
  "Josefa Pérez", "Matías Cortés", "Sofía Valdés", "Tomás González",
  "Laura Bravo", "Ignacio Rojas", "Camila Torres",
].map((nombre, i) => ({ id: `p${i}`, nombre }));

/* --------------------------------------------------------- estado mutable */
const notificaciones: Notificacion[] = [
  { id: "n1", tipo: "clase", titulo: "Cálculo I está en vivo",
    detalle: "Teorema del valor medio · comenzó hace 12 min", asignatura_id: "cal",
    ref_tipo: "clase", ref_id: "c-viva", leida: false, creado_en: new Date(ahora).toISOString() },
  { id: "n2", tipo: "tarea", titulo: "Guía 2 vence mañana",
    detalle: "Independencia lineal", asignatura_id: "alg",
    ref_tipo: "tarea", ref_id: "t3", leida: false, creado_en: enDias(-0.3) },
  { id: "n3", tipo: "anuncio", titulo: "Ana Ríos publicó un aviso",
    detalle: "Sala del control del miércoles", asignatura_id: "cal",
    ref_tipo: "hilo", ref_id: "f1", leida: true, creado_en: enDias(-1) },
];

const apuntes: Apunte[] = [
  { id: "ap1", asignatura_id: "cal", clase_id: "c-viva", titulo: "Teorema del valor medio",
    contenido: "Si f es continua en [a,b] y derivable en (a,b), existe c en (a,b) donde f'(c) es la pendiente de la recta que une los extremos.\n\nOjo: hace falta continuidad en el cerrado y derivabilidad en el abierto.",
    trazos: null, fijado: true, actualizado_en: enDias(-0.1) },
];

const resumenes = new Map<string, ResumenGuardado>();
const completados = new Set(["mm1", "mm2", "mm3", "mm4", "mm5", "mm9", "mm11", "mm13", "mm14", "mm15", "mm16"]);
let siguienteId = 1;
const nuevoId = (p: string) => `${p}-demo-${siguienteId++}`;

/** Un respiro breve, para que la app se comporte como con red de verdad. */
const respirar = () => new Promise<void>((listo) => setTimeout(listo, 120));

/* ================================ consultas ============================== */

/** Copia superficial: nadie debe poder mutar el estado del demo desde afuera. */
const copiar = <T,>(x: T): T => (Array.isArray(x) ? x.map((e) => ({ ...e })) : { ...x }) as T;

/**
 * Quien no tiene institución no ve nada de la institución: ni ramos, ni
 * horario, ni tareas, ni notas, ni foro. No es una lista filtrada, es una
 * lista que nunca existió para esa persona.
 */
const conInstitucion = (): boolean => perfilActual()?.institucion !== false;

export async function misAsignaturas(): Promise<Asignatura[]> {
  await respirar();
  if (!conInstitucion()) return copiar(RAMOS_PROPIOS);
  // Los ramos propios van al final: primero lo que trae la institución,
  // después lo que la persona armó. Quien no tiene institución ve solo los
  // suyos, que es exactamente la lista vacía más lo que agregó.
  return copiar([...ASIGNATURAS, ...RAMOS_PROPIOS]);
}

/**
 * La misma carga masiva que hace la base, sobre los datos del aparato.
 *
 * Existe para poder recorrer el panel de administración sin servidor. Se
 * comporta igual en lo que importa: el ramo que ya estaba se actualiza en
 * vez de duplicarse, el horario de esos ramos se rehace entero, y lo que la
 * planilla no menciona no se toca.
 */
export async function cargarCatalogo(
  colegio: Pick<Colegio, "asignaturas" | "horario">,
): Promise<{ ramos: number; bloques: number }> {
  await respirar();
  const codigos = new Set(colegio.asignaturas.map((a) => a.codigo.toUpperCase()));

  for (const a of colegio.asignaturas) {
    const codigo = a.codigo.toUpperCase();
    const ramo: Asignatura = {
      id: `col-${codigo}`,
      codigo,
      nombre: a.nombre,
      profesor: a.profesor,
      ayudante: a.ayudante,
      color: a.color,
      creditos: a.creditos,
      descripcion: a.descripcion,
      requisitos: a.requisitos,
      bibliografia: a.bibliografia,
      intro_tutor: a.intro_tutor,
      propio: false,
    };
    const i = ASIGNATURAS.findIndex((x) => x.codigo.toUpperCase() === codigo);
    if (i >= 0) ASIGNATURAS[i] = { ...ASIGNATURAS[i]!, ...ramo, id: ASIGNATURAS[i]!.id };
    else ASIGNATURAS.push(ramo);
  }

  const idDe = (codigo: string) =>
    ASIGNATURAS.find((x) => x.codigo.toUpperCase() === codigo.toUpperCase())?.id ?? "";

  // Solo el de los ramos que vienen: una planilla parcial no borra el resto.
  for (let i = HORARIO.length - 1; i >= 0; i--) {
    const suyo = ASIGNATURAS.find((x) => x.id === HORARIO[i]!.asignatura_id);
    if (suyo && codigos.has(suyo.codigo.toUpperCase())) HORARIO.splice(i, 1);
  }
  for (const [n, b] of colegio.horario.entries()) {
    HORARIO.push({
      id: `bloque-cargado-${n}`,
      asignatura_id: idDe(b.codigo),
      dia: b.dia,
      hora_inicio: comoHora(b.inicio),
      hora_fin: comoHora(b.fin),
      sala: b.sala,
      tipo: b.tipo,
    });
  }

  return { ramos: colegio.asignaturas.length, bloques: colegio.horario.length };
}

/**
 * El registro, en la demostración: los perfiles de ejemplo.
 *
 * Como en la base, solo lo ve la administración. Devolver la lista a
 * cualquiera acá dejaría la pantalla mintiendo sobre lo que va a pasar con
 * servidor de verdad.
 */
export async function registros(): Promise<Registro[]> {
  await respirar();
  if (perfilActual()?.rol !== "administrador") return [];
  return PERFILES_DEMO.map((p, i) => ({
    id: p.id,
    nombre: p.nombre,
    correo: p.correo,
    rol: p.rol,
    // Escalonados, para que la lista se vea como una lista de verdad.
    creado_en: new Date(Date.now() - (i + 1) * 86_400_000 * 9).toISOString(),
  }));
}

/** El rol, en la demostración. Con las mismas dos guardias que la base. */
export async function cambiarRol(personaId: string, rol: Registro["rol"]): Promise<void> {
  await respirar();
  const yo = perfilActual();
  if (yo?.rol !== "administrador") throw new Error("Solo la administración cambia roles.");
  if (personaId === yo.id) {
    throw new Error("No puedes cambiar tu propio rol. Pídeselo a otra persona de administración.");
  }
  const persona = PERFILES_DEMO.find((p) => p.id === personaId);
  if (!persona) throw new Error("Esa persona ya no está registrada.");
  persona.rol = rol;
}

export async function miHorario(): Promise<BloqueHorario[]> {
  await respirar();
  // Quien no tiene institución igual puede tener horario: el que se cargó
  // escribiéndolo. Antes esta rama devolvía siempre vacío y su pestaña de
  // horario no podía mostrar nada nunca.
  const propio = horarioPropio();
  if (!conInstitucion()) return propio;
  return [...copiar(HORARIO), ...propio];
}

export async function materiaDe(asignaturaId: string): Promise<Modulo[]> {
  await respirar();
  const propios = modulosPropiosDe(asignaturaId);
  if (propios.length > 0) return propios;

  return (MODULOS[asignaturaId] ?? []).map((m) => ({
    ...m,
    materiales: m.materiales.map((x) => ({
      ...x,
      completado: completados.has(x.id),
      leible: TEXTOS_DEMO[x.id] !== undefined,
    })),
  }));
}

export async function lecturaPorId(materialId: string): Promise<Lectura | null> {
  await respirar();
  const propia = lecturaPropiaDe(materialId);
  if (propia) return propia;

  const texto = TEXTOS_DEMO[materialId];
  if (!texto) return null;

  for (const [asignaturaId, modulos] of Object.entries(MODULOS)) {
    for (const m of modulos) {
      const mat = m.materiales.find((x) => x.id === materialId);
      if (!mat) continue;
      return {
        id: mat.id,
        titulo: mat.titulo,
        texto,
        asignatura_id: asignaturaId,
        asignatura_nombre: ASIGNATURAS.find((a) => a.id === asignaturaId)?.nombre ?? "",
        asignatura_color: ASIGNATURAS.find((a) => a.id === asignaturaId)?.color ?? null,
      };
    }
  }
  return null;
}

export async function marcarMaterial(materialId: string, completado: boolean): Promise<void> {
  if (completado) completados.add(materialId);
  else completados.delete(materialId);
}

export async function clasesDe(asignaturaId: string): Promise<Clase[]> {
  await respirar();
  if (!conInstitucion()) return [];
  return copiar(CLASES.filter((c) => c.asignatura_id === asignaturaId));
}

export async function claseEnVivo(): Promise<Clase | null> {
  await respirar();
  if (!conInstitucion()) return null;
  const viva = CLASES.find((c) => c.estado === "en_vivo");
  return viva ? { ...viva } : null;
}

export async function capitulosDe(claseId: string): Promise<Capitulo[]> {
  await respirar();
  const clase = CLASES.find((c) => c.id === claseId);
  const total = clase?.duracion_seg ?? 0;
  return [
    { id: `${claseId}-1`, titulo: "Repaso de la clase anterior", segundo: 0 },
    { id: `${claseId}-2`, titulo: "Concepto central", segundo: Math.round(total * 0.18) },
    { id: `${claseId}-3`, titulo: "Ejemplo en pizarra", segundo: Math.round(total * 0.45) },
    { id: `${claseId}-4`, titulo: "Preguntas del curso", segundo: Math.round(total * 0.78) },
  ];
}

export async function misTareas(asignaturaId?: string): Promise<TareaConEstado[]> {
  await respirar();
  if (!conInstitucion()) return [];
  return copiar(asignaturaId ? TAREAS.filter((t) => t.asignatura_id === asignaturaId) : TAREAS);
}

export async function tareaPorId(tareaId: string): Promise<TareaConEstado | null> {
  await respirar();
  const t = TAREAS.find((x) => x.id === tareaId);
  return t ? { ...t } : null;
}

export async function entregarTarea(tareaId: string): Promise<void> {
  const tarea = TAREAS.find((t) => t.id === tareaId);
  if (tarea) tarea.entregada_en = new Date().toISOString();
}

export async function evaluacionesDe(asignaturaId: string): Promise<EvaluacionConNota[]> {
  await respirar();
  if (!conInstitucion()) return [];
  return copiar(EVALUACIONES[asignaturaId] ?? []);
}

export async function todasLasEvaluaciones(): Promise<Map<string, EvaluacionConNota[]>> {
  await respirar();
  if (!conInstitucion()) return new Map();
  return new Map(Object.entries(EVALUACIONES).map(([id, evs]) => [id, copiar(evs)]));
}

export async function foroDe(asignaturaId: string): Promise<Hilo[]> {
  await respirar();
  if (!conInstitucion()) return [];
  return copiar(HILOS.filter((h) => h.asignatura_id === asignaturaId));
}

export async function respuestasDe(hiloId: string): Promise<Respuesta[]> {
  await respirar();
  return copiar(RESPUESTAS[hiloId] ?? []);
}

export async function responderHilo(hiloId: string, cuerpo: string): Promise<void> {
  const lista = RESPUESTAS[hiloId] ?? (RESPUESTAS[hiloId] = []);
  lista.push({
    id: nuevoId("r"), autor_nombre: "Eduardo Q.", autor_rol: "Estudiante",
    cuerpo, creado_en: new Date().toISOString(),
  });
  const hilo = HILOS.find((h) => h.id === hiloId);
  if (hilo) hilo.respuestas = lista.length;
}

export async function crearHilo(asignaturaId: string, titulo: string, cuerpo: string): Promise<string> {
  const id = nuevoId("f");
  HILOS.unshift({
    id, asignatura_id: asignaturaId, autor_nombre: "Eduardo Q.", autor_rol: "Estudiante",
    titulo, cuerpo, fijado: false, creado_en: new Date().toISOString(), respuestas: 0,
  });
  return id;
}

export async function hiloPorId(hiloId: string) {
  await respirar();
  const h = HILOS.find((x) => x.id === hiloId);
  return h
    ? { id: h.id, autor_nombre: h.autor_nombre, autor_rol: h.autor_rol,
        titulo: h.titulo, cuerpo: h.cuerpo, creado_en: h.creado_en }
    : null;
}

export async function companerosDe(): Promise<{ id: string; nombre: string }[]> {
  await respirar();
  if (!conInstitucion()) return [];
  return copiar(COMPANEROS);
}

export async function miPerfil(): Promise<Perfil> {
  await respirar();
  const quien = perfilActual();
  return {
    nombre: quien?.nombre ?? "Eduardo Q.",
    correo: quien?.correo ?? "eduardo@studia.cl",
    rol: quien?.rol ?? "estudiante",
  };
}

export async function misDictados(): Promise<Dictado[]> {
  await respirar();
  const quien = perfilActual();
  return (quien?.dicta ?? []).map((asignatura_id) => ({
    asignatura_id,
    papel: quien?.papel ?? "ayudante",
  }));
}

export async function cambiarNombre(): Promise<void> {
  // En demostración el perfil no se guarda en ninguna parte.
}

export async function misNotificaciones(): Promise<Notificacion[]> {
  await respirar();
  if (!conInstitucion()) return [];
  return copiar(notificaciones);
}

export async function marcarLeida(id: string): Promise<void> {
  const n = notificaciones.find((x) => x.id === id);
  if (n) n.leida = true;
}

export async function marcarTodasLeidas(): Promise<void> {
  notificaciones.forEach((n) => { n.leida = true; });
}

export async function mensajesDe(): Promise<MensajeTutor[]> {
  return [];
}

export async function misApuntes(asignaturaId?: string): Promise<ApunteEnLista[]> {
  await respirar();
  const suyos = asignaturaId ? apuntes.filter((a) => a.asignatura_id === asignaturaId) : apuntes;
  // Sin los trazos, igual que contra la base: la lista no los necesita.
  return copiar(suyos).map(({ trazos, ...resto }) => ({ ...resto, tiene_trazos: trazos !== null }));
}

export async function apuntePorId(apunteId: string): Promise<Apunte | null> {
  await respirar();
  const a = apuntes.find((x) => x.id === apunteId);
  return a ? { ...a } : null;
}

export async function crearApunte(
  asignaturaId: string, titulo: string, claseId?: string | null,
): Promise<Apunte> {
  const nuevo: Apunte = {
    id: nuevoId("ap"), asignatura_id: asignaturaId, clase_id: claseId ?? null,
    titulo, contenido: "", trazos: null, fijado: false,
    actualizado_en: new Date().toISOString(),
  };
  apuntes.unshift(nuevo);
  return { ...nuevo };
}

export async function guardarApunte(
  apunteId: string, campos: { titulo?: string; contenido?: string; trazos?: string | null },
): Promise<void> {
  const a = apuntes.find((x) => x.id === apunteId);
  if (!a) return;
  if (campos.titulo !== undefined) a.titulo = campos.titulo;
  if (campos.contenido !== undefined) a.contenido = campos.contenido;
  a.actualizado_en = new Date().toISOString();
}

export async function fijarApunte(apunteId: string, fijado: boolean): Promise<void> {
  const a = apuntes.find((x) => x.id === apunteId);
  if (a) a.fijado = fijado;
}

export async function borrarApunte(apunteId: string): Promise<void> {
  const i = apuntes.findIndex((a) => a.id === apunteId);
  if (i >= 0) apuntes.splice(i, 1);
}

export async function resumenDe(apunteId: string): Promise<ResumenGuardado | null> {
  await respirar();
  const r = resumenes.get(apunteId);
  return r ? { ...r } : null;
}

/** Solo para el modo demostración: guarda el resumen que arma el tutor local. */
export function guardarResumenDemo(apunteId: string, resumen: ResumenGuardado): void {
  resumenes.set(apunteId, resumen);
}

// Lo del docente vive en su propio archivo porque son otras listas, pero
// pasa por la misma fachada: si no, con Supabase conectado las pantallas del
// profesor seguirían mostrando el curso inventado, y en silencio.
import {
  avanceDe, corregir, cursoDe, entregasDe, notasDe, ponerNota, publicarNotas,
} from "./datos-docente.ts";

export {
  avanceDe, corregir, cursoDe, entregasDe, notasDe, ponerNota, publicarNotas,
};

// Y lo que arma quien llega por su cuenta vive en otro archivo más, por la
// misma razón: son sus ramos, no los de una institución.
import {
  borrarRamoPropio, crearHorarioPropio, crearMaterial, crearModulo, crearRamoPropio,
  moduloParaMaterial,
} from "./datos-propios.ts";


// ── El planificador ───────────────────────────────────────────────────────

/**
 * Las sesiones de la demostración empiezan vacías y a propósito.
 *
 * Es la única parte de la aplicación que no tiene nada precargado: si
 * viniera con una semana ya armada, no se vería lo que hace falta ver, que
 * es lo fácil que es armarla uno. Y cuando alguien la arma, queda: son suyas
 * mientras dure la sesión en el aparato.
 */
const sesiones: SesionEstudio[] = [];

export async function misSesiones(desde: Date, hasta: Date): Promise<SesionEstudio[]> {
  await respirar();
  return sesiones
    .filter((s) => {
      const cuando = new Date(s.empieza_en);
      return cuando >= desde && cuando < hasta;
    })
    .sort((a, b) => a.empieza_en.localeCompare(b.empieza_en))
    .map((s) => ({ ...s }));
}

export async function crearSesion(nueva: {
  asignaturaId: string | null;
  titulo: string;
  empiezaEn: Date;
  minutos: number;
}): Promise<SesionEstudio> {
  await respirar();
  // Las mismas dos reglas que la base, para que la demostración se rompa
  // donde se rompe la de verdad y no en otro lado.
  if (nueva.titulo.trim().length === 0) throw new Error("La sesión necesita un título.");
  if (nueva.minutos < 5 || nueva.minutos > 480) {
    throw new Error("Una sesión dura entre 5 minutos y 8 horas.");
  }
  const s: SesionEstudio = {
    id: nuevoId("ses"),
    asignatura_id: nueva.asignaturaId,
    titulo: nueva.titulo.trim(),
    empieza_en: nueva.empiezaEn.toISOString(),
    minutos: nueva.minutos,
    hecha_en: null,
  };
  sesiones.push(s);
  return { ...s };
}

export async function marcarSesion(sesionId: string, hecha: boolean): Promise<void> {
  await respirar();
  const s = sesiones.find((x) => x.id === sesionId);
  if (s) s.hecha_en = hecha ? new Date().toISOString() : null;
}

export async function borrarSesion(sesionId: string): Promise<void> {
  await respirar();
  const i = sesiones.findIndex((x) => x.id === sesionId);
  if (i >= 0) sesiones.splice(i, 1);
}


// ── Los quices ────────────────────────────────────────────────────────────
//
// Los guarda `quiz-demo.ts`, que es donde está el banco de preguntas. Acá
// solo se les pone el respiro de red, para que la pantalla se comporte igual
// con servidor y sin él.

export async function misQuices(asignaturaId?: string): Promise<Quiz[]> {
  await respirar();
  return quicesDemo(asignaturaId);
}

export async function quizPorId(quizId: string): Promise<Quiz | null> {
  await respirar();
  return quizDemoPorId(quizId);
}

export async function responderQuiz(
  quizId: string, respuestas: (number | null)[], terminado: boolean,
): Promise<void> {
  await respirar();
  responderQuizDemo(quizId, respuestas, terminado);
}

export async function borrarQuiz(quizId: string): Promise<void> {
  await respirar();
  borrarQuizDemo(quizId);
}


// ── Las fichas ────────────────────────────────────────────────────────────

export async function misFichas(asignaturaId: string, tema?: string): Promise<Ficha[]> {
  await respirar();
  return fichasDemo(asignaturaId, tema);
}

export async function repasarFicha(fichaId: string, acerto: boolean): Promise<void> {
  await respirar();
  repasarFichaDemo(fichaId, acerto);
}

export {
  borrarRamoPropio, crearHorarioPropio, crearMaterial, crearModulo, crearRamoPropio,
  moduloParaMaterial,
};

// Si en `consultas-supabase.ts` aparece una consulta nueva, esto deja de
// compilar hasta que exista también acá.
const _cobertura: Omit<typeof Real, "default"> = {
  misAsignaturas, miHorario, materiaDe, marcarMaterial, clasesDe, claseEnVivo,
  lecturaPorId, capitulosDe, misTareas, tareaPorId, entregarTarea, evaluacionesDe,
  todasLasEvaluaciones, foroDe, respuestasDe, responderHilo, crearHilo,
  hiloPorId, companerosDe, miPerfil, cambiarNombre, misNotificaciones,
  marcarLeida, marcarTodasLeidas, mensajesDe, misApuntes, apuntePorId, misDictados,
  crearApunte, guardarApunte, fijarApunte, borrarApunte, resumenDe,
  cursoDe, entregasDe, notasDe, avanceDe, corregir, ponerNota, publicarNotas,
  crearRamoPropio, borrarRamoPropio, crearModulo, crearMaterial, crearHorarioPropio,
  moduloParaMaterial, cargarCatalogo, registros, cambiarRol,
  misSesiones, crearSesion, marcarSesion, borrarSesion,
  empezarAEscuchar, subirTramos, cuantosEscuchan, tramosDeLaClase,
  armarLaClase, claseEscrita, permitirEscucha,
  misQuices, quizPorId, responderQuiz, borrarQuiz,
  misFichas, repasarFicha,
};
void _cobertura;

/* ------------------------------------------------------------ modo escucha */

// En demostración no hay curso al otro lado, así que el cruce de versiones no
// tendría con qué cruzar. Se guardan unos tramos de otros aparatos, escritos a
// mano y con los errores que comete un reconocedor de verdad —«el problema del
// valor medio»— para que se vea qué hace el cruce y no un cruce de una sola
// versión, que no cruza nada.
const OTROS_APARATOS: Tramo[] = [
  { aparato: "compañera de adelante", segundo: 0, texto: "Buenos días, hoy vamos a ver el teorema del valor medio", confianza: 0.82 },
  { aparato: "compañero del fondo", segundo: 1, texto: "buenos días hoy vamos a ver el problema del valor medio", confianza: 0.41 },
  { aparato: "la profesora", segundo: 0, texto: "Buenos días, hoy vamos a ver el teorema del valor medio", confianza: 0.91 },
  { aparato: "compañera de adelante", segundo: 22, texto: "si la función es continua en el cerrado y derivable en el abierto", confianza: 0.77 },
  { aparato: "la profesora", segundo: 23, texto: "si la función es continua en el cerrado y derivable en el abierto", confianza: 0.88 },
  { aparato: "compañero del fondo", segundo: 24, texto: "si la función es continua en el cerrado", confianza: 0.35 },
  { aparato: "compañero del fondo", segundo: 48, texto: "profesora, ¿eso entra en el control del miércoles?", confianza: 0.66 },
  { aparato: "la profesora", segundo: 52, texto: "sí, entra, revisen la guía cuatro", confianza: 0.9 },
];

const oidos = new Map<string, Tramo[]>();
const escritas = new Map<string, { segundo: number; texto: string }[]>();

export async function empezarAEscuchar(claseId: string, aparato: string): Promise<string> {
  await respirar();
  if (!oidos.has(claseId)) oidos.set(claseId, [...OTROS_APARATOS]);
  return `${claseId}:${aparato}`;
}

export async function subirTramos(
  claseId: string, escuchaId: string, tramos: readonly TramoOido[],
): Promise<void> {
  await respirar();
  const previos = oidos.get(claseId) ?? [];
  oidos.set(claseId, [
    ...previos,
    ...tramos.map((t) => ({ ...t, aparato: escuchaId })),
  ]);
}

export async function cuantosEscuchan(): Promise<number> {
  await respirar();
  // Los tres de ejemplo más el propio.
  return 4;
}

export async function tramosDeLaClase(claseId: string): Promise<Tramo[]> {
  await respirar();
  return [...(oidos.get(claseId) ?? OTROS_APARATOS)];
}

export async function armarLaClase(
  claseId: string, clase: readonly { segundo: number; texto: string }[],
): Promise<void> {
  await respirar();
  escritas.set(claseId, [...clase]);
  oidos.delete(claseId);   // igual que en la base: armada la clase, sobran
}

export async function claseEscrita(claseId: string): Promise<{ segundo: number; texto: string }[]> {
  await respirar();
  return escritas.get(claseId) ?? [];
}

export async function permitirEscucha(claseId: string, permitida: boolean): Promise<void> {
  await respirar();
  const c = CLASES.find((x) => x.id === claseId);
  if (c) c.escucha_permitida = permitida;
}
