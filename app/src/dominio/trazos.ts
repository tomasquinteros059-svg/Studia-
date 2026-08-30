// Escribir a mano en un apunte.
//
// Acá vive todo lo que no necesita una pantalla: cómo se convierte una hilera
// de puntos en una curva, cuánto engrosa el trazo, cuándo se descarta lo que
// apoyó la palma, y qué se guarda. La pantalla solo dibuja lo que esto dice.
//
// Se separa así porque es la parte que se puede equivocar en silencio. Un
// trazo mal suavizado se ve raro pero se ve; una regla de rechazo de palma mal
// hecha borra media clase y nadie sabe por qué.

/** Un punto del trazo, en coordenadas de la hoja. */
export type Punto = { x: number; y: number; t: number };

/** Con qué se está escribiendo. */
export type Util = "lapiz" | "destacador" | "goma";

export type Trazo = {
  id: string;
  util: Util;
  color: string;
  /** El grosor base, antes de la velocidad. */
  grosor: number;
  puntos: Punto[];
};

/**
 * Qué dispositivo tocó la pantalla, tal como lo entrega React Native.
 *
 * Android lo saca de `MotionEvent.getToolType`, así que un lápiz activo llega
 * como "pen" y un dedo —o la palma— como "touch". En un navegador viene del
 * evento de puntero del propio navegador. Donde no se sepa, llega vacío.
 */
export type Puntero = "pen" | "touch" | "mouse" | "";

// ── Rechazo de palma ──────────────────────────────────────────────────────

/**
 * Si este toque debe dibujar.
 *
 * La regla es la de cualquier aplicación de tinta que se use en serio: apenas
 * se ve un lápiz, la mano deja de escribir. Quien escribe con lápiz apoya la
 * palma sin pensarlo, y esa palma llega como un toque igual que un dedo; si el
 * dedo siguiera dibujando, cada renglón vendría con un borrón al lado.
 *
 * Antes de ver un lápiz, el dedo sí dibuja: en un teléfono sin lápiz es la
 * única forma de escribir, y negarla por si acaso dejaría la función inútil
 * para la mayoría.
 *
 * `huboLapiz` se recuerda mientras el apunte esté abierto y no más allá: quien
 * dejó el lápiz y siguió con el dedo no tiene por qué volver a buscarlo.
 */
export function dibuja(puntero: Puntero, huboLapiz: boolean): boolean {
  if (puntero === "pen") return true;
  if (puntero === "mouse") return true;
  // Vacío es «no se sabe»: pasa en plataformas que no informan el tipo, y ahí
  // negarse sería peor que dibujar de más.
  if (puntero === "") return true;
  return !huboLapiz;
}

// ── El grosor ─────────────────────────────────────────────────────────────

/**
 * Cuánto vale el trazo en este punto, según qué tan rápido iba.
 *
 * No sale de la presión. React Native no la entrega en Android —devuelve 0.5
 * fija, esté el lápiz apoyado apenas o hundido— así que usar presión sería
 * dibujar una línea de grosor constante y llamarla sensible.
 *
 * La velocidad sí se sabe, y funciona por la misma razón física: al escribir
 * rápido la punta marca menos. Un trazo lento queda grueso, uno rápido más
 * fino, y la letra deja de parecer un cable.
 */
export const VELOCIDAD_FINA = 2.2;

export function grosorEn(base: number, velocidad: number): number {
  const v = Math.max(0, velocidad);
  // Entre 1 y 0.55 del grosor base, cayendo suave. Nunca a cero: un trazo que
  // desaparece al mover rápido se lee como que la pantalla no respondió.
  const factor = 1 - 0.45 * Math.min(1, v / VELOCIDAD_FINA);
  return Math.max(0.5, base * factor);
}

/** Píxeles por milisegundo entre dos puntos. */
export function velocidad(a: Punto, b: Punto): number {
  const ms = Math.max(1, b.t - a.t);
  return Math.hypot(b.x - a.x, b.y - a.y) / ms;
}

// ── De puntos a curva ─────────────────────────────────────────────────────

/**
 * El trazo como una `d` de SVG.
 *
 * Unir los puntos con rectas da una letra con esquinas: el dedo entrega un
 * punto cada pocos milisegundos y a esa escala cada cambio de dirección se ve.
 * Acá cada tramo es una curva cuadrática cuyo control es el punto medido y
 * cuyo final es el punto medio hasta el siguiente, que es la forma barata de
 * pasar una curva continua por una nube de puntos.
 */
export function comoCurva(puntos: readonly Punto[]): string {
  if (puntos.length === 0) return "";
  const [primero] = puntos;
  if (!primero) return "";
  if (puntos.length === 1) {
    // Un toque sin arrastre es un punto: se dibuja como una raya mínima, que
    // con el extremo redondeado sale redondo.
    return `M${red(primero.x)},${red(primero.y)} L${red(primero.x)},${red(primero.y)}`;
  }

  let d = `M${red(primero.x)},${red(primero.y)}`;
  for (let i = 1; i < puntos.length - 1; i++) {
    const p = puntos[i]!;
    const s = puntos[i + 1]!;
    d += ` Q${red(p.x)},${red(p.y)} ${red((p.x + s.x) / 2)},${red((p.y + s.y) / 2)}`;
  }
  const ultimo = puntos[puntos.length - 1]!;
  d += ` L${red(ultimo.x)},${red(ultimo.y)}`;
  return d;
}

/** Dos decimales bastan a esta escala, y acortan mucho lo que se guarda. */
const red = (n: number): number => Math.round(n * 100) / 100;

/**
 * Saca los puntos que no aportan forma.
 *
 * Un trazo de un renglón llega con cientos de puntos y casi todos caen sobre
 * la recta que forman sus vecinos. Guardarlos es guardar el pulso de la
 * pantalla, no la letra: un apunte de una clase se iría a varios megas y
 * tardaría en abrir.
 *
 * Es Ramer–Douglas–Peucker con una tolerancia chica, que conserva las curvas y
 * se come las rectas.
 */
export function aligerar(puntos: readonly Punto[], tolerancia = 0.7): Punto[] {
  if (puntos.length <= 2) return [...puntos];

  const primero = puntos[0]!;
  const ultimo = puntos[puntos.length - 1]!;

  let peor = 0;
  let donde = 0;
  for (let i = 1; i < puntos.length - 1; i++) {
    const d = distanciaARecta(puntos[i]!, primero, ultimo);
    if (d > peor) { peor = d; donde = i; }
  }

  if (peor <= tolerancia) return [primero, ultimo];

  const izquierda = aligerar(puntos.slice(0, donde + 1), tolerancia);
  const derecha = aligerar(puntos.slice(donde), tolerancia);
  return [...izquierda.slice(0, -1), ...derecha];
}

function distanciaARecta(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy);
  if (largo === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / largo;
}

// ── La goma ───────────────────────────────────────────────────────────────

/**
 * Borra por trazo entero y no por pedacito.
 *
 * Un borrador que come píxeles obliga a repasar prolijamente lo que se quiere
 * sacar, con la mano temblando sobre lo que hay que conservar. Borrar el trazo
 * que se toca es un gesto y se deshace con un toque, que es como se corrige
 * cuando se está en clase y el profesor sigue hablando.
 */
export function borrarDonde(
  trazos: readonly Trazo[], x: number, y: number, radio = 12,
): Trazo[] {
  return trazos.filter((t) => !tocaPunto(t, x, y, radio));
}

function tocaPunto(t: Trazo, x: number, y: number, radio: number): boolean {
  const alcance = radio + t.grosor / 2;
  return t.puntos.some((p) => Math.hypot(p.x - x, p.y - y) <= alcance);
}

// ── Lo que se guarda ──────────────────────────────────────────────────────

/**
 * Los trazos como texto, para meterlos en la fila del apunte.
 *
 * Con versión adentro: el día que cambie la forma de un trazo, un apunte viejo
 * tiene que seguir abriéndose. Sin este número habría que adivinarlo mirando
 * las llaves, que es como se pierden los apuntes de alguien.
 */
export const VERSION_TRAZOS = 1;

export type Tablero = { v: number; trazos: readonly Trazo[] };

export function guardar(trazos: readonly Trazo[]): string {
  return JSON.stringify({ v: VERSION_TRAZOS, trazos } satisfies Tablero);
}

/**
 * Lee lo guardado. Ante cualquier duda devuelve vacío en vez de reventar: un
 * apunte con los trazos ilegibles todavía tiene su texto, y perder la pantalla
 * entera por eso sería perder también lo que sí está bien.
 */
export function leer(crudo: string | null | undefined): Trazo[] {
  if (!crudo) return [];
  let dato: unknown;
  try {
    dato = JSON.parse(crudo);
  } catch {
    return [];
  }
  if (typeof dato !== "object" || dato === null) return [];
  const { v, trazos } = dato as Partial<Tablero>;
  if (v !== VERSION_TRAZOS || !Array.isArray(trazos)) return [];
  return trazos.filter(esTrazo);
}

function esTrazo(t: unknown): t is Trazo {
  if (typeof t !== "object" || t === null) return false;
  const c = t as Partial<Trazo>;
  return typeof c.id === "string"
    && (c.util === "lapiz" || c.util === "destacador" || c.util === "goma")
    && typeof c.color === "string"
    && typeof c.grosor === "number"
    && Array.isArray(c.puntos)
    && c.puntos.every((p) =>
      typeof p === "object" && p !== null
      && typeof (p as Punto).x === "number" && typeof (p as Punto).y === "number");
}

/** Si hay algo dibujado. Un tablero en blanco no se guarda como "[]". */
export const hayTinta = (trazos: readonly Trazo[]): boolean => trazos.length > 0;
