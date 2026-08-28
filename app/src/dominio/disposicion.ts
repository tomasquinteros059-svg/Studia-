// Cómo se reparte la pantalla según el ancho disponible.
//
// El corte va por ANCHO, nunca por tipo de aparato: una tablet en vertical
// tiene el mismo espacio útil que un teléfono grande y debe verse igual, y una
// tablet que gira cambia de forma sin reiniciar nada. Preguntar "¿tablet o
// celular?" al arrancar sería una pregunta cuya respuesta correcta cambia al
// girar el aparato.

export type Ancho = "compacto" | "medio" | "amplio";

export const CORTE_MEDIO = 620;
export const CORTE_AMPLIO = 900;

export function clasificarAncho(ancho: number): Ancho {
  if (ancho >= CORTE_AMPLIO) return "amplio";
  if (ancho >= CORTE_MEDIO) return "medio";
  return "compacto";
}

/** Dos columnas —contenido y tutor— solo cuando de verdad caben. */
export function admiteDosPaneles(ancho: number): boolean {
  return ancho >= CORTE_AMPLIO;
}

/** Cuántas tarjetas de asignatura caben en una fila. */
export function columnasDeTarjetas(ancho: number): number {
  if (ancho >= 1250) return 3;
  if (ancho >= CORTE_MEDIO) return 2;
  return 1;
}

/**
 * Un texto que cruza toda una tablet es incómodo de leer. Se limita el ancho
 * de la columna y se centra; en un teléfono no hace nada porque nunca sobra.
 */
export const ANCHO_LECTURA = 760;

export function anchoDeContenido(ancho: number): number {
  return Math.min(ancho, ANCHO_LECTURA);
}

/** En pantalla amplia las secciones caben a la vista y el menú sobra. */
export function muestraBarraDeSecciones(ancho: number): boolean {
  return ancho >= CORTE_AMPLIO;
}

/** Lo que se deja de aire entre dos tarjetas, en porcentaje de la fila. */
export const SEPARACION_TARJETAS = 3;

/**
 * El porcentaje de fila que ocupa cada tarjeta de una rejilla de `columnas`.
 *
 * Descuenta exactamente la separación que la rejilla deja entre tarjetas. Si
 * descontara menos, la suma pasaría del 100% y las tarjetas se irían una
 * debajo de la otra: una cuadrícula de una sola columna en una pantalla
 * ancha, que es justo lo que la rejilla venía a evitar.
 */
export function anchoDeTarjeta(columnas: number): `${number}%` {
  if (columnas <= 1) return "100%";
  const huecos = SEPARACION_TARJETAS * (columnas - 1);
  return `${(100 - huecos) / columnas}%`;
}
