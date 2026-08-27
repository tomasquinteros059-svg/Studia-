import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTA_VACIA, balanceDe, comoQuedo, cuandoVence, enPalabras, estadoDeTarea,
  huecos, loPrimero, misTareas, ordenarTareas, type Acta, type Tarea,
} from "./acta.ts";

const HOY = new Date("2026-09-01T15:00:00Z");

let n = 0;
const tarea = (p: Partial<Tarea> = {}): Tarea => ({
  id: `t${++n}`, que: "Pedir la cotización", responsable: "Ana", plazo: "2026-09-05",
  prioridad: "normal", acuerdo: 1, lista: false, ...p,
});

const acta = (p: Partial<Acta> = {}): Acta => ({ ...ACTA_VACIA, ...p });

/* ----------------------------------------------------------------- orden */

test("primero lo que vence antes", () => {
  const orden = ordenarTareas([
    tarea({ que: "C", plazo: "2026-09-10" }),
    tarea({ que: "A", plazo: "2026-09-02" }),
    tarea({ que: "B", plazo: "2026-09-05" }),
  ]);
  assert.deepEqual(orden.map((t) => t.que), ["A", "B", "C"]);
});

test("lo que no tiene plazo va al final, no al principio", () => {
  const orden = ordenarTareas([
    tarea({ que: "sin fecha", plazo: null }),
    tarea({ que: "con fecha", plazo: "2026-12-31" }),
  ]);
  assert.deepEqual(orden.map((t) => t.que), ["con fecha", "sin fecha"]);
});

test("lo hecho se va abajo, aunque venciera antes", () => {
  const orden = ordenarTareas([
    tarea({ que: "hecha", plazo: "2026-09-01", lista: true }),
    tarea({ que: "pendiente", plazo: "2026-09-30" }),
  ]);
  assert.deepEqual(orden.map((t) => t.que), ["pendiente", "hecha"]);
});

test("con el mismo plazo, primero lo urgente", () => {
  const orden = ordenarTareas([
    tarea({ que: "normal", prioridad: "normal" }),
    tarea({ que: "urgente", prioridad: "alta" }),
  ]);
  assert.deepEqual(orden.map((t) => t.que), ["urgente", "normal"]);
});

test("ordenar no toca la lista que le pasaron", () => {
  const original = [tarea({ que: "B", plazo: "2026-09-10" }), tarea({ que: "A", plazo: "2026-09-02" })];
  const copia = [...original];
  ordenarTareas(original);
  assert.deepEqual(original, copia);
});

/* ------------------------------------------------------------------ mías */

test("mis tareas son las mías y las que siguen abiertas", () => {
  const mias = misTareas([
    tarea({ que: "mía", responsable: "Ana Ríos" }),
    tarea({ que: "mía hecha", responsable: "Ana Ríos", lista: true }),
    tarea({ que: "de otro", responsable: "Pedro" }),
    tarea({ que: "de nadie", responsable: null }),
  ], "Ana Ríos");
  assert.deepEqual(mias.map((t) => t.que), ["mía"]);
});

test("el nombre se compara sin acentos, mayúsculas ni espacios de más", () => {
  const mias = misTareas([tarea({ responsable: "  josé  pérez " })], "Jose Perez");
  assert.equal(mias.length, 1);
});

test("sin saber quién soy no reclamo tareas ajenas", () => {
  assert.deepEqual(misTareas([tarea({ responsable: "Ana" })], "  "), []);
});

/* ----------------------------------------------------------------- huecos */

test("un compromiso sin dueño y otro sin fecha se ven por separado", () => {
  const h = huecos([
    tarea({ que: "sin dueño", responsable: null }),
    tarea({ que: "sin fecha", plazo: null }),
    tarea({ que: "completa" }),
  ]);
  assert.deepEqual(h.sinResponsable.map((t) => t.que), ["sin dueño"]);
  assert.deepEqual(h.sinPlazo.map((t) => t.que), ["sin fecha"]);
  assert.deepEqual(h.sinNada, []);
});

test("el que no tiene ni dueño ni fecha aparece en las tres listas", () => {
  const h = huecos([tarea({ que: "en el aire", responsable: null, plazo: null })]);
  assert.equal(h.sinResponsable.length, 1);
  assert.equal(h.sinPlazo.length, 1);
  assert.equal(h.sinNada.length, 1);
});

test("lo ya hecho no cuenta como hueco: sin dueño pero hecho, no falta nada", () => {
  const h = huecos([tarea({ responsable: null, plazo: null, lista: true })]);
  assert.deepEqual(h.sinNada, []);
});

/* ----------------------------------------------------------------- plazos */

test("los estados de una tarea según el día", () => {
  assert.equal(estadoDeTarea(tarea({ plazo: "2026-08-30" }), HOY), "vencida");
  assert.equal(estadoDeTarea(tarea({ plazo: "2026-09-01" }), HOY), "hoy");
  assert.equal(estadoDeTarea(tarea({ plazo: "2026-09-02" }), HOY), "proxima");
  assert.equal(estadoDeTarea(tarea({ plazo: null }), HOY), "sin_plazo");
  assert.equal(estadoDeTarea(tarea({ plazo: "2026-08-01", lista: true }), HOY), "lista");
});

test("el plazo se dice como lo diría una persona", () => {
  assert.equal(cuandoVence(tarea({ plazo: "2026-09-01" }), HOY), "vence hoy");
  assert.equal(cuandoVence(tarea({ plazo: "2026-09-02" }), HOY), "vence mañana");
  assert.equal(cuandoVence(tarea({ plazo: "2026-09-05" }), HOY), "vence en 4 días");
  assert.equal(cuandoVence(tarea({ plazo: "2026-08-31" }), HOY), "venció ayer");
  assert.equal(cuandoVence(tarea({ plazo: "2026-08-28" }), HOY), "venció hace 4 días");
  assert.equal(cuandoVence(tarea({ plazo: "2026-10-03" }), HOY), "vence el 3 de octubre");
  assert.equal(cuandoVence(tarea({ plazo: null }), HOY), "sin plazo");
  assert.equal(cuandoVence(tarea({ lista: true }), HOY), "lista");
});

test("una fecha rara se muestra tal cual en vez de inventar un mes", () => {
  assert.equal(enPalabras("2026-13-40"), "2026-13-40");
  assert.equal(enPalabras("cualquier cosa"), "cualquier cosa");
});

/* ---------------------------------------------------------------- balance */

test("el balance cuenta lo firme aparte de lo propuesto", () => {
  const b = balanceDe(acta({
    acuerdos: [
      { numero: 1, texto: "Se aprueba el presupuesto", firme: true },
      { numero: 2, texto: "Se evaluará cambiar de proveedor", firme: false },
    ],
  }), HOY);
  assert.equal(b.acuerdos, 1);
  assert.equal(b.propuestos, 1);
});

test("el balance ve lo vencido y lo que quedó a la deriva", () => {
  const b = balanceDe(acta({
    tareas: [
      tarea({ plazo: "2026-08-20" }),
      tarea({ responsable: null }),
      tarea({ plazo: null }),
      tarea({ lista: true }),
    ],
    pendientes: [{ texto: "Falta la cotización", porque: "no llegó" }],
    sinTratar: ["Renovación del contrato de aseo"],
  }), HOY);
  assert.equal(b.tareas, 4);
  assert.equal(b.listas, 1);
  assert.equal(b.vencidas, 1);
  assert.equal(b.sinResponsable, 1);
  assert.equal(b.sinPlazo, 1);
  assert.equal(b.pendientes, 1);
  assert.equal(b.sinTratar, 1);
});

/* --------------------------------------------------------- cómo quedó todo */

test("la línea de resumen dice lo que falta antes que lo logrado", () => {
  const b = balanceDe(acta({
    acuerdos: [{ numero: 1, texto: "x", firme: true }],
    tareas: [tarea({ plazo: "2026-08-20" }), tarea({ responsable: null })],
  }), HOY);
  assert.equal(comoQuedo(b), "2 tareas · 1 vencida · 1 sin responsable");
});

test("una reunión que cerró todo lo dice así, no con un silencio", () => {
  const b = balanceDe(acta({
    acuerdos: [{ numero: 1, texto: "x", firme: true }],
    tareas: [tarea({ lista: true })],
  }), HOY);
  assert.equal(comoQuedo(b), "1 acuerdo, nada pendiente");
});

test("una reunión sin nada tampoco se queda muda", () => {
  assert.equal(comoQuedo(balanceDe(ACTA_VACIA, HOY)), "Sin acuerdos ni pendientes");
});

test("una sola tarea se dice en singular", () => {
  const b = balanceDe(acta({ tareas: [tarea()] }), HOY);
  assert.equal(comoQuedo(b), "1 tarea");
});

/* ------------------------------------------------------------ lo primero */

test("lo primero son avisos accionables, y nunca más de tres", () => {
  const avisos = loPrimero(acta({
    tareas: [
      tarea({ plazo: "2026-08-20" }),
      tarea({ responsable: null }),
      tarea({ plazo: null }),
    ],
    contradicciones: ["El plazo del contrato: dos versiones distintas"],
    sinTratar: ["Aseo", "Seguridad"],
  }), HOY);
  assert.equal(avisos.length, 3);
  assert.match(avisos[0]!, /plazo vencido/);
  assert.match(avisos[1]!, /sin nadie a cargo/);
  assert.match(avisos[2]!, /no todos entendieron lo mismo/);
});

test("una reunión limpia no inventa avisos", () => {
  assert.deepEqual(loPrimero(acta({
    acuerdos: [{ numero: 1, texto: "x", firme: true }],
    tareas: [tarea()],
  }), HOY), []);
});

test("cuando hay poco que avisar, avisa lo que hay", () => {
  const avisos = loPrimero(acta({ sinTratar: ["Renovación del seguro"] }), HOY);
  assert.deepEqual(avisos, ["Un punto de la tabla no alcanzó a tratarse."]);
});

test("los avisos hablan en singular cuando es uno solo", () => {
  const avisos = loPrimero(acta({ tareas: [tarea({ responsable: null, plazo: "2026-09-30" })] }), HOY);
  assert.deepEqual(avisos, ["Un compromiso quedó sin nadie a cargo."]);
});
