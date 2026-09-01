// Lo escrito que todavía no subió, guardado en el aparato.
//
// Va en el almacenamiento local y no en la base por la razón evidente: existe
// justamente para cuando no se puede llegar a la base. Las reglas de cuál
// versión gana están en `dominio/borrador.ts`, con pruebas.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Borrador } from "../dominio/borrador.ts";

const clave = (apunteId: string) => `studia.apunte.borrador.${apunteId}`;

// Ninguna falla del almacenamiento debería impedir escribir. Si esto no
// funciona, la aplicación sigue como antes: guardando contra el servidor.

export async function guardarBorrador(b: Borrador): Promise<void> {
  try {
    await AsyncStorage.setItem(clave(b.apunteId), JSON.stringify(b));
  } catch { /* se sigue sin copia local */ }
}

export async function leerBorrador(apunteId: string): Promise<Borrador | null> {
  try {
    const crudo = await AsyncStorage.getItem(clave(apunteId));
    if (!crudo) return null;
    const b = JSON.parse(crudo) as Borrador;
    // Un borrador a medio escribir en el disco es peor que ninguno: haría
    // que la pantalla abra con `undefined` donde va el texto.
    if (typeof b?.contenido !== "string" || typeof b?.escritoEn !== "number") return null;
    return { ...b, apunteId };
  } catch {
    return null;
  }
}

export async function olvidarBorrador(apunteId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(clave(apunteId));
  } catch { /* quedará una copia de más; `cualGana` la descarta sola */ }
}
