// Qué versión de la app se está usando.
//
// Existe por una razón concreta: al probar un APK nuevo encima de uno viejo
// no había forma de saber cuál de los dos estaba abierto. El teléfono guarda
// el archivo anterior en Descargas con el mismo nombre, y basta tocar el
// equivocado para quedarse con la versión vieja creyendo que es la nueva.
//
// Con esto, la pantalla de perfil lo dice y la duda se resuelve mirando.

import Constants from "expo-constants";
import { versionParaMostrar } from "../dominio/version.ts";

/** "1.3.0", o cadena vacía si el paquete no la trae. */
export const VERSION: string = Constants.expoConfig?.version ?? "";

/**
 * El número de compilación. Lo pone el flujo que arma el APK; en una
 * compilación hecha a mano no viene.
 *
 * Sale de `extra` y no de `android.versionCode`, que es donde Android lo
 * lee: ese bloque no llega a `expoConfig` en todas las plataformas —en web
 * no viene— y el número quedaría sin mostrarse justo donde se revisa.
 */
export const COMPILACION: number | null = (() => {
  const crudo = Constants.expoConfig?.extra?.compilacion;
  const n = typeof crudo === "string" ? Number(crudo) : crudo;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
})();

/** "Versión 1.3.0 (247)", listo para pintar. */
export const VERSION_VISIBLE: string = versionParaMostrar(VERSION, COMPILACION);
