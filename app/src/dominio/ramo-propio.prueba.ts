import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoDe, introDe, normalizar } from "./ramo-propio.ts";

test("normalizar deja un solo espacio y saca los de los bordes", () => {
  assert.equal(normalizar("  Estadística   aplicada "), "Estadística aplicada");
  assert.equal(normalizar("\n Inglés\t"), "Inglés");
});

test("el código sale del nombre, en mayúsculas y sin acentos", () => {
  assert.equal(codigoDe("Estadística"), "MIS-ESTADISTICA");
  assert.equal(codigoDe("Inglés técnico"), "MIS-INGLES-TECNICO");
});

test("un nombre largo se corta sin dejar el guion colgando", () => {
  const codigo = codigoDe("Programación orientada a objetos");
  assert.ok(codigo.length <= 22, codigo);
  assert.ok(!codigo.endsWith("-"), codigo);
});

test("un nombre sin letras ni números igual da un código usable", () => {
  assert.equal(codigoDe("!!!"), "MIS-RAMO");
  assert.equal(codigoDe("   "), "MIS-RAMO");
});

test("dos nombres que solo difieren en espacios dan el mismo código", () => {
  assert.equal(codigoDe("Cálculo  II"), codigoDe(" Cálculo II "));
});

test("el tutor saluda con el nombre limpio, no con el que se escribió", () => {
  assert.match(introDe("  Inglés  técnico "), /Inglés técnico/);
  assert.ok(introDe("Inglés").endsWith("intentaste."));
});
