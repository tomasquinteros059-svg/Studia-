// Cómo se escribe el nombre de alguien en la pantalla.
//
// Está acá y no en cada pantalla porque las iniciales de una persona salían
// calculadas en tres archivos distintos, y las tres versiones trataban
// distinto los nombres de una sola palabra.

/**
 * El nombre con que se saluda. "Eduardo Quintero Muñoz" → "Eduardo".
 *
 * Devuelve cadena vacía si no hay nombre: quien llama decide si saluda con
 * nombre o sin él, que es más honesto que inventar uno.
 */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}

/**
 * Las iniciales para el avatar. Toma la primera y la última palabra, no las
 * dos primeras: "María de los Ángeles Soto" es MS y no MD.
 *
 * Un nombre de una sola palabra da una sola letra; dos letras exigirían
 * partir la palabra, y "ED" por "Eduardo" no se parece a nada.
 */
export function inicialesDePersona(nombre: string): string {
  const partes = nombre.replace(/\./g, "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  const primera = partes[0]![0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1]![0] ?? "" : "";
  return `${primera}${ultima}`.toUpperCase();
}
