import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LARGO_MENSAJE, NO_REPETIR_POR, armarReporte, esRepetido, limpiar,
} from "./errores.ts";

test("un mensaje normal pasa entero", () => {
  assert.equal(limpiar("No pude cargar la materia"), "No pude cargar la materia");
});

// Las tres formas en que esto pasa de verdad.
test("un correo dentro del mensaje no queda guardado", () => {
  assert.equal(limpiar("falló para eduardo@alumnos.uc.cl"), "falló para (correo)");
});

test("un token de sesión tampoco", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdef";
  assert.ok(!limpiar(`Authorization: Bearer ${jwt}`).includes(jwt));
  assert.match(limpiar(`Bearer ${jwt}`), /\(clave\)/);
});

// Una dirección firmada es acceso a un archivo ajeno mientras no venza.
test("los parámetros de una dirección firmada no quedan guardados", () => {
  const url = "https://x.supabase.co/storage/v1/object/sign/material/yo/a/b.pdf?token=abc123def456ghi";
  const limpio = limpiar(`No pude abrir ${url}`);
  assert.ok(!limpio.includes("token=abc123def456ghi"));
  assert.match(limpio, /\(parámetros\)/);
});

test("el reporte sale de cualquier cosa que se haya lanzado", () => {
  assert.equal(armarReporte(new Error("reventó"), "Tareas", "pantalla").mensaje, "reventó");
  assert.equal(armarReporte("reventó", "Tareas", "global").mensaje, "reventó");
  assert.equal(armarReporte({ codigo: 42 }, "Tareas", "global").mensaje, '{"codigo":42}');
});

// Si armar el reporte fallara, la app se caería dos veces y la segunda sin
// dejar rastro.
test("armar el reporte nunca revienta, ni con lo que no se puede describir", () => {
  const circular: Record<string, unknown> = {};
  circular.yo = circular;
  assert.doesNotThrow(() => armarReporte(circular, "Tareas", "global"));
  assert.doesNotThrow(() => armarReporte(undefined, "", "promesa"));
  assert.doesNotThrow(() => armarReporte(new Error(""), "Tareas", "pantalla"));
});

test("un error sin mensaje igual dice algo", () => {
  assert.ok(armarReporte(new Error(""), "Tareas", "pantalla").mensaje.length > 0);
});

test("un mensaje larguísimo se corta", () => {
  const largo = armarReporte(new Error("x".repeat(3000)), "Tareas", "pantalla");
  assert.ok(largo.mensaje.length <= LARGO_MENSAJE);
});

test("la pila también se limpia, no solo el mensaje", () => {
  const err = new Error("falló");
  err.stack = "Error: falló\n    at pedir (app.js:1) para ana@u.cl";
  assert.ok(!armarReporte(err, "Tareas", "pantalla").pila!.includes("ana@u.cl"));
});

// Un error dentro de un render se repite en cada intento de dibujar. Sin esto
// una pantalla rota manda cien filas por minuto.
test("el mismo error no se manda dos veces seguidas", () => {
  const vistos = new Map<string, number>();
  const r = armarReporte(new Error("reventó"), "Tareas", "pantalla");
  assert.equal(esRepetido(r, vistos, 1000), false);
  assert.equal(esRepetido(r, vistos, 1500), true);
  assert.equal(esRepetido(r, vistos, 1000 + NO_REPETIR_POR + 1), false);
});

test("dos errores distintos no se tapan entre sí", () => {
  const vistos = new Map<string, number>();
  assert.equal(esRepetido(armarReporte(new Error("uno"), "Tareas", "pantalla"), vistos, 0), false);
  assert.equal(esRepetido(armarReporte(new Error("dos"), "Tareas", "pantalla"), vistos, 0), false);
  // El mismo mensaje en otra pantalla es otro problema.
  assert.equal(esRepetido(armarReporte(new Error("uno"), "Notas", "pantalla"), vistos, 0), false);
});
