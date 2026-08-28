// Qué hacer con el micrófono según el permiso que dio el sistema.
// Aparte de la app para poder probarlo sin un dispositivo.

export type EstadoMicrofono =
  | "sin_preguntar"   // todavía no se le pidió al sistema
  | "concedido"
  | "denegado"        // dijo que no, pero se le puede volver a preguntar
  | "bloqueado";      // dijo que no para siempre: solo se arregla en Ajustes

export type AccionMicrofono = "abrir" | "pedir" | "ir_a_ajustes";

/**
 * Nunca se pide el permiso al entrar a la clase: se pide cuando el estudiante
 * intenta hablar. Un permiso pedido sin motivo visible se rechaza más.
 */
export function accionAlTocarMicrofono(estado: EstadoMicrofono): AccionMicrofono {
  if (estado === "concedido") return "abrir";
  if (estado === "bloqueado") return "ir_a_ajustes";
  return "pedir";
}

/** Traduce la respuesta del sistema al estado que usa la app. */
export function estadoDesdePermiso(
  permiso: { granted: boolean; canAskAgain: boolean },
): EstadoMicrofono {
  if (permiso.granted) return "concedido";
  return permiso.canAskAgain ? "denegado" : "bloqueado";
}

/** Lo que se lee debajo del botón. */
export function etiquetaMicrofono(estado: EstadoMicrofono, abierto: boolean): string {
  if (estado === "bloqueado") return "Sin permiso";
  if (!abierto) return "Silenciado";
  return "Micrófono abierto";
}

export const AVISO_BLOQUEADO =
  "StudIA no tiene permiso para usar el micrófono. Puedes activarlo en los " +
  "ajustes del teléfono; mientras tanto puedes seguir la clase escuchando.";

export const AVISO_DENEGADO =
  "Sin micrófono puedes escuchar la clase, pero no hablar. Puedes volver a " +
  "intentarlo cuando quieras.";
