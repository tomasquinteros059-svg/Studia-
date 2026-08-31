// Una clase oída por muchos teléfonos, convertida en una sola clase escrita.
//
// Cada aparato de la sala entrega tramos de texto con el segundo en que los
// oyó. Ninguno oye bien la clase entera: el de adelante pierde la pregunta de
// atrás, al de atrás le llega la profesora lejos, y todos se comen algo cuando
// alguien tose al lado. Juntarlos es lo que hace que grabar el curso completo
// valga la pena en vez de ser treinta copias del mismo error.
//
// La idea es vieja y está medida en el mundo del reconocimiento de voz: varios
// reconocedores votando aciertan más que el mejor de ellos solo. Acá se hace a
// la escala que corresponde —tramos de una clase, no fonemas— porque eso es lo
// que se puede probar sin un laboratorio.
//
// Nada de esto toca la red ni la pantalla, así que se prueba entero.

/** Un tramo tal como lo entrega un teléfono. */
export type Tramo = {
  /** Qué aparato lo oyó. Dos tramos del mismo aparato nunca se votan entre sí. */
  aparato: string;
  /** Segundo de la clase en que empieza. */
  segundo: number;
  texto: string;
  /** Entre 0 y 1. Negativa donde el teléfono no la informa. */
  confianza: number;
};

/** Lo que queda de un momento de la clase, después de cruzar las versiones. */
export type Acordado = {
  segundo: number;
  texto: string;
  /** Cuántos aparatos oyeron algo parecido. Uno solo también vale. */
  votos: number;
  /** De cuántos aparatos que estaban oyendo en ese momento. */
  deCuantos: number;
};

/**
 * Cuántos segundos caben en una misma ventana.
 *
 * Dos teléfonos nunca marcan el mismo segundo para la misma frase: uno empieza
 * a oír antes, otro corta la sesión en un silencio y arranca tarde. Seis
 * segundos es más que ese desfase y menos que una frase de clase, así que
 * junta las versiones de lo mismo sin juntar dos ideas distintas.
 */
export const VENTANA = 6;

/**
 * Las ventanas se arman desde el primer tramo de cada grupo, no sobre una
 * grilla fija de seis en seis.
 *
 * Con la grilla, dos aparatos que oyeron lo mismo con un segundo de diferencia
 * caían en ventanas distintas si el borde pasaba justo entre ellos —el 11 y el
 * 12, por ejemplo— y la clase salía con la misma frase dos veces, cada una con
 * un voto. Lo destapó una prueba: es exactamente el error que este módulo
 * viene a evitar.
 */
function porTiempo(tramos: readonly Tramo[]): Tramo[][] {
  const ordenados = [...tramos].sort((a, b) => a.segundo - b.segundo);
  const ventanas: Tramo[][] = [];
  let abierta: Tramo[] = [];
  let empezo = 0;
  for (const t of ordenados) {
    if (abierta.length === 0 || t.segundo - empezo <= VENTANA) {
      if (abierta.length === 0) empezo = t.segundo;
      abierta.push(t);
    } else {
      ventanas.push(abierta);
      abierta = [t];
      empezo = t.segundo;
    }
  }
  if (abierta.length > 0) ventanas.push(abierta);
  return ventanas;
}

// ── Comparar dos versiones de lo mismo ────────────────────────────────────

/**
 * El texto reducido a lo que importa para compararlo.
 *
 * Sin tildes, sin puntuación y en minúsculas: un reconocedor escribe «derivable»
 * y otro «derivable,» y son la misma palabra. Comparar en crudo haría que dos
 * aparatos que oyeron lo mismo se contaran como si discreparan, que es
 * exactamente al revés de lo que esto viene a hacer.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    // La eñe se protege antes de descomponer. `NFD` la parte en ene más
    // virgulilla, y quitar las marcas dejaría «mañana» en «manana»: la eñe no
    // es una ene con acento, es otra letra, y confundirlas junta palabras que
    // en castellano son distintas.
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001/g, "ñ")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const palabras = (texto: string): string[] =>
  normalizar(texto).split(" ").filter(Boolean);

/**
 * Qué tanto se parecen dos versiones, entre 0 y 1.
 *
 * Cuenta palabras compartidas sobre el total distinto —Jaccard— y no el orden.
 * El orden importaría si se comparara una frase con otra frase; acá se compara
 * lo que dos micrófonos oyeron del mismo momento, y ahí lo que cambia es qué
 * palabras se perdió cada uno, no cómo las ordenó.
 */
export function parecido(a: string, b: string): number {
  const unas = new Set(palabras(a));
  const otras = new Set(palabras(b));
  if (unas.size === 0 && otras.size === 0) return 1;
  if (unas.size === 0 || otras.size === 0) return 0;
  let comunes = 0;
  for (const p of unas) if (otras.has(p)) comunes += 1;
  return comunes / (unas.size + otras.size - comunes);
}

/** Desde cuánto parecido se consideran la misma frase. */
export const IGUALES = 0.45;

// ── El cruce ──────────────────────────────────────────────────────────────

/**
 * Junta lo que oyeron todos y devuelve una sola clase.
 *
 * Por cada ventana de tiempo se agrupan las versiones parecidas, y gana el
 * grupo más numeroso: si cuatro teléfonos oyeron «el teorema del valor medio» y
 * uno oyó «el problema del valor medio», la clase dice teorema. A igualdad de
 * votos decide la confianza que informó el reconocedor, y si tampoco hay,
 * el texto más largo, que casi siempre es el que se perdió menos palabras.
 *
 * Dentro de un grupo se entrega el texto de la mejor versión y no una mezcla
 * de todas. Coser pedazos de cinco transcripciones da frases que nadie dijo, y
 * una frase inventada en el apunte de una clase es peor que una frase con un
 * error.
 */
export function unir(tramos: readonly Tramo[]): Acordado[] {
  const dichos = tramos.filter((t) => t.texto.trim());

  const clase: Acordado[] = [];
  for (const enLaVentana of porTiempo(dichos)) {
    const segundo = enLaVentana[0]!.segundo;
    const cuantosAparatos = new Set(enLaVentana.map((t) => t.aparato)).size;
    const grupos = agrupar(enLaVentana);
    const mejor = grupos.sort(porFuerza)[0];
    if (!mejor) continue;
    const gana = mejorVersion(mejor);
    clase.push({
      segundo,
      texto: gana.texto.trim(),
      // Cuántos dijeron *esta* versión, no cuántos cayeron en el grupo. El
      // grupo junta versiones parecidas, así que incluye a quien discrepó en
      // una palabra; contarlo como si hubiera corroborado sería inflar el
      // acuerdo con quien justamente no estuvo de acuerdo.
      votos: new Set(
        mejor.filter((t) => normalizar(t.texto) === normalizar(gana.texto))
          .map((t) => t.aparato),
      ).size,
      deCuantos: cuantosAparatos,
    });
  }
  return clase;
}

/** Agrupa las versiones que dicen lo mismo. */
function agrupar(tramos: readonly Tramo[]): Tramo[][] {
  const grupos: Tramo[][] = [];
  for (const t of tramos) {
    const suyo = grupos.find((g) => g.some((otro) => parecido(otro.texto, t.texto) >= IGUALES));
    if (suyo) suyo.push(t);
    else grupos.push([t]);
  }
  return grupos;
}

/**
 * Primero el que más aparatos oyeron; después el de más confianza; y a falta
 * de las dos cosas, el que trae más palabras.
 *
 * Lo último no es un capricho de desempate: entre «existe un punto» y «existe
 * un punto donde la derivada vale la pendiente media», el segundo no es más
 * largo por ruido, es el que alcanzó a oír el resto de la frase. Quedarse con
 * el corto sería tirar la mitad de la clase por orden de llegada.
 */
function porFuerza(a: Tramo[], b: Tramo[]): number {
  const votos = new Set(b.map((t) => t.aparato)).size - new Set(a.map((t) => t.aparato)).size;
  if (votos !== 0) return votos;
  const confianza = confianzaDe(b) - confianzaDe(a);
  if (Math.abs(confianza) > 0.001) return confianza;
  return palabras(mejorVersion(b).texto).length - palabras(mejorVersion(a).texto).length;
}

/** La confianza del grupo, ignorando los tramos que no la informan. */
function confianzaDe(grupo: readonly Tramo[]): number {
  const dichas = grupo.map((t) => t.confianza).filter((c) => c >= 0);
  if (dichas.length === 0) return 0;
  return dichas.reduce((a, b) => a + b, 0) / dichas.length;
}

/**
 * Dentro del grupo, la versión que se entrega.
 *
 * También por mayoría, y no por orden de llegada. Un grupo junta versiones
 * parecidas, no idénticas: «el teorema del valor medio» y «el problema del
 * valor medio» comparten cuatro de seis palabras y caen juntas, que es lo que
 * corresponde. Pero entonces hay que contar cuántos aparatos dijeron
 * exactamente cada una, o la clase termina diciendo lo que dijo el primero que
 * habló en la lista.
 *
 * Después la confianza, y al final el largo.
 */
function mejorVersion(grupo: readonly Tramo[]): Tramo {
  const cuantosDijeron = new Map<string, Set<string>>();
  for (const t of grupo) {
    const clave = normalizar(t.texto);
    cuantosDijeron.set(clave, (cuantosDijeron.get(clave) ?? new Set()).add(t.aparato));
  }
  const votosDe = (t: Tramo) => cuantosDijeron.get(normalizar(t.texto))?.size ?? 0;

  return [...grupo].sort((a, b) => {
    const votos = votosDe(b) - votosDe(a);
    if (votos !== 0) return votos;
    if (a.confianza >= 0 && b.confianza >= 0 && a.confianza !== b.confianza) {
      return b.confianza - a.confianza;
    }
    return palabras(b.texto).length - palabras(a.texto).length;
  })[0]!;
}

// ── Lo que se puede decir de la clase ─────────────────────────────────────

/** El texto corrido, para mandárselo al resumen. */
export const comoTexto = (clase: readonly Acordado[]): string =>
  clase.map((a) => a.texto).join(" ");

/** mm:ss, como se muestra al lado de cada tramo. */
export function comoReloj(segundo: number): string {
  const m = Math.floor(Math.max(0, segundo) / 60);
  const s = Math.floor(Math.max(0, segundo) % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Qué tan de acuerdo quedó la clase.
 *
 * Es la proporción de tramos donde más de un aparato coincidió. Sirve para
 * decir con honestidad cuánto confiar: una clase armada con un solo teléfono
 * no está mal, pero no está corroborada por nadie, y quien la lea debería
 * saberlo.
 */
export function acuerdo(clase: readonly Acordado[]): number {
  if (clase.length === 0) return 0;
  const corroborados = clase.filter((a) => a.votos > 1).length;
  return corroborados / clase.length;
}

/** Cómo se le cuenta eso a alguien. */
export function comoQuedo(clase: readonly Acordado[], aparatos: number): string {
  if (clase.length === 0) return "No se alcanzó a oír nada de esta clase.";
  if (aparatos <= 1) {
    return "La oyó un solo teléfono, así que no hay con qué contrastarla. "
      + "Con más gente escuchando queda mejor.";
  }
  const deAcuerdo = Math.round(acuerdo(clase) * 100);
  return `La oyeron ${aparatos} teléfonos y coincidieron en ${deAcuerdo}% de la clase.`;
}

/**
 * Cuánto duró, en minutos, según el último tramo.
 *
 * Del último tramo y no de cuánto estuvo prendido: si alguien deja el modo
 * escucha corriendo después de que terminó la clase, la clase no dura más.
 */
export const duracion = (clase: readonly Acordado[]): number =>
  clase.length === 0 ? 0 : Math.round(((clase[clase.length - 1]?.segundo ?? 0) + VENTANA) / 60);
