// La sala: uno graba, los demás reciben.
//
// En una clase, en una asamblea o en una reunión de obra graba una sola
// persona —la que tiene el teléfono a mano— y el resultado le sirve a todos
// los que estaban ahí. Que cada uno grabe por su lado sería el mismo audio
// cinco veces, cinco análisis distintos del mismo rato y cinco actas que no
// coinciden.
//
// Así que se graba una vez y se entra a la sala con un código. El código se
// dice en voz alta y se escribe mal, así que todo lo de acá abajo existe
// para que decirlo y escribirlo mal no cueste nada.

/**
 * Sin O/0, I/1/L, S/5, B/8, ni U/V. Son los pares que se confunden al leer
 * un código escrito a mano en la pizarra o al dictarlo en una sala con ruido.
 */
export const ALFABETO = "ACDEFGHJKMNPQRTWXY2346789";

export const LARGO = 6;

/** Cuántos códigos distintos hay. Con esto se decide si hace falta más largo. */
export const CUANTOS_CABEN = ALFABETO.length ** LARGO;

/**
 * Un código nuevo. `azar` se puede reemplazar en las pruebas: un código que
 * no se puede fijar es un código que no se puede probar.
 */
export function nuevoCodigo(azar: () => number = Math.random): string {
  let codigo = "";
  for (let i = 0; i < LARGO; i++) {
    const n = Math.floor(azar() * ALFABETO.length);
    codigo += ALFABETO[Math.min(Math.max(n, 0), ALFABETO.length - 1)];
  }
  return codigo;
}

/**
 * Lo que la persona escribió, convertido en el código que probablemente
 * quiso escribir. Mayúsculas, sin espacios ni guiones, y con las confusiones
 * de siempre corregidas: quien ve un 0 escribe una O, y al revés.
 *
 * Devuelve null si, después de todo eso, no es un código.
 */
export function normalizarCodigo(escrito: string): string | null {
  // Cada línea manda una letra que NO está en el alfabeto a la que sí está y
  // más se le parece. El 8 y el 2 sí están, así que no se tocan: la B se va
  // al 8 y la Z al 2, no al revés.
  const limpio = escrito
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .replace(/[O0]/g, "Q")
    .replace(/[IL1]/g, "J")
    .replace(/[S5]/g, "9")
    .replace(/B/g, "8")
    .replace(/Z/g, "2")
    .replace(/[UV]/g, "W");

  if (limpio.length !== LARGO) return null;
  for (const letra of limpio) {
    if (!ALFABETO.includes(letra)) return null;
  }
  return limpio;
}

/** "ACD-EFG": partido por la mitad, que es como se dicta y como se recuerda. */
export function comoSeMuestra(codigo: string): string {
  const mitad = Math.ceil(codigo.length / 2);
  return `${codigo.slice(0, mitad)}-${codigo.slice(mitad)}`;
}

/**
 * Una sala no queda abierta para siempre. Pasado este rato, quien no entró
 * ya no entra: el código sigue circulando en un grupo de WhatsApp mucho
 * después de que la reunión terminó.
 */
export const HORAS_ABIERTA = 12;

export type Sala = {
  abierta: boolean;
  /** Cuándo se abrió, en ISO. */
  abierta_en: string | null;
};

export function sePuedeEntrar(sala: Sala, ahora: Date = new Date()): boolean {
  if (!sala.abierta || sala.abierta_en === null) return false;
  const abierta = Date.parse(sala.abierta_en);
  if (Number.isNaN(abierta)) return false;
  return ahora.getTime() - abierta < HORAS_ABIERTA * 3_600_000;
}

/** Qué decirle a quien mira la sala. */
export function comoEsta(sala: Sala, cuantos: number, ahora: Date = new Date()): string {
  if (!sePuedeEntrar(sala, ahora)) {
    return cuantos === 0
      ? "La sala está cerrada."
      : `La sala está cerrada. ${cuantos === 1 ? "Una persona alcanzó" : `${cuantos} personas alcanzaron`} a entrar.`;
  }
  if (cuantos === 0) return "Sala abierta. Todavía no entra nadie.";
  return cuantos === 1
    ? "Sala abierta. Una persona entró."
    : `Sala abierta. ${cuantos} personas entraron.`;
}
