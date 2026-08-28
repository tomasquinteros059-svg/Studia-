// Cómo se prepara un texto para escucharlo y seguirlo con la vista.
//
// El lector no manda el texto entero al sintetizador de voz. Lo corta en
// frases y las va diciendo una por una. Eso resuelve tres cosas a la vez:
// se puede resaltar exactamente lo que se está oyendo, se puede retroceder
// una frase sin volver al principio, y se esquiva el límite de largo que
// tienen los motores de voz de Android (que cortan sin avisar).

export type Frase = {
  /** Posición en el texto completo. Es lo que se guarda para retomar. */
  indice: number;
  /** A qué párrafo pertenece, para dibujarlo agrupado. */
  parrafo: number;
  texto: string;
};

export type Parrafo = { indice: number; frases: Frase[] };

/**
 * Más largo que esto y conviene cortar igual: el motor de voz de Android
 * trunca las frases largas en silencio, y resaltar medio párrafo no ayuda
 * a seguir la lectura.
 */
export const MAXIMO_FRASE = 280;

// Un tratamiento siempre viene seguido de un nombre propio, así que su punto
// nunca cierra la frase: "el Dr. Salas" es una sola.
const TRATAMIENTOS = new Set([
  "sr", "sra", "srta", "dr", "dra", "prof", "ing", "lic", "ph", "don", "dna",
]);

// Estas otras sí pueden ir al final de una frase ("...volúmenes, etc. Ahora
// el caso general"). Se decide por lo que viene después: minúscula o número
// significa que la frase sigue.
const ABREVIATURAS = new Set([
  "etc", "ej", "p", "pag", "pags", "fig", "num", "aprox", "vs", "ud", "uds",
  "av", "art", "cap", "vol", "ed", "min", "seg", "max", "ss", "aa",
  "a.c", "d.c", "ee.uu", "i.e", "e.g",
]);

const sinAcentos = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** La palabra pegada al punto: "aprox." → "aprox". */
function palabraAnterior(texto: string): string {
  const m = /([\p{L}.]+)$/u.exec(texto);
  return m?.[1] ? sinAcentos(m[1]) : "";
}

/**
 * Corta una línea en frases. Un signo de puntuación cierra la frase solo si
 * viene seguido de espacio o de nada: así "f(x)=2.5x" y "Sr. Pérez" quedan
 * enteros, y "¿Y ahora?" abre frase nueva.
 */
function frasesDeLinea(linea: string): string[] {
  const trozos: string[] = [];
  let inicio = 0;
  const cierres = /[.!?…]+/g;
  let m: RegExpExecArray | null;

  while ((m = cierres.exec(linea)) !== null) {
    const fin = m.index + m[0].length;
    const antes = linea.slice(0, m.index);
    const despues = linea.slice(fin);

    // 3.1416 y 3,14: el punto vive entre dígitos, no cierra nada.
    if (m[0] === "." && /\d$/.test(antes) && /^\d/.test(despues)) continue;
    const previa = palabraAnterior(antes);
    // Tratamiento: nunca cierra.
    if (m[0] === "." && TRATAMIENTOS.has(previa)) continue;
    // Otra abreviatura: cierra solo si lo que sigue empieza frase nueva.
    if (m[0] === "." && ABREVIATURAS.has(previa) && !/^\s+[\p{Lu}¿¡«"]/u.test(despues)) continue;
    // Una inicial suelta: "J. Pérez".
    if (m[0] === "." && /(?:^|\s)\p{Lu}$/u.test(antes)) continue;
    // Tiene que venir un espacio, o ser el final de la línea.
    if (despues.length > 0 && !/^\s/.test(despues)) continue;

    const frase = linea.slice(inicio, fin).trim();
    if (frase) trozos.push(frase);
    inicio = fin;
  }

  const cola = linea.slice(inicio).trim();
  if (cola) trozos.push(cola);
  return trozos;
}

/** Parte una frase demasiado larga por comas, y si no hay, por espacios. */
function acortar(frase: string): string[] {
  if (frase.length <= MAXIMO_FRASE) return [frase];

  const partes: string[] = [];
  let resto = frase;
  while (resto.length > MAXIMO_FRASE) {
    const ventana = resto.slice(0, MAXIMO_FRASE);
    const corte =
      Math.max(ventana.lastIndexOf("; "), ventana.lastIndexOf(", "), ventana.lastIndexOf(": ")) + 1 ||
      ventana.lastIndexOf(" ");
    // Si no hay dónde cortar con gracia, se corta a lo bruto antes que perder texto.
    const en = corte > MAXIMO_FRASE * 0.4 ? corte : MAXIMO_FRASE;
    partes.push(resto.slice(0, en).trim());
    resto = resto.slice(en).trim();
  }
  if (resto) partes.push(resto);
  return partes;
}

/**
 * El texto completo, ya cortado y numerado. Los párrafos se separan por
 * líneas en blanco; dentro de un párrafo, cada línea se corta aparte para
 * que una lista con viñetas se lea ítem por ítem.
 */
export function partirEnFrases(texto: string): Frase[] {
  const frases: Frase[] = [];
  const parrafos = texto.replace(/\r\n/g, "\n").split(/\n[ \t]*\n+/);

  parrafos.forEach((bloque, nParrafo) => {
    for (const linea of bloque.split("\n")) {
      for (const frase of frasesDeLinea(linea)) {
        for (const trozo of acortar(frase)) {
          frases.push({ indice: frases.length, parrafo: nParrafo, texto: trozo });
        }
      }
    }
  });

  // Renumera los párrafos para que no queden huecos por bloques vacíos.
  const vistos = new Map<number, number>();
  return frases.map((f) => {
    if (!vistos.has(f.parrafo)) vistos.set(f.parrafo, vistos.size);
    return { ...f, parrafo: vistos.get(f.parrafo)! };
  });
}

export function agruparEnParrafos(frases: Frase[]): Parrafo[] {
  const grupos: Parrafo[] = [];
  for (const f of frases) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.indice === f.parrafo) ultimo.frases.push(f);
    else grupos.push({ indice: f.parrafo, frases: [f] });
  }
  return grupos;
}

// ── Avanzar y retroceder ────────────────────────────────────────────────

/** El siguiente índice, o null si ya no queda texto. */
export function siguiente(indice: number, total: number): number | null {
  return indice + 1 < total ? indice + 1 : null;
}

export function anterior(indice: number): number {
  return Math.max(0, indice - 1);
}

/**
 * Dónde retomar. Un índice guardado de una versión anterior del texto puede
 * apuntar fuera de rango; y si quedó en la última frase, se vuelve a empezar
 * en vez de abrir el lector ya terminado.
 */
export function retomar(guardado: number | null | undefined, total: number): number {
  if (total === 0) return 0;
  if (typeof guardado !== "number" || !Number.isFinite(guardado) || guardado < 0) return 0;
  if (guardado >= total - 1) return 0;
  return Math.floor(guardado);
}

export function progreso(indice: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (indice + 1) / total));
}

// ── Cuánto dura ─────────────────────────────────────────────────────────

/** Una voz sintética en español ronda esto a velocidad 1. */
export const PALABRAS_POR_MINUTO = 155;

export function palabras(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length;
}

/** Minutos que falta escuchar desde una frase, redondeado hacia arriba. */
export function minutosDeEscucha(frases: Frase[], velocidad = 1, desde = 0): number {
  const restantes = frases.slice(desde).reduce((n, f) => n + palabras(f.texto), 0);
  if (restantes === 0) return 0;
  return Math.max(1, Math.ceil(restantes / (PALABRAS_POR_MINUTO * velocidad)));
}

// ── Cómo se ve ──────────────────────────────────────────────────────────

export const VELOCIDADES = [0.7, 0.85, 1, 1.15, 1.35, 1.6] as const;
export const TAMANOS = [16, 18, 21, 25, 30, 36] as const;

export type Fondo = "papel" | "sepia" | "noche";
export type Interlineado = "normal" | "amplio" | "doble";

export type Preferencias = {
  /** Índice en TAMANOS. */
  tamano: number;
  interlineado: Interlineado;
  fondo: Fondo;
  /** Oscurece todo menos la frase que se está leyendo. */
  foco: boolean;
  /** Índice en VELOCIDADES. */
  velocidad: number;
};

// `as const` para que TAMANOS[PREFERENCIAS_POR_DEFECTO.tamano] tenga tipo
// concreto: así el respaldo de estiloDeLectura no puede quedar indefinido.
export const PREFERENCIAS_POR_DEFECTO = {
  tamano: 2,
  interlineado: "amplio",
  fondo: "papel",
  foco: false,
  velocidad: 2,
} as const satisfies Preferencias;

const FACTOR_INTERLINEADO: Record<Interlineado, number> = {
  normal: 1.4,
  amplio: 1.75,
  doble: 2.1,
};

export type EstiloDeLectura = {
  fontSize: number;
  lineHeight: number;
  /** Texto más grande necesita columna más ancha o quedan tres palabras por línea. */
  anchoMaximo: number;
};

export function estiloDeLectura(p: Preferencias): EstiloDeLectura {
  const fontSize: number = TAMANOS[p.tamano] ?? TAMANOS[PREFERENCIAS_POR_DEFECTO.tamano];
  return {
    fontSize,
    lineHeight: Math.round(fontSize * FACTOR_INTERLINEADO[p.interlineado]),
    // ~62 caracteres por línea, que es donde el ojo salta de renglón sin perderse.
    anchoMaximo: Math.round(fontSize * 32),
  };
}

export function velocidadDe(p: Preferencias): number {
  return VELOCIDADES[p.velocidad] ?? 1;
}

export type Paleta = {
  fondo: string;
  texto: string;
  /** Fondo de la frase que suena ahora. */
  resalte: string;
  /** Texto de lo que no se está leyendo, cuando el foco está encendido. */
  atenuado: string;
  borde: string;
};

const PALETAS: Record<Fondo, Paleta> = {
  papel: { fondo: "#FFFFFF", texto: "#0B1220", resalte: "#DCEBFB", atenuado: "#B7BBC4", borde: "#E1E2E7" },
  sepia: { fondo: "#F6EFE2", texto: "#3B3123", resalte: "#EBD9B4", atenuado: "#B3A68F", borde: "#E0D3BC" },
  noche: { fondo: "#0E1726", texto: "#E7EAF0", resalte: "#1D3557", atenuado: "#5A6478", borde: "#222E44" },
};

export function paletaDeLectura(fondo: Fondo): Paleta {
  return PALETAS[fondo] ?? PALETAS.papel;
}

/**
 * Lo que se guardó puede venir de una versión anterior de la app, o estar
 * corrupto. Se acepta lo que sirva y se rellena el resto: nunca debe hacer
 * que el lector no abra.
 */
export function normalizarPreferencias(crudo: unknown): Preferencias {
  const p = (typeof crudo === "object" && crudo !== null ? crudo : {}) as Record<string, unknown>;
  const enRango = (v: unknown, largo: number, porDefecto: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v < largo ? v : porDefecto;

  return {
    tamano: enRango(p.tamano, TAMANOS.length, PREFERENCIAS_POR_DEFECTO.tamano),
    velocidad: enRango(p.velocidad, VELOCIDADES.length, PREFERENCIAS_POR_DEFECTO.velocidad),
    interlineado:
      p.interlineado === "normal" || p.interlineado === "amplio" || p.interlineado === "doble"
        ? p.interlineado
        : PREFERENCIAS_POR_DEFECTO.interlineado,
    fondo:
      p.fondo === "papel" || p.fondo === "sepia" || p.fondo === "noche"
        ? p.fondo
        : PREFERENCIAS_POR_DEFECTO.fondo,
    foco: typeof p.foco === "boolean" ? p.foco : PREFERENCIAS_POR_DEFECTO.foco,
  };
}

/** Una frase lista para pegar en los apuntes, con las comillas puestas. */
export function citar(frase: string): string {
  return `«${frase.replace(/\s+/g, " ").trim()}»`;
}

// ── Lo que se ve y lo que se oye ────────────────────────────────────────

/**
 * El texto que se le entrega al sintetizador, que no es el mismo que se
 * muestra en pantalla.
 *
 * Los motores de voz leen los signos en voz alta: un paréntesis se convierte
 * en la palabra "paréntesis" y arruina la frase. La solución no es borrarlos
 * y ya: un paréntesis *significa* algo —un inciso— y ese significado se
 * conserva mejor como una pausa. Así el signo se oye como entorno de la
 * frase, no como una palabra más.
 *
 * En pantalla el texto queda intacto: esto es solo para el oído.
 */
export function paraVoz(texto: string): string {
  let t = texto;

  // Una viñeta al principio de la línea no se dice.
  t = t.replace(/^\s*[-–—•·*]\s+/, "");

  // Las barras de valor absoluto se sacan antes que nada: así |x|/x llega a
  // la regla de la división como x/x y se dice "x sobre x".
  t = t.replace(/\|/g, "");

  // Notación de función. Una letra sola pegada a un paréntesis corto es f(x),
  // y en una sala de clases eso se dice "f de x", no "f equis".
  t = t.replace(/\b(\p{L})\(([^()\s]{1,12})\)/gu, "$1 de $2");

  // Una división escrita con barra se dice "sobre", que es como se lee en el
  // pizarrón. Con espacios alrededor la barra es otra cosa y no se toca.
  t = t.replace(/(\p{L}|\p{N})\/(\p{L}|\p{N})/gu, "$1 sobre $2");

  // Paréntesis, corchetes y llaves. Si adentro hay más de una palabra es un
  // inciso y se vuelve una pausa; si es un término suelto —(a,b)— los signos
  // sobran y el término se dice pegado a lo que venía.
  t = t.replace(/[([{]([^)\]}]*)[)\]}]/g, (_entero, dentro: string) => {
    const limpio = dentro.trim();
    if (!limpio) return " ";
    return /\s/.test(limpio) ? `, ${limpio}, ` : ` ${limpio} `;
  });

  // Los que quedaron sueltos porque el par estaba incompleto.
  t = t.replace(/[()[\]{}]/g, " ");

  // Las comillas no se dicen: quien escucha no distingue una cita por el
  // signo, la distingue por la entonación.
  t = t.replace(/[«»""''"']/g, "");

  // Puntos suspensivos y raya de inciso: pausa, no palabra.
  t = t.replace(/…|\.\.\./g, ",");
  t = t.replace(/\s[–—]\s/g, ", ");
  t = t.replace(/\s·\s/g, ", ");

  // Signos que el motor nombra y que no aportan nada dicho en voz alta.
  t = t.replace(/[*_#\\/<>^~]/g, " ");

  // Limpieza: comas pegadas, comas colgando y espacios de más.
  t = t.replace(/\s+([,;:.!?])/g, "$1");
  t = t.replace(/,(\s*,)+/g, ",");
  t = t.replace(/,\s*([.;:!?])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^[,;:]\s*/, "");

  // Si no quedó nada que se pueda pronunciar, no hay nada que decir.
  return /[\p{L}\p{N}]/u.test(t) ? t : "";
}
