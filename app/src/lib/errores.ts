// Mandar la caída, y saber en qué pantalla ocurrió.
//
// Lo que se manda y lo que se limpia está en `dominio/errores.ts`, con
// pruebas. Acá solo se toca el servidor y el sistema.

import { Platform } from "react-native";

import { MODO_DEMO } from "./config.ts";
import { supabase } from "./supabase.ts";
import { COMPILACION, VERSION } from "./version.ts";
import { armarReporte, esRepetido, type Reporte } from "../dominio/errores.ts";

/**
 * En qué pantalla está la persona.
 *
 * Lo escribe la navegación al cambiar de pantalla. Es una variable de módulo y
 * no un estado de React a propósito: cuando la aplicación se cae, React puede
 * estar justamente en medio de lo que reventó, y leer un estado suyo en ese
 * momento es pedirle algo a quien se está cayendo.
 */
let pantallaActual = "";

export function anotarPantalla(nombre: string | undefined): void {
  if (nombre) pantallaActual = nombre;
}

const vistos = new Map<string, number>();

/**
 * Guarda la caída, si se puede.
 *
 * Nunca lanza: esto se llama justo cuando algo ya salió mal, y una segunda
 * falla acá dejaría a la persona sin la pantalla de aviso.
 */
export async function anotarCaida(falla: unknown, origen: Reporte["origen"]): Promise<void> {
  try {
    if (MODO_DEMO) return;

    const reporte = armarReporte(falla, pantallaActual, origen);
    if (esRepetido(reporte, vistos, Date.now())) return;

    const { data } = await supabase.auth.getUser();
    // Sin sesión no hay a nombre de quién anotarla, y la política la
    // rechazaría. Se pierde, y es preferible a reintentar en un bucle.
    if (!data.user) return;

    await supabase.from("errores").insert({
      persona_id: data.user.id,
      version: VERSION,
      compilacion: COMPILACION,
      plataforma: `${Platform.OS} ${String(Platform.Version)}`,
      pantalla: reporte.pantalla,
      mensaje: reporte.mensaje,
      pila: reporte.pila,
      origen: reporte.origen,
    });
  } catch {
    // A propósito: si no se pudo anotar, no se puede hacer nada más.
  }
}

/**
 * Engancha los dos manejadores que existen fuera de React.
 *
 * La barrera de React solo atrapa lo que revienta dibujando. Lo que falla en
 * un `setTimeout`, en un manejador de eventos o en una promesa sin `catch`
 * pasa por al lado, y son la mitad de las caídas.
 */
export function engancharManejadores(): void {
  if (MODO_DEMO) return;

  // React Native: el manejador global del motor.
  const global_ = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (e: unknown, fatal?: boolean) => void;
      setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void;
    };
    addEventListener?: (t: string, h: (ev: unknown) => void) => void;
  };

  const utils = global_.ErrorUtils;
  if (utils) {
    const anterior = utils.getGlobalHandler();
    utils.setGlobalHandler((error, fatal) => {
      void anotarCaida(error, "global");
      // El de antes se llama igual: es el que muestra la pantalla roja en
      // desarrollo y el que cierra la app en producción. Quedarse con él sería
      // cambiar el comportamiento de la aplicación para poder anotarlo.
      anterior(error, fatal);
    });
  }

  // Una promesa sin `catch`. En web tiene su propio evento; en React Native
  // este oyente no existe y la rama simplemente no se engancha.
  global_.addEventListener?.("unhandledrejection", (ev: unknown) => {
    const razon = (ev as { reason?: unknown })?.reason;
    void anotarCaida(razon ?? ev, "promesa");
  });
}
