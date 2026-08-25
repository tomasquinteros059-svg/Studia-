// Credenciales de sala para el audio en vivo.
//
// Un token de LiveKit es un JWT firmado con HMAC-SHA256 y un permiso de vídeo
// adentro. Se arma acá, sin dependencias, para poder probarlo sin Deno ni
// LiveKit: lo que decide quién puede hablar no debería depender de una
// biblioteca que no se puede ejecutar en las pruebas.

export type Papel = "estudiante" | "docente";

export type PermisoSala = {
  sala: string;
  identidad: string;
  nombre: string;
  papel: Papel;
};

/** Cuánto vale un token. Corto: se pide otro al volver a entrar. */
export const VIGENCIA_SEGUNDOS = 6 * 60 * 60;

/** El nombre de sala sale de la clase, nunca de lo que mande el cliente. */
export function nombreDeSala(claseId: string): string {
  return `clase-${claseId}`;
}

export type Reclamos = {
  iss: string;
  sub: string;
  name: string;
  nbf: number;
  exp: number;
  video: {
    room: string;
    roomJoin: true;
    canSubscribe: true;
    canPublish: boolean;
    canPublishData: true;
    roomAdmin: boolean;
  };
};

/**
 * El docente publica audio desde que entra; el estudiante entra escuchando y
 * solo puede publicar cuando el profesor le da la palabra, lo que implica pedir
 * otro token. Así, un estudiante no puede abrir su micrófono por su cuenta ni
 * modificando la app: el permiso no está en el token que tiene.
 */
export function construirReclamos(
  permiso: PermisoSala,
  claveApi: string,
  ahoraSegundos: number,
  puedePublicar = permiso.papel === "docente",
): Reclamos {
  return {
    iss: claveApi,
    sub: permiso.identidad,
    name: permiso.nombre,
    nbf: ahoraSegundos,
    exp: ahoraSegundos + VIGENCIA_SEGUNDOS,
    video: {
      room: permiso.sala,
      roomJoin: true,
      canSubscribe: true,
      canPublish: puedePublicar,
      canPublishData: true,
      roomAdmin: permiso.papel === "docente",
    },
  };
}

function base64url(datos: Uint8Array | string): string {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : datos;
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Firma el JWT con HMAC-SHA256, que es lo que LiveKit espera. */
export async function firmarToken(reclamos: Reclamos, secreto: string): Promise<string> {
  const cabecera = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(reclamos));
  const material = `${cabecera}.${cuerpo}`;

  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(material));

  return `${material}.${base64url(new Uint8Array(firma))}`;
}

/** Deshace el JWT sin verificar. Solo para pruebas y depuración. */
export function leerReclamos(token: string): Reclamos {
  const parte = token.split(".")[1];
  if (!parte) throw new Error("El token no tiene cuerpo.");

  const relleno = parte.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(relleno + "=".repeat((4 - (relleno.length % 4)) % 4));

  // `atob` devuelve bytes, no texto: sin decodificar el UTF-8 explícitamente,
  // un nombre con acentos vuelve roto.
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
