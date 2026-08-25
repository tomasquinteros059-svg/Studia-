import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estaAprobado,
  formatearNota,
  notaDelRamo,
  promedioPonderado,
  proyeccionParaAprobar,
  type Evaluacion,
} from "./notas.ts";

const CALCULO: Evaluacion[] = [
  { titulo: "Control 1", peso: 20, nota: 6.2 },
  { titulo: "Control 2", peso: 20, nota: 6.3 },
  { titulo: "Guías", peso: 15, nota: 6.5 },
  { titulo: "Examen", peso: 45, nota: null },
];

const OPERACIONES: Evaluacion[] = [
  { titulo: "Control 1", peso: 30, nota: 4.2 },
  { titulo: "Casos", peso: 20, nota: null },
  { titulo: "Examen", peso: 50, nota: null },
];

test("pondera solo lo rendido", () => {
  const r = notaDelRamo(CALCULO);
  // (20·6,2 + 20·6,3 + 15·6,5) / 55
  assert.equal(Math.round(r.nota! * 100) / 100, 6.32);
  assert.equal(r.rendido, 55);
  assert.equal(r.pendiente, 45);
});

test("lo pendiente NO cuenta como cero", () => {
  const conCeros = CALCULO.map((e) => ({ ...e, nota: e.nota ?? 0 }));
  const ponderandoTodo =
    conCeros.reduce((a, e) => a + e.peso * e.nota, 0) / 100;
  assert.ok(notaDelRamo(CALCULO).nota! > ponderandoTodo + 2);
});

test("sin evaluaciones rendidas no hay nota", () => {
  const r = notaDelRamo([{ titulo: "Examen", peso: 100, nota: null }]);
  assert.equal(r.nota, null);
  assert.equal(r.rendido, 0);
  assert.equal(r.pendiente, 100);
});

test("un ramo sin evaluaciones no revienta", () => {
  assert.deepEqual(notaDelRamo([]), { nota: null, rendido: 0, pendiente: 0 });
});

test("proyección: cuánto se necesita para aprobar", () => {
  // (4 − 4,2·0,30) / 0,70 = 3,914 → se pide 4,0
  assert.deepEqual(proyeccionParaAprobar(OPERACIONES), {
    tipo: "necesita",
    nota: 4.0,
    pendiente: 70,
  });
});

test("proyección: redondea hacia arriba, nunca hacia abajo", () => {
  // Bajar 3,91 a 3,9 haría creer que con 3,9 alcanza. No alcanza.
  const evs: Evaluacion[] = [
    { titulo: "C1", peso: 50, nota: 4.09 },
    { titulo: "Examen", peso: 50, nota: null },
  ];
  const p = proyeccionParaAprobar(evs);
  assert.equal(p.tipo, "necesita");
  if (p.tipo === "necesita") {
    const exacta = (4 - 4.09 * 0.5) / 0.5;
    assert.ok(p.nota >= exacta, `${p.nota} debería alcanzar para ${exacta}`);
  }
});

test("proyección: ya aprobado pase lo que pase", () => {
  const evs: Evaluacion[] = [
    { titulo: "C1", peso: 90, nota: 6.5 },
    { titulo: "Examen", peso: 10, nota: null },
  ];
  assert.deepEqual(proyeccionParaAprobar(evs), { tipo: "ya_aprobado" });
});

test("proyección: ya no alcanza ni con un 7,0", () => {
  const evs: Evaluacion[] = [
    { titulo: "C1", peso: 80, nota: 2.0 },
    { titulo: "Examen", peso: 20, nota: null },
  ];
  assert.deepEqual(proyeccionParaAprobar(evs), { tipo: "inalcanzable", pendiente: 20 });
});

test("proyección: sin datos y con todo evaluado", () => {
  assert.deepEqual(
    proyeccionParaAprobar([{ titulo: "Examen", peso: 100, nota: null }]),
    { tipo: "sin_datos" },
  );
  assert.deepEqual(
    proyeccionParaAprobar([{ titulo: "Examen", peso: 100, nota: 5.0 }]),
    { tipo: "todo_evaluado" },
  );
});

test("la nota proyectada siempre cae dentro de la escala", () => {
  for (let actual = 1; actual <= 7; actual += 0.1) {
    for (const peso of [10, 25, 40, 60, 90]) {
      const p = proyeccionParaAprobar([
        { titulo: "rendido", peso: 100 - peso, nota: Math.round(actual * 10) / 10 },
        { titulo: "pendiente", peso, nota: null },
      ]);
      if (p.tipo === "necesita") {
        assert.ok(p.nota > 1.0 && p.nota <= 7.0, `fuera de escala: ${p.nota}`);
      }
    }
  }
});

test("promedio general ponderado por créditos", () => {
  const p = promedioPonderado([
    { creditos: 10, evaluaciones: CALCULO },       // 6,32
    { creditos: 10, evaluaciones: OPERACIONES },   // 4,20
  ]);
  assert.equal(Math.round(p! * 100) / 100, 5.26);
});

test("los ramos sin nota no arrastran el promedio", () => {
  const sinNota: Evaluacion[] = [{ titulo: "Examen", peso: 100, nota: null }];
  const solo = promedioPonderado([{ creditos: 10, evaluaciones: CALCULO }]);
  const conVacio = promedioPonderado([
    { creditos: 10, evaluaciones: CALCULO },
    { creditos: 10, evaluaciones: sinNota },
  ]);
  assert.equal(solo, conVacio);
});

test("sin ningún ramo evaluado no hay promedio", () => {
  assert.equal(promedioPonderado([]), null);
  assert.equal(
    promedioPonderado([{ creditos: 10, evaluaciones: [{ titulo: "x", peso: 100, nota: null }] }]),
    null,
  );
});

test("las notas se escriben con coma", () => {
  assert.equal(formatearNota(6.32), "6,3");
  assert.equal(formatearNota(4), "4,0");
  assert.equal(formatearNota(null), "—");
  assert.equal(formatearNota(NaN), "—");
});

test("aprobado es 4,0 o más", () => {
  assert.equal(estaAprobado(4.0), true);
  assert.equal(estaAprobado(3.9), false);
  assert.equal(estaAprobado(null), false);
});
