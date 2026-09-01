import { test } from "node:test";
import assert from "node:assert/strict";
import { LARGO_MINIMO, hayAlgoQueMandar, revisarClaveNueva } from "./clave.ts";

const problema = (clave: string, repetida = clave) => {
  const r = revisarClaveNueva(clave, repetida);
  return r.sirve ? null : r.problema;
};

test("una clave larga y repetida bien sirve", () => {
  assert.deepEqual(revisarClaveNueva("integrales2026", "integrales2026"), { sirve: true });
});

test("no se acepta una clave corta", () => {
  assert.match(problema("corta1") ?? "", new RegExp(String(LARGO_MINIMO)));
});

// Un espacio al final no se ve tras los puntitos y sí cuenta al entrar: es de
// las maneras más fáciles de quedar fuera de la propia cuenta.
test("los espacios de los bordes se rechazan en vez de guardarse", () => {
  assert.match(problema(" integrales2026 ") ?? "", /espacio/);
  assert.match(problema("integrales2026\n") ?? "", /espacio/);
  // Adentro sí se permiten: una frase con espacios es una buena clave.
  assert.equal(problema("las integrales de linea"), null);
});

test("dos claves distintas no pasan, aunque las dos sean buenas", () => {
  assert.match(problema("integrales2026", "integrales2027") ?? "", /no son iguales/);
});

test("sin escribir nada se pide escribir algo, no se dice que es corta", () => {
  assert.match(problema("") ?? "", /Escribe una clave/);
});

// Al entrar la regla es otra a propósito: quien ya tiene una cuenta con una
// clave de seis caracteres tiene derecho a entrar con ella.
test("para entrar basta con que haya correo y algo escrito", () => {
  assert.equal(hayAlgoQueMandar("ana@u.cl", "abc123"), true);
  assert.equal(hayAlgoQueMandar("  ", "abc123"), false);
  assert.equal(hayAlgoQueMandar("ana@u.cl", ""), false);
});
