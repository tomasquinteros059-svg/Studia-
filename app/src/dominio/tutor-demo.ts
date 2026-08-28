// El tutor del modo demostración.
//
// No hay servidor al que preguntar, así que responde con guiones. Sigue la
// misma regla que el tutor real —nunca entrega la respuesta— porque un demo
// que la entregara mostraría un producto que no es este.

const GUIAS = [
  "Buena intuición. ¿Qué paso crees que viene ahora, y por qué ese?",
  "Vas bien. Antes de seguir, ¿cómo podrías verificar si eso funciona?",
  "Interesante. ¿Qué dato del enunciado todavía no has usado?",
  "Casi. ¿Qué pasaría si lo pruebas con un caso simple para comprobarlo?",
  "Vas encaminado. ¿Qué regla o concepto crees que aplica aquí, con tus palabras?",
];

const PIDE_LA_RESPUESTA = /respuesta|dame|resultado|soluci|cu[aá]nto es|resu[eé]lvelo|hazlo por m[ií]|dime la|dime el/i;
// Ojo con `\b`: en JavaScript se basa en el alfabeto inglés, así que "sé"
// termina en un carácter que no considera letra y el límite nunca se cumple.
// Por eso el corte se hace mirando que no siga otra letra, acentos incluidos.
const ESTA_PERDIDO = /no s[eé](?![a-záéíóúñ])|no entiendo|estoy perdid|ni idea|no cacho/i;

export const NEGATIVA =
  "Sé que sería cómodo que te la diera, pero mi misión es que la descubras tú: " +
  "así de verdad aprendes. Vamos por partes. ¿Qué es lo primero que sabes que debes calcular?";

export const RETROCEDER =
  "Tranquilo, empecemos más atrás. Cuéntame con tus palabras qué dice el enunciado: " +
  "¿qué te dan y qué te piden?";

/**
 * `paso` avanza en cada intercambio, para que no repita siempre lo mismo.
 * Devuelve también el paso siguiente, sin guardar estado acá dentro.
 */
export function responderDemo(mensaje: string, paso: number): { texto: string; paso: number } {
  if (PIDE_LA_RESPUESTA.test(mensaje)) return { texto: NEGATIVA, paso };
  if (ESTA_PERDIDO.test(mensaje)) return { texto: RETROCEDER, paso };
  return { texto: GUIAS[paso % GUIAS.length]!, paso: paso + 1 };
}

/** Resumen de apuntes para el modo demostración. */
export function resumenDemo(contenido: string, asignatura: string) {
  const lineas = contenido.split("\n").map((l) => l.trim()).filter(Boolean);
  const primeras = lineas.slice(0, 3).join(" ");

  return {
    cuerpo:
      `Sobre lo que anotaste en ${asignatura}: ${primeras.slice(0, 240)}` +
      (primeras.length > 240 ? "…" : "") +
      "\n\nEste resumen es de demostración: se arma con tus propias líneas. " +
      "Con el servidor conectado lo escribe el tutor, cruzando tus apuntes con el temario del ramo.",
    vacios: [
      "Con Supabase conectado, acá aparece lo que el temario cubre y tu apunte no menciona.",
    ],
    consejos: [
      "Relee tus apuntes en voz alta: lo que no puedas explicar es lo que hay que repasar.",
      "Busca un ejercicio del ramo que use justo esto y resuélvelo sin mirar.",
    ],
    conTranscripcion: false,
  };
}
