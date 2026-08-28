// Reuniones que se repiten a una hora fija.
//
// Hay una limitación que no es nuestra y conviene tenerla escrita acá, donde
// se toman las decisiones que dependen de ella: NINGUNA aplicación puede
// prender el micrófono sola a una hora. Android lo prohíbe explícitamente
// —un servicio de micrófono no se puede crear con la app en segundo plano— y
// iOS solo deja CONTINUAR una grabación que empezó con la app abierta, nunca
// iniciarla. Los dos, además, muestran un indicador permanente mientras el
// micrófono está activo, y la persona puede cortarlo cuando quiera.
//
// Así que lo que se agenda no es la grabación: es el aviso. A la hora fijada
// llega una notificación y basta un toque para empezar. Ese toque es lo único
// que las dos plataformas exigen, y después la grabación sigue con la
// pantalla bloqueada sin problema.
//
// El resultado práctico es casi el mismo —nadie tiene que acordarse de nada—
// y el que graba sabe que está grabando, que es como debe ser cuando en la
// sala hay más gente.

export type Repeticion = "nunca" | "cada_semana" | "dias_de_semana";

export type Agenda = {
  /** Cuándo empieza, en ISO. Null si no está agendada. */
  programada_para: string | null;
  repite: Repeticion;
};

export const SIN_AGENDA: Agenda = { programada_para: null, repite: "nunca" };

const DIA = 86_400_000;

/**
 * Cuándo es la próxima. Null si no está agendada, o si era una sola vez y ya
 * pasó: un aviso que llega tarde no sirve para grabar nada.
 */
export function proximaVez(agenda: Agenda, ahora: Date = new Date()): Date | null {
  if (agenda.programada_para === null) return null;
  const inicio = Date.parse(agenda.programada_para);
  if (Number.isNaN(inicio)) return null;

  if (agenda.repite === "nunca") {
    return inicio > ahora.getTime() ? new Date(inicio) : null;
  }

  let candidato = inicio;
  // Se avanza de a un día y se filtra por el día de la semana, en vez de
  // sumar semanas: así "de lunes a viernes" cae en el día siguiente hábil y
  // no en el mismo día de la semana que viene.
  const paso = agenda.repite === "cada_semana" ? 7 * DIA : DIA;

  // Un tope: sin él, una fecha absurda daría un bucle que no termina.
  for (let i = 0; i < 400; i++) {
    if (candidato > ahora.getTime() && esDiaValido(new Date(candidato), agenda.repite)) {
      return new Date(candidato);
    }
    candidato += paso;
  }
  return null;
}

function esDiaValido(cuando: Date, repite: Repeticion): boolean {
  if (repite !== "dias_de_semana") return true;
  const dia = cuando.getDay();
  return dia >= 1 && dia <= 5;
}

/** ¿Está agendada y todavía va a ocurrir? */
export const estaAgendada = (agenda: Agenda, ahora: Date = new Date()): boolean =>
  proximaVez(agenda, ahora) !== null;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "hoy a las 08:30", "mañana a las 14:00", "el jueves a las 08:30". */
export function cuandoEs(agenda: Agenda, ahora: Date = new Date()): string {
  const proxima = proximaVez(agenda, ahora);
  if (proxima === null) return "sin agendar";

  const hora = `${dos(proxima.getHours())}:${dos(proxima.getMinutes())}`;
  const dias = diasDeDiferencia(ahora, proxima);

  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `mañana a las ${hora}`;
  if (dias < 7) return `el ${DIAS[proxima.getDay()]} a las ${hora}`;
  return `el ${proxima.getDate()} de ${MESES[proxima.getMonth()]} a las ${hora}`;
}

/** Cómo se describe la repetición, para que se vea qué se agendó. */
export function comoSeRepite(repite: Repeticion): string {
  if (repite === "cada_semana") return "cada semana";
  if (repite === "dias_de_semana") return "de lunes a viernes";
  return "una sola vez";
}

/**
 * El aviso que llega a la hora. Dice de qué reunión es y qué va a pasar al
 * tocarlo: una notificación que no dice que va a grabar sería exactamente la
 * clase de sorpresa que hay que evitar con un micrófono.
 */
export function avisoDe(titulo: string): { titulo: string; cuerpo: string } {
  return {
    titulo: `Empieza ${titulo}`,
    cuerpo: "Toca para empezar a grabar. Se te avisará en pantalla mientras grabas.",
  };
}

/**
 * Cuántos avisos futuros se dejan programados de una reunión que se repite.
 * Ni Android ni iOS ejecutan código nuestro para "generar el siguiente": hay
 * que dejarlos puestos de antemano, y iOS además tiene un tope de 64 avisos
 * pendientes por aplicación. Ocho semanas por reunión deja espacio para
 * varias sin acercarse a ese techo.
 */
export const AVISOS_POR_ADELANTADO = 8;

/** Las próximas veces, para dejar los avisos puestos de una vez. */
export function proximasVeces(
  agenda: Agenda,
  cuantas: number = AVISOS_POR_ADELANTADO,
  ahora: Date = new Date(),
): Date[] {
  const veces: Date[] = [];
  let desde = ahora;
  for (let i = 0; i < cuantas; i++) {
    const siguiente = proximaVez(agenda, desde);
    if (siguiente === null) break;
    veces.push(siguiente);
    // Un milisegundo después, para no volver a encontrar la misma.
    desde = new Date(siguiente.getTime() + 1);
  }
  return veces;
}

const dos = (n: number) => String(n).padStart(2, "0");

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Días de calendario entre dos fechas, sin que la hora los desordene. */
function diasDeDiferencia(desde: Date, hasta: Date): number {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b.getTime() - a.getTime()) / DIA);
}
