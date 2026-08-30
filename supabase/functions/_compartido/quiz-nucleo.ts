// El quiz: preguntas hechas a partir del material del propio ramo.
//
// Es la única parte del sistema donde Claude escribe algo que después se
// corrige solo, y eso obliga a ser más estricto que en el resto: una pregunta
// mal formada —sin respuesta correcta, con dos correctas, con alternativas
// repetidas— no se muestra a medias, se descarta. Vale más un quiz de tres
// preguntas buenas que uno de cinco con una que miente.
//
// Sin dependencias del entorno, para poder probarlo sin Deno ni Claude.

export type Pregunta = {
  /** El enunciado. */
  pregunta: string;
  /** Siempre cuatro, en el orden en que se muestran. */
  opciones: string[];
  /** Índice de la correcta dentro de `opciones`. */
  correcta: number;
  /** Por qué es esa, y qué error es típico acá. Se muestra al responder. */
  explicacion: string;
};

export type ContextoQuiz = {
  asignatura: string;
  codigo: string;
  /** El módulo o tema sobre el que se pregunta. */
  tema: string;
  /** Los títulos del material de ese tema: es de ahí que salen las preguntas. */
  materiales: string[];
  /** El texto de las lecturas, si lo hay. Es lo que hace que el quiz sea de este ramo. */
  texto: string;
  cuantas: number;
};

export const CUANTAS_POR_DEFECTO = 5;
export const MINIMO_DE_PREGUNTAS = 3;
export const MAXIMO_DE_PREGUNTAS = 8;
export const LARGO_MAXIMO_TEXTO = 30_000;

export function promptQuiz(ctx: ContextoQuiz): string {
  const partes = [
    `Eres el evaluador de StudIA. Preparas preguntas de repaso para un estudiante de ${ctx.asignatura} (${ctx.codigo}) sobre el tema «${ctx.tema}».`,

    `Escribe ${ctx.cuantas} preguntas de alternativas sobre ESE material y nada más. No preguntes por cosas que el material no cubre: el estudiante va a creer que le falta estudiar algo que su ramo nunca pasó.`,

    `Cada pregunta tiene cuatro alternativas y una sola correcta. Las tres incorrectas tienen que ser errores plausibles —del tipo que alguien comete de verdad al estudiar esto— y no alternativas de relleno evidentemente falsas. Que la correcta no sea siempre la más larga.`,

    `Pregunta por comprensión, no por memoria: qué técnica conviene y por qué, qué pasa si cambia una condición, cuál es el error típico. Nada de «¿en qué año…?» ni de definiciones que se copian del apunte.`,

    `Responde SOLO con un arreglo JSON, sin texto antes ni después, sin bloque de código. Cada elemento:
{"pregunta": "...", "opciones": ["...", "...", "...", "..."], "correcta": 0, "explicacion": "..."}

«correcta» es el índice —de 0 a 3— de la alternativa correcta dentro de «opciones». «explicacion» son una o dos frases que digan por qué es esa y qué error es típico acá; se le muestran al estudiante justo después de que responde, así que háblale de tú.`,

    `Escribes en español de Chile.`,

    `Material del tema:\n${ctx.materiales.map((m) => `- ${m}`).join("\n") || "- (sin material cargado)"}`,
  ];

  if (ctx.texto.trim()) {
    partes.push(`Contenido de las lecturas:\n${ctx.texto.trim().slice(0, LARGO_MAXIMO_TEXTO)}`);
  } else {
    partes.push(
      "No hay lecturas cargadas de este tema, así que trabaja con los títulos del material y lo que es estándar en un curso de este nivel. No inventes contenido específico del ramo.",
    );
  }

  return partes.join("\n\n");
}

/**
 * Lee el JSON que devolvió el modelo y se queda solo con las preguntas sanas.
 *
 * Tolera lo que los modelos hacen igual aunque se les pida que no: envolver el
 * arreglo en un bloque de código, anteponer una frase de cortesía, o meterlo
 * dentro de un objeto con una llave cualquiera.
 */
export function leerPreguntas(texto: string): Pregunta[] {
  const crudo = extraerArreglo(texto);
  if (!Array.isArray(crudo)) return [];
  return crudo.map(comoPregunta).filter((p): p is Pregunta => p !== null);
}

function extraerArreglo(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  const intentar = (s: string): unknown => {
    try { return JSON.parse(s); } catch { return undefined; }
  };

  const directo = intentar(limpio);
  if (Array.isArray(directo)) return directo;
  // Un objeto que envuelve el arreglo: {"preguntas": [...]}.
  if (directo && typeof directo === "object") {
    for (const v of Object.values(directo as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
    }
  }

  // Última salida: el primer arreglo que aparezca en el texto.
  const desde = limpio.indexOf("[");
  const hasta = limpio.lastIndexOf("]");
  if (desde >= 0 && hasta > desde) return intentar(limpio.slice(desde, hasta + 1));
  return undefined;
}

/**
 * Una pregunta solo pasa si está entera: enunciado, cuatro alternativas
 * distintas, un índice que existe, y explicación. Cualquier otra cosa se
 * descarta en silencio; mostrarla a medias sería peor.
 */
function comoPregunta(x: unknown): Pregunta | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;

  const pregunta = typeof o.pregunta === "string" ? o.pregunta.trim() : "";
  const explicacion = typeof o.explicacion === "string" ? o.explicacion.trim() : "";
  if (pregunta.length < 8 || explicacion.length < 8) return null;

  if (!Array.isArray(o.opciones) || o.opciones.length !== 4) return null;
  const opciones = o.opciones.map((v) => (typeof v === "string" ? v.trim() : ""));
  if (opciones.some((v) => v.length === 0)) return null;

  // Dos alternativas iguales hacen que haya dos correctas o ninguna.
  const distintas = new Set(opciones.map((v) => v.toLowerCase()));
  if (distintas.size !== 4) return null;

  // Un índice escrito como texto —"1"— se acepta: el modelo lo hace igual y
  // no hay ambigüedad. Lo que no se acepta es que falte: `Number(null)` es
  // cero, y cero es un índice válido, así que un `correcta` ausente se
  // convertiría en «la alternativa A» y el quiz mentiría con toda naturalidad.
  const crudo = o.correcta;
  const esNumero = typeof crudo === "number";
  const esTextoDeNumero = typeof crudo === "string" && crudo.trim() !== "";
  if (!esNumero && !esTextoDeNumero) return null;
  const correcta = Number(crudo);
  if (!Number.isInteger(correcta) || correcta < 0 || correcta > 3) return null;

  return { pregunta, opciones, correcta, explicacion };
}

/** Cuántas pedir: ni una sola ni una tanda que nadie termina. */
export function cuantasPedir(pedidas: unknown): number {
  const n = Math.round(Number(pedidas));
  if (!Number.isFinite(n)) return CUANTAS_POR_DEFECTO;
  return Math.min(MAXIMO_DE_PREGUNTAS, Math.max(MINIMO_DE_PREGUNTAS, n));
}

/**
 * Un quiz sirve si quedaron suficientes preguntas sanas después de filtrar.
 * Con menos de tres no es un repaso, es una anécdota.
 */
export function suficientes(preguntas: readonly Pregunta[]): boolean {
  return preguntas.length >= MINIMO_DE_PREGUNTAS;
}
