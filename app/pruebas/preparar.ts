import { cleanup } from "@testing-library/react-native";

// Preparación común de las pruebas de interfaz.
//
// Las pantallas no deben hablar con Supabase ni con Claude durante una prueba:
// lo que se está comprobando es que rendericen y reaccionen, no la red.


// El cliente de Supabase revienta al importarse si faltan estas variables.
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://pruebas.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "clave-de-pruebas";

// La versión 3 ya no trae doble para jest: uno en memoria basta.
jest.mock("@react-native-async-storage/async-storage", () => {
  const almacen = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => almacen.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { almacen.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { almacen.delete(k); }),
      clear: jest.fn(async () => { almacen.clear(); }),
    },
  };
});

// expo-audio necesita el módulo nativo; en pruebas basta con que no exista.
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({
    play: jest.fn(), pause: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    setPlaybackRate: jest.fn(),
  }),
  useAudioPlayerStatus: () => ({ currentTime: 0, duration: 0, playing: false, isLoaded: false }),
  getRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
  requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// Cada prueba parte de cero: sin esto, un árbol montado por la prueba anterior
// puede seguir vivo y hacer fallar búsquedas que sí deberían encontrar algo.
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});
