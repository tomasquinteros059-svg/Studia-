// Cómo se nombra un ramo que arma la propia persona.
//
// Vive en el dominio porque lo usan los dos lados —la base y la
// demostración— y tienen que llegar exactamente al mismo nombre y al mismo
// código: si no, el mismo ramo se vería distinto según dónde esté guardado.

/** Sin espacios de sobra: alguien que escribe rápido deja dos, y se nota. */
export const normalizar = (nombre: string): string => nombre.replace(/\s+/g, " ").trim();

/**
 * "MIS-ESTADISTICA". Corto, sin acentos y estable: es lo que la persona ve
 * en la franja de color de su propio ramo, donde los demás ven MAT1610.
 */
export function codigoDe(nombre: string): string {
  const base = normalizar(nombre)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18)
    .replace(/-$/, "");
  return `MIS-${base || "RAMO"}`;
}

/** Lo primero que dice el tutor en un ramo que nadie dicta. */
export const introDe = (nombre: string): string =>
  `¿En qué parte de ${normalizar(nombre)} estás? Cuéntame qué intentaste.`;
