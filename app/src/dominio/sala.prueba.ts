import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALFABETO, CUANTOS_CABEN, HORAS_ABIERTA, LARGO, comoEsta, comoSeMuestra,
  normalizarCodigo, nuevoCodigo, sePuedeEntrar,
} from "./sala.ts";

test("el alfabeto no tiene ningún par que se confunda al dictarlo", () => {
  for (const par of ["O0", "I1", "IL", "1L", "S5", "B8", "UV", "Z2"]) {
    const dentro = [...par].filter((c) => ALFABETO.includes(c));
    assert.ok(dentro.length <= 1, `${par} está entero en el alfabeto: ${dentro.join("")}`);
  }
});

test("el alfabeto no repite letras", () => {
  assert.equal(new Set(ALFABETO).size, ALFABETO.length);
});

test("caben suficientes códigos como para no chocar", () => {
  // Con menos de cien millones habría que empezar a preocuparse por repetidos.
  assert.ok(CUANTOS_CABEN > 100_000_000, String(CUANTOS_CABEN));
});

test("un código nuevo tiene el largo y solo usa el alfabeto", () => {
  for (let i = 0; i < 200; i++) {
    const c = nuevoCodigo();
    assert.equal(c.length, LARGO);
    for (const letra of c) assert.ok(ALFABETO.includes(letra), `${c} trae ${letra}`);
  }
});

test("con un azar fijo el código es el mismo, para poder probarlo", () => {
  assert.equal(nuevoCodigo(() => 0), ALFABETO[0]!.repeat(LARGO));
});

test("un azar que devuelve 1 no se sale del alfabeto", () => {
  const c = nuevoCodigo(() => 1);
  assert.equal(c, ALFABETO[ALFABETO.length - 1]!.repeat(LARGO));
});

/* ------------------------------------------------------- leerlo y escribirlo */

test("se acepta en minúsculas, con espacios y con guion", () => {
  const bueno = nuevoCodigo(() => 0);
  assert.equal(normalizarCodigo(bueno.toLowerCase()), bueno);
  assert.equal(normalizarCodigo(` ${bueno.slice(0, 3)}-${bueno.slice(3)} `), bueno);
});

test("las confusiones de siempre se corrigen en vez de rechazarse", () => {
  // Quien dicta "JOTA" y quien escribe "1" están queriendo decir lo mismo.
  assert.equal(normalizarCodigo("IJJJJJ"), "JJJJJJ");
  assert.equal(normalizarCodigo("1JJJJJ"), "JJJJJJ");
  assert.equal(normalizarCodigo("LJJJJJ"), "JJJJJJ");
  assert.equal(normalizarCodigo("O99999"), "Q99999");
  assert.equal(normalizarCodigo("099999"), "Q99999");
  assert.equal(normalizarCodigo("S99999"), "999999");
  assert.equal(normalizarCodigo("B66666"), "666666");
  assert.equal(normalizarCodigo("U99999"), "W99999");
});

test("un código de otro largo no pasa", () => {
  assert.equal(normalizarCodigo("ACD"), null);
  assert.equal(normalizarCodigo("ACDEFGH"), null);
  assert.equal(normalizarCodigo(""), null);
});

test("algo que no es un código no pasa", () => {
  assert.equal(normalizarCodigo("hola!!"), null);
  assert.equal(normalizarCodigo("ÁCDEFG"), null);
});

test("normalizar dos veces da lo mismo que normalizar una", () => {
  const una = normalizarCodigo("io-1s0u")!;
  assert.equal(normalizarCodigo(una), una);
});

test("se muestra partido por la mitad, que es como se dicta", () => {
  assert.equal(comoSeMuestra("ACDEFG"), "ACD-EFG");
});

/* --------------------------------------------------------- abierta y cerrada */

const ahora = new Date("2026-09-01T15:00:00Z");
const haceHoras = (h: number) => new Date(ahora.getTime() - h * 3_600_000).toISOString();

test("una sala recién abierta deja entrar", () => {
  assert.equal(sePuedeEntrar({ abierta: true, abierta_en: haceHoras(1) }, ahora), true);
});

test("una sala cerrada a mano no deja entrar, por reciente que sea", () => {
  assert.equal(sePuedeEntrar({ abierta: false, abierta_en: haceHoras(0.1) }, ahora), false);
});

test("el código deja de servir cuando pasa el rato", () => {
  assert.equal(sePuedeEntrar({ abierta: true, abierta_en: haceHoras(HORAS_ABIERTA - 1) }, ahora), true);
  assert.equal(sePuedeEntrar({ abierta: true, abierta_en: haceHoras(HORAS_ABIERTA + 1) }, ahora), false);
});

test("una sala sin fecha de apertura no deja entrar", () => {
  assert.equal(sePuedeEntrar({ abierta: true, abierta_en: null }, ahora), false);
  assert.equal(sePuedeEntrar({ abierta: true, abierta_en: "cualquier cosa" }, ahora), false);
});

test("dice cuánta gente entró, en singular y en plural", () => {
  const abierta = { abierta: true, abierta_en: haceHoras(1) };
  assert.equal(comoEsta(abierta, 0, ahora), "Sala abierta. Todavía no entra nadie.");
  assert.equal(comoEsta(abierta, 1, ahora), "Sala abierta. Una persona entró.");
  assert.equal(comoEsta(abierta, 24, ahora), "Sala abierta. 24 personas entraron.");
});

test("una sala cerrada dice cuántos alcanzaron a entrar", () => {
  const cerrada = { abierta: false, abierta_en: haceHoras(1) };
  assert.equal(comoEsta(cerrada, 0, ahora), "La sala está cerrada.");
  assert.equal(comoEsta(cerrada, 1, ahora), "La sala está cerrada. Una persona alcanzó a entrar.");
  assert.equal(comoEsta(cerrada, 24, ahora), "La sala está cerrada. 24 personas alcanzaron a entrar.");
});
