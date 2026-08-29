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

// ── El registro, como lo mira la administración ─────────────────────────

export type Rol = "estudiante" | "profesor" | "administrador";

/** Cómo se nombra cada rol en pantalla. */
export const NOMBRE_DEL_ROL: Record<Rol, string> = {
  estudiante: "Estudiante",
  profesor: "Docente",
  administrador: "Administración",
};

/**
 * Busca por nombre o por correo, sin importar tildes ni mayúsculas.
 *
 * Con mil registros, escribir "jose" y que no aparezca José es la manera más
 * rápida de que alguien crea que la persona no está inscrita.
 */
export function buscar<T extends { nombre: string; correo: string }>(
  gente: readonly T[], texto: string,
): T[] {
  const aguja = plano(texto);
  if (!aguja) return [...gente];
  return gente.filter((p) => plano(p.nombre).includes(aguja) || plano(p.correo).includes(aguja));
}

const plano = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Cuántas personas hay de cada rol, para decirlo de una. */
export function cuentaPorRol(gente: readonly { rol: Rol }[]): Record<Rol, number> {
  const cuenta: Record<Rol, number> = { estudiante: 0, profesor: 0, administrador: 0 };
  for (const p of gente) cuenta[p.rol] += 1;
  return cuenta;
}
