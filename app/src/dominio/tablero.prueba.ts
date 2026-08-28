import { test } from "node:test";
import assert from "node:assert/strict";
import {
  columnasDelTablero, filtrarApuntes, normalizar, ordenarTablero, vistaPrevia,
  type ApunteDeTablero,
} from "./tablero.ts";

const ap = (a: Partial<ApunteDeTablero> & { id: string }): ApunteDeTablero => ({
  titulo: a.id, contenido: "", fijado: false,
  actualizado_en: "2026-08-01T10:00:00Z", asignatura_id: "r1", ...a,
});

test("los fijados van primero", () => {
  const orden = ordenarTablero([
    ap({ id: "reciente", actualizado_en: "2026-08-25T10:00:00Z" }),
    ap({ id: "fijado-viejo", fijado: true, actualizado_en: "2026-01-01T10:00:00Z" }),
  ]).map((x) => x.id);
  assert.deepEqual(orden, ["fijado-viejo", "reciente"]);
});

test("dentro de cada grupo manda la fecha", () => {
  const orden = ordenarTablero([
    ap({ id: "f-viejo", fijado: true, actualizado_en: "2026-01-01T10:00:00Z" }),
    ap({ id: "n-viejo", actualizado_en: "2026-02-01T10:00:00Z" }),
    ap({ id: "f-nuevo", fijado: true, actualizado_en: "2026-08-01T10:00:00Z" }),
    ap({ id: "n-nuevo", actualizado_en: "2026-08-20T10:00:00Z" }),
  ]).map((x) => x.id);
  assert.deepEqual(orden, ["f-nuevo", "f-viejo", "n-nuevo", "n-viejo"]);
});

test("ordenar no muta la lista original", () => {
  const original = [ap({ id: "a" }), ap({ id: "b", fijado: true })];
  const copia = [...original];
  ordenarTablero(original);
  assert.deepEqual(original, copia);
});

test("buscar ignora acentos y mayúsculas", () => {
  assert.equal(normalizar("Cálculo I"), "calculo i");
  const apuntes = [ap({ id: "a", titulo: "Cálculo I" }), ap({ id: "b", titulo: "Física" })];
  assert.deepEqual(filtrarApuntes(apuntes, "calculo").map((x) => x.id), ["a"]);
  assert.deepEqual(filtrarApuntes(apuntes, "FISICA").map((x) => x.id), ["b"]);
});

test("buscar mira también el contenido", () => {
  const apuntes = [ap({ id: "a", titulo: "Clase 3", contenido: "teorema del valor medio" })];
  assert.equal(filtrarApuntes(apuntes, "valor").length, 1);
});

test("todas las palabras deben aparecer, en cualquier orden", () => {
  const apuntes = [
    ap({ id: "a", contenido: "el teorema del valor medio" }),
    ap({ id: "b", contenido: "solo el valor" }),
  ];
  assert.deepEqual(filtrarApuntes(apuntes, "medio valor").map((x) => x.id), ["a"]);
  assert.deepEqual(filtrarApuntes(apuntes, "valor").map((x) => x.id), ["a", "b"]);
});

test("una búsqueda vacía devuelve todo", () => {
  const apuntes = [ap({ id: "a" }), ap({ id: "b" })];
  assert.equal(filtrarApuntes(apuntes, "").length, 2);
  assert.equal(filtrarApuntes(apuntes, "   ").length, 2);
});

test("la vista previa no parte palabras por la mitad", () => {
  const largo = "palabra ".repeat(60);
  const previa = vistaPrevia(largo, 50);
  assert.ok(previa.length <= 51, previa);
  assert.ok(previa.endsWith("…"));
  assert.ok(!previa.includes("palab…"));
});

test("la vista previa colapsa saltos de línea", () => {
  assert.equal(vistaPrevia("uno\n\n  dos\ttres"), "uno dos tres");
});

test("un contenido corto pasa entero y sin puntos suspensivos", () => {
  assert.equal(vistaPrevia("corto"), "corto");
  assert.equal(vistaPrevia(""), "");
});

test("las columnas crecen con el ancho", () => {
  assert.equal(columnasDelTablero(400), 1);
  assert.equal(columnasDelTablero(700), 2);
  assert.equal(columnasDelTablero(1000), 3);
  assert.equal(columnasDelTablero(1400), 4);
});

test("el número de columnas nunca baja al crecer el ancho", () => {
  let previo = 0;
  for (let w = 300; w <= 1600; w += 20) {
    const c = columnasDelTablero(w);
    assert.ok(c >= previo, `en ${w} bajó de ${previo} a ${c}`);
    previo = c;
  }
});
