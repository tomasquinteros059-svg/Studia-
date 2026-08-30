// Los quices del modo demostración.
//
// Acá no hay evaluador que escriba preguntas: no hay servidor. Así que en vez
// de fingir uno —una espera de dos segundos y unas preguntas genéricas que no
// son de ningún ramo— están escritas a mano, sobre la materia que la
// demostración de verdad tiene cargada.
//
// Las de Cálculo son de cálculo y las de Física son de física. Que sean pocas
// y ciertas dice más de lo que hace la aplicación que muchas y de relleno.

import type { PreguntaDeQuiz, Quiz } from "./tipos.ts";

type Banco = { tema: RegExp; preguntas: PreguntaDeQuiz[] };

const BANCOS: Banco[] = [
  {
    tema: /límite|continuidad|derivada|integral|cálculo/i,
    preguntas: [
      {
        pregunta: "¿Qué técnica conviene para resolver ∫ x·eˣ dx?",
        opciones: ["Sustitución simple", "Integración por partes", "Fracciones parciales", "Sustitución trigonométrica"],
        correcta: 1,
        explicacion: "Un polinomio multiplicando a una exponencial pide partes: derivas el polinomio hasta que desaparece e integras la exponencial, que no cambia.",
      },
      {
        pregunta: "El teorema del valor medio necesita que la función sea…",
        opciones: [
          "Continua en [a,b] y derivable en (a,b)",
          "Derivable en [a,b] completo, extremos incluidos",
          "Solo continua en [a,b]",
          "Continua y con derivada continua",
        ],
        correcta: 0,
        explicacion: "El error típico es pedir derivabilidad en los extremos. No hace falta: basta con que sea continua ahí y derivable adentro.",
      },
      {
        pregunta: "∫₁^∞ 1/x² dx …",
        opciones: ["Diverge", "Converge a 1", "Converge a 0", "No se puede evaluar"],
        correcta: 1,
        explicacion: "El límite de [−1/x] entre 1 y b cuando b→∞ da 0 − (−1) = 1. La regla corta: 1/xᵖ converge en [1,∞) si p > 1.",
      },
      {
        pregunta: "Si una función es derivable en un punto, entonces en ese punto…",
        opciones: [
          "Es continua",
          "Tiene un máximo o un mínimo",
          "Su derivada es continua",
          "Es creciente",
        ],
        correcta: 0,
        explicacion: "Derivable implica continua, pero no al revés: |x| es continua en 0 y no derivable ahí. Esa flecha en un solo sentido es la que más se da vuelta.",
      },
      {
        pregunta: "Para ∫ √(1−x²) dx, ¿qué sustitución usarías?",
        opciones: ["u = 1−x²", "x = sen(θ)", "x = tan(θ)", "Integración por partes"],
        correcta: 1,
        explicacion: "La forma √(a²−x²) pide x = a·sen(θ): como 1 − sen²θ = cos²θ, la raíz desaparece y queda una integral de coseno.",
      },
    ],
  },
  {
    tema: /física|newton|cinemática|dinámica|energía/i,
    preguntas: [
      {
        pregunta: "Un cuerpo se mueve con velocidad constante. La fuerza neta sobre él es…",
        opciones: ["Cero", "Constante y distinta de cero", "Proporcional a la velocidad", "Igual al peso"],
        correcta: 0,
        explicacion: "Velocidad constante es aceleración cero, y por la segunda ley eso obliga a fuerza neta cero. Que se mueva no significa que algo lo esté empujando.",
      },
      {
        pregunta: "En el diagrama de cuerpo libre de un libro sobre una mesa, la normal y el peso…",
        opciones: [
          "Son un par de acción y reacción",
          "Actúan sobre el mismo cuerpo, así que no son par acción-reacción",
          "Siempre son iguales aunque la mesa esté inclinada",
          "Se suman en la misma dirección",
        ],
        correcta: 1,
        explicacion: "Un par acción-reacción actúa sobre cuerpos distintos. Peso y normal actúan los dos sobre el libro: se cancelan, pero no son ese par.",
      },
      {
        pregunta: "Se lanza una piedra hacia arriba. En el punto más alto, su aceleración es…",
        opciones: ["Cero", "g, hacia abajo", "g, hacia arriba", "Depende de la velocidad inicial"],
        correcta: 1,
        explicacion: "La velocidad es cero ahí, pero la aceleración no: la gravedad no se apaga. Confundir velocidad cero con aceleración cero es el error clásico.",
      },
      {
        pregunta: "La energía mecánica se conserva cuando…",
        opciones: [
          "No hay roce ni otras fuerzas no conservativas",
          "El cuerpo se mueve en línea recta",
          "La velocidad es constante",
          "Siempre, es una ley universal",
        ],
        correcta: 0,
        explicacion: "Con roce, parte de la energía se va como calor y la mecánica ya no se conserva. La que siempre se conserva es la energía total, no la mecánica.",
      },
    ],
  },
];

/** Preguntas de fondo, cuando el tema no calza con ningún banco. */
const GENERAL: PreguntaDeQuiz[] = [
  {
    pregunta: "Repasar espaciado en el tiempo funciona mejor que estudiar de una porque…",
    opciones: [
      "Se ocupan menos horas en total",
      "Recuperar algo casi olvidado es lo que lo fija",
      "Permite leer más rápido",
      "Evita tener que tomar apuntes",
    ],
    correcta: 1,
    explicacion: "El esfuerzo de recuperar es lo que consolida. Releer se siente productivo y no lo es: la sensación de facilidad no es señal de aprendizaje.",
  },
  {
    pregunta: "Terminas de leer un capítulo y lo entendiste todo. ¿Qué conviene hacer?",
    opciones: [
      "Pasar al siguiente, ya está",
      "Cerrarlo y explicarlo de memoria, en voz alta",
      "Releerlo subrayando",
      "Copiar el resumen del final",
    ],
    correcta: 1,
    explicacion: "Entender leyendo y poder explicar sin mirar son cosas distintas, y la prueba pide la segunda. Cerrar el libro es lo que revela el hueco.",
  },
  {
    pregunta: "¿Cuál es el mejor momento para descubrir que no entendiste algo?",
    opciones: ["Durante la prueba", "La noche anterior", "Ahora", "Cuando salen las notas"],
    correcta: 2,
    explicacion: "Por eso el quiz no vale nota y no lo ve nadie más: equivocarse acá es exactamente para lo que sirve.",
  },
];

let siguiente = 1;

/**
 * Los quices hechos en esta sesión. Viven acá y no en `datos-demo.ts` porque
 * el banco de preguntas ya está en este archivo, y porque así el modo
 * demostración guarda las respuestas igual que la base: se puede dejar un
 * quiz a medias, cerrarlo y encontrarlo donde quedó.
 */
const hechos: Quiz[] = [];

/**
 * Arma un quiz de mentira pero con preguntas de verdad.
 *
 * El tema llega como texto y no se busca en la base porque acá no hay base.
 * En el servidor es al revés a propósito: el título del módulo se lee de la
 * base con el token de quien pregunta, y lo que mande el cliente da lo mismo.
 */
export function quizDemo(entrada: {
  asignaturaId: string; tema: string; cuantas: number;
}): Quiz {
  const banco = BANCOS.find((b) => b.tema.test(entrada.tema))?.preguntas ?? GENERAL;
  const preguntas = banco.slice(0, Math.max(3, Math.min(entrada.cuantas, banco.length)));

  const quiz: Quiz = {
    id: `quiz-demo-${siguiente++}`,
    asignatura_id: entrada.asignaturaId,
    tema: entrada.tema,
    preguntas,
    respuestas: [],
    terminado_en: null,
    creado_en: new Date().toISOString(),
  };
  hechos.unshift(quiz);
  return { ...quiz };
}

export const quicesDemo = (asignaturaId?: string): Quiz[] =>
  hechos.filter((q) => !asignaturaId || q.asignatura_id === asignaturaId).map((q) => ({ ...q }));

export const quizDemoPorId = (id: string): Quiz | null => {
  const q = hechos.find((x) => x.id === id);
  return q ? { ...q } : null;
};

export function responderQuizDemo(
  id: string, respuestas: (number | null)[], terminado: boolean,
): void {
  const q = hechos.find((x) => x.id === id);
  if (!q) throw new Error("Ese quiz no es tuyo.");
  // La misma guardia que la función de la base.
  if (respuestas.length > q.preguntas.length) {
    throw new Error("Mandaste más respuestas que preguntas.");
  }
  q.respuestas = respuestas;
  q.terminado_en = terminado ? new Date().toISOString() : null;
}

export function borrarQuizDemo(id: string): void {
  const i = hechos.findIndex((x) => x.id === id);
  if (i >= 0) hechos.splice(i, 1);
}
