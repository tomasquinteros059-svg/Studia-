// La costura hacia el almacenamiento en la nube.
//
// Todavía no hay dónde guardar archivos, y este archivo existe justamente
// para que ese día sea corto. Elegir un archivo ya funciona; subirlo es lo
// único que falta, y es UNA función. Cuando haya un bucket de Supabase
// Storage —o el que sea—, se implementa `subir` acá adentro y ninguna
// pantalla se entera.
//
// Lo que NO se hace: esconder el botón. Un botón que no está no se puede
// planificar; uno que está y dice por qué no funciona, sí.

import { hayBackend } from "./config.ts";
import type { Adjunto } from "../dominio/adjuntos.ts";

type ModuloElector = typeof import("expo-document-picker");

// Igual que expo-audio y expo-speech: si el cliente no trae el módulo nativo,
// la app sigue abriendo y el botón lo explica.
let elector: ModuloElector | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  elector = require("expo-document-picker") as ModuloElector;
} catch {
  elector = null;
}

export const sePuedeElegirArchivo = elector !== null;

/**
 * Si es falso, se puede elegir un archivo pero no guardarlo. Hoy siempre lo
 * es: no hay bucket configurado. El día que lo haya, esta constante pasa a
 * mirar la configuración de verdad.
 */
export const HAY_ALMACENAMIENTO = false;

export type AdjuntoElegido = Adjunto & { uri: string };

/** Abre el selector del sistema. Null si la persona lo cerró sin elegir. */
export async function elegirArchivo(): Promise<AdjuntoElegido | null> {
  if (!elector) return null;

  const r = await elector.getDocumentAsync({ copyToCacheDirectory: true });
  if (r.canceled) return null;

  const archivo = r.assets?.[0];
  if (!archivo) return null;

  return {
    nombre: archivo.name,
    mime: archivo.mimeType ?? "",
    tamano: archivo.size ?? 0,
    uri: archivo.uri,
  };
}

export type Subida =
  | { ok: true; url: string }
  | { ok: false; motivo: string };

/**
 * Guarda el archivo y devuelve la dirección con que se recupera. Es lo único
 * que falta implementar.
 *
 * Cuando haya almacenamiento, acá va algo así:
 *
 *     const cuerpo = await fetch(adjunto.uri).then((r) => r.blob());
 *     const ruta = `${duenoId}/${crypto.randomUUID()}-${adjunto.nombre}`;
 *     const { error } = await supabase.storage.from("material").upload(ruta, cuerpo);
 *     if (error) return { ok: false, motivo: error.message };
 *     return { ok: true, url: ruta };
 *
 * Y en `materiales.url` se guarda esa ruta, no una dirección pública: la
 * dirección se firma al abrirla para que un archivo de un ramo no quede
 * accesible a quien tenga el enlace.
 */
export async function subir(_adjunto: AdjuntoElegido, _duenoId: string): Promise<Subida> {
  return { ok: false, motivo: AVISO_SIN_ALMACENAMIENTO };
}

export const AVISO_SIN_ALMACENAMIENTO = hayBackend
  ? "Todavía no hay almacenamiento conectado, así que el archivo no se puede guardar. Mientras tanto puedes escribir o pegar el texto acá abajo: eso sí queda, y el lector lo lee en voz alta."
  : "Guardar archivos necesita el servidor conectado. Mientras tanto puedes escribir o pegar el texto acá abajo: eso sí queda, y el lector lo lee en voz alta.";
