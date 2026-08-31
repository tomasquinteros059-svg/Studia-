import { strict as afirmar } from "node:assert";
import { describe, test } from "node:test";
import {
  armarRegistro, cabe, comoVaElRegistro, enRiesgo, estaRepartido, pesoLibre,
  pesoUsado, porPublicar, type Evaluacion, type NotaPuesta,
} from "./registro.ts";

const ev = (id: string, peso: number, orden: number): Evaluacion =>
  ({ id, titulo: `Control ${orden}`, peso, orden });

const nota = (
  evaluacion_id: string, estudiante_id: string, n: number | null, publicada = false,
): NotaPuesta => ({
  evaluacion_id, estudiante_id, estudiante: estudiante_id, nota: n, publicada,
});

const CURSO = [{ id: "a1", nombre: "Eduardo" }, { id: "a2", nombre: "Josefa" }];

describe("las ponderaciones", () => {
  test("suma lo repartido y dice lo que queda", () => {
    const evs = [ev("e1", 30, 1), ev("e2", 25, 2)];
    afirmar.equal(pesoUsado(evs), 55);
    afirmar.equal(pesoLibre(evs), 45);
    afirmar.equal(estaRepartido(evs), false);
  });

  test("con el semestre completo no queda nada libre", () => {
    afirmar.equal(estaRepartido([ev("e1", 60, 1), ev("e2", 40, 2)]), true);
  });

  test("los decimales no dejan restos raros", () => {
    // 33,3 tres veces da 99,9 y no 99,90000000000002, que es lo que sale de
    // sumar flotantes y lo que después se le muestra a alguien.
    const evs = [ev("e1", 33.3, 1), ev("e2", 33.3, 2), ev("e3", 33.3, 3)];
    afirmar.equal(pesoUsado(evs), 99.9);
    afirmar.equal(pesoLibre(evs), 0.1);
  });

  test("un peso cabe solo si queda espacio", () => {
    const evs = [ev("e1", 70, 1)];
    afirmar.equal(cabe(evs, 30), true);
    afirmar.equal(cabe(evs, 31), false);
    // Cero o negativo no es una ponderación.
    afirmar.equal(cabe(evs, 0), false);
    afirmar.equal(cabe(evs, -10), false);
  });
});

describe("el registro del curso", () => {
  const evs = [ev("e1", 40, 1), ev("e2", 60, 2)];

  test("una fila por alumno, en el orden de las evaluaciones", () => {
    const filas = armarRegistro(CURSO, evs, [
      nota("e1", "a1", 6.0), nota("e2", "a1", 5.0),
      nota("e1", "a2", 3.0),
    ]);
    afirmar.deepEqual(filas.map((f) => f.estudiante), ["Eduardo", "Josefa"]);
    afirmar.deepEqual(filas[0]!.notas, [6.0, 5.0]);
    afirmar.deepEqual(filas[1]!.notas, [3.0, null]);
  });

  test("las columnas siguen el orden de la evaluación, no el de llegada", () => {
    const alReves = [ev("e2", 60, 2), ev("e1", 40, 1)];
    const filas = armarRegistro([CURSO[0]!], alReves, [
      nota("e1", "a1", 6.0), nota("e2", "a1", 5.0),
    ]);
    afirmar.deepEqual(filas[0]!.notas, [6.0, 5.0]);
  });

  test("el promedio pondera de verdad", () => {
    const filas = armarRegistro([CURSO[0]!], evs, [
      nota("e1", "a1", 7.0), nota("e2", "a1", 4.0),
    ]);
    // 7,0 al 40% y 4,0 al 60% son 5,2, no 5,5.
    afirmar.equal(filas[0]!.hastaAhora, 5.2);
    afirmar.equal(filas[0]!.cubierto, 100);
  });

  test("lo que todavía no se rinde no cuenta como cero", () => {
    // Contar como cero lo no hecho convertiría a todo el curso en reprobado en
    // marzo, que es la manera más rápida de que un promedio deje de significar
    // algo.
    const filas = armarRegistro([CURSO[0]!], evs, [nota("e1", "a1", 6.0)]);
    afirmar.equal(filas[0]!.hastaAhora, 6.0);
    afirmar.equal(filas[0]!.cubierto, 40);
  });

  test("quien no tiene ninguna nota aparece igual, sin promedio inventado", () => {
    // Es justamente a quien hay que mirar.
    const filas = armarRegistro(CURSO, evs, [nota("e1", "a1", 6.0)]);
    const josefa = filas.find((f) => f.estudiante === "Josefa")!;
    afirmar.equal(josefa.hastaAhora, null);
    afirmar.equal(josefa.cubierto, 0);
  });

  test("cuenta las notas que el curso todavía no ve", () => {
    const filas = armarRegistro(CURSO, evs, [
      nota("e1", "a1", 6.0, true), nota("e2", "a1", 5.0, false),
      nota("e1", "a2", 3.0, false),
    ]);
    afirmar.equal(filas[0]!.sinPublicar, 1);
    afirmar.equal(porPublicar(filas), 2);
  });

  test("señala a quienes van bajo el cuatro con lo que llevan", () => {
    const filas = armarRegistro(CURSO, evs, [
      nota("e1", "a1", 6.0), nota("e1", "a2", 3.0),
    ]);
    afirmar.deepEqual(enRiesgo(filas).map((f) => f.estudiante), ["Josefa"]);
  });

  test("sin curso no hay filas, y nada revienta", () => {
    afirmar.deepEqual(armarRegistro([], evs, []), []);
  });
});

describe("cómo se le cuenta al profesor", () => {
  test("primero lo que falta, que es a lo que viene", () => {
    const evs = [ev("e1", 40, 1)];
    const filas = armarRegistro(CURSO, evs, [nota("e1", "a1", 6.0)]);
    const dicho = comoVaElRegistro(evs, filas);
    afirmar.match(dicho, /falta repartir 60%/);
    afirmar.match(dicho, /1 nota puesta que el curso no ve/);
  });

  test("con todo repartido y publicado se dice así, sin ruido", () => {
    const evs = [ev("e1", 100, 1)];
    const filas = armarRegistro(CURSO, evs, [
      nota("e1", "a1", 6.0, true), nota("e1", "a2", 5.0, true),
    ]);
    afirmar.equal(comoVaElRegistro(evs, filas), "Todo repartido y todo publicado.");
  });

  test("sin evaluaciones se dice eso, no un 0% que suena a error", () => {
    afirmar.match(comoVaElRegistro([], []), /Todavía no hay evaluaciones/);
  });

  test("la nota puesta se dice en singular cuando es una", () => {
    const evs = [ev("e1", 100, 1)];
    const filas = armarRegistro([CURSO[0]!], evs, [nota("e1", "a1", 6.0)]);
    afirmar.match(comoVaElRegistro(evs, filas), /1 nota puesta que el curso no ve/);
  });
});
