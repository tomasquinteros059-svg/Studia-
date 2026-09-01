import { test } from "node:test";
import assert from "node:assert/strict";
import { carpetaDe, nombreSeguro, rutaPara } from "./almacen.ts";

test("un nombre normal pasa igual", () => {
  assert.equal(nombreSeguro("guia-4.pdf"), "guia-4.pdf");
});

test("las tildes y la eñe se vuelven letras, no se pierden", () => {
  assert.equal(nombreSeguro("Cálculo mañana.pdf"), "Calculo-manana.pdf");
});

// La barra es la peligrosa: en una ruta significa «carpeta», y un archivo que
// se guarda una carpeta más adentro queda fuera de lo que la política deja ver.
test("una barra en el nombre no abre una carpeta", () => {
  assert.equal(nombreSeguro("tarea 3/4.pdf"), "tarea-3-4.pdf");
  assert.ok(!nombreSeguro("../../secreto.pdf").includes("/"));
});

test("un nombre que se queda en nada igual se llama de alguna manera", () => {
  assert.equal(nombreSeguro("..."), "archivo");
  assert.equal(nombreSeguro("   "), "archivo");
});

test("un nombre larguísimo se corta y no queda empezando en guion", () => {
  const n = nombreSeguro("a".repeat(200) + ".pdf");
  assert.ok(n.length <= 80);
  assert.doesNotMatch(n, /^[-.]/);
});

test("la carpeta es lo que mira el permiso", () => {
  assert.equal(carpetaDe({ tipo: "yo", personaId: "p-1" }), "yo/p-1");
  assert.equal(carpetaDe({ tipo: "ramo", asignaturaId: "r-9" }), "ramo/r-9");
  assert.equal(carpetaDe({ tipo: "entrega", tareaId: "t-3" }), "entrega/t-3");
});

// Una entrega no va al espacio propio aunque la suba un alumno: ahí quedaría
// fuera del alcance de quien tiene que corregirla, que es para lo que existe.
test("una entrega tiene su propia carpeta, distinta de la del alumno", () => {
  const entrega = rutaPara({ tipo: "entrega", tareaId: "t-3" }, "guia.pdf", "u");
  assert.match(entrega, /^entrega\/t-3\//);
  assert.ok(!entrega.startsWith("yo/"));
});

// Subir dos veces el mismo archivo tiene que dar dos archivos, no uno pisando
// al otro. Con el nombre delante, los dos se llamarían igual hasta el punto.
test("dos veces el mismo archivo dan dos rutas distintas", () => {
  const a = rutaPara({ tipo: "yo", personaId: "p-1" }, "apunte.pdf", "aaa");
  const b = rutaPara({ tipo: "yo", personaId: "p-1" }, "apunte.pdf", "bbb");
  assert.notEqual(a, b);
  assert.equal(a, "yo/p-1/aaa-apunte.pdf");
});

test("la ruta de un ramo empieza por su carpeta", () => {
  assert.match(rutaPara({ tipo: "ramo", asignaturaId: "r-9" }, "Guía 1.pdf", "u"), /^ramo\/r-9\//);
});
