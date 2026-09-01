// Cómo se le cuenta a alguien que algo falló.
//
// Nace de mirar la app sin señal. Lo que aparecía era esto:
//
//     No pude cargar tus asignaturas: TypeError: Network request failed
//
// Un mensaje en dos idiomas, con el nombre de una clase de JavaScript adentro,
// que además no dice lo único que la persona necesita saber: que el problema
// es el internet y que se arregla solo cuando vuelva. La mitad de las veces
// que una aplicación «se ve rota» es esto.
//
// Las cuatro fallas que pasan de verdad son siempre las mismas, y ninguna se
// arregla igual: no hay red, la sesión venció, no hay permiso, o eso ya no
// existe. Cada una lleva a algo distinto, así que cada una tiene que decirse
// distinto.

/** Qué clase de problema fue. Sirve para decidir si vale la pena reintentar. */
export type Clase = "red" | "sesion" | "permiso" | "no_esta" | "otra";

const SEÑALES: [Clase, RegExp][] = [
  // «Network request failed» es la de fetch; «Failed to fetch» la del
  // navegador; las otras dos salen cuando el aparato pierde la red a media
  // petición, que es lo que pasa al salir del edificio.
  ["red", /network request failed|failed to fetch|networkerror|load failed|\btime[d]? ?out\b|abort/i],
  ["sesion", /\bjwt\b|token.*(expired|invalid)|refresh.token|not authenticated|401/i],
  ["permiso", /row-level security|permission denied|not authorized|forbidden|403/i],
  ["no_esta", /pgrst116|no rows|not found|404/i],
];

/**
 * Una falla que se acuerda de qué clase era.
 *
 * Existe por un problema concreto y difícil de ver: en cuanto el mensaje se
 * traduce —«Parece que no hay internet…»— deja de parecerse a lo que lo
 * causó, y volver a mirarlo para clasificarlo devuelve «otra». Eso hacía que
 * la copia guardada en el aparato no se usara nunca, justo cuando hacía falta.
 *
 * Con la clase adjunta, quien la recibe no tiene que adivinar leyendo texto.
 */
export class Falla extends Error {
  readonly clase: Clase;
  constructor(mensaje: string, clase: Clase) {
    super(mensaje);
    this.name = "Falla";
    this.clase = clase;
  }
}

/** El mensaje dicho para alguien, y la clase adjunta para el código. */
export function comoFalla(algo: unknown, contexto?: string): Falla {
  const crudo = algo instanceof Error ? algo.message : typeof algo === "string" ? algo : "";
  return new Falla(comoSeDice(algo, contexto), claseDe(crudo));
}

/** Qué clase de falla es, mirando primero si ella misma lo dice. */
export function claseDeLaFalla(algo: unknown): Clase {
  if (algo instanceof Falla) return algo.clase;
  return claseDe(algo instanceof Error ? algo.message : typeof algo === "string" ? algo : "");
}

export function claseDe(mensaje: string): Clase {
  for (const [clase, señal] of SEÑALES) if (señal.test(mensaje)) return clase;
  return "otra";
}

const SE_DICE: Record<Exclude<Clase, "otra">, string> = {
  red: "Parece que no hay internet. Revisa tu conexión y vuelve a intentarlo.",
  sesion: "Tu sesión venció. Vuelve a entrar.",
  permiso: "No tienes permiso para ver esto.",
  no_esta: "Eso ya no está.",
};

/** Si tiene sentido ofrecer «volver a intentar», o si insistir no va a servir. */
export function vale_reintentar(clase: Clase): boolean {
  return clase === "red" || clase === "otra";
}

/**
 * El mensaje que se muestra.
 *
 * `contexto` es lo que la aplicación estaba haciendo —«No pude cargar tus
 * asignaturas»—, escrito por quien programó la consulta. Se usa cuando la
 * falla no es de las conocidas: sirve para ubicarse. Cuando sí es conocida, la
 * causa importa más que el paso: da lo mismo qué se estaba cargando si lo que
 * pasa es que no hay internet.
 */
export function comoSeDice(falla: unknown, contexto?: string): string {
  const crudo = falla instanceof Error ? falla.message
    : typeof falla === "string" ? falla
      : "";

  const clase = claseDe(crudo);
  if (clase !== "otra") return SE_DICE[clase];

  const limpio = contexto?.trim();
  if (limpio) return limpio.endsWith(".") ? limpio : `${limpio}.`;

  // Sin contexto, hay dos casos y confundirlos cuesta caro en las dos
  // direcciones. Un mensaje que alguien escribió pensando en quien lo va a
  // leer —«No pude cargar tus asignaturas»— hay que dejarlo pasar: cambiarlo
  // por uno genérico es perder lo único que ubicaba a la persona. Uno técnico
  // hay que taparlo: no le sirve a quien lo lee, y quien sí lo necesita lo
  // tiene en la tabla de caídas.
  if (pareceEscritoParaAlguien(crudo)) return crudo;
  return "Algo salió mal. Vuelve a intentarlo.";
}

/** Marcas de que un texto salió de una máquina y no de una persona. */
const DE_MAQUINA =
  /\b(TypeError|ReferenceError|SyntaxError|RangeError|Error:|undefined|null|NaN)\b|\sat\s\S+\(|_|::|\{|\}/;

/**
 * Si este mensaje parece escrito para que alguien lo lea.
 *
 * No hay forma exacta de saberlo; lo que hay son señales. Una frase pensada
 * para una persona empieza en mayúscula, tiene espacios y no nombra clases de
 * JavaScript ni trae rastros de una pila.
 */
export function pareceEscritoParaAlguien(mensaje: string): boolean {
  const t = mensaje.trim();
  if (t.length < 8 || !t.includes(" ")) return false;
  if (DE_MAQUINA.test(t)) return false;
  return t[0] === t[0]?.toLocaleUpperCase("es") && /[a-záéíóúñ]/i.test(t);
}
