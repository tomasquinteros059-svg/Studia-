// Qué clave se acepta al crearla o al cambiarla.
//
// La regla es distinta según el momento, y esa diferencia importa: al
// **entrar** no se puede exigir nada, porque quien ya tiene una cuenta con una
// clave de seis caracteres tiene derecho a entrar con ella; endurecer la regla
// ahí sería dejar afuera a la gente que ya está adentro. Al **crear** o al
// **cambiar** sí, porque ahí la clave todavía no existe.

/** Lo que se pide de una clave nueva. Ocho es el mínimo que ya nadie discute. */
export const LARGO_MINIMO = 8;

export type Revision = { sirve: true } | { sirve: false; problema: string };

const SIRVE: Revision = { sirve: true };

/**
 * Revisa una clave nueva contra su repetición.
 *
 * Se pide dos veces porque en un teléfono la clave va con puntitos: un dedo
 * que se equivocó no se ve, y el error aparece recién al día siguiente,
 * cuando ya no hay forma de saber qué se escribió.
 */
export function revisarClaveNueva(clave: string, repetida: string): Revision {
  if (!clave) return { sirve: false, problema: "Escribe una clave." };

  // Los espacios al principio o al final no se ven y sí cuentan. Es una
  // manera muy fácil de quedar fuera de la propia cuenta.
  if (clave !== clave.trim()) {
    return { sirve: false, problema: "La clave no puede empezar ni terminar con un espacio." };
  }
  if (clave.length < LARGO_MINIMO) {
    return { sirve: false, problema: `Usa al menos ${LARGO_MINIMO} caracteres.` };
  }
  // Nada de exigir un símbolo y una mayúscula: eso produce «Estudio1!» en
  // todas partes, que es peor que una frase larga. El largo es lo que importa.
  if (repetida !== clave) {
    return { sirve: false, problema: "Las dos claves no son iguales." };
  }
  return SIRVE;
}

/** Al entrar solo se comprueba que haya algo escrito. */
export function hayAlgoQueMandar(correo: string, clave: string): boolean {
  return correo.trim().length > 0 && clave.length > 0;
}
