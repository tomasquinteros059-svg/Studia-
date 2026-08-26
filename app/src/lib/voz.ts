// Puerta única hacia expo-speech, igual que audio.ts con expo-audio.
//
// El sintetizador es código nativo. En Expo Go, en el navegador o en
// cualquier cliente que no lo traiga, importarlo directo se lleva puesta la
// app entera al arrancar. Acá se carga con cuidado: si no está, el lector
// sigue abriendo y se puede leer con los ojos, solo que no suena.

type ModuloVoz = typeof import("expo-speech");

let modulo: ModuloVoz | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  modulo = require("expo-speech") as ModuloVoz;
} catch {
  modulo = null;
}

export const hayVoz = modulo !== null;

export type OpcionesDeVoz = {
  /** 1 es la velocidad normal del motor. */
  velocidad: number;
  idioma: string;
  /** Se llama cuando terminó de decir el texto, no cuando lo empezó. */
  alTerminar: () => void;
  alFallar: (mensaje: string) => void;
};

/** El castellano de Chile si el aparato lo tiene; si no, el motor elige. */
export const IDIOMA = "es-CL";

export function hablar(texto: string, op: OpcionesDeVoz): void {
  if (!modulo) {
    op.alFallar(AVISO_SIN_VOZ);
    return;
  }
  modulo.speak(texto, {
    language: op.idioma,
    rate: op.velocidad,
    onDone: op.alTerminar,
    // Detener a propósito también dispara onStopped; el que llama distingue.
    onStopped: () => {},
    onError: (e: unknown) =>
      op.alFallar(e instanceof Error ? e.message : "El lector de voz falló."),
  });
}

export function callar(): void {
  modulo?.stop();
}

/**
 * Los idiomas que el aparato tiene instalados. Sirve para avisar cuando no
 * hay ninguna voz en español: sin esto el motor lee castellano con fonética
 * inglesa y no se entiende nada.
 */
export async function hayVozEnEspanol(): Promise<boolean> {
  if (!modulo) return false;
  try {
    const voces = await modulo.getAvailableVoicesAsync();
    // Sin lista de voces no se puede concluir que falten: Android a veces
    // devuelve vacío aunque el motor funcione. Se asume que sí hay.
    if (voces.length === 0) return true;
    return voces.some((v) => v.language?.toLowerCase().startsWith("es"));
  } catch {
    return true;
  }
}

export const AVISO_SIN_VOZ =
  "Este cliente no trae el lector de voz. El texto se lee igual; para escucharlo hace falta la app instalada.";

export const AVISO_SIN_ESPANOL =
  "Tu aparato no tiene voces en español instaladas. Ajustes → Idiomas → Salida de texto a voz.";
