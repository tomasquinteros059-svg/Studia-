import { test } from "node:test";
import assert from "node:assert/strict";
import { COLORES_DE_RAMO, colorDeRamo, inicialesDeRamo } from "./ramos.ts";

test("los colores son todos distintos y bien formados", () => {
  assert.equal(new Set(COLORES_DE_RAMO).size, COLORES_DE_RAMO.length);
  for (const c of COLORES_DE_RAMO) assert.match(c, /^#[0-9A-F]{6}$/i);
});

test("un color de la paleta se respeta tal cual", () => {
  assert.equal(colorDeRamo("cal", COLORES_DE_RAMO[0]), COLORES_DE_RAMO[0]);
});

test("un color de fuera de la paleta se reemplaza por uno de ella", () => {
  const c = colorDeRamo("cal", "#208AEF");
  assert.ok((COLORES_DE_RAMO as readonly string[]).includes(c), c);
});

test("sin color, o con basura, igual sale uno de la paleta", () => {
  for (const malo of [null, undefined, "", "azul", "#GGGGGG", "#12345", 42 as unknown as string]) {
    const c = colorDeRamo("cal", malo);
    assert.ok((COLORES_DE_RAMO as readonly string[]).includes(c), `${String(malo)} → ${c}`);
  }
});

test("el mismo ramo siempre recibe el mismo color", () => {
  assert.equal(colorDeRamo("fis"), colorDeRamo("fis"));
  assert.equal(colorDeRamo("fis", "roto"), colorDeRamo("fis", "otro roto"));
});

test("seis ramos no terminan todos del mismo color", () => {
  const asignados = new Set(["cal", "alg", "fis", "io", "mic", "pro"].map((i) => colorDeRamo(i)));
  assert.ok(asignados.size >= 4, `solo ${asignados.size} colores para seis ramos`);
});

/* ----------------------------------------------------------- iniciales */

test("las iniciales salen de las dos primeras palabras que importan", () => {
  assert.equal(inicialesDeRamo("Cálculo I"), "CI");
  assert.equal(inicialesDeRamo("Álgebra Lineal"), "ÁL");
  assert.equal(inicialesDeRamo("Investigación de Operaciones"), "IO");
});

test("las palabras menudas no cuentan", () => {
  assert.equal(inicialesDeRamo("Historia de la Ciencia"), "HC");
});

test("un nombre de una sola palabra usa sus dos primeras letras", () => {
  assert.equal(inicialesDeRamo("Microeconomía"), "MI");
  assert.equal(inicialesDeRamo("Programación"), "PR");
});

test("los signos no se cuelan en las iniciales", () => {
  assert.equal(inicialesDeRamo("Física I · Mecánica"), "FI");
  assert.equal(inicialesDeRamo("  Química   Orgánica  "), "QO");
});

test("un nombre sin letras no revienta", () => {
  assert.equal(inicialesDeRamo("!!!"), "?");
  assert.equal(inicialesDeRamo(""), "?");
});
