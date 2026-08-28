// Lo que el estudiante ajustó en el lector, guardado en el aparato.
//
// Va local y no en la base: son ajustes de vista —tamaño de letra, velocidad,
// dónde quedó— que dependen de la pantalla que tiene en la mano, no de su
// cuenta. Además así el lector abre sin esperar a la red.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PREFERENCIAS_POR_DEFECTO, normalizarPreferencias, type Preferencias,
} from "../dominio/lectura.ts";

const CLAVE_PREFERENCIAS = "studia.lectura.preferencias";
const clavePosicion = (idTexto: string) => `studia.lectura.posicion.${idTexto}`;

// Ninguna falla del almacenamiento debería impedir leer: se cae al valor por
// defecto y listo.

export async function leerPreferencias(): Promise<Preferencias> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_PREFERENCIAS);
    return normalizarPreferencias(crudo ? JSON.parse(crudo) : null);
  } catch {
    return { ...PREFERENCIAS_POR_DEFECTO };
  }
}

export async function guardarPreferencias(p: Preferencias): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(p));
  } catch {
    // Se pierde el ajuste, no la lectura.
  }
}

export async function leerPosicion(idTexto: string): Promise<number | null> {
  try {
    const crudo = await AsyncStorage.getItem(clavePosicion(idTexto));
    if (crudo === null) return null;
    const n = Number.parseInt(crudo, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function guardarPosicion(idTexto: string, indice: number): Promise<void> {
  try {
    await AsyncStorage.setItem(clavePosicion(idTexto), String(indice));
  } catch {
    // Idem: la próxima vez empieza de arriba.
  }
}
