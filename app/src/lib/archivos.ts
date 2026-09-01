// La costura hacia el almacenamiento en la nube.
//
// Elegir el archivo lo hace el sistema; guardarlo, Supabase Storage. Dónde
// queda y con qué nombre lo decide `dominio/almacen.ts`, y no es un detalle
// interno: las políticas de acceso leen la ruta para saber quién puede abrir
// el archivo. Si las dos puntas no arman la misma ruta, la subida se rechaza
// sin decir por qué.
//
// El bucket es privado. Uno público entrega cualquier archivo a quien tenga la
// dirección, y las direcciones se filtran solas: se pegan en un chat, quedan
// en el historial. Acá se pide una dirección firmada cada vez, y vence.

import { MODO_DEMO, hayBackend } from "./config.ts";
import { supabase } from "./supabase.ts";
import { BALDE, rutaPara, type Destino } from "../dominio/almacen.ts";
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
 * Si es falso, se puede elegir un archivo pero no guardarlo.
 *
 * Depende del servidor y de nada más: el bucket viaja en las migraciones, así
 * que donde hay base de datos hay dónde guardar. En la demostración no, y ahí
 * el botón lo dice en vez de fallar al apretarlo.
 */
export const HAY_ALMACENAMIENTO = hayBackend;

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

/**
 * El espacio propio de quien tiene la sesión abierta.
 *
 * Sale del token y no de un parámetro: si el identificador lo pusiera la
 * pantalla, un error ahí guardaría el archivo en la carpeta de otra persona
 * —o lo intentaría, y la política lo rechazaría sin explicación—.
 */
export async function miEspacio(): Promise<Destino | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ? { tipo: "yo", personaId: data.user.id } : null;
}

export type Subida =
  | { ok: true; url: string }
  | { ok: false; motivo: string };

/**
 * Guarda el archivo y devuelve la ruta con que se recupera.
 *
 * Lo que se guarda en `materiales.url` es la ruta, no una dirección pública:
 * la dirección se firma al abrirla, con `direccionFirmada`, para que un
 * archivo de un ramo no quede accesible a quien tenga el enlace.
 */
export async function subir(adjunto: AdjuntoElegido, destino: Destino): Promise<Subida> {
  if (!HAY_ALMACENAMIENTO) return { ok: false, motivo: AVISO_SIN_ALMACENAMIENTO };

  const ruta = rutaPara(destino, adjunto.nombre, crypto.randomUUID());

  let cuerpo: ArrayBuffer;
  try {
    // ArrayBuffer y no Blob: en React Native el Blob no trae los bytes
    // consigo, y lo que se sube termina siendo un archivo de cero bytes que
    // no falla en ninguna parte hasta que alguien intenta abrirlo.
    cuerpo = await fetch(adjunto.uri).then((r) => r.arrayBuffer());
  } catch {
    return { ok: false, motivo: "No pude leer el archivo desde el teléfono. Elígelo de nuevo." };
  }

  const { error } = await supabase.storage.from(BALDE).upload(ruta, cuerpo, {
    contentType: adjunto.mime || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    const m = error.message.toLowerCase();
    // El caso más común y el más confuso: la política dice que no. Devolver
    // «new row violates row-level security policy» no le sirve a nadie.
    if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("403")) {
      return { ok: false, motivo: "No tienes permiso para guardar archivos acá." };
    }
    if (m.includes("payload") || m.includes("too large") || m.includes("413")) {
      return { ok: false, motivo: "El archivo pesa más de lo que se puede guardar." };
    }
    return { ok: false, motivo: "No pude guardar el archivo. Revisa tu internet e inténtalo de nuevo." };
  }

  return { ok: true, url: ruta };
}

/** Cuánto dura una dirección firmada: lo justo para abrir el archivo. */
const DURA_SEGUNDOS = 60 * 60;

/**
 * La dirección con la que se abre un archivo guardado.
 *
 * Null cuando no se puede: sin servidor, con una ruta que ya no existe, o
 * cuando quien mira no tiene permiso. Las tres se ven igual desde acá a
 * propósito —decir «existe pero no puedes» ya es contar algo—.
 */
export async function direccionFirmada(ruta: string | null): Promise<string | null> {
  if (!ruta || MODO_DEMO) return null;
  // Lo que se guardó antes de que existiera el almacenamiento puede ser una
  // dirección de internet y no una ruta; esa se abre tal cual.
  if (/^https?:\/\//i.test(ruta)) return ruta;

  const { data, error } = await supabase.storage.from(BALDE).createSignedUrl(ruta, DURA_SEGUNDOS);
  return error ? null : data?.signedUrl ?? null;
}

export const AVISO_SIN_ALMACENAMIENTO = hayBackend
  ? "No pude guardar el archivo. Revisa tu internet e inténtalo de nuevo."
  : "Guardar archivos necesita el servidor conectado. Mientras tanto puedes escribir o pegar el texto acá abajo: eso sí queda, y el lector lo lee en voz alta.";
