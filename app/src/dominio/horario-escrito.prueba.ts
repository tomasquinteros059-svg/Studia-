import { test } from "node:test";
import assert from "node:assert/strict";
import {
  colorDeLaCarga, cuantosBloques, leerCola, leerDia, leerHora, leerHorario, unir,
} from "./horario-escrito.ts";

const nombres = (t: string) => leerHorario(t).ramos.map((r) => r.nombre);

// ── Las piezas ──────────────────────────────────────────────────────────

test("la hora se completa a HH:MM", () => {
  assert.equal(leerHora("8"), "08:00");
  assert.equal(leerHora("8:30"), "08:30");
  assert.equal(leerHora("8.30"), "08:30");
  assert.equal(leerHora("14:00"), "14:00");
  assert.equal(leerHora("08:05"), "08:05");
});

test("una hora que no existe en un reloj no se acepta", () => {
  assert.equal(leerHora("25:00"), null);
  assert.equal(leerHora("8:75"), null);
  assert.equal(leerHora("mañana"), null);
  assert.equal(leerHora(""), null);
});

test("el día se entiende con o sin tilde, entero o abreviado", () => {
  assert.equal(leerDia("lunes"), 1);
  assert.equal(leerDia("Lunes"), 1);
  assert.equal(leerDia("lun"), 1);
  assert.equal(leerDia("miércoles"), 3);
  assert.equal(leerDia("miercoles"), 3);
  assert.equal(leerDia("mie"), 3);
  assert.equal(leerDia("sábado"), 6);
});

test("martes y miércoles no se confunden, que es el error caro", () => {
  assert.equal(leerDia("ma"), 2);
  assert.equal(leerDia("mi"), 3);
  // Una sola letra sí sería ambigua, así que no se acepta.
  assert.equal(leerDia("m"), null);
  assert.equal(leerDia("l"), null);
});

test("lo que sigue a la hora se parte en tipo y sala", () => {
  assert.deepEqual(leerCola("lab B-104"), { tipo: "Laboratorio", sala: "B-104" });
  assert.deepEqual(leerCola("sala A-201"), { tipo: "Clase", sala: "sala A-201" });
  assert.deepEqual(leerCola("ayudantía"), { tipo: "Ayudantía", sala: "" });
  assert.deepEqual(leerCola(""), { tipo: "Clase", sala: "" });
  assert.deepEqual(leerCola("  - B-104"), { tipo: "Clase", sala: "B-104" });
});

// ── El horario completo ─────────────────────────────────────────────────

test("un ramo con sus bloques debajo", () => {
  const h = leerHorario(`
Cálculo I
lunes 8:30 a 10:00 sala B-104
miércoles 8:30 a 10:00
`);
  assert.deepEqual(nombres(h.ramos.length ? "Cálculo I" : ""), ["Cálculo I"]);
  assert.equal(h.ramos.length, 1);
  assert.equal(h.ramos[0]!.nombre, "Cálculo I");
  assert.deepEqual(h.ramos[0]!.bloques, [
    { dia: 1, inicio: "08:30", fin: "10:00", sala: "sala B-104", tipo: "Clase" },
    { dia: 3, inicio: "08:30", fin: "10:00", sala: "", tipo: "Clase" },
  ]);
  assert.deepEqual(h.reparos, []);
});

test("un ramo y su bloque en la misma línea", () => {
  const h = leerHorario("Física I, martes 14:00-16:00 lab");
  assert.equal(h.ramos.length, 1);
  assert.equal(h.ramos[0]!.nombre, "Física I");
  assert.deepEqual(h.ramos[0]!.bloques, [
    { dia: 2, inicio: "14:00", fin: "16:00", sala: "", tipo: "Laboratorio" },
  ]);
});

test("las dos formas se pueden mezclar en el mismo texto", () => {
  const h = leerHorario(`
Cálculo I
lunes 8:30 a 10:00
Física I, martes 14:00-16:00
jueves 14:00-16:00
`);
  assert.deepEqual(h.ramos.map((r) => r.nombre), ["Cálculo I", "Física I"]);
  assert.equal(h.ramos[0]!.bloques.length, 1);
  // El bloque suelto del final es del último ramo nombrado, Física I.
  assert.deepEqual(h.ramos[1]!.bloques.map((b) => b.dia), [2, 4]);
});

test("el mismo ramo escrito dos veces no se duplica", () => {
  const h = leerHorario(`
Cálculo I, lunes 8:30 a 10:00
Física I, martes 14:00-16:00
cálculo  i, viernes 10:00 a 11:30
`);
  assert.deepEqual(h.ramos.map((r) => r.nombre), ["Cálculo I", "Física I"]);
  assert.deepEqual(h.ramos[0]!.bloques.map((b) => b.dia), [1, 5]);
});

test("un bloque pegado dos veces entra una sola vez", () => {
  const h = leerHorario(`
Cálculo I
lunes 8:30 a 10:00
lunes 8:30 a 10:00
`);
  assert.equal(h.ramos[0]!.bloques.length, 1);
});

test("un ramo sin horas es válido: no todo el mundo tiene horario fijo", () => {
  const h = leerHorario("Inglés\nEstadística");
  assert.deepEqual(h.ramos.map((r) => r.nombre), ["Inglés", "Estadística"]);
  assert.equal(cuantosBloques(h), 0);
  assert.deepEqual(h.reparos, []);
});

test("acepta las distintas maneras de escribir un rango", () => {
  for (const linea of [
    "Ramo, lunes 8:30 a 10:00",
    "Ramo, lunes 8:30-10:00",
    "Ramo, lunes 8:30 – 10:00",
    "Ramo, lunes 8:30 hasta 10:00",
    "Ramo, lunes de 8:30 a 10:00 hrs",
    "Ramo, Lun 08:30 - 10:00",
  ]) {
    const h = leerHorario(linea);
    assert.deepEqual(
      h.ramos[0]?.bloques[0],
      { dia: 1, inicio: "08:30", fin: "10:00", sala: "", tipo: "Clase" },
      `no leyó: ${linea}`,
    );
  }
});

// ── Lo que no se entiende se dice, no se traga ──────────────────────────

test("una hora de término anterior a la de inicio se reclama", () => {
  const h = leerHorario("Cálculo I\nlunes 14:00 a 10:00");
  assert.equal(h.ramos[0]!.bloques.length, 0);
  assert.equal(h.reparos.length, 1);
  assert.equal(h.reparos[0]!.linea, 2);
  assert.match(h.reparos[0]!.motivo, /antes/);
});

test("un bloque sin ramo del que colgar se reclama, con su línea", () => {
  const h = leerHorario("lunes 8:30 a 10:00");
  assert.equal(h.ramos.length, 0);
  assert.equal(h.reparos.length, 1);
  assert.equal(h.reparos[0]!.linea, 1);
  assert.equal(h.reparos[0]!.texto, "lunes 8:30 a 10:00");
});

test("el número de línea del reparo apunta a la línea de verdad", () => {
  const h = leerHorario("\n\nCálculo I\n\nlunes 30:00 a 40:00");
  assert.equal(h.reparos.length, 1);
  assert.equal(h.reparos[0]!.linea, 5);
});

test("un texto vacío no es un error, simplemente no trae nada", () => {
  for (const t of ["", "   ", "\n\n", "---"]) {
    assert.deepEqual(leerHorario(t), { ramos: [], reparos: [] });
  }
});

test("una línea que no es día ni hora se toma como nombre de ramo", () => {
  const h = leerHorario("Taller de tesis");
  assert.deepEqual(h.ramos.map((r) => r.nombre), ["Taller de tesis"]);
  assert.deepEqual(h.reparos, []);
});

test("se cuentan los bloques para poder decirlo antes de crear nada", () => {
  const h = leerHorario(`
Cálculo I
lunes 8:30 a 10:00
miércoles 8:30 a 10:00
Física I, martes 14:00-16:00
`);
  assert.equal(h.ramos.length, 2);
  assert.equal(cuantosBloques(h), 3);
});

// ── Las trampas del mundo real ──────────────────────────────────────────

test("un nombre que empieza como un día no se lee como día", () => {
  // "Matemáticas" empieza igual que "martes". Sin el rango de horas pegado
  // detrás, la palabra es solo el nombre del ramo.
  const h = leerHorario("Matemáticas\nlunes 8:30 a 10:00");
  assert.deepEqual(h.ramos.map((r) => r.nombre), ["Matemáticas"]);
  assert.deepEqual(h.ramos[0]!.bloques.map((b) => b.dia), [1]);
  assert.deepEqual(h.reparos, []);
});

test("un ramo con un día en el nombre conserva su nombre entero", () => {
  const h = leerHorario("Taller de los lunes, jueves 15:00 a 16:30");
  assert.equal(h.ramos[0]!.nombre, "Taller de los lunes");
  assert.deepEqual(h.ramos[0]!.bloques.map((b) => b.dia), [4]);
});

test("una hora sin día se reclama en vez de inventarse el día", () => {
  const h = leerHorario("Cálculo I\nMatemáticas 8:00 a 10:00");
  assert.equal(h.reparos.length, 1);
  assert.match(h.reparos[0]!.motivo, /día/);
  assert.equal(cuantosBloques(h), 0);
});

test("un mismo día con dos bloques distintos entra dos veces", () => {
  const h = leerHorario(`
Cálculo I
lunes 8:30 a 10:00
lunes 15:00 a 16:30
`);
  assert.equal(h.ramos[0]!.bloques.length, 2);
});

test("lo que no se entendió no impide crear lo que sí", () => {
  const h = leerHorario(`
Cálculo I
lunes 8:30 a 10:00
lunes 99:99 a 100:00
Física I, martes 14:00-16:00
`);
  assert.deepEqual(h.ramos.map((r) => r.nombre), ["Cálculo I", "Física I"]);
  assert.equal(cuantosBloques(h), 2);
  assert.equal(h.reparos.length, 1);
});

test("los espacios y la puntuación de sobra no llegan al nombre", () => {
  const h = leerHorario("  Cálculo   I  :  \nlunes 8:30 a 10:00");
  assert.equal(h.ramos[0]!.nombre, "Cálculo I");
});

// ── Lo que se pinta ─────────────────────────────────────────────────────

test("las partes vacías no dejan separadores colgando", () => {
  assert.equal(unir(["Clase", "", "hasta 11:45"]), "Clase · hasta 11:45");
  assert.equal(unir(["Clase", "B-104", "hasta 11:45"]), "Clase · B-104 · hasta 11:45");
  assert.equal(unir([null, undefined, "  ", "solo"]), "solo");
  assert.equal(unir([]), "");
});

test("el color de la carga continúa donde quedaron los ramos que ya había", () => {
  const paleta = ["a", "b", "c"];
  assert.equal(colorDeLaCarga(0, 0, paleta), "a");
  assert.equal(colorDeLaCarga(1, 0, paleta), "b");
  // Con dos ramos ya creados, el primero de la carga sigue en el tercero.
  assert.equal(colorDeLaCarga(0, 2, paleta), "c");
  assert.equal(colorDeLaCarga(1, 2, paleta), "a");
});

test("dos ramos de la misma carga nunca comparten color mientras alcance la paleta", () => {
  const paleta = ["a", "b", "c", "d", "e", "f"];
  for (const ya of [0, 1, 5, 11]) {
    const salen = [0, 1, 2, 3].map((i) => colorDeLaCarga(i, ya, paleta));
    assert.equal(new Set(salen).size, salen.length, `con ${ya} ya creados: ${salen}`);
  }
});
