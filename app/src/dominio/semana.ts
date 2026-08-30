// La semana: qué cae en cada día y cuánto pesa cada ramo.
//
// El planificador junta tres cosas que hasta ahora vivían separadas y que la
// persona vive juntas: las clases que puso la institución, las tareas que
// vencen, y lo que uno mismo se propuso hacer. Ninguna de las tres sabe de
// las otras, y la única manera de responder «¿cómo viene mi semana?» es
// ponerlas en la misma grilla.
//
// Todo esto es aritmética de fechas y no toca la pantalla ni la base, así que
// vive acá y se prueba solo. Es lo que permite afirmar sin dudar que un lunes
// es un lunes incluso cuando el semestre empieza en domingo.

/** Lo que puede caer en un día: una clase, algo que vence, o tiempo propio. */
export type Cosa =
  | {
      clase: "clase";
      id: string;
      asignaturaId: string;
      titulo: string;
      /** "08:30" */
      desde: string;
      hasta: string;
      sala: string;
      minutos: number;
    }
  | {
      clase: "entrega";
      id: string;
      asignaturaId: string;
      titulo: string;
      desde: string;
      /** Ya la entregó: se sigue mostrando, pero apagada. */
      lista: boolean;
      minutos: 0;
    }
  | {
      clase: "sesion";
      id: string;
      /** Una sesión puede no ser de ningún ramo. */
      asignaturaId: string | null;
      titulo: string;
      desde: string;
      minutos: number;
      hecha: boolean;
    };

export type Dia = {
  /** 1 = lunes. */
  numero: number;
  fecha: Date;
  /** El día del mes: "31". */
  delMes: number;
  hoy: boolean;
  cosas: Cosa[];
};

export type Semana = {
  dias: Dia[];
  /** Del lunes al domingo, para el encabezado: "31 ago — 6 sep". */
  titulo: string;
  desde: Date;
  hasta: Date;
};

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Medianoche del día de esa fecha, en la zona horaria del aparato. */
export function aMedianoche(f: Date): Date {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate());
}

/**
 * El lunes de la semana de esa fecha.
 *
 * `getDay()` cuenta el domingo como 0, que es la convención de otro
 * calendario: acá la semana empieza el lunes, como en el horario de
 * cualquier institución.
 */
export function lunesDe(f: Date): Date {
  const d = aMedianoche(f);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** 1 = lunes … 7 = domingo, que es como numera los días el horario. */
export const numeroDeDia = (f: Date): number => ((f.getDay() + 6) % 7) + 1;

export const sumarDias = (f: Date, n: number): Date => {
  const d = new Date(f);
  d.setDate(d.getDate() + n);
  return d;
};

export const mismoDia = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "31 ago — 6 sep", y sin repetir el mes cuando la semana no lo cruza. */
export function tituloDeSemana(lunes: Date): string {
  const domingo = sumarDias(lunes, 6);
  const mesL = MES[lunes.getMonth()] ?? "";
  const mesD = MES[domingo.getMonth()] ?? "";
  return mesL === mesD
    ? `${lunes.getDate()} — ${domingo.getDate()} ${mesD}`
    : `${lunes.getDate()} ${mesL} — ${domingo.getDate()} ${mesD}`;
}

/** "08:30:00" o "8:5" a "08:30". La base manda lo primero; la gente escribe lo segundo. */
export const enPunto = (t: string): string => {
  const [h = "0", m = "0"] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
};

/** "08:30" a minutos desde medianoche, para ordenar y para restar. */
export const enMinutos = (t: string): number => {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
};

/** Cuánto dura un bloque, en minutos. Nunca negativo. */
export const cuantoDura = (desde: string, hasta: string): number =>
  Math.max(0, enMinutos(hasta) - enMinutos(desde));

/** "1 h 30", "45 min", "2 h". Como lo diría alguien, no como lo guarda la base. */
export function comoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

// ── Armar la semana ───────────────────────────────────────────────────────

export type BloqueDeSemana = {
  id: string;
  asignatura_id: string;
  dia: number;
  hora_inicio: string;
  hora_fin: string;
  sala: string;
};

export type EntregaDeSemana = {
  id: string;
  asignatura_id: string;
  titulo: string;
  vence_en: string;
  entregada_en: string | null;
};

export type SesionDeSemana = {
  id: string;
  asignatura_id: string | null;
  titulo: string;
  empieza_en: string;
  minutos: number;
  hecha_en: string | null;
};

/**
 * Los siete días con todo lo que cae en cada uno, ya ordenado por hora.
 *
 * Las clases se repiten todas las semanas —el horario dice «martes a las
 * 10:15», no «el martes 1 de septiembre»— así que se copian a la semana que
 * se esté mirando. Las tareas y las sesiones tienen fecha propia y solo
 * aparecen en la suya.
 */
export function armarSemana(
  lunes: Date,
  datos: {
    bloques: readonly BloqueDeSemana[];
    entregas: readonly EntregaDeSemana[];
    sesiones: readonly SesionDeSemana[];
  },
  ahora: Date = new Date(),
): Semana {
  const dias: Dia[] = [];

  for (let i = 0; i < 7; i++) {
    const fecha = sumarDias(lunes, i);
    const numero = i + 1;
    const cosas: Cosa[] = [];

    for (const b of datos.bloques) {
      if (b.dia !== numero) continue;
      cosas.push({
        clase: "clase",
        id: b.id,
        asignaturaId: b.asignatura_id,
        titulo: "",
        desde: enPunto(b.hora_inicio),
        hasta: enPunto(b.hora_fin),
        sala: b.sala,
        minutos: cuantoDura(enPunto(b.hora_inicio), enPunto(b.hora_fin)),
      });
    }

    for (const t of datos.entregas) {
      const vence = new Date(t.vence_en);
      if (!mismoDia(vence, fecha)) continue;
      cosas.push({
        clase: "entrega",
        id: t.id,
        asignaturaId: t.asignatura_id,
        titulo: t.titulo,
        desde: `${String(vence.getHours()).padStart(2, "0")}:${String(vence.getMinutes()).padStart(2, "0")}`,
        lista: t.entregada_en !== null,
        minutos: 0,
      });
    }

    for (const s of datos.sesiones) {
      const empieza = new Date(s.empieza_en);
      if (!mismoDia(empieza, fecha)) continue;
      cosas.push({
        clase: "sesion",
        id: s.id,
        asignaturaId: s.asignatura_id,
        titulo: s.titulo,
        desde: `${String(empieza.getHours()).padStart(2, "0")}:${String(empieza.getMinutes()).padStart(2, "0")}`,
        minutos: s.minutos,
        hecha: s.hecha_en !== null,
      });
    }

    cosas.sort((a, b) => enMinutos(a.desde) - enMinutos(b.desde));
    dias.push({ numero, fecha, delMes: fecha.getDate(), hoy: mismoDia(fecha, ahora), cosas });
  }

  return { dias, titulo: tituloDeSemana(lunes), desde: lunes, hasta: sumarDias(lunes, 6) };
}

// ── Cuánto pesa cada ramo ─────────────────────────────────────────────────

export type Carga = {
  asignaturaId: string | null;
  minutos: number;
};

/**
 * Cuánto tiempo se lleva cada ramo esta semana, contando solo lo que la
 * persona decidió: las sesiones, no las clases.
 *
 * Es a propósito. Las horas de clase son las que son y no las elige nadie;
 * meterlas acá haría que el ramo con más créditos siempre saliera primero y
 * el resumen no diría nada. Lo que sirve saber es en qué se está poniendo el
 * tiempo propio, que es el único que se puede repartir distinto.
 */
export function cargaPorRamo(sesiones: readonly SesionDeSemana[]): Carga[] {
  const suma = new Map<string, number>();
  for (const s of sesiones) {
    const llave = s.asignatura_id ?? "";
    suma.set(llave, (suma.get(llave) ?? 0) + s.minutos);
  }
  return [...suma.entries()]
    .map(([llave, minutos]) => ({ asignaturaId: llave === "" ? null : llave, minutos }))
    .sort((a, b) => b.minutos - a.minutos);
}

export const totalDeLaSemana = (cargas: readonly Carga[]): number =>
  cargas.reduce((n, c) => n + c.minutos, 0);

/**
 * Un día está libre cuando no hay nada que hacer en él.
 *
 * Una entrega ya entregada no cuenta: sigue en la grilla para que se vea que
 * se cumplió, pero no es trabajo pendiente. Una sesión hecha, igual.
 */
export const estaLibre = (d: Dia): boolean =>
  d.cosas.every((c) =>
    (c.clase === "entrega" && c.lista) || (c.clase === "sesion" && c.hecha),
  );

/**
 * Dónde poner una sesión nueva cuando la persona aprieta «agregar» en un día.
 *
 * Después de lo último que ya hay, redondeado a la media hora siguiente, y
 * nunca antes de las cuatro de la tarde: un día sin nada empieza a las 17:00,
 * que es cuando alguien vuelve de clases. No es una regla sagrada —el campo
 * de la hora queda editable— pero acierta casi siempre y ahorra el trámite.
 */
export function horaSugerida(d: Dia): string {
  const DESPUES_DE_CLASES = 17 * 60;
  const ultimo = d.cosas.reduce((n, c) => {
    const fin = enMinutos(c.desde) + (c.clase === "entrega" ? 0 : c.minutos);
    return Math.max(n, fin);
  }, 0);

  const crudo = Math.max(DESPUES_DE_CLASES, ultimo === 0 ? 0 : ultimo + 15);
  const redondeado = Math.ceil(crudo / 30) * 30;
  const tope = Math.min(redondeado, 22 * 60);
  return `${String(Math.floor(tope / 60)).padStart(2, "0")}:${String(tope % 60).padStart(2, "0")}`;
}

/**
 * La fecha y hora de una sesión, a partir del día de la grilla y "17:30".
 *
 * Se arma con los campos locales y no con `Date.parse`: escribir la fecha
 * como texto y volver a leerla es la forma más común de que una sesión de las
 * 17:00 termine guardada a las 20:00 en otro huso.
 */
export function cuandoEmpieza(dia: Date, hhmm: string): Date {
  const [h = "0", m = "0"] = hhmm.split(":");
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Number(h), Number(m), 0, 0);
}

/** Una hora escrita a mano. Devuelve "17:30" o null si no se entiende. */
export function leerHoraDelDia(texto: string): string | null {
  const limpio = texto.trim().replace(/[.\s]/g, ":").replace(/::+/g, ":");
  const m = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(limpio);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ── El aviso de la semana ─────────────────────────────────────────────────

/**
 * Una sola cosa que conviene saber al mirar la semana, o ninguna.
 *
 * Es una regla, no un agente: no hay nadie decidiendo nada, solo se mira si
 * algo vence y no hay tiempo reservado antes para prepararlo. Eso importa
 * decirlo, porque la pantalla parece decirlo alguien y no lo dice nadie.
 *
 * Se avisa de una sola entrega —la primera que quede sin preparar— porque
 * cuatro avisos a la vez no son cuatro avisos: son ninguno.
 */
export function avisoDeLaSemana(
  semana: Semana,
  nombreDeRamo: (id: string) => string | undefined,
): string | null {
  const DIA = ["", "el lunes", "el martes", "el miércoles", "el jueves", "el viernes", "el sábado", "el domingo"];

  for (const d of semana.dias) {
    for (const c of d.cosas) {
      if (c.clase !== "entrega" || c.lista) continue;

      // ¿Hay tiempo reservado para ese ramo antes de que venza?
      const preparada = semana.dias.some((otro) =>
        (otro.numero < d.numero
          || (otro.numero === d.numero && otro.cosas.some((x) => x === c)))
        && otro.cosas.some((x) =>
          x.clase === "sesion" && !x.hecha && x.asignaturaId === c.asignaturaId
          && (otro.numero < d.numero || enMinutos(x.desde) < enMinutos(c.desde)),
        ),
      );
      if (preparada) continue;

      const ramo = nombreDeRamo(c.asignaturaId);
      return `«${c.titulo}»${ramo ? ` de ${ramo}` : ""} vence ${DIA[d.numero]}`
        + " y todavía no reservaste tiempo para prepararla.";
    }
  }
  return null;
}
