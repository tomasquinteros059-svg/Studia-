// A qué color corresponde cada ramo.
//
// Vive en el dominio y no en el tema porque no es una decisión de estilo: es
// la regla de orientación de la aplicación. El color de un ramo es cómo la
// persona sabe dónde está sin leer nada, y tiene que ser el mismo siempre,
// venga el dato como venga.

/**
 * Los seis colores, en el orden en que se reparten.
 *
 * Están afinados para convivir: mismo peso visual y saturación parecida, de
 * modo que en una cuadrícula ninguno se coma a los demás. Es la diferencia
 * entre una paleta y un semáforo.
 */
export const COLORES_DE_RAMO = [
  "#2563C9", // azul
  "#6D3FD1", // morado
  "#C25A18", // naranja quemado
  "#0F6E6E", // verde azulado
  "#C4326B", // frambuesa
  "#0E5A8A", // azul petróleo
] as const;

const esDeLaPaleta = (c: string): boolean =>
  (COLORES_DE_RAMO as readonly string[]).some((x) => x.toLowerCase() === c.toLowerCase());

/**
 * El color de un ramo. Si el dato trae uno de la paleta, se respeta; si trae
 * otro —un color viejo, o basura— se le asigna uno a partir de su
 * identificador: estable, y sin depender de que los datos vengan bien.
 */
export function colorDeRamo(id: string, propuesto?: string | null): string {
  if (typeof propuesto === "string" && /^#[0-9A-Fa-f]{6}$/.test(propuesto) && esDeLaPaleta(propuesto)) {
    return propuesto;
  }
  let suma = 0;
  for (let i = 0; i < id.length; i++) suma = (suma * 31 + id.charCodeAt(i)) >>> 0;
  return COLORES_DE_RAMO[suma % COLORES_DE_RAMO.length]!;
}

/** Las iniciales de un ramo, para la baldosa: "Cálculo I" → "CI". */
export function inicialesDeRamo(nombre: string): string {
  const palabras = nombre
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length > 0 && !MENUDAS.has(p.toLowerCase()));

  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0]!.slice(0, 2).toUpperCase();
  return (palabras[0]![0]! + palabras[1]![0]!).toUpperCase();
}

/** Palabras que no aportan a unas iniciales. */
const MENUDAS = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "a", "en"]);

/**
 * Cuánto del material de un ramo está marcado como visto, en porcentaje.
 *
 * Es la única cifra de avance que la aplicación puede dar sin inventar: sale
 * de lo que la persona marcó, no de una estimación de cuánto «debería» llevar.
 * Un ramo sin material cargado no lleva 0% ni 100%: no lleva nada, y por eso
 * devuelve null en vez de un número que no significa nada.
 */
export function porcentajeVisto(
  modulos: readonly { materiales: readonly { completado: boolean }[] }[],
): number | null {
  const todos = modulos.flatMap((m) => m.materiales);
  if (todos.length === 0) return null;
  return Math.round((todos.filter((x) => x.completado).length / todos.length) * 100);
}
