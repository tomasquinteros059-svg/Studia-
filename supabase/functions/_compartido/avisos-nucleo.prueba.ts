import { test } from "node:test";
import assert from "node:assert/strict";
import { comoSuena, esHoraDecente, vibra } from "./avisos-nucleo.ts";

// Una app de estudio que vibra por cualquier cosa se silencia en la primera
// semana, y entonces tampoco avisa lo que sí importaba.
test("los avisos que caducan sí interrumpen", () => {
  assert.equal(vibra("clase"), true);
  assert.equal(vibra("tarea"), true);
  assert.equal(vibra("nota"), true);
});

test("un anuncio del profesor no interrumpe: llega al abrir la app", () => {
  assert.equal(vibra("anuncio"), false);
});

test("de madrugada no se avisa", () => {
  assert.equal(esHoraDecente(3), false);
  assert.equal(esHoraDecente(7), false);
  assert.equal(esHoraDecente(8), true);
  assert.equal(esHoraDecente(21), true);
  assert.equal(esHoraDecente(22), false);
  assert.equal(esHoraDecente(23), false);
});

// Afuera de la app no hay contexto: no se sabe de qué ramo es.
test("el ramo va adelante, porque afuera no se sabe de cuál es", () => {
  const a = comoSuena("nota", "Publicaron Control 2", "Sacaste 5,8", "Cálculo I");
  assert.equal(a.titulo, "Cálculo I · Publicaron Control 2");
  assert.equal(a.cuerpo, "Sacaste 5,8");
});

test("sin ramo no queda un separador colgando", () => {
  assert.equal(comoSuena("tarea", "Guía 4", "Vence mañana").titulo, "Guía 4");
  assert.equal(comoSuena("tarea", "Guía 4", "Vence mañana", "   ").titulo, "Guía 4");
});

// Un aviso que dice «Nueva nota» y nada más obliga a abrir la aplicación para
// saber si vale la pena abrirla.
test("sin detalle igual dice algo útil, no queda vacío", () => {
  assert.equal(comoSuena("clase", "Cálculo I", "").cuerpo, "Tu clase está empezando.");
  assert.equal(comoSuena("nota", "Control 2", "   ").cuerpo, "Publicaron una nota nueva.");
});

test("un aviso larguísimo se corta antes de mandarlo", () => {
  const a = comoSuena("tarea", "x".repeat(200), "y".repeat(400), "z".repeat(50));
  assert.ok(a.titulo.length <= 80);
  assert.ok(a.cuerpo.length <= 160);
});
