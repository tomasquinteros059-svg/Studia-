import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acomodar, avance, comoTeFue, cuantasRespondidas, enQueVoy, estaTerminado,
  pintaDe, revisar, type Pregunta,
} from "./quiz.ts";

const P = (correcta: number, pregunta = "¿Cuál?"): Pregunta => ({
  pregunta, opciones: ["a", "b", "c", "d"], correcta, explicacion: "porque sí",
});
const TRES = [P(1, "Primera"), P(0, "Segunda"), P(3, "Tercera")];

// ── Acomodar lo guardado ────────────────────────────────────────────────

test("un quiz recién hecho no tiene ninguna respuesta", () => {
  assert.deepEqual(acomodar([], 3), [null, null, null]);
});

test("un quiz a medias se recupera donde se dejó", () => {
  assert.deepEqual(acomodar([1, 0], 3), [1, 0, null]);
});

test("lo que no es un índice de alternativa se toma como sin responder", () => {
  assert.deepEqual(acomodar([1, "b", 9, -1, null, 1.5], 6), [1, null, null, null, null, null]);
});

test("si viniera de más, se recorta al largo de las preguntas", () => {
  assert.deepEqual(acomodar([1, 0, 3, 2, 1], 3), [1, 0, 3]);
});

test("lo que no es un arreglo no rompe nada", () => {
  assert.deepEqual(acomodar(null, 2), [null, null]);
  assert.deepEqual(acomodar("1,2", 2), [null, null]);
});

// ── Dónde vas ───────────────────────────────────────────────────────────

test("vas en la primera sin contestar, no en la última contestada", () => {
  assert.equal(enQueVoy([null, null, null]), 0);
  assert.equal(enQueVoy([1, null, null]), 1);
  // Un hueco al medio manda: es la que falta.
  assert.equal(enQueVoy([1, null, 3]), 1);
});

test("con todas contestadas, se va al final", () => {
  assert.equal(enQueVoy([1, 0, 3]), 3);
  assert.equal(estaTerminado([1, 0, 3]), true);
  assert.equal(estaTerminado([1, null, 3]), false);
});

test("un quiz sin preguntas no está terminado, está vacío", () => {
  assert.equal(estaTerminado([]), false);
});

test("la barra de avance cuenta respuestas, no la pregunta en que estás", () => {
  assert.equal(avance([null, null, null, null]), 0);
  assert.equal(avance([1, null, null, null]), 0.25);
  assert.equal(avance([1, 0, 3]), 1);
  assert.equal(avance([]), 0);
  assert.equal(cuantasRespondidas([1, null, 3]), 2);
});

// ── Cuántas van buenas ──────────────────────────────────────────────────

test("se cuentan las que están bien y se dice cuáles", () => {
  const r = revisar(TRES, [1, 2, 3]);
  assert.equal(r.correctas, 2);
  assert.equal(r.total, 3);
  assert.deepEqual(r.detalle.map((d) => [d.pregunta, d.acerto]),
    [["Primera", true], ["Segunda", false], ["Tercera", true]]);
});

test("una pregunta sin contestar no cuenta como buena", () => {
  assert.equal(revisar(TRES, [null, null, null]).correctas, 0);
});

test("responder cero no es lo mismo que no responder", () => {
  // La alternativa A es el índice 0, y `null` es no haber contestado. Si se
  // confundieran, un quiz sin empezar saldría con todas las de A buenas.
  assert.equal(revisar([P(0)], [0]).correctas, 1);
  assert.equal(revisar([P(0)], [null]).correctas, 0);
});

// ── Qué se te dice ──────────────────────────────────────────────────────

test("todas buenas: se dice que el tema está, sin adornos", () => {
  assert.equal(comoTeFue(3, 3).titulo, "Perfecto");
});

test("la mitad o más: se dice cuántas quedaron, en singular o en plural", () => {
  assert.equal(comoTeFue(2, 3).titulo, "Vas bien");
  assert.match(comoTeFue(2, 3).mensaje, /quedó una/);
  assert.match(comoTeFue(3, 5).mensaje, /quedaron 2/);
  // Justo la mitad todavía es «vas bien».
  assert.equal(comoTeFue(2, 4).titulo, "Vas bien");
});

test("menos de la mitad: no se felicita de mentira ni se reta", () => {
  const v = comoTeFue(1, 5);
  assert.equal(v.titulo, "Todavía no, y está bien");
  assert.match(v.mensaje, /otra pasada/);
  assert.doesNotMatch(v.mensaje, /buen intento|sigue así|no te preocupes/i);
});

test("un quiz vacío no dice que te fue perfecto", () => {
  assert.equal(comoTeFue(0, 0).titulo, "Sin preguntas");
});

// ── Cómo se pinta cada alternativa ──────────────────────────────────────

test("antes de responder no se pinta nada", () => {
  for (let i = 0; i < 4; i++) assert.equal(pintaDe(i, 2, null), "sinResponder");
});

test("al acertar, la elegida es la correcta y el resto se apaga", () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => pintaDe(i, 2, 2)),
    ["apagada", "apagada", "correcta", "apagada"]);
});

test("al equivocarse se marca la correcta igual: es lo que hacía falta saber", () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => pintaDe(i, 2, 0)),
    ["equivocada", "apagada", "correcta", "apagada"]);
});
