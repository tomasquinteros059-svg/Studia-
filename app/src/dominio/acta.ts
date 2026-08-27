// Lo que queda después de una reunión.
//
// El equipo de tres devuelve texto; esto es lo que la aplicación hace con él.
// Y lo que hace es una sola cosa: que quien salió de la reunión no tenga que
// releer nada para saber qué le toca. De ahí que casi todo acá gire en torno
// a las tareas y a lo que quedó sin definir.
//
// Una regla que atraviesa el archivo: una tarea sin responsable o sin plazo
// no se esconde ni se rellena con un valor inventado. Se muestra marcada. Es
// exactamente el tipo de cosa que se pierde en una reunión, y taparla sería
// dejar de servir para lo único que sirve esto.

export type Prioridad = "alta" | "normal";

export type Tarea = {
  id: string;
  que: string;
  /** Quién quedó a cargo. Null si en la reunión no se dijo. */
  responsable: string | null;
  /** Fecha en ISO (aaaa-mm-dd). Null si no se puso plazo. */
  plazo: string | null;
  prioridad: Prioridad;
  /** El acuerdo del que sale, para poder volver al punto exacto. */
  acuerdo: number | null;
  lista: boolean;
};

export type Acuerdo = {
  numero: number;
  texto: string;
  /** Se acordó, o solo se propuso y quedó dando vueltas. */
  firme: boolean;
};

export type Pendiente = {
  texto: string;
  /** Por qué quedó pendiente: falta un dato, una firma, una cotización. */
  porque: string | null;
};

export type Acta = {
  /** Qué se hizo, en pocas frases. */
  resumen: string;
  acuerdos: Acuerdo[];
  tareas: Tarea[];
  /** Lo que quedó sin cerrar. */
  pendientes: Pendiente[];
  /** Puntos de la tabla que no se alcanzaron a tratar. */
  sinTratar: string[];
  /** Qué conviene llevar o preguntar la próxima vez. */
  aportes: string[];
  /** Dos personas que entendieron cosas distintas, o un acuerdo que choca. */
  contradicciones: string[];
};

export const ACTA_VACIA: Acta = {
  resumen: "", acuerdos: [], tareas: [], pendientes: [],
  sinTratar: [], aportes: [], contradicciones: [],
};

/* ------------------------------------------------------------- las tareas */

/**
 * El orden en que sirven: primero lo que vence antes, y dentro del mismo día
 * lo urgente. Lo que no tiene plazo va al final, no al principio: no es más
 * urgente por no tener fecha, es más incierto, y arriba taparía lo que sí
 * vence mañana.
 */
export function ordenarTareas(tareas: Tarea[]): Tarea[] {
  return [...tareas].sort((a, b) => {
    if (a.lista !== b.lista) return a.lista ? 1 : -1;
    if ((a.plazo === null) !== (b.plazo === null)) return a.plazo === null ? 1 : -1;
    if (a.plazo && b.plazo && a.plazo !== b.plazo) return a.plazo.localeCompare(b.plazo);
    if (a.prioridad !== b.prioridad) return a.prioridad === "alta" ? -1 : 1;
    return a.que.localeCompare(b.que, "es");
  });
}

/** Lo mío: lo que quedó a mi nombre y todavía no está hecho. */
export function misTareas(tareas: Tarea[], quienSoy: string): Tarea[] {
  const yo = normalizar(quienSoy);
  if (yo.length === 0) return [];
  return ordenarTareas(tareas.filter(
    (t) => !t.lista && t.responsable !== null && normalizar(t.responsable) === yo,
  ));
}

/**
 * Lo que la reunión dejó a medias. Es lo primero que hay que mirar y por eso
 * se calcula aparte: un compromiso sin dueño no lo va a hacer nadie, y uno
 * sin fecha no lo va a hacer nunca.
 */
export type Huecos = {
  sinResponsable: Tarea[];
  sinPlazo: Tarea[];
  /** Las dos cosas a la vez. También aparecen en las otras dos listas. */
  sinNada: Tarea[];
};

export function huecos(tareas: Tarea[]): Huecos {
  const abiertas = tareas.filter((t) => !t.lista);
  return {
    sinResponsable: ordenarTareas(abiertas.filter((t) => t.responsable === null)),
    sinPlazo: ordenarTareas(abiertas.filter((t) => t.plazo === null)),
    sinNada: ordenarTareas(abiertas.filter((t) => t.responsable === null && t.plazo === null)),
  };
}

export type EstadoDeTarea = "lista" | "vencida" | "hoy" | "proxima" | "sin_plazo";

export function estadoDeTarea(tarea: Tarea, hoy: Date = new Date()): EstadoDeTarea {
  if (tarea.lista) return "lista";
  if (tarea.plazo === null) return "sin_plazo";
  const dia = comoDia(hoy);
  if (tarea.plazo < dia) return "vencida";
  if (tarea.plazo === dia) return "hoy";
  return "proxima";
}

/** "vence hoy", "vencía el 3 de septiembre", "en 4 días". */
export function cuandoVence(tarea: Tarea, hoy: Date = new Date()): string {
  const estado = estadoDeTarea(tarea, hoy);
  if (estado === "lista") return "lista";
  if (estado === "sin_plazo") return "sin plazo";
  if (estado === "hoy") return "vence hoy";

  const dias = diasEntre(comoDia(hoy), tarea.plazo!);
  if (estado === "vencida") {
    return dias === -1 ? "venció ayer" : `venció hace ${-dias} días`;
  }
  if (dias === 1) return "vence mañana";
  if (dias <= 7) return `vence en ${dias} días`;
  return `vence el ${enPalabras(tarea.plazo!)}`;
}

/* ------------------------------------------------------- cómo quedó la cosa */

export type Balance = {
  acuerdos: number;
  /** Acuerdos que quedaron solo propuestos. */
  propuestos: number;
  tareas: number;
  listas: number;
  vencidas: number;
  sinResponsable: number;
  sinPlazo: number;
  pendientes: number;
  sinTratar: number;
};

export function balanceDe(acta: Acta, hoy: Date = new Date()): Balance {
  const h = huecos(acta.tareas);
  return {
    acuerdos: acta.acuerdos.filter((a) => a.firme).length,
    propuestos: acta.acuerdos.filter((a) => !a.firme).length,
    tareas: acta.tareas.length,
    listas: acta.tareas.filter((t) => t.lista).length,
    vencidas: acta.tareas.filter((t) => estadoDeTarea(t, hoy) === "vencida").length,
    sinResponsable: h.sinResponsable.length,
    sinPlazo: h.sinPlazo.length,
    pendientes: acta.pendientes.length,
    sinTratar: acta.sinTratar.length,
  };
}

/**
 * La frase que resume el balance, para la fila de la lista de reuniones.
 * Se dice lo que falta antes que lo que se logró: lo que se logró ya está
 * hecho y no requiere que nadie mueva un dedo.
 */
export function comoQuedo(balance: Balance): string {
  const partes: string[] = [];
  const abiertas = balance.tareas - balance.listas;

  if (abiertas > 0) partes.push(`${abiertas} ${abiertas === 1 ? "tarea" : "tareas"}`);
  if (balance.vencidas > 0) partes.push(`${balance.vencidas} vencida${balance.vencidas === 1 ? "" : "s"}`);
  if (balance.sinResponsable > 0) partes.push(`${balance.sinResponsable} sin responsable`);
  if (balance.sinTratar > 0) partes.push(`${balance.sinTratar} sin tratar`);

  if (partes.length === 0) {
    return balance.acuerdos > 0
      ? `${balance.acuerdos} ${balance.acuerdos === 1 ? "acuerdo" : "acuerdos"}, nada pendiente`
      : "Sin acuerdos ni pendientes";
  }
  return partes.join(" · ");
}

/**
 * Qué mirar primero, en orden. Es lo que la persona ve arriba del acta: no
 * un puntaje, sino tres frases accionables como mucho. Más de tres deja de
 * ser un aviso y pasa a ser otra lista que leer.
 */
export function loPrimero(acta: Acta, hoy: Date = new Date()): string[] {
  const b = balanceDe(acta, hoy);
  const avisos: string[] = [];

  if (b.vencidas > 0) {
    avisos.push(b.vencidas === 1
      ? "Hay una tarea con el plazo vencido."
      : `Hay ${b.vencidas} tareas con el plazo vencido.`);
  }
  if (b.sinResponsable > 0) {
    avisos.push(b.sinResponsable === 1
      ? "Un compromiso quedó sin nadie a cargo."
      : `${b.sinResponsable} compromisos quedaron sin nadie a cargo.`);
  }
  if (acta.contradicciones.length > 0) {
    avisos.push(acta.contradicciones.length === 1
      ? "Hay un punto donde no todos entendieron lo mismo."
      : `Hay ${acta.contradicciones.length} puntos donde no todos entendieron lo mismo.`);
  }
  if (b.sinPlazo > 0 && avisos.length < 3) {
    avisos.push(b.sinPlazo === 1
      ? "Un compromiso quedó sin fecha."
      : `${b.sinPlazo} compromisos quedaron sin fecha.`);
  }
  if (b.sinTratar > 0 && avisos.length < 3) {
    avisos.push(b.sinTratar === 1
      ? "Un punto de la tabla no alcanzó a tratarse."
      : `${b.sinTratar} puntos de la tabla no alcanzaron a tratarse.`);
  }
  return avisos.slice(0, 3);
}

/* ------------------------------------------------------------------ fechas */

const comoDia = (d: Date): string => d.toISOString().slice(0, 10);

const diasEntre = (desde: string, hasta: string): number =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "3 de septiembre". Sin el año, que en una reunión nunca es el dudoso. */
export function enPalabras(dia: string): string {
  const [, mes, numero] = dia.split("-");
  const nombre = MESES[Number(mes) - 1];
  if (!nombre || !numero) return dia;
  return `${Number(numero)} de ${nombre}`;
}

const normalizar = (t: string): string =>
  t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
