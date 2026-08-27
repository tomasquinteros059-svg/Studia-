// Qué se puede adjuntar a un ramo propio, y en qué se convierte.
//
// El almacenamiento todavía no existe: cuando exista, lo único que hay que
// escribir es la subida. Las reglas de qué se acepta viven acá porque no
// dependen de dónde termine guardado el archivo, y conviene que estén
// decididas antes: rechazar un archivo después de subirlo es peor.

export type TipoDeMaterial = "video" | "documento" | "ejercicios";

export type Adjunto = {
  nombre: string;
  /** Tipo MIME que reporta el aparato. Puede venir vacío o mentir. */
  mime: string;
  /** Bytes. Cero o negativo significa que el aparato no lo supo decir. */
  tamano: number;
};

/**
 * Veinte megas. No es una cifra caprichosa: es lo que pesa un apunte
 * escaneado de cien páginas, y por encima de eso conviene que la persona
 * parta el archivo antes de subirlo por datos móviles.
 */
export const TAMANO_MAXIMO = 20 * 1024 * 1024;

const EXTENSIONES: Record<string, TipoDeMaterial> = {
  pdf: "documento", doc: "documento", docx: "documento",
  txt: "documento", md: "documento", rtf: "documento", odt: "documento",
  ppt: "documento", pptx: "documento",
  png: "documento", jpg: "documento", jpeg: "documento", heic: "documento",
  mp4: "video", mov: "video", m4v: "video", webm: "video",
  mp3: "video", m4a: "video", wav: "video", ogg: "video",
  csv: "ejercicios", xlsx: "ejercicios", xls: "ejercicios",
};

export function extensionDe(nombre: string): string {
  const limpio = nombre.trim().toLowerCase();
  const punto = limpio.lastIndexOf(".");
  return punto <= 0 ? "" : limpio.slice(punto + 1);
}

/**
 * De qué tipo es. Se decide por la extensión y no por el MIME: el MIME que
 * reporta un aparato Android es `application/octet-stream` la mitad de las
 * veces, y el nombre casi nunca miente.
 */
export function tipoDe(nombre: string): TipoDeMaterial | null {
  return EXTENSIONES[extensionDe(nombre)] ?? null;
}

export type Revision = { ok: true; tipo: TipoDeMaterial } | { ok: false; motivo: string };

export function revisar(adjunto: Adjunto): Revision {
  const nombre = adjunto.nombre.trim();
  if (nombre.length === 0) return { ok: false, motivo: "Ese archivo no tiene nombre." };

  const tipo = tipoDe(nombre);
  if (tipo === null) {
    const ext = extensionDe(nombre);
    return {
      ok: false,
      motivo: ext
        ? `No sé qué hacer con un archivo .${ext}. Sirven PDF, Word, imágenes, audio y video.`
        : "Ese archivo no tiene extensión y no sé qué es.",
    };
  }

  if (adjunto.tamano > TAMANO_MAXIMO) {
    return {
      ok: false,
      motivo: `Pesa ${comoPeso(adjunto.tamano)} y el máximo son ${comoPeso(TAMANO_MAXIMO)}. Pártelo o comprímelo.`,
    };
  }

  return { ok: true, tipo };
}

/** "2,4 MB". Con coma decimal, que es como se escribe en Chile. */
export function comoPeso(bytes: number): string {
  if (bytes <= 0) return "tamaño desconocido";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * El nombre sin la extensión, presentable como título. Es lo que se propone
 * al adjuntar, para que nadie tenga que escribirlo de nuevo.
 */
export function tituloDesdeNombre(nombre: string): string {
  const sinRuta = nombre.split(/[\\/]/).pop() ?? nombre;
  const punto = sinRuta.lastIndexOf(".");
  // Un punto al principio es un archivo oculto: no le queda nombre debajo.
  const base = punto > 0 ? sinRuta.slice(0, punto) : punto === 0 ? "" : sinRuta;
  const legible = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (legible.length === 0) return "Material sin nombre";
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}

/** La línea que acompaña al material en la lista del ramo. */
export function detalleDe(adjunto: Adjunto): string {
  const ext = extensionDe(adjunto.nombre);
  const peso = comoPeso(adjunto.tamano);
  return ext ? `${ext.toUpperCase()} · ${peso}` : peso;
}

/**
 * Cuánto dura leer un texto en voz alta, para el detalle de una lectura
 * escrita a mano. Misma velocidad que usa el lector.
 */
export function minutosDeLectura(texto: string): number {
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(palabras / 155));
}
