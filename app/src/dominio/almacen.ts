// Dónde queda guardado cada archivo, y con qué nombre.
//
// La ruta no es un detalle interno: es lo que decide quién puede abrir el
// archivo. Las políticas de acceso del almacenamiento leen la primera parte de
// la ruta —«yo/<persona>» o «ramo/<asignatura>»— y de ahí sacan el permiso. Si
// la ruta se arma mal, o se arma en dos lugares distintos que se van
// separando, el permiso deja de corresponder al archivo.
//
// Por eso vive acá, en una función sola y con pruebas, y no pegada al código
// que sube.

/** A quién pertenece lo que se sube. */
export type Destino =
  /** El espacio propio de una persona: lo suyo, que no ve nadie más. */
  | { tipo: "yo"; personaId: string }
  /** El material de un ramo: lo ve el curso, lo sube quien lo dicta. */
  | { tipo: "ramo"; asignaturaId: string }
  /**
   * Lo que se entrega en una tarea.
   *
   * Es su propia forma y no el espacio propio, aunque lo suba un alumno: una
   * entrega existe para que la lea quien corrige. Guardarla en «yo/» la
   * dejaría fuera del alcance del profesor, que es justamente la única
   * persona que además del alumno tiene que poder abrirla.
   */
  | { tipo: "entrega"; tareaId: string };

/**
 * El nombre del archivo, dejado en algo que un almacenamiento acepte.
 *
 * Los nombres reales traen tildes, espacios, paréntesis y a veces una barra.
 * La barra es la peligrosa: en una ruta significa «carpeta», así que un
 * archivo llamado «tarea 3/4.pdf» se guardaría una carpeta más adentro y
 * quedaría fuera de lo que la política permite mirar.
 */
export function nombreSeguro(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")     // se van las tildes, queda la letra
    .replace(/[^a-zA-Z0-9._-]+/g, "-")   // todo lo demás pasa a guion
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");      // ni empieza ni termina en guion o punto

  // Un nombre que se quedó en nada igual necesita llamarse de alguna manera.
  if (!limpio) return "archivo";
  // Storage no se lleva bien con nombres larguísimos, y nadie los lee igual.
  return limpio.length > 80 ? limpio.slice(-80).replace(/^[-.]+/, "") : limpio;
}

/** La carpeta que mira la política de acceso. */
export function carpetaDe(destino: Destino): string {
  switch (destino.tipo) {
    case "yo": return `yo/${destino.personaId}`;
    case "ramo": return `ramo/${destino.asignaturaId}`;
    case "entrega": return `entrega/${destino.tareaId}`;
  }
}

/**
 * La ruta completa.
 *
 * El identificador único va delante del nombre y no detrás: subir dos veces
 * «apunte.pdf» tiene que dar dos archivos, no uno pisando al otro, y con el
 * nombre delante los dos se llamarían igual hasta el punto.
 */
export function rutaPara(destino: Destino, nombre: string, unico: string): string {
  return `${carpetaDe(destino)}/${unico}-${nombreSeguro(nombre)}`;
}

/** El bucket. Uno solo: lo que separa es la carpeta, no el bucket. */
export const BALDE = "material";
