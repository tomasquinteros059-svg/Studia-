import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MONEDAS, PLANES, agrupar, comoPrecio, monedaDeIdioma, monedaPorCodigo,
  precioDe, referencia,
} from "./precios.ts";

const clp = monedaPorCodigo("CLP");
const usd = monedaPorCodigo("USD");

// ── Los números ─────────────────────────────────────────────────────────

test("los miles se agrupan de a tres desde la derecha", () => {
  assert.equal(agrupar(14990, "."), "14.990");
  assert.equal(agrupar(999, "."), "999");
  assert.equal(agrupar(1000, "."), "1.000");
  assert.equal(agrupar(64900, "."), "64.900");
  assert.equal(agrupar(1234567, ","), "1,234,567");
  assert.equal(agrupar(0, "."), "0");
});

test("un precio se escribe con su símbolo pegado", () => {
  assert.equal(comoPrecio(14990, clp), "$14.990");
  assert.equal(comoPrecio(16, usd), "US$16");
  assert.equal(comoPrecio(15, monedaPorCodigo("EUR")), "€15");
  assert.equal(comoPrecio(59, monedaPorCodigo("PEN")), "S/59");
});

// ── De dónde es quien mira ──────────────────────────────────────────────

test("del idioma del aparato sale la moneda del país", () => {
  assert.equal(monedaDeIdioma("es-CL").codigo, "CLP");
  assert.equal(monedaDeIdioma("pt-BR").codigo, "BRL");
  assert.equal(monedaDeIdioma("es_MX").codigo, "MXN");
  assert.equal(monedaDeIdioma("en-US").codigo, "USD");
  assert.equal(monedaDeIdioma("es-ES").codigo, "EUR");
});

test("sin país no se adivina: queda el dólar, que se entiende como referencia", () => {
  for (const suelto of ["es", "en", "", undefined, null, "xx-YY"]) {
    assert.equal(monedaDeIdioma(suelto).codigo, "USD", String(suelto));
  }
});

test("una moneda que no existe cae al dólar en vez de reventar", () => {
  assert.equal(monedaPorCodigo("XYZ").codigo, "USD");
});

// ── La línea de referencia ──────────────────────────────────────────────

test("en pesos se dice a cuánto equivale", () => {
  assert.equal(referencia(clp), "equivale a US$16 al mes");
});

test("en dólares no se dice: «US$16 equivale a US$16» es ruido", () => {
  assert.equal(referencia(usd), null);
});

// ── Los planes ──────────────────────────────────────────────────────────

test("ninguna acción repite lo que ya dice el precio de su plan", () => {
  // «Conversemos» arriba y «Conversemos» abajo es la misma palabra dos veces
  // en cuatro centímetros.
  for (const plan of PLANES) {
    assert.notEqual(plan.accion.toLowerCase(), precioDe(plan, usd).toLowerCase());
  }
});

test("hay tres planes y solo uno viene destacado", () => {
  assert.equal(PLANES.length, 3);
  assert.equal(PLANES.filter((p) => p.destacado).length, 1);
  assert.equal(PLANES.find((p) => p.destacado)?.id, "personal");
});

test("el precio de cada plan se escribe en la moneda que se mira", () => {
  const [gratis, personal, institucion] = PLANES;
  assert.equal(precioDe(gratis!, clp), "$0");
  assert.equal(precioDe(personal!, clp), "$14.990");
  assert.equal(precioDe(personal!, usd), "US$16");
  assert.equal(precioDe(institucion!, clp), "Conversemos");
});

test("el gratis es el único que enumera lo que NO trae", () => {
  const sinEllo = PLANES.filter((p) => p.incluye.some((x) => !x.hay));
  assert.deepEqual(sinEllo.map((p) => p.id), ["gratis"]);
});

test("todas las monedas están bien formadas y no se repiten", () => {
  assert.equal(new Set(MONEDAS.map((m) => m.codigo)).size, MONEDAS.length);
  for (const m of MONEDAS) {
    assert.ok(m.personal > 0, m.codigo);
    assert.match(m.codigo, /^[A-Z]{3}$/);
    assert.ok(m.simbolo.length > 0 && m.nombre.length > 0, m.codigo);
  }
});
