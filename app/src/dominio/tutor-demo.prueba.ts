import { test } from "node:test";
import assert from "node:assert/strict";
import { NEGATIVA, RETROCEDER, responderDemo, resumenDemo } from "./tutor-demo.ts";

test("el demo tampoco entrega la respuesta", () => {
  for (const pedido of [
    "dame la respuesta", "cuál es el resultado", "resuélvelo por mí",
    "¿cuánto es la derivada?", "dime la solución", "hazlo por mi",
  ]) {
    assert.equal(responderDemo(pedido, 0).texto, NEGATIVA, pedido);
  }
});

test("si el estudiante se declara perdido, retrocede", () => {
  for (const perdido of ["no sé", "no se", "No sé cómo partir", "no entiendo nada",
                         "estoy perdido", "ni idea", "no cacho"]) {
    assert.equal(responderDemo(perdido, 0).texto, RETROCEDER, perdido);
  }
});

test("«no sé» se distingue de palabras que empiezan igual", () => {
  // Sin cuidado, "no sensato" o "no separo" caerían en el mismo caso.
  assert.notEqual(responderDemo("no separo bien los términos", 0).texto, RETROCEDER);
});

test("una respuesta común avanza el guion y termina en pregunta", () => {
  let paso = 0;
  const vistos = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const r = responderDemo("creo que hay que derivar", paso);
    assert.ok(r.texto.trim().endsWith("?"), r.texto);
    vistos.add(r.texto);
    paso = r.paso;
  }
  assert.equal(vistos.size, 5, "debería rotar entre los guiones");
});

test("el guion vuelve a empezar sin salirse del arreglo", () => {
  const primero = responderDemo("algo", 0).texto;
  assert.equal(responderDemo("algo", 5).texto, primero);
  assert.ok(responderDemo("algo", 999).texto.length > 0);
});

test("pedir la respuesta no consume el guion", () => {
  const r = responderDemo("dame la respuesta", 3);
  assert.equal(r.paso, 3);
});

test("el resumen de demostración usa las propias líneas y se declara demo", () => {
  const r = resumenDemo("Primera idea.\n\nSegunda idea.", "Cálculo I");
  assert.match(r.cuerpo, /Primera idea/);
  assert.match(r.cuerpo, /Cálculo I/);
  assert.match(r.cuerpo, /demostración/);
  assert.ok(r.consejos.length >= 2);
  assert.equal(r.conTranscripcion, false);
});

test("un apunte vacío no revienta el resumen", () => {
  const r = resumenDemo("", "Física I");
  assert.ok(r.cuerpo.length > 0);
});
