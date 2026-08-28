import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVISOS_POR_ADELANTADO, SIN_AGENDA, avisoDe, comoSeRepite, cuandoEs,
  estaAgendada, proximaVez, proximasVeces, type Agenda,
} from "./agenda.ts";

// Martes 1 de septiembre de 2026, 10:00, hora local.
const AHORA = new Date(2026, 8, 1, 10, 0, 0);
const local = (dia: number, hora: number, minuto = 0) =>
  new Date(2026, 8, dia, hora, minuto, 0).toISOString();

const agenda = (p: Partial<Agenda>): Agenda => ({ ...SIN_AGENDA, ...p });

/* -------------------------------------------------------------- una vez */

test("sin agenda no hay próxima vez", () => {
  assert.equal(proximaVez(SIN_AGENDA, AHORA), null);
  assert.equal(estaAgendada(SIN_AGENDA, AHORA), false);
});

test("una fecha ilegible no revienta, simplemente no hay agenda", () => {
  assert.equal(proximaVez(agenda({ programada_para: "el jueves" }), AHORA), null);
});

test("una sola vez, en el futuro, es esa vez", () => {
  const a = agenda({ programada_para: local(3, 8, 30) });
  assert.equal(proximaVez(a, AHORA)?.getDate(), 3);
});

test("una sola vez que ya pasó no vuelve: un aviso tarde no sirve", () => {
  const a = agenda({ programada_para: local(1, 8, 30) });
  assert.equal(proximaVez(a, AHORA), null);
  assert.equal(estaAgendada(a, AHORA), false);
});

/* ------------------------------------------------------------- semanal */

test("cada semana cae el mismo día de la semana", () => {
  // Lunes 31 de agosto a las 08:30, repitiendo cada semana.
  const a = agenda({ programada_para: new Date(2026, 7, 31, 8, 30).toISOString(), repite: "cada_semana" });
  const p = proximaVez(a, AHORA)!;
  assert.equal(p.getDay(), 1, "no cayó lunes");
  assert.equal(p.getHours(), 8);
  assert.equal(p.getMinutes(), 30);
  assert.ok(p.getTime() > AHORA.getTime());
});

test("la semanal de hoy más tarde es hoy, no la semana que viene", () => {
  const a = agenda({ programada_para: local(1, 14, 0), repite: "cada_semana" });
  assert.equal(proximaVez(a, AHORA)?.getDate(), 1);
});

test("la semanal de hoy más temprano se va a la semana siguiente", () => {
  const a = agenda({ programada_para: local(1, 8, 0), repite: "cada_semana" });
  assert.equal(proximaVez(a, AHORA)?.getDate(), 8);
});

/* ------------------------------------------------- de lunes a viernes */

test("de lunes a viernes cae mañana, no la semana que viene", () => {
  const a = agenda({ programada_para: local(1, 8, 0), repite: "dias_de_semana" });
  const p = proximaVez(a, AHORA)!;
  assert.equal(p.getDate(), 2);
  assert.equal(p.getHours(), 8);
});

test("de lunes a viernes se salta el fin de semana", () => {
  // Viernes 4 a las 08:00; la siguiente es el lunes 7, no el sábado.
  const a = agenda({ programada_para: local(4, 8, 0), repite: "dias_de_semana" });
  const viernes = new Date(2026, 8, 4, 10, 0);
  const p = proximaVez(a, viernes)!;
  assert.equal(p.getDay(), 1, "cayó en fin de semana");
  assert.equal(p.getDate(), 7);
});

test("agendar un sábado 'de lunes a viernes' salta al lunes", () => {
  // Sábado 5 a las 08:00: el primero válido es el lunes 7.
  const a = agenda({ programada_para: local(5, 8, 0), repite: "dias_de_semana" });
  const p = proximaVez(a, AHORA)!;
  assert.equal(p.getDay(), 1);
  assert.equal(p.getDate(), 7);
});

/* --------------------------------------------------------- cómo se dice */

test("se dice como lo diría una persona", () => {
  assert.equal(cuandoEs(agenda({ programada_para: local(1, 14, 0) }), AHORA), "hoy a las 14:00");
  assert.equal(cuandoEs(agenda({ programada_para: local(2, 8, 30) }), AHORA), "mañana a las 08:30");
  assert.equal(cuandoEs(agenda({ programada_para: local(3, 8, 30) }), AHORA), "el jueves a las 08:30");
  assert.equal(cuandoEs(agenda({ programada_para: local(20, 8, 30) }), AHORA),
    "el 20 de septiembre a las 08:30");
  assert.equal(cuandoEs(SIN_AGENDA, AHORA), "sin agendar");
});

test("la repetición se explica con palabras", () => {
  assert.equal(comoSeRepite("nunca"), "una sola vez");
  assert.equal(comoSeRepite("cada_semana"), "cada semana");
  assert.equal(comoSeRepite("dias_de_semana"), "de lunes a viernes");
});

test("el aviso dice de qué es y que va a grabar", () => {
  const a = avisoDe("Reunión de obra semanal");
  assert.equal(a.titulo, "Empieza Reunión de obra semanal");
  assert.match(a.cuerpo, /empezar a grabar/);
  // Que va a avisar en pantalla mientras graba no es letra chica: es lo que
  // hace que nadie se sorprenda con un micrófono encendido.
  assert.match(a.cuerpo, /avisará en pantalla/);
});

/* ------------------------------------------------- avisos por adelantado */

test("deja varios avisos puestos, porque nadie los va a generar después", () => {
  const a = agenda({ programada_para: local(1, 14, 0), repite: "cada_semana" });
  const veces = proximasVeces(a, AVISOS_POR_ADELANTADO, AHORA);
  assert.equal(veces.length, AVISOS_POR_ADELANTADO);
  for (const v of veces) assert.equal(v.getDay(), 2, "alguna no cayó martes");
});

test("las veces van en orden y sin repetirse", () => {
  const veces = proximasVeces(
    agenda({ programada_para: local(1, 14, 0), repite: "dias_de_semana" }), 6, AHORA);
  const tiempos = veces.map((v) => v.getTime());
  assert.deepEqual(tiempos, [...tiempos].sort((x, y) => x - y));
  assert.equal(new Set(tiempos).size, tiempos.length);
});

test("de una sola vez hay una sola vez, no ocho", () => {
  const veces = proximasVeces(agenda({ programada_para: local(3, 8, 0) }), 8, AHORA);
  assert.equal(veces.length, 1);
});

test("sin agenda no hay avisos que poner", () => {
  assert.deepEqual(proximasVeces(SIN_AGENDA, 8, AHORA), []);
});

test("el tope de avisos deja espacio para varias reuniones en el mismo aparato", () => {
  // iOS no acepta más de 64 avisos pendientes por aplicación.
  assert.ok(AVISOS_POR_ADELANTADO * 7 <= 64, "con siete reuniones ya se pasa del tope de iOS");
});
