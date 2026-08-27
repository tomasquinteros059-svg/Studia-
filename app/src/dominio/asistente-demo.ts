// El asistente del docente, respondiendo sin servidor.
//
// Con Supabase conectado la pregunta va a Claude, que además puede buscar en
// internet. Sin backend no hay a quién preguntarle, así que acá se responden
// las preguntas que un docente hace de verdad, calculadas de los datos del
// curso. No inventa: si el dato no está, lo dice.
//
// La diferencia con el tutor del alumno es de fondo. Al alumno no se le da la
// respuesta nunca, porque el objetivo es que la encuentre. Al docente se le da
// derecho, porque su problema no es aprender: es no perder media hora
// cruzando planillas para saber a quién le escribe.

import {
  aprobacion, distribucion, porRevisar, promedioDelCurso,
  type EntregaDeCurso, type NotaDeCurso,
} from "./curso.ts";

export type AvanceDeAlumno = {
  estudiante_id: string;
  estudiante: string;
  /** Materiales del ramo que marcó como vistos. */
  hechos: number;
  totales: number;
  /** ISO, o null si nunca abrió el ramo. */
  ultimo_acceso: string | null;
};

export type TareaDelCurso = {
  id: string;
  titulo: string;
  puntos: number;
  vence_en: string;
  entregas: EntregaDeCurso[];
};

export type EvaluacionDelCurso = {
  id: string;
  titulo: string;
  peso: number;
  notas: NotaDeCurso[];
};

export type CursoParaElAsistente = {
  codigo: string;
  nombre: string;
  inscritos: { id: string; nombre: string }[];
  tareas: TareaDelCurso[];
  evaluaciones: EvaluacionDelCurso[];
  avance: AvanceDeAlumno[];
};

export type Respuesta = {
  texto: string;
  /** Nombres, uno por línea, cuando la respuesta es una lista de gente. */
  filas: string[];
  /** Lo que el asistente entendió. Vacío si no entendió nada. */
  intencion: Intencion | null;
};

export type Intencion =
  | "sin-entregar"
  | "sin-estudiar"
  | "por-corregir"
  | "como-le-fue"
  | "en-riesgo"
  | "resumen";

const sinAcentos = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const contiene = (texto: string, ...palabras: string[]) =>
  palabras.some((p) => texto.includes(p));

/**
 * Qué está preguntando. El orden importa: las preguntas más específicas se
 * revisan antes, porque "quién no ha entregado" también contiene "quién".
 */
export function entender(pregunta: string): Intencion | null {
  const t = sinAcentos(pregunta);

  // Corregir va primero a propósito: "entregas sin revisar" contiene tanto
  // "entrega" como "sin", y si se preguntara por las entregas antes, esa
  // frase se leería como "quién no entregó", que es lo contrario.
  if (contiene(t, "corregir", "revisar", "pendiente")) return "por-corregir";

  if (contiene(t, "entrego", "entregado", "entrega", "entregaron")) {
    if (contiene(t, "no ", "falta", "sin ", "quien no")) return "sin-entregar";
  }
  if (contiene(t, "estudiando", "estudiado", "estudia", "avance", "material",
                  "vieron", "visto", "conectado", "entrado", "atras", "quedandose",
                  "rezagado", "abandonado")) {
    return "sin-estudiar";
  }
  if (contiene(t, "riesgo", "mal", "reprobando", "reprobar", "peor", "preocupa")) {
    return "en-riesgo";
  }
  if (contiene(t, "como le fue", "promedio", "nota", "control", "prueba", "resultado", "aprobaron", "aprueban")) {
    return "como-le-fue";
  }
  if (contiene(t, "resumen", "como va", "como esta", "estado", "cuentame", "situacion")) return "resumen";
  return null;
}

/** "Josefa Pérez · 2 de 9 materiales · sin entrar hace 12 días" */
const diasDesde = (iso: string | null): number | null => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
};

const enumerar = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

// ── Las respuestas ──────────────────────────────────────────────────────

function sinEntregar(curso: CursoParaElAsistente): Respuesta {
  const ahora = Date.now();
  // La tarea que importa es la que ya venció o está por vencer.
  const tarea = [...curso.tareas]
    .sort((a, b) => Math.abs(new Date(a.vence_en).getTime() - ahora)
                  - Math.abs(new Date(b.vence_en).getTime() - ahora))[0];

  if (!tarea) {
    return { texto: `${curso.nombre} no tiene tareas publicadas.`, filas: [], intencion: "sin-entregar" };
  }

  const entregaron = new Set(
    tarea.entregas.filter((e) => e.entregado_en !== null).map((e) => e.estudiante_id),
  );
  const faltan = curso.inscritos.filter((a) => !entregaron.has(a.id));

  if (faltan.length === 0) {
    return {
      texto: `Entregaron los ${curso.inscritos.length} en «${tarea.titulo}».`,
      filas: [], intencion: "sin-entregar",
    };
  }

  return {
    texto: `En «${tarea.titulo}» faltan ${enumerar(faltan.length, "persona", "personas")} de ${curso.inscritos.length}:`,
    filas: faltan.map((a) => a.nombre),
    intencion: "sin-entregar",
  };
}

function sinEstudiar(curso: CursoParaElAsistente): Respuesta {
  if (curso.avance.length === 0) {
    return {
      texto: `Todavía no hay registro de avance en ${curso.nombre}.`,
      filas: [], intencion: "sin-estudiar",
    };
  }

  // Menos de la mitad del material visto, o más de una semana sin entrar.
  const rezagados = curso.avance
    .filter((a) => {
      const dias = diasDesde(a.ultimo_acceso);
      return (a.totales > 0 && a.hechos / a.totales < 0.5) || dias === null || dias > 7;
    })
    .sort((a, b) => a.hechos / Math.max(1, a.totales) - b.hechos / Math.max(1, b.totales));

  if (rezagados.length === 0) {
    return {
      texto: `El curso viene al día: nadie está bajo la mitad del material ni lleva más de una semana sin entrar.`,
      filas: [], intencion: "sin-estudiar",
    };
  }

  return {
    texto: `${enumerar(rezagados.length, "persona viene", "personas vienen")} quedándose atrás en ${curso.nombre}:`,
    filas: rezagados.map((a) => {
      const dias = diasDesde(a.ultimo_acceso);
      const cuando = dias === null
        ? "nunca ha entrado"
        : dias === 0 ? "entró hoy"
        : `sin entrar hace ${enumerar(dias, "día", "días")}`;
      return `${a.estudiante} · ${a.hechos} de ${a.totales} materiales · ${cuando}`;
    }),
    intencion: "sin-estudiar",
  };
}

function porCorregir(curso: CursoParaElAsistente): Respuesta {
  const pendientes = curso.tareas.flatMap((t) =>
    porRevisar(t.entregas).map((e) => ({ tarea: t.titulo, quien: e.estudiante })));

  if (pendientes.length === 0) {
    return { texto: `No te queda nada por corregir en ${curso.nombre}.`, filas: [], intencion: "por-corregir" };
  }
  return {
    texto: `Te quedan ${enumerar(pendientes.length, "entrega", "entregas")} por corregir:`,
    filas: pendientes.map((p) => `${p.quien} · ${p.tarea}`),
    intencion: "por-corregir",
  };
}

function comoLeFue(curso: CursoParaElAsistente, pregunta: string): Respuesta {
  const t = sinAcentos(pregunta);
  // Si nombró una evaluación, esa; si no, la última con notas puestas.
  const conNotas = curso.evaluaciones.filter((ev) => ev.notas.some((n) => n.nota !== null));
  const nombrada = conNotas.find((ev) => t.includes(sinAcentos(ev.titulo).split(" ")[0] ?? "«»"));
  const ev = nombrada ?? conNotas[conNotas.length - 1];

  if (!ev) {
    return {
      texto: `Todavía no hay notas puestas en ${curso.nombre}.`,
      filas: [], intencion: "como-le-fue",
    };
  }

  const promedio = promedioDelCurso(ev.notas);
  const { aprobados, conNota } = aprobacion(ev.notas);
  const tramos = distribucion(ev.notas).filter((x) => x.cuantos > 0);
  const sinPublicar = ev.notas.filter((n) => n.nota !== null && !n.publicada).length;

  const partes = [
    `En «${ev.titulo}» el promedio fue ${(promedio ?? 0).toFixed(1).replace(".", ",")} y aprobaron ${aprobados} de ${conNota}.`,
  ];
  if (sinPublicar > 0) {
    partes.push(`Ojo: ${enumerar(sinPublicar, "nota está puesta", "notas están puestas")} y el curso todavía no las ve.`);
  }

  return {
    texto: partes.join(" "),
    filas: tramos.map((x) => `${x.desde.toFixed(1)} a ${x.hasta.toFixed(1)} · ${enumerar(x.cuantos, "alumno", "alumnos")}`),
    intencion: "como-le-fue",
  };
}

function enRiesgo(curso: CursoParaElAsistente): Respuesta {
  // El promedio ponderado de lo que ya tiene nota, por alumno.
  const porAlumno = new Map<string, { nombre: string; suma: number; peso: number }>();
  for (const ev of curso.evaluaciones) {
    for (const n of ev.notas) {
      if (n.nota === null) continue;
      const fila = porAlumno.get(n.estudiante_id)
        ?? { nombre: n.estudiante, suma: 0, peso: 0 };
      fila.suma += n.nota * ev.peso;
      fila.peso += ev.peso;
      porAlumno.set(n.estudiante_id, fila);
    }
  }

  const bajos = [...porAlumno.values()]
    .map((x) => ({ nombre: x.nombre, promedio: x.suma / x.peso }))
    .filter((x) => x.promedio < 4)
    .sort((a, b) => a.promedio - b.promedio);

  if (porAlumno.size === 0) {
    return {
      texto: `Todavía no hay notas suficientes para decir quién viene en riesgo.`,
      filas: [], intencion: "en-riesgo",
    };
  }
  if (bajos.length === 0) {
    return {
      texto: `Nadie viene bajo 4,0 con las notas que hay hasta ahora.`,
      filas: [], intencion: "en-riesgo",
    };
  }
  return {
    texto: `${enumerar(bajos.length, "persona viene", "personas vienen")} bajo 4,0 con lo que lleva rendido:`,
    filas: bajos.map((x) => `${x.nombre} · ${x.promedio.toFixed(1).replace(".", ",")}`),
    intencion: "en-riesgo",
  };
}

function resumen(curso: CursoParaElAsistente): Respuesta {
  const pendientes = curso.tareas.reduce((n, t) => n + porRevisar(t.entregas).length, 0);
  const sinPublicar = curso.evaluaciones.reduce(
    (n, ev) => n + ev.notas.filter((x) => x.nota !== null && !x.publicada).length, 0);
  const rezagados = sinEstudiar(curso).filas.length;

  return {
    texto: `${curso.nombre} tiene ${enumerar(curso.inscritos.length, "inscrito", "inscritos")}.`,
    filas: [
      `${enumerar(pendientes, "entrega", "entregas")} por corregir`,
      `${enumerar(sinPublicar, "nota", "notas")} sin publicar`,
      `${enumerar(rezagados, "persona quedándose", "personas quedándose")} atrás`,
    ],
    intencion: "resumen",
  };
}

const NO_ENTENDI: Respuesta = {
  texto: "Todavía no sé responder eso sin servidor. Con el servidor conectado esta pregunta va a Claude, que además puede buscar en internet. Mientras tanto puedo decirte quién no ha entregado, quién viene quedándose atrás, qué te queda por corregir, cómo le fue al curso en una evaluación y quién viene en riesgo.",
  filas: [],
  intencion: null,
};

/** El curso del que habla la pregunta, o el primero si no nombra ninguno. */
export function cursoNombrado(
  pregunta: string, cursos: CursoParaElAsistente[],
): CursoParaElAsistente | null {
  const t = sinAcentos(pregunta);
  return cursos.find((c) =>
    t.includes(sinAcentos(c.nombre)) || t.includes(sinAcentos(c.codigo))) ?? cursos[0] ?? null;
}

export function responder(pregunta: string, cursos: CursoParaElAsistente[]): Respuesta {
  const curso = cursoNombrado(pregunta, cursos);
  if (!curso) {
    return { texto: "Todavía no tienes ramos asignados.", filas: [], intencion: null };
  }

  switch (entender(pregunta)) {
    case "sin-entregar": return sinEntregar(curso);
    case "sin-estudiar": return sinEstudiar(curso);
    case "por-corregir": return porCorregir(curso);
    case "como-le-fue": return comoLeFue(curso, pregunta);
    case "en-riesgo": return enRiesgo(curso);
    case "resumen": return resumen(curso);
    default: return NO_ENTENDI;
  }
}

/** Lo que se ofrece de partida, para que nadie tenga que adivinar. */
export const SUGERENCIAS = [
  "¿Quién no ha entregado?",
  "¿Quién viene quedándose atrás?",
  "¿Qué me queda por corregir?",
  "¿Cómo le fue al curso?",
  "¿Quién viene en riesgo?",
];
