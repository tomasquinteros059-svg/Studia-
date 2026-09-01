// Qué merece sonar en el teléfono, y a qué hora.
//
// La pregunta no es «¿se puede avisar?» sino «¿vale la pena interrumpir?».
// Una aplicación de estudio que vibra por cualquier cosa se silencia en la
// primera semana, y entonces tampoco avisa lo que sí importaba.
//
// Vive en el servidor porque la decisión se toma ahí: el teléfono no elige qué
// le llega. Y vive aparte de `avisar/index.ts` para poder probarla sin mandar
// nada a ninguna parte.

/** Los avisos que la aplicación ya sabe generar. */
export type TipoDeAviso = "clase" | "anuncio" | "tarea" | "nota";

/**
 * Si este aviso merece salir del teléfono.
 *
 * Los anuncios del profesor no: se acumulan, muchos son de trámite, y llegan
 * igual la próxima vez que se abra la aplicación. Los otros tres tienen algo
 * en común: si uno se entera tarde, ya no sirven de nada.
 */
export function vibra(tipo: TipoDeAviso): boolean {
  return tipo !== "anuncio";
}

/** Desde qué hora y hasta cuál se puede interrumpir. */
export const DESDE_LAS = 8;
export const HASTA_LAS = 22;

/**
 * Si a esta hora se puede avisar.
 *
 * A las tres de la mañana ningún aviso de una app de estudio es urgente. Lo
 * que queda fuera de hora no se pierde: sale a la mañana siguiente, y por eso
 * esto decide «ahora sí o ahora no», no «se manda o no se manda».
 */
export function esHoraDecente(hora: number): boolean {
  return hora >= DESDE_LAS && hora < HASTA_LAS;
}

/** El texto de un aviso, tal como se ve en la pantalla bloqueada. */
export type Aviso = { titulo: string; cuerpo: string };

const SIN_DETALLE: Record<TipoDeAviso, string> = {
  clase: "Tu clase está empezando.",
  anuncio: "Hay un aviso nuevo.",
  tarea: "Tienes una entrega cerca.",
  nota: "Publicaron una nota nueva.",
};

/**
 * Cómo se lee el aviso afuera de la aplicación.
 *
 * Afuera no hay contexto: no se sabe de qué ramo es ni qué se estaba haciendo.
 * Por eso el ramo va adelante —«Cálculo I · …»— y por eso el cuerpo tiene que
 * poder leerse solo. Un aviso que dice «Nueva nota» y nada más obliga a abrir
 * la aplicación para saber si vale la pena abrirla.
 */
export function comoSuena(
  tipo: TipoDeAviso, titulo: string, detalle: string, ramo?: string | null,
): Aviso {
  const conRamo = ramo?.trim() ? `${ramo.trim()} · ` : "";
  const cuerpo = detalle.trim() || SIN_DETALLE[tipo];
  return { titulo: `${conRamo}${titulo.trim()}`.slice(0, 80), cuerpo: cuerpo.slice(0, 160) };
}
