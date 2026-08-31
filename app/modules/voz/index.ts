/**
 * Oír y transcribir, en el propio teléfono.
 *
 * Envuelve el módulo nativo para que la pantalla no tenga que saber si existe.
 * Donde no está —Expo Go, el navegador, iOS— `disponible()` responde que no y
 * la pantalla lo dice en vez de ofrecer un botón que no haría nada.
 *
 * El audio no sale del aparato: lo que sube es el texto con su minuto y su
 * confianza, que es lo que hace falta para armar la clase.
 */
import { NativeModule, requireOptionalNativeModule } from "expo-modules-core";

export type ErrorVoz = { codigo: string; mensaje: string };

type Eventos = {
  alParcial: (e: { texto: string }) => void;
  alTexto: (e: { texto: string; confianza: number }) => void;
  alError: (e: ErrorVoz) => void;
  alFin: () => void;
};

// `declare class ... extends` es la forma que hereda addListener; una
// interfaz que extiende la clase no lo hace.
declare class Nativo extends NativeModule<Eventos> {
  hayReconocedor(): boolean;
  empezar(idioma?: string): Promise<void>;
  detener(): Promise<void>;
}

const nativo = requireOptionalNativeModule<Nativo>("Voz");

/** Si este dispositivo puede dictar. Falso también donde el módulo no existe. */
export function disponible(): boolean {
  if (!nativo) return false;
  try {
    return nativo.hayReconocedor();
  } catch {
    return false;
  }
}

export type Oyentes = {
  /** Lo que se va oyendo, todavía sin confirmar. Se reemplaza cada vez. */
  alParcial?: (texto: string) => void;
  /**
   * Un tramo ya confirmado. Se suma a lo anterior.
   *
   * `confianza` va entre 0 y 1, o -1 donde el teléfono no la informa. El -1
   * importa: un tramo sin dato no es un tramo malo, y el cruce de versiones
   * tiene que poder distinguirlos.
   */
  alTexto: (texto: string, confianza: number) => void;
  alError?: (error: ErrorVoz) => void;
};

/**
 * Empieza a dictar. Devuelve la función que lo detiene, y que hay que llamar
 * siempre —también al salir de la pantalla— porque el reconocedor se queda
 * con el micrófono tomado.
 */
export function escuchar(oyentes: Oyentes, idioma = "es-CL"): () => void {
  if (!nativo) {
    oyentes.alError?.({
      codigo: "SIN_MODULO",
      mensaje: "El dictado no está disponible en esta versión.",
    });
    return () => {};
  }

  const suscripciones = [
    nativo.addListener("alTexto", ({ texto, confianza }) => oyentes.alTexto(texto, confianza)),
    nativo.addListener("alParcial", ({ texto }) => oyentes.alParcial?.(texto)),
    nativo.addListener("alError", (error) => oyentes.alError?.(error)),
  ];

  const soltar = () => {
    for (const s of suscripciones) s.remove();
  };

  nativo.empezar(idioma).catch((e: unknown) => {
    soltar();
    oyentes.alError?.({
      codigo: "NO_ARRANCA",
      mensaje: e instanceof Error ? e.message : "No se pudo iniciar el dictado.",
    });
  });

  return () => {
    soltar();
    void nativo.detener().catch(() => {
      // Detener algo que ya se detuvo no es un problema que valga contar.
    });
  };
}
