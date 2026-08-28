import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consejosDeEstudio, entregoAlFilo, estaAtrasada, HORAS_AL_FILO,
  type RamoDeHabito, type TareaDeHabito,
} from "./habitos.ts";

const AHORA = new Date("2026-08-25T15:00:00Z");
const enHoras = (h: number) => new Date(AHORA.getTime() + h * 3_600_000).toISOString();

const tarea = (t: Partial<TareaDeHabito> & { id: string }): TareaDeHabito => ({
  titulo: t.id, ramo: "Cálculo I", vence_en: enHoras(24), entregada_en: null, ...t,
});
const ramo = (r: Partial<RamoDeHabito> & { id: string }): RamoDeHabito => ({
  nombre: r.id, progreso: 60, nota: 5.5, apuntes: 2, ...r,
});
const claves = (c: { clave: string }[]) => c.map((x) => x.clave);

test("un ramo bajo 4,0 es lo primero que se avisa", () => {
  const c = consejosDeEstudio([], [ramo({ id: "io", nombre: "Investigación", nota: 3.4 })], AHORA);
  assert.equal(c[0]?.clave, "riesgo:io");
  assert.equal(c[0]?.tono, "alerta");
  assert.match(c[0]!.detalle, /3,4/);
});

test("un 4,0 justo no es riesgo", () => {
  const c = consejosDeEstudio([], [ramo({ id: "x", nota: 4.0 })], AHORA);
  assert.ok(!claves(c).some((k) => k.startsWith("riesgo")));
});

test("un ramo sin notas todavía no se marca como riesgo", () => {
  const c = consejosDeEstudio([], [ramo({ id: "x", nota: null })], AHORA);
  assert.ok(!claves(c).some((k) => k.startsWith("riesgo")));
});

test("las tareas atrasadas se nombran, no se cuentan nomás", () => {
  const c = consejosDeEstudio([
    tarea({ id: "a", titulo: "Guía 2", vence_en: enHoras(-30) }),
    tarea({ id: "b", titulo: "Informe", vence_en: enHoras(-5) }),
  ], [ramo({ id: "x" })], AHORA);
  const aviso = c.find((x) => x.clave === "atrasadas")!;
  assert.match(aviso.titulo, /2 tareas atrasadas/);
  assert.match(aviso.detalle, /«Guía 2»/);
  assert.match(aviso.detalle, /«Informe»/);
});

test("una sola atrasada se dice en singular", () => {
  const c = consejosDeEstudio([tarea({ id: "a", vence_en: enHoras(-2) })], [ramo({ id: "x" })], AHORA);
  assert.match(c.find((x) => x.clave === "atrasadas")!.titulo, /una tarea atrasada/);
});

test("una tarea entregada no cuenta como atrasada aunque venciera", () => {
  const t = tarea({ id: "a", vence_en: enHoras(-30), entregada_en: enHoras(-40) });
  assert.equal(estaAtrasada(t, AHORA), false);
  const c = consejosDeEstudio([t], [ramo({ id: "x" })], AHORA);
  assert.ok(!claves(c).includes("atrasadas"));
});

test("entregar sobre la hora se detecta, entregar antes no", () => {
  assert.equal(entregoAlFilo(tarea({ id: "a", vence_en: enHoras(0), entregada_en: enHoras(-1) })), true);
  assert.equal(entregoAlFilo(tarea({ id: "b", vence_en: enHoras(0), entregada_en: enHoras(-HORAS_AL_FILO) })), true);
  assert.equal(entregoAlFilo(tarea({ id: "c", vence_en: enHoras(0), entregada_en: enHoras(-48) })), false);
  assert.equal(entregoAlFilo(tarea({ id: "d", vence_en: enHoras(0), entregada_en: null })), false);
});

test("entregar tarde tampoco es «al filo»", () => {
  // Entregó después del plazo: eso es otro problema, no este consejo.
  assert.equal(entregoAlFilo(tarea({ id: "a", vence_en: enHoras(-5), entregada_en: enHoras(-1) })), false);
});

test("el consejo del filo necesita un patrón, no un caso suelto", () => {
  const alFilo = (id: string) => tarea({ id, vence_en: enHoras(-24), entregada_en: enHoras(-25) });
  // Dos entregas no alcanzan para hablar de costumbre.
  let c = consejosDeEstudio([alFilo("a"), alFilo("b")], [ramo({ id: "x" })], AHORA);
  assert.ok(!claves(c).includes("al_filo"));
  // Tres sí.
  c = consejosDeEstudio([alFilo("a"), alFilo("b"), alFilo("c")], [ramo({ id: "x" })], AHORA);
  assert.ok(claves(c).includes("al_filo"));
});

test("si entrega con antelación no se le reta", () => {
  const holgada = (id: string) => tarea({ id, vence_en: enHoras(-24), entregada_en: enHoras(-72) });
  const c = consejosDeEstudio([holgada("a"), holgada("b"), holgada("c")], [ramo({ id: "x" })], AHORA);
  assert.ok(!claves(c).includes("al_filo"));
});

test("detecta el ramo que se queda atrás del resto", () => {
  const c = consejosDeEstudio([], [
    ramo({ id: "a", progreso: 80 }), ramo({ id: "b", progreso: 75 }),
    ramo({ id: "c", nombre: "Física", progreso: 20 }),
  ], AHORA);
  const aviso = c.find((x) => x.clave === "rezagado:c")!;
  assert.match(aviso.titulo, /Física/);
  assert.match(aviso.detalle, /20%/);
});

test("ramos parejos no generan aviso de rezago", () => {
  const c = consejosDeEstudio([], [
    ramo({ id: "a", progreso: 60 }), ramo({ id: "b", progreso: 55 }), ramo({ id: "c", progreso: 50 }),
  ], AHORA);
  assert.ok(!claves(c).some((k) => k.startsWith("rezagado")));
});

test("con un solo ramo no se puede hablar de rezago", () => {
  const c = consejosDeEstudio([], [ramo({ id: "a", progreso: 5 })], AHORA);
  assert.ok(!claves(c).some((k) => k.startsWith("rezagado")));
});

test("avisa del ramo que se avanza sin dejar apuntes", () => {
  const c = consejosDeEstudio([], [ramo({ id: "a", nombre: "Álgebra", apuntes: 0, progreso: 60 })], AHORA);
  assert.ok(claves(c).includes("sin_apuntes:a"));
});

test("no reclama apuntes de un ramo que recién empieza", () => {
  const c = consejosDeEstudio([], [ramo({ id: "a", apuntes: 0, progreso: 10 })], AHORA);
  assert.ok(!claves(c).some((k) => k.startsWith("sin_apuntes")));
});

test("cuando todo va bien lo dice, en vez de callarse", () => {
  const c = consejosDeEstudio([tarea({ id: "a", entregada_en: enHoras(-72), vence_en: enHoras(-24) })],
    [ramo({ id: "a" }), ramo({ id: "b" })], AHORA);
  assert.deepEqual(claves(c), ["al_dia"]);
  assert.equal(c[0]?.tono, "bueno");
});

test("el «vas al día» no aparece si hay algo que avisar", () => {
  const c = consejosDeEstudio([tarea({ id: "a", vence_en: enHoras(-2) })], [ramo({ id: "x" })], AHORA);
  assert.ok(!claves(c).includes("al_dia"));
});

test("sin ramos no inventa consejos", () => {
  assert.deepEqual(consejosDeEstudio([], [], AHORA), []);
});

test("los consejos salen ordenados por urgencia", () => {
  const c = consejosDeEstudio(
    [tarea({ id: "a", vence_en: enHoras(-5) })],
    [ramo({ id: "r", nota: 3.0, apuntes: 0, progreso: 40 }), ramo({ id: "s", progreso: 90 })],
    AHORA,
  );
  const prioridades = c.map((x) => x.prioridad);
  assert.deepEqual(prioridades, [...prioridades].sort((a, b) => a - b));
  assert.equal(c[0]?.clave, "riesgo:r");
});

test("cada consejo trae título y detalle no vacíos", () => {
  const c = consejosDeEstudio(
    [tarea({ id: "a", vence_en: enHoras(-5) })],
    [ramo({ id: "r", nota: 2.5, apuntes: 0, progreso: 35 }), ramo({ id: "s", progreso: 95 })],
    AHORA,
  );
  assert.ok(c.length >= 3);
  for (const x of c) {
    assert.ok(x.titulo.trim().length > 0, x.clave);
    assert.ok(x.detalle.trim().length > 10, x.clave);
  }
});
