// Puerta única hacia expo-audio.
//
// expo-audio trae código nativo. En Expo Go, o en cualquier cliente que no lo
// incluya, importarlo directamente revienta la app entera al arrancar: una
// pantalla que ni siquiera se ha abierto se lleva puesto todo lo demás.
// Acá se carga con cuidado y, si no está, la app sigue funcionando sin audio.

type ModuloAudio = typeof import("expo-audio");

let modulo: ModuloAudio | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  modulo = require("expo-audio") as ModuloAudio;
} catch {
  modulo = null;
}

/** Si es falso, las pantallas de audio se muestran pero no suenan. */
export const hayAudioNativo = modulo !== null;

type Reproductor = ReturnType<ModuloAudio["useAudioPlayer"]>;
type Estado = ReturnType<ModuloAudio["useAudioPlayerStatus"]>;

const REPRODUCTOR_INERTE = {
  play() {}, pause() {},
  seekTo: async () => {},
  setPlaybackRate() {},
} as unknown as Reproductor;

const ESTADO_INERTE = {
  currentTime: 0, duration: 0, playing: false, isLoaded: false,
} as unknown as Estado;

// La identidad de estas funciones se fija al cargar el módulo, así que no
// rompe las reglas de los hooks: siempre se llama a la misma.
export const usarReproductor: ModuloAudio["useAudioPlayer"] =
  modulo?.useAudioPlayer ?? (() => REPRODUCTOR_INERTE);

export const usarEstadoDelReproductor: ModuloAudio["useAudioPlayerStatus"] =
  modulo?.useAudioPlayerStatus ?? (() => ESTADO_INERTE);

export const permisoDeMicrofono: ModuloAudio["getRecordingPermissionsAsync"] =
  modulo?.getRecordingPermissionsAsync ??
  (async () => ({ granted: false, canAskAgain: false, status: "denied", expires: "never" } as never));

export const pedirMicrofono: ModuloAudio["requestRecordingPermissionsAsync"] =
  modulo?.requestRecordingPermissionsAsync ??
  (async () => ({ granted: false, canAskAgain: false, status: "denied", expires: "never" } as never));

export const fijarModoDeAudio: ModuloAudio["setAudioModeAsync"] =
  modulo?.setAudioModeAsync ?? (async () => {});

export const AVISO_SIN_AUDIO =
  "El audio necesita la app instalada, no Expo Go. Todo lo demás funciona igual.";
