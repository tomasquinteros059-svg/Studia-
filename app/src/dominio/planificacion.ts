// La planificación del mes, por asignatura.
//
// Un profesor no planifica clase a clase: reparte la materia en las semanas
// que tiene. Esto arma ese calendario —las semanas de un mes— y propone un
// reparto a partir de la materia que él mismo ya cargó.
//
// La propuesta es una cuenta, no una opinión de un modelo: se toman las
// unidades que faltan y se reparten en las semanas que quedan. Eso importa
// porque una propuesta que sale de una cuenta se puede explicar, se puede
// probar, y da lo mismo dos veces seguidas. El asistente sirve para lo otro
// —conversar sobre el plan, mirar si es realista— y para eso se le pasa el
// plan ya armado.

export type Semana = {
  /** Lunes de esa semana. */
  empieza: Date;
  /** Domingo. */
  termina: Date;
  /** 1 para la primera semana del mes. */
  numero: number;
};

export type Bloque = {
  id: string;
  semana: number;
  titulo: string;
  detalle: string;
  /** De qué unidad de la materia salió, si salió de una. */
  modulo_id: string | null;
};

/** El lunes de la semana en que cae una fecha. */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  // getDay() da 0 el domingo: el domingo pertenece a la semana que empezó el
  // lunes anterior, no a la que empieza mañana.
  const desde = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desde);
  return d;
}

/**
 * Las semanas de un mes.
 *
 * Una semana pertenece al mes si su lunes cae dentro. Así ninguna semana
 * aparece en dos meses, que es lo que pasa si se cuentan por días: la del 30
 * de septiembre saldría en septiembre y en octubre, y planificar dos veces lo
 * mismo es peor que no planificarlo.
 */
export function semanasDelMes(ano: number, mes: number): Semana[] {
  const semanas: Semana[] = [];
  const primero = new Date(ano, mes, 1);
  const cursor = lunesDe(primero);
  // Si el lunes cae en el mes anterior, la primera semana del mes es la
  // siguiente.
  if (cursor.getMonth() !== mes) cursor.setDate(cursor.getDate() + 7);

  let numero = 1;
  while (cursor.getMonth() === mes && cursor.getFullYear() === ano) {
    const termina = new Date(cursor);
    termina.setDate(termina.getDate() + 6);
    semanas.push({ empieza: new Date(cursor), termina, numero });
    cursor.setDate(cursor.getDate() + 7);
    numero += 1;
  }
  return semanas;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export const nombreDelMes = (mes: number): string => MESES[mes] ?? "";

/** «1 al 7 de septiembre», o «29 de septiembre al 5 de octubre» si cruza. */
export function comoSeLee(s: Semana): string {
  const mismoMes = s.empieza.getMonth() === s.termina.getMonth();
  if (mismoMes) {
    return `${s.empieza.getDate()} al ${s.termina.getDate()} de ${nombreDelMes(s.empieza.getMonth())}`;
  }
  return `${s.empieza.getDate()} de ${nombreDelMes(s.empieza.getMonth())}`
    + ` al ${s.termina.getDate()} de ${nombreDelMes(s.termina.getMonth())}`;
}

// ── La propuesta ──────────────────────────────────────────────────────────

type Unidad = { id: string; titulo: string; materiales: readonly unknown[] };

/**
 * Reparte las unidades que faltan en las semanas que hay.
 *
 * Si sobran semanas, cada unidad se queda con una y las últimas quedan libres:
 * llenar el mes estirando materia sería inventarle trabajo a alguien. Si
 * faltan, se agrupan las que no caben en la última semana y se dice, para que
 * el profesor decida qué corre —esa decisión es suya y no se toma sola.
 */
export function proponer(unidades: readonly Unidad[], semanas: readonly Semana[]): Bloque[] {
  if (semanas.length === 0 || unidades.length === 0) return [];

  const bloques: Bloque[] = [];
  const porSemana = Math.ceil(unidades.length / semanas.length);

  for (const [i, unidad] of unidades.entries()) {
    const semana = Math.min(semanas.length, Math.floor(i / porSemana) + 1);
    bloques.push({
      id: `propuesta-${unidad.id}`,
      semana,
      titulo: unidad.titulo,
      detalle: `${unidad.materiales.length} ${unidad.materiales.length === 1 ? "recurso" : "recursos"} ya cargados`,
      modulo_id: unidad.id,
    });
  }
  return bloques;
}

/**
 * Qué tan apretado queda el mes, dicho en palabras.
 *
 * Se dice cuando aprieta y también cuando sobra: un mes con la mitad de las
 * semanas vacías es información, no un error.
 */
export function comoQuedaElMes(unidades: number, semanas: number): string {
  if (semanas === 0) return "Este mes no tiene semanas completas.";
  if (unidades === 0) return "Este ramo todavía no tiene unidades que repartir.";
  if (unidades > semanas) {
    const dobles = unidades - semanas;
    return `Van ${unidades} unidades en ${semanas} semanas: ${dobles} `
      + `${dobles === 1 ? "semana lleva" : "semanas llevan"} más de una. Mira si alcanza.`;
  }
  if (unidades < semanas) {
    const libres = semanas - unidades;
    return `Quedan ${libres} ${libres === 1 ? "semana libre" : "semanas libres"} `
      + "para repasar, evaluar o lo que decidas.";
  }
  return "Una unidad por semana: el mes calza justo.";
}

/** Los bloques de una semana, en el orden en que se pusieron. */
export const deLaSemana = (bloques: readonly Bloque[], numero: number): Bloque[] =>
  bloques.filter((b) => b.semana === numero);

/**
 * El plan en texto, para poder pasárselo al asistente.
 *
 * En texto y no en JSON porque lo que sigue es una conversación: el asistente
 * tiene que poder leerlo como lo leería un colega al que le muestran el
 * cuaderno.
 */
export function comoTexto(
  ramo: string, ano: number, mes: number,
  semanas: readonly Semana[], bloques: readonly Bloque[],
): string {
  const lineas = semanas.map((s) => {
    const suyos = deLaSemana(bloques, s.numero);
    const que = suyos.length === 0 ? "sin nada planificado" : suyos.map((b) => b.titulo).join("; ");
    return `Semana ${s.numero} (${comoSeLee(s)}): ${que}`;
  });
  return `Plan de ${ramo} para ${nombreDelMes(mes)} de ${ano}:\n${lineas.join("\n")}`;
}
