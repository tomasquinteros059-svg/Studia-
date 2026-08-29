import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as propios from "./datos-propios.ts";
import * as demo from "./datos-demo.ts";
import { entrarComo, salir } from "./perfiles-demo.ts";

beforeEach(() => {
  propios.vaciarEspacioPropio();
  salir();
});

test("un ramo propio queda marcado como propio y con código propio", async () => {
  const ramo = await propios.crearRamoPropio("Estadística  aplicada ", "#208AEF");
  assert.equal(ramo.nombre, "Estadística aplicada");
  assert.equal(ramo.propio, true);
  assert.equal(ramo.codigo, "MIS-ESTADISTICA-APLICA");
  assert.equal(ramo.profesor, "Por tu cuenta");
});

test("el material escrito a mano se puede abrir en el lector", async () => {
  const ramo = await propios.crearRamoPropio("Repaso", "#208AEF");
  const moduloId = await propios.crearModulo(ramo.id, "Unidad 1");
  await propios.crearMaterial({
    moduloId, tipo: "documento", titulo: "Derivadas",
    detalle: "Lectura · 1 min", texto: "La derivada mide el cambio.",
  });

  const modulos = propios.modulosPropiosDe(ramo.id);
  const material = modulos[0]!.materiales[0]!;
  assert.equal(material.leible, true);

  const lectura = propios.lecturaPropiaDe(material.id);
  assert.equal(lectura?.texto, "La derivada mide el cambio.");
  assert.equal(lectura?.asignatura_nombre, "Repaso");
});

test("un material sin texto no es legible y no aparece en el lector", async () => {
  const ramo = await propios.crearRamoPropio("Repaso", "#208AEF");
  const moduloId = await propios.crearModulo(ramo.id, "Unidad 1");
  await propios.crearMaterial({
    moduloId, tipo: "video", titulo: "Clase grabada", detalle: "MP4 · 8,0 MB",
  });

  const material = propios.modulosPropiosDe(ramo.id)[0]!.materiales[0]!;
  assert.equal(material.leible, false);
  assert.equal(propios.lecturaPropiaDe(material.id), null);
});

test("borrar el ramo se lleva sus textos: no quedan legibles sueltos", async () => {
  const ramo = await propios.crearRamoPropio("Repaso", "#208AEF");
  const moduloId = await propios.crearModulo(ramo.id, "Unidad 1");
  await propios.crearMaterial({
    moduloId, tipo: "documento", titulo: "Derivadas", detalle: "", texto: "Algo.",
  });
  const materialId = propios.modulosPropiosDe(ramo.id)[0]!.materiales[0]!.id;

  await propios.borrarRamoPropio(ramo.id);
  assert.equal(propios.lecturaPropiaDe(materialId), null);
  assert.deepEqual(propios.modulosPropiosDe(ramo.id), []);
});

test("guardar material en una unidad que ya no existe avisa, no lo pierde en silencio", async () => {
  await assert.rejects(() => propios.crearMaterial({
    moduloId: "mod-inventado", tipo: "documento", titulo: "X", detalle: "",
  }));
});

/* Cómo se ve desde la fachada, que es lo que usan las pantallas. */

test("quien no tiene institución empieza con todo vacío", async () => {
  entrarComo("p-sofia");
  assert.deepEqual(await demo.misAsignaturas(), []);
  assert.deepEqual(await demo.miHorario(), []);
  assert.deepEqual(await demo.misTareas(), []);
  assert.deepEqual(await demo.misNotificaciones(), []);
  assert.equal(await demo.claseEnVivo(), null);
  assert.equal((await demo.todasLasEvaluaciones()).size, 0);
});

test("su ramo propio sí aparece, y es el único", async () => {
  entrarComo("p-sofia");
  await demo.crearRamoPropio("Inglés", "#1E8E5A");

  const ramos = await demo.misAsignaturas();
  assert.equal(ramos.length, 1);
  assert.equal(ramos[0]!.propio, true);
});

test("quien sí tiene institución ve los seis del colegio más los suyos", async () => {
  entrarComo("p-eduardo");
  await demo.crearRamoPropio("Inglés", "#1E8E5A");

  const ramos = await demo.misAsignaturas();
  assert.equal(ramos.length, 7);
  assert.equal(ramos.filter((r) => r.propio).length, 1);
  // Los del colegio van primero: la lista no se reordena por agregar uno propio.
  assert.equal(ramos[0]!.propio, false);
});

test("la materia de un ramo propio sale por la misma consulta que la del colegio", async () => {
  entrarComo("p-sofia");
  const ramo = await demo.crearRamoPropio("Inglés", "#1E8E5A");
  const moduloId = await demo.crearModulo(ramo.id, "Mi material");
  await demo.crearMaterial({
    moduloId, tipo: "documento", titulo: "Phrasal verbs", detalle: "Lectura · 2 min",
    texto: "Look up means to search.",
  });

  const modulos = await demo.materiaDe(ramo.id);
  assert.equal(modulos.length, 1);
  const material = modulos[0]!.materiales[0]!;
  assert.equal(material.titulo, "Phrasal verbs");

  const lectura = await demo.lecturaPorId(material.id);
  assert.equal(lectura?.titulo, "Phrasal verbs");
});

// ── Dónde cae un material que se sube sin elegir unidad ─────────────────

test("el primer material crea la unidad solo: nadie tiene que inventarla", async () => {
  const ramo = await propios.crearRamoPropio("Inglés", "#2563C9");
  const moduloId = await propios.moduloParaMaterial(ramo.id);

  const modulos = propios.modulosPropiosDe(ramo.id);
  assert.equal(modulos.length, 1);
  assert.equal(modulos[0]!.id, moduloId);
  assert.equal(modulos[0]!.titulo, "Mi material");
});

test("subir varios materiales no llena el ramo de unidades repetidas", async () => {
  const ramo = await propios.crearRamoPropio("Inglés", "#2563C9");

  const primera = await propios.moduloParaMaterial(ramo.id);
  const segunda = await propios.moduloParaMaterial(ramo.id);
  const tercera = await propios.moduloParaMaterial(ramo.id);

  assert.equal(primera, segunda);
  assert.equal(segunda, tercera);
  assert.equal(propios.modulosPropiosDe(ramo.id).length, 1);
});

test("si el ramo ya tenía una unidad, el material entra ahí", async () => {
  const ramo = await propios.crearRamoPropio("Inglés", "#2563C9");
  const mia = await propios.crearModulo(ramo.id, "Unidad 1 · Verbos");

  assert.equal(await propios.moduloParaMaterial(ramo.id), mia);
  assert.equal(propios.modulosPropiosDe(ramo.id).length, 1);
});
