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

/** "1.1.0", o cadena vacía si el paquete no la trae. */
export const VERSION: string = Constants.expoConfig?.version ?? "";

/** "Versión 1.1.0", listo para pintar. */
export const VERSION_VISIBLE: string = versionParaMostrar(VERSION);
