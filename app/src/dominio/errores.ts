// Qué se manda cuando la aplicación se cae, y qué no.
//
// Existe porque hoy, si a alguien se le cierra la app en medio de una clase,
// no se entera nadie: no hay registro en ninguna parte y la persona no va a
// escribir un correo. Sin esto, un error que le pasa a treinta personas se ve
// igual que uno que no le pasa a nadie.
//
// Lo delicado es lo segundo: qué NO se manda. Un mensaje de error arrastra lo
// que había alrededor cuando reventó, y ahí puede venir el correo de alguien o
// el token de su sesión. Un token en una tabla de errores es una sesión ajena
// esperando a que alguien la lea. Por eso se limpia acá, en una función con
// pruebas, y no en el camino.

/** Lo que se guarda de una caída. */
export type Reporte = {
  mensaje: string;
  /** Las primeras líneas de la pila. Nula si el error no traía. */
  pila: string | null;
  /** En qué pantalla estaba. Vacía si todavía no se sabe. */
  pantalla: string;
  /** Si venía de la barrera de React o del manejador global. */
  origen: "pantalla" | "global" | "promesa";
};

/** Hasta dónde se guarda cada cosa. Más allá no ayuda a nadie a arreglar nada. */
export const LARGO_MENSAJE = 500;
export const LARGO_PILA = 2000;

const CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Un JWT, o cualquier tira larga que parezca una clave. La longitud es la
// pista: nada de lo que uno escribe a mano tiene cuarenta caracteres seguidos
// sin espacios.
const CLAVE = /\b(eyJ[\w-]{10,}\.[\w-]+\.?[\w-]*|[A-Za-z0-9_-]{40,})\b/g;
// Una dirección con parámetros: los tokens de las direcciones firmadas viajan
// ahí, y una dirección firmada es acceso a un archivo ajeno.
const CONSULTA = /(\?|#)[^\s"']{10,}/g;

/**
 * Saca de un texto lo que no puede quedar guardado.
 *
 * No intenta ser exhaustivo —no se puede— sino cubrir las tres formas en que
 * esto pasa de verdad: un correo dentro del mensaje, un token de sesión en una
 * cabecera que el error copió, y una dirección firmada completa.
 */
export function limpiar(texto: string): string {
  return texto
    .replace(CORREO, "(correo)")
    .replace(CLAVE, "(clave)")
    .replace(CONSULTA, "$1(parámetros)");
}

/** El mensaje de cualquier cosa que alguien haya lanzado. */
function mensajeDe(falla: unknown): string {
  if (falla instanceof Error) return falla.message || falla.name || "Error sin mensaje";
  if (typeof falla === "string") return falla;
  // Alguien lanzó un objeto. Pasa más de lo que parece con las bibliotecas.
  try {
    return JSON.stringify(falla).slice(0, LARGO_MENSAJE);
  } catch {
    return "Error que no se puede describir";
  }
}

/**
 * Arma el reporte a partir de lo que sea que se lanzó.
 *
 * Nunca revienta: si esto fallara, la aplicación se caería dos veces y la
 * segunda sin dejar rastro.
 */
export function armarReporte(
  falla: unknown, pantalla: string, origen: Reporte["origen"],
): Reporte {
  const pila = falla instanceof Error && falla.stack ? falla.stack : null;
  return {
    mensaje: limpiar(mensajeDe(falla)).slice(0, LARGO_MENSAJE),
    pila: pila ? limpiar(pila).slice(0, LARGO_PILA) : null,
    pantalla: limpiar(pantalla).slice(0, 60),
    origen,
  };
}

/**
 * Si este error ya se mandó hace poco.
 *
 * Un error dentro de un render se repite en cada intento de dibujar: sin esto,
 * una pantalla rota manda cien filas por minuto y la tabla deja de servir para
 * enterarse de nada.
 */
export const NO_REPETIR_POR = 60_000;

export function esRepetido(
  reporte: Reporte, vistos: Map<string, number>, ahora: number,
): boolean {
  const huella = `${reporte.origen}·${reporte.pantalla}·${reporte.mensaje}`;
  const antes = vistos.get(huella);
  if (antes !== undefined && ahora - antes < NO_REPETIR_POR) return true;
  vistos.set(huella, ahora);
  return false;
}

/**
 * Qué se le dice a la persona cuando la pantalla se cayó.
 *
 * Sin el mensaje técnico: no le sirve, y el que sí lo necesita lo tiene en la
 * tabla. Lo que sí se dice es que el problema ya se sabe, porque si no la
 * reacción natural es no contarlo.
 */
export const QUE_SE_LE_DICE = {
  titulo: "Se cayó esta pantalla",
  cuerpo: "No fue algo que hicieras mal. Ya quedó anotado para arreglarlo; "
    + "puedes volver a intentarlo.",
  boton: "Volver a intentarlo",
} as const;
