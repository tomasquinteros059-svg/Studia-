import { test } from "node:test";
import assert from "node:assert/strict";
import {
  admiteDosPaneles, ANCHO_LECTURA, anchoDeContenido, clasificarAncho,
  columnasDeTarjetas, CORTE_AMPLIO, CORTE_MEDIO, muestraBarraDeSecciones,
} from "./disposicion.ts";

// Anchos reales, en puntos, de aparatos que la app va a ver.
const APARATOS = {
  "teléfono vertical": 390,
  "teléfono horizontal": 844,
  "tablet vertical": 834,
  "tablet horizontal": 1194,
  "tablet grande horizontal": 1366,
};

test("el teléfono en vertical siempre es compacto", () => {
  assert.equal(clasificarAncho(APARATOS["teléfono vertical"]), "compacto");
  assert.equal(columnasDeTarjetas(APARATOS["teléfono vertical"]), 1);
  assert.equal(admiteDosPaneles(APARATOS["teléfono vertical"]), false);
});

test("la tablet en vertical NO abre dos paneles", () => {
  // Tiene 834 puntos: alcanza para dos tarjetas, no para contenido y tutor.
  const ancho = APARATOS["tablet vertical"];
  assert.equal(admiteDosPaneles(ancho), false);
  assert.equal(columnasDeTarjetas(ancho), 2);
});

test("la tablet en horizontal sí abre dos paneles", () => {
  assert.equal(admiteDosPaneles(APARATOS["tablet horizontal"]), true);
  assert.equal(muestraBarraDeSecciones(APARATOS["tablet horizontal"]), true);
});

test("un teléfono grande de lado no se disfraza de tablet", () => {
  // 844 puntos: más que una tablet vertical en número, pero sin alto útil
  // para dos paneles. El corte en 900 lo deja fuera, que es lo correcto.
  assert.equal(admiteDosPaneles(APARATOS["teléfono horizontal"]), false);
});

test("las tarjetas crecen con el ancho y nunca decrecen", () => {
  let previo = 0;
  for (let w = 320; w <= 1600; w += 10) {
    const c = columnasDeTarjetas(w);
    assert.ok(c >= previo, `en ${w} bajó de ${previo} a ${c}`);
    assert.ok(c >= 1 && c <= 3, `${c} columnas en ${w}`);
    previo = c;
  }
});

test("la clasificación es continua en los cortes", () => {
  assert.equal(clasificarAncho(CORTE_MEDIO - 1), "compacto");
  assert.equal(clasificarAncho(CORTE_MEDIO), "medio");
  assert.equal(clasificarAncho(CORTE_AMPLIO - 1), "medio");
  assert.equal(clasificarAncho(CORTE_AMPLIO), "amplio");
});

test("el texto no se estira a lo ancho de una tablet", () => {
  assert.equal(anchoDeContenido(1366), ANCHO_LECTURA);
  assert.equal(anchoDeContenido(1194), ANCHO_LECTURA);
});

test("en un teléfono el límite de lectura no hace nada", () => {
  assert.equal(anchoDeContenido(390), 390);
  assert.equal(anchoDeContenido(844), 760);
});

test("ningún ancho produce un contenido más ancho que la pantalla", () => {
  for (let w = 280; w <= 1600; w += 7) {
    assert.ok(anchoDeContenido(w) <= w, `en ${w}`);
  }
});

test("las secciones se esconden tras el menú solo cuando no caben", () => {
  assert.equal(muestraBarraDeSecciones(APARATOS["teléfono vertical"]), false);
  assert.equal(muestraBarraDeSecciones(APARATOS["tablet vertical"]), false);
  assert.equal(muestraBarraDeSecciones(APARATOS["tablet horizontal"]), true);
});
