import { test } from "node:test";
import assert from "node:assert/strict";
import {
  armarSemana, avisoDeLaSemana, cargaPorRamo, comoDuracion, cuandoEmpieza, cuantoDura, enPunto,
  estaLibre, horaSugerida, leerHoraDelDia, lunesDe, numeroDeDia, sumarDias,
  tituloDeSemana, totalDeLaSemana,
} from "./semana.ts";

// El lunes 31 de agosto de 2026, a media mañana.
const LUNES = new Date(2026, 7, 31);
const MARTES = new Date(2026, 8, 1, 10, 0);

// ── Los días de la semana ───────────────────────────────────────────────

test("la semana empieza el lunes, no el domingo", () => {
  // Del martes se llega al lunes anterior.
  assert.equal(lunesDe(MARTES).getDate(), 31);
  // Y del domingo también, que es el caso que se equivoca solo.
  const domingo = new Date(2026, 8, 6, 23, 30);
  assert.equal(lunesDe(domingo).getDate(), 31);
  assert.equal(lunesDe(domingo).getMonth(), 7);
  // Un lunes se queda donde está.
  assert.equal(lunesDe(LUNES).getDate(), 31);
});

test("los días se numeran como el horario: 1 es lunes y 7 es domingo", () => {
  assert.equal(numeroDeDia(LUNES), 1);
  assert.equal(numeroDeDia(MARTES), 2);
  assert.equal(numeroDeDia(new Date(2026, 8, 6)), 7);
});

test("el título de la semana no repite el mes si no hace falta", () => {
  assert.equal(tituloDeSemana(LUNES), "31 ago — 6 sep");
  assert.equal(tituloDeSemana(new Date(2026, 8, 7)), "7 — 13 sep");
});

// ── Horas y duraciones ──────────────────────────────────────────────────

test("las horas se muestran parejas, vengan como vengan", () => {
  assert.equal(enPunto("08:30:00"), "08:30");
  assert.equal(enPunto("8:5"), "08:05");
});

test("una duración se dice como la diría alguien", () => {
  assert.equal(comoDuracion(45), "45 min");
  assert.equal(comoDuracion(60), "1 h");
  assert.equal(comoDuracion(90), "1 h 30");
  assert.equal(comoDuracion(195), "3 h 15");
});

test("un bloque al revés dura cero, no un número negativo", () => {
  assert.equal(cuantoDura("10:15", "11:45"), 90);
  assert.equal(cuantoDura("11:45", "10:15"), 0);
});

// ── Armar la semana ─────────────────────────────────────────────────────

const BLOQUES = [
  { id: "b1", asignatura_id: "cal", dia: 2, hora_inicio: "10:15:00", hora_fin: "11:45:00", sala: "B-21" },
  { id: "b2", asignatura_id: "fis", dia: 4, hora_inicio: "14:30:00", hora_fin: "16:00:00", sala: "A-3" },
];
const ENTREGAS = [
  { id: "t1", asignatura_id: "cal", titulo: "Tarea 3", vence_en: new Date(2026, 8, 4, 23, 59).toISOString(), entregada_en: null },
  { id: "t2", asignatura_id: "fis", titulo: "Informe 1", vence_en: new Date(2026, 7, 31, 12, 0).toISOString(), entregada_en: new Date().toISOString() },
];
const SESIONES = [
  { id: "s1", asignatura_id: "cal", titulo: "Guía 5", empieza_en: new Date(2026, 8, 1, 17, 0).toISOString(), minutos: 60, hecha_en: null },
  { id: "s2", asignatura_id: "cal", titulo: "Impropias", empieza_en: new Date(2026, 8, 1, 8, 30).toISOString(), minutos: 45, hecha_en: null },
  { id: "s3", asignatura_id: null, titulo: "Leer capítulo 4", empieza_en: new Date(2026, 8, 4, 17, 0).toISOString(), minutos: 45, hecha_en: null },
];
const TODO = { bloques: BLOQUES, entregas: ENTREGAS, sesiones: SESIONES };

test("la semana tiene siete días y empieza el lunes", () => {
  const s = armarSemana(LUNES, TODO, MARTES);
  assert.equal(s.dias.length, 7);
  assert.equal(s.dias[0]?.numero, 1);
  assert.equal(s.dias[0]?.delMes, 31);
  assert.equal(s.dias[6]?.delMes, 6);
});

test("hoy es uno solo, y es el que corresponde", () => {
  const s = armarSemana(LUNES, TODO, MARTES);
  assert.deepEqual(s.dias.map((d) => d.hoy), [false, true, false, false, false, false, false]);
});

test("una semana que no contiene hoy no marca ningún día", () => {
  const otra = armarSemana(sumarDias(LUNES, 7), TODO, MARTES);
  assert.equal(otra.dias.filter((d) => d.hoy).length, 0);
});

test("las clases se repiten todas las semanas; las tareas y sesiones no", () => {
  const siguiente = armarSemana(sumarDias(LUNES, 7), TODO, MARTES);
  const martes = siguiente.dias[1];
  // La clase del martes sigue estando…
  assert.equal(martes?.cosas.filter((c) => c.clase === "clase").length, 1);
  // …pero las sesiones de ese martes concreto, no.
  assert.equal(martes?.cosas.filter((c) => c.clase === "sesion").length, 0);
});

test("lo del día sale ordenado por hora, mezclando clases, entregas y sesiones", () => {
  const s = armarSemana(LUNES, TODO, MARTES);
  assert.deepEqual(
    s.dias[1]?.cosas.map((c) => [c.desde, c.clase]),
    [["08:30", "sesion"], ["10:15", "clase"], ["17:00", "sesion"]],
  );
});

test("el viernes junta la entrega y la sesión suelta", () => {
  const viernes = armarSemana(LUNES, TODO, MARTES).dias[4];
  assert.deepEqual(viernes?.cosas.map((c) => c.titulo), ["Leer capítulo 4", "Tarea 3"]);
});

test("una clase sabe cuánto dura y en qué sala es", () => {
  const clase = armarSemana(LUNES, TODO, MARTES).dias[1]?.cosas.find((c) => c.clase === "clase");
  assert.equal(clase?.clase === "clase" && clase.sala, "B-21");
  assert.equal(clase?.minutos, 90);
});

// ── Días libres ─────────────────────────────────────────────────────────

test("un día sin nada está libre", () => {
  const s = armarSemana(LUNES, TODO, MARTES);
  assert.equal(estaLibre(s.dias[2]!), true, "el miércoles no tiene nada");
  assert.equal(estaLibre(s.dias[1]!), false, "el martes tiene clase");
});

test("un día con la entrega ya entregada también está libre", () => {
  // El lunes solo tiene el informe, que ya se entregó.
  const s = armarSemana(LUNES, TODO, MARTES);
  assert.equal(s.dias[0]?.cosas.length, 1);
  assert.equal(estaLibre(s.dias[0]!), true);
});

// ── La carga de cada ramo ───────────────────────────────────────────────

test("la carga cuenta el tiempo propio, no las horas de clase", () => {
  const c = cargaPorRamo(SESIONES);
  assert.deepEqual(c, [
    { asignaturaId: "cal", minutos: 105 },
    { asignaturaId: null, minutos: 45 },
  ]);
  assert.equal(totalDeLaSemana(c), 150);
  assert.equal(comoDuracion(150), "2 h 30");
});

test("sin sesiones la carga es una lista vacía, no un cero inventado", () => {
  assert.deepEqual(cargaPorRamo([]), []);
  assert.equal(totalDeLaSemana([]), 0);
});

// ── Dónde cae una sesión nueva ──────────────────────────────────────────

test("en un día vacío la sesión nueva parte a las cinco de la tarde", () => {
  const s = armarSemana(LUNES, TODO, MARTES);
  assert.equal(horaSugerida(s.dias[2]!), "17:00");
});

test("en un día con cosas, después de la última y redondeada a la media hora", () => {
  const s = armarSemana(LUNES, TODO, MARTES);
  // El martes lo último termina 17:00 + 60 min = 18:00, más quince = 18:15.
  assert.equal(horaSugerida(s.dias[1]!), "18:30");
});

test("no propone estudiar de madrugada: se corta a las diez de la noche", () => {
  const tarde = {
    numero: 3, fecha: new Date(2026, 8, 2), delMes: 2, hoy: false,
    cosas: [{ clase: "sesion" as const, id: "x", asignaturaId: null, titulo: "larga", desde: "21:00", minutos: 180, hecha: false }],
  };
  assert.equal(horaSugerida(tarde), "22:00");
});

// ── Escribir la hora ────────────────────────────────────────────────────

test("la hora se puede escribir como salga", () => {
  assert.equal(leerHoraDelDia("17:30"), "17:30");
  assert.equal(leerHoraDelDia("17.30"), "17:30");
  assert.equal(leerHoraDelDia(" 9 "), "09:00");
  assert.equal(leerHoraDelDia("9:5"), "09:05");
});

test("una hora que no existe no se acepta en silencio", () => {
  for (const malo of ["", "tarde", "25:00", "12:70", "17:30:00", "-1"]) {
    assert.equal(leerHoraDelDia(malo), null, malo);
  }
});

test("la sesión se guarda en la hora local, no corrida por el huso", () => {
  const cuando = cuandoEmpieza(new Date(2026, 8, 1), "17:00");
  assert.equal(cuando.getHours(), 17);
  assert.equal(cuando.getMinutes(), 0);
  assert.equal(cuando.getDate(), 1);
  assert.equal(cuando.getMonth(), 8);
});

// ── El aviso ────────────────────────────────────────────────────────────

const NOMBRE = (id: string) => ({ cal: "Cálculo II", fis: "Física" })[id];

test("avisa de la entrega que no tiene tiempo reservado antes", () => {
  // La Tarea 3 de Cálculo vence el viernes; la única sesión de Cálculo es el
  // martes, o sea antes: esa sí está preparada. La de Física no existe.
  const s = armarSemana(LUNES, {
    bloques: [],
    entregas: [
      { id: "t9", asignatura_id: "fis", titulo: "Informe 2", vence_en: new Date(2026, 8, 3, 23, 59).toISOString(), entregada_en: null },
    ],
    sesiones: SESIONES,
  }, MARTES);
  assert.equal(
    avisoDeLaSemana(s, NOMBRE),
    "«Informe 2» de Física vence el jueves y todavía no reservaste tiempo para prepararla.",
  );
});

test("no avisa de lo que sí está preparado", () => {
  const s = armarSemana(LUNES, { bloques: [], entregas: [ENTREGAS[0]!], sesiones: SESIONES }, MARTES);
  assert.equal(avisoDeLaSemana(s, NOMBRE), null);
});

test("una sesión posterior a la entrega no la prepara", () => {
  const s = armarSemana(LUNES, {
    bloques: [],
    entregas: [{ id: "t1", asignatura_id: "cal", titulo: "Tarea 3", vence_en: new Date(2026, 7, 31, 12, 0).toISOString(), entregada_en: null }],
    sesiones: SESIONES,
  }, MARTES);
  assert.match(avisoDeLaSemana(s, NOMBRE) ?? "", /Tarea 3.*Cálculo II.*el lunes/);
});

test("una sesión ya hecha no cuenta como preparación pendiente", () => {
  const s = armarSemana(LUNES, {
    bloques: [], entregas: [ENTREGAS[0]!],
    sesiones: SESIONES.map((x) => ({ ...x, hecha_en: new Date().toISOString() })),
  }, MARTES);
  assert.match(avisoDeLaSemana(s, NOMBRE) ?? "", /Tarea 3/);
});

test("lo ya entregado no genera aviso", () => {
  const s = armarSemana(LUNES, { bloques: [], entregas: [ENTREGAS[1]!], sesiones: [] }, MARTES);
  assert.equal(avisoDeLaSemana(s, NOMBRE), null);
});

test("una semana sin entregas no dice nada, en vez de decir algo por decir", () => {
  const s = armarSemana(LUNES, { bloques: BLOQUES, entregas: [], sesiones: [] }, MARTES);
  assert.equal(avisoDeLaSemana(s, NOMBRE), null);
});
