import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accionAlTocarMicrofono, estadoDesdePermiso, etiquetaMicrofono, type EstadoMicrofono,
} from "./microfono.ts";

test("no se pide el permiso hasta que el estudiante intenta hablar", () => {
  assert.equal(accionAlTocarMicrofono("sin_preguntar"), "pedir");
});

test("si ya dijo que no pero se puede reintentar, se vuelve a pedir", () => {
  assert.equal(accionAlTocarMicrofono("denegado"), "pedir");
});

test("si lo bloqueó, la app manda a Ajustes en vez de insistir", () => {
  assert.equal(accionAlTocarMicrofono("bloqueado"), "ir_a_ajustes");
});

test("con permiso, abre el micrófono", () => {
  assert.equal(accionAlTocarMicrofono("concedido"), "abrir");
});

test("la respuesta del sistema se traduce a los tres casos", () => {
  assert.equal(estadoDesdePermiso({ granted: true, canAskAgain: true }), "concedido");
  assert.equal(estadoDesdePermiso({ granted: true, canAskAgain: false }), "concedido");
  assert.equal(estadoDesdePermiso({ granted: false, canAskAgain: true }), "denegado");
  assert.equal(estadoDesdePermiso({ granted: false, canAskAgain: false }), "bloqueado");
});

test("la etiqueta dice la verdad en cada estado", () => {
  assert.equal(etiquetaMicrofono("concedido", false), "Silenciado");
  assert.equal(etiquetaMicrofono("concedido", true), "Micrófono abierto");
  assert.equal(etiquetaMicrofono("sin_preguntar", false), "Silenciado");
  // Si está bloqueado, decir "Silenciado" haría creer que basta con tocarlo.
  assert.equal(etiquetaMicrofono("bloqueado", false), "Sin permiso");
  assert.equal(etiquetaMicrofono("bloqueado", true), "Sin permiso");
});

test("ningún estado deja al botón sin etiqueta", () => {
  const estados: EstadoMicrofono[] = ["sin_preguntar", "concedido", "denegado", "bloqueado"];
  for (const estado of estados) {
    for (const abierto of [true, false]) {
      assert.ok(etiquetaMicrofono(estado, abierto).length > 0);
    }
  }
});
