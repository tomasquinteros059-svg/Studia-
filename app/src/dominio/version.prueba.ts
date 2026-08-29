import { test } from "node:test";
import assert from "node:assert/strict";
import { versionParaMostrar } from "./version.ts";

test("la versión se muestra con su rótulo", () => {
  assert.equal(versionParaMostrar("1.3.0"), "Versión 1.3.0");
});

test("con número de compilación se distinguen dos APK que dicen lo mismo", () => {
  assert.equal(versionParaMostrar("1.3.0", 247), "Versión 1.3.0 (247)");
  assert.equal(versionParaMostrar("1.3.0", 248), "Versión 1.3.0 (248)");
});

test("una compilación sin numerar no ensucia la pantalla", () => {
  // Es la que se arma en el computador de uno: el número no dice nada.
  assert.equal(versionParaMostrar("1.3.0", 1), "Versión 1.3.0");
  assert.equal(versionParaMostrar("1.3.0", 0), "Versión 1.3.0");
  assert.equal(versionParaMostrar("1.3.0", null), "Versión 1.3.0");
  assert.equal(versionParaMostrar("1.3.0", undefined), "Versión 1.3.0");
  assert.equal(versionParaMostrar("1.3.0", NaN), "Versión 1.3.0");
});

test("sin versión no se muestra nada, ni un texto de relleno", () => {
  assert.equal(versionParaMostrar(""), "");
  assert.equal(versionParaMostrar("   "), "");
  assert.equal(versionParaMostrar("", 247), "");
});

test("los espacios de sobra no llegan a la pantalla", () => {
  assert.equal(versionParaMostrar(" 1.3.0 ", 247), "Versión 1.3.0 (247)");
});
