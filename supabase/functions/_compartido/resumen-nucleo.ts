// Resumen de fin de clase: cruza lo que el estudiante escribió con la materia
// del ramo y, cuando exista, con lo que se dijo en la sala.
//
// Sin dependencias del entorno, para poder probarlo sin Deno ni Claude.

export type ContextoResumen = {
  asignatura: string;
  codigo: string;
  profesor: string;
  /** Títulos del material del ramo, para detectar lo que el apunte no menciona. */
  temario: string[];
  /** Lo que se dijo en clase, si hay transcripción. Vacío mientras no la haya. */
  transcripcion: string;
  apunte: string;
};

export type Resumen = { cuerpo: string; vacios: string[]; consejos: string[] };

export const LARGO_MAXIMO_APUNTE = 20_000;

export function promptResumen(ctx: ContextoResumen): string {
  const partes = [
    `Eres el tutor de StudIA acompañando a un estudiante de ${ctx.asignatura} (${ctx.codigo}), ramo que dicta ${ctx.profesor}. El estudiante acaba de terminar una clase y te entrega los apuntes que tomó.`,

    `Tu tarea es devolverle un resumen útil de SUS apuntes, señalarle qué de la materia no quedó registrado, y darle consejos concretos de estudio sobre este contenido.`,

    `SIGUE VALIENDO LA REGLA DE FONDO: no resuelves ejercicios. Si en los apuntes hay un ejercicio a medias, no lo terminas; señalas qué falta y qué pregunta debería hacerse para seguir. Resumir lo que el propio estudiante escribió sí está permitido: eso no es hacerle la tarea.`,

    `Responde EXACTAMENTE en este formato, sin nada antes ni después:

RESUMEN
(dos o tres párrafos cortos, en segunda persona, con las ideas centrales tal como quedaron en sus apuntes. Si algo quedó anotado de forma confusa o incorrecta, dilo con cuidado y explica el concepto.)

VACIOS
- (un punto por cada tema del temario que la clase probablemente cubrió y el apunte no menciona. Si no falta nada, escribe una sola línea: "- ninguno")

CONSEJOS
- (dos a cuatro consejos concretos para estudiar ESTE contenido: qué repasar primero, con qué ejercicio comprobar que se entendió, qué error es típico aquí. Nada genérico como "estudia todos los días".)`,

    `Escribes en español de Chile, tratando de tú, sin encabezados extra ni listas anidadas.`,

    `Temario del ramo:\n${ctx.temario.map((t) => `- ${t}`).join("\n") || "- (sin material cargado)"}`,
  ];

  if (ctx.transcripcion.trim()) {
    partes.push(
      `Lo que se dijo en la clase (transcripción):\n${ctx.transcripcion.trim()}`,
    );
  } else {
    partes.push(
      "No hay transcripción de esta clase, así que trabaja solo con los apuntes y el temario. No inventes lo que el profesor dijo.",
    );
  }

  partes.push(`Apuntes del estudiante:\n${ctx.apunte.trim()}`);

  return partes.join("\n\n");
}

/** Convierte las viñetas de un bloque en una lista limpia. */
function vinetas(bloque: string): string[] {
  return bloque
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((l) => l.length > 0)
    .filter((l) => l.toLowerCase() !== "ninguno" && l.toLowerCase() !== "ninguna");
}

/**
 * Parte la respuesta en sus tres bloques. Si el modelo no respeta el formato,
 * se prefiere devolver todo como resumen antes que perder el contenido.
 */
export function partirRespuesta(texto: string): Resumen {
  const limpio = texto.trim();
  if (!limpio) return { cuerpo: "", vacios: [], consejos: [] };

  // Tolerante a acentos, minúsculas y adornos tipo "## RESUMEN" o "**VACÍOS**".
  const encabezado = (nombre: string) =>
    new RegExp(`^[\\s#*_>]*${nombre}[\\s:*_]*$`, "im");

  const iResumen = limpio.search(encabezado("RESUMEN"));
  const iVacios = limpio.search(encabezado("VAC[IÍ]OS"));
  const iConsejos = limpio.search(encabezado("CONSEJOS"));

  // Sin ningún encabezado reconocible, todo es el resumen.
  if (iVacios < 0 && iConsejos < 0) {
    return { cuerpo: quitarEncabezado(limpio), vacios: [], consejos: [] };
  }

  // El resumen llega hasta el PRIMERO de los otros dos encabezados, venga en
  // el orden que venga: tomar el primero del arreglo se comía una sección.
  const siguientes = [iVacios, iConsejos].filter((i) => i >= 0);
  const finResumen = siguientes.length ? Math.min(...siguientes) : limpio.length;
  const inicioResumen = iResumen >= 0 ? iResumen : 0;

  const cuerpo = quitarEncabezado(limpio.slice(inicioResumen, finResumen));

  let vacios: string[] = [];
  if (iVacios >= 0) {
    const fin = iConsejos > iVacios ? iConsejos : limpio.length;
    vacios = vinetas(quitarEncabezado(limpio.slice(iVacios, fin)));
  }

  let consejos: string[] = [];
  if (iConsejos >= 0) {
    const fin = iVacios > iConsejos ? iVacios : limpio.length;
    consejos = vinetas(quitarEncabezado(limpio.slice(iConsejos, fin)));
  }

  return { cuerpo, vacios, consejos };
}

function quitarEncabezado(bloque: string): string {
  return bloque
    .replace(/^[\s#*_>]*(RESUMEN|VAC[IÍ]OS|CONSEJOS)[\s:*_]*\n?/i, "")
    .trim();
}

export function validarApunte(contenido: unknown): { ok: true; texto: string } | { ok: false; motivo: string } {
  if (typeof contenido !== "string") return { ok: false, motivo: "El apunte debe ser texto." };
  const texto = contenido.trim();
  if (texto.length < 40) {
    return { ok: false, motivo: "Escribe un poco más antes de pedir el resumen: con dos líneas no hay mucho que resumir." };
  }
  if (texto.length > LARGO_MAXIMO_APUNTE) {
    return { ok: false, motivo: "El apunte es demasiado largo para resumirlo de una vez. Divídelo por clase." };
  }
  return { ok: true, texto };
}
