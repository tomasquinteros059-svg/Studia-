import { test } from "node:test";
import assert from "node:assert/strict";
import { versionParaMostrar } from "./version.ts";

test("la versión se muestra con su rótulo", () => {
  assert.equal(versionParaMostrar("1.1.0"), "Versión 1.1.0");
});

test("sin versión no se muestra nada, ni un texto de relleno", () => {
  assert.equal(versionParaMostrar(""), "");
  assert.equal(versionParaMostrar("   "), "");
});

test("los espacios de sobra no llegan a la pantalla", () => {
  assert.equal(versionParaMostrar(" 1.1.0 "), "Versión 1.1.0");
});
