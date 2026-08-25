import { test } from "node:test";
import assert from "node:assert/strict";
import { cuandoVence, diasHasta, estadoDeTarea, ordenarTareas, type Tarea } from "./tareas.ts";

const AHORA = new Date("2026-08-25T15:00:00Z");
const enDias = (d: number) => new Date(AHORA.getTime() + d * 86_400_000).toISOString();
const tarea = (t: Partial<Tarea> & { id: string }): Tarea => ({
  titulo: t.id, vence_en: enDias(1), puntos: 10, ...t,
});

test("el estado sale de la fecha y de la entrega", () => {
  assert.equal(estadoDeTarea(tarea({ id: "a", vence_en: enDias(3) }), AHORA), "pendiente");
  assert.equal(estadoDeTarea(tarea({ id: "b", vence_en: enDias(-1) }), AHORA), "atrasada");
  assert.equal(
    estadoDeTarea(tarea({ id: "c", vence_en: enDias(-1), entregada_en: enDias(-2) }), AHORA),
    "entregada",
  );
});

test("una entrega a tiempo no queda atrasada aunque pase la fecha", () => {
  const t = tarea({ id: "d", vence_en: enDias(-5), entregada_en: enDias(-6) });
  assert.equal(estadoDeTarea(t, AHORA), "entregada");
});

test("los días se cuentan por fecha, no por horas", () => {
  // Faltan 10 horas para mañana, pero es mañana igual.
  assert.equal(diasHasta("2026-08-26T01:00:00Z", AHORA), 1);
  assert.equal(diasHasta("2026-08-25T23:59:00Z", AHORA), 0);
  assert.equal(diasHasta("2026-08-24T23:59:00Z", AHORA), -1);
});

test("el vencimiento se dice como lo diría un estudiante", () => {
  assert.equal(cuandoVence(tarea({ id: "a", vence_en: enDias(0) }), AHORA), "Hoy");
  assert.equal(cuandoVence(tarea({ id: "b", vence_en: enDias(1) }), AHORA), "Mañana");
  assert.equal(cuandoVence(tarea({ id: "c", vence_en: enDias(3) }), AHORA), "En 3 días");
  assert.equal(cuandoVence(tarea({ id: "d", vence_en: enDias(-2) }), AHORA), "Venció");
  assert.equal(
    cuandoVence(tarea({ id: "e", vence_en: enDias(-2), entregada_en: enDias(-3) }), AHORA),
    "Entregada",
  );
});

test("primero lo atrasado, después por urgencia, y lo entregado al final", () => {
  const orden = ordenarTareas([
    tarea({ id: "en-7-dias", vence_en: enDias(7) }),
    tarea({ id: "entregada-vieja", vence_en: enDias(-10), entregada_en: enDias(-10) }),
    tarea({ id: "manana", vence_en: enDias(1) }),
    tarea({ id: "atrasada", vence_en: enDias(-1) }),
    tarea({ id: "entregada-reciente", vence_en: enDias(-2), entregada_en: enDias(-2) }),
  ]).map((t) => t.id);

  assert.deepEqual(orden, [
    "atrasada", "manana", "en-7-dias", "entregada-reciente", "entregada-vieja",
  ]);
});

test("ordenar no muta la lista original", () => {
  const original = [tarea({ id: "b", vence_en: enDias(5) }), tarea({ id: "a", vence_en: enDias(1) })];
  const copia = [...original];
  ordenarTareas(original);
  assert.deepEqual(original, copia);
});

test("ordenar una lista vacía o de un elemento", () => {
  assert.deepEqual(ordenarTareas([]), []);
  const una = [tarea({ id: "sola" })];
  assert.equal(ordenarTareas(una).length, 1);
});
