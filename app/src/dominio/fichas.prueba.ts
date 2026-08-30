import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACIERTOS_PARA_SABIDA, alDia, contar, cuandoVuelve, enCuanto, toca, tocanAhora,
  type Ficha,
} from "./fichas.ts";

const AHORA = new Date(2026, 8, 1, 12, 0);
const dias = (n: number) => new Date(AHORA.getTime() + n * 86_400_000).toISOString();

const f = (id: string, extra: Partial<Ficha> = {}): Ficha => ({
  id, tema: "Integrales", pregunta: `¿${id}?`, respuesta: id,
  aciertos: 0, fallos: 0, vuelve_en: null, ...extra,
});

// ── Cuándo vuelve ───────────────────────────────────────────────────────

test("acertar la aleja cada vez más, hasta un techo", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map((a) => cuandoVuelve(a, true)),
    [1, 3, 7, 16, 35, 35, 35]);
});

test("fallar la trae de vuelta hoy, sin importar la racha", () => {
  for (const a of [0, 3, 9]) assert.equal(cuandoVuelve(a, false), 0);
});

test("el plazo se dice como lo diría alguien", () => {
  assert.equal(enCuanto(0), "hoy mismo");
  assert.equal(enCuanto(1), "mañana");
  assert.equal(enCuanto(3), "en 3 días");
  assert.equal(enCuanto(16), "en 2 semanas");
  assert.equal(enCuanto(35), "en 5 semanas");
});

// ── Cuáles tocan ────────────────────────────────────────────────────────

test("una ficha sin estrenar toca siempre", () => {
  assert.equal(toca(f("nueva"), AHORA), true);
});

test("una con fecha futura no toca; una vencida sí", () => {
  assert.equal(toca(f("a", { vuelve_en: dias(3) }), AHORA), false);
  assert.equal(toca(f("b", { vuelve_en: dias(-1) }), AHORA), true);
  // Justo ahora también cuenta: si no, se quedaría esperando un segundo más.
  assert.equal(toca(f("c", { vuelve_en: AHORA.toISOString() }), AHORA), true);
});

test("primero las sin estrenar, después las más atrasadas", () => {
  const orden = tocanAhora([
    f("atrasada1", { vuelve_en: dias(-1) }),
    f("futura", { vuelve_en: dias(5) }),
    f("nueva"),
    f("atrasada5", { vuelve_en: dias(-5) }),
  ], AHORA).map((x) => x.id);
  assert.deepEqual(orden, ["nueva", "atrasada5", "atrasada1"]);
});

test("a igual atraso, primero la que más se ha fallado", () => {
  const orden = tocanAhora([
    f("poco", { vuelve_en: dias(-2), fallos: 1 }),
    f("mucho", { vuelve_en: dias(-2), fallos: 6 }),
  ], AHORA).map((x) => x.id);
  assert.deepEqual(orden, ["mucho", "poco"]);
});

test("sin fichas no toca nada, y no revienta", () => {
  assert.deepEqual(tocanAhora([], AHORA), []);
});

// ── La cuenta ───────────────────────────────────────────────────────────

test("se cuenta cuántas tocan, cuántas hay y cuántas están asentadas", () => {
  const c = contar([
    f("nueva"),
    f("sabida", { aciertos: ACIERTOS_PARA_SABIDA, vuelve_en: dias(7) }),
    f("casi", { aciertos: 2, vuelve_en: dias(3) }),
  ], AHORA);
  assert.deepEqual(c, { tocan: 1, todas: 3, sabidas: 1 });
});

test("dos aciertos todavía no es sabérsela: pudo ser suerte", () => {
  assert.equal(contar([f("x", { aciertos: 2, vuelve_en: dias(3) })], AHORA).sabidas, 0);
});

// ── Qué se dice al terminar ─────────────────────────────────────────────

test("sin fichas se dice eso, no que terminaste", () => {
  assert.match(alDia({ tocan: 0, todas: 0, sabidas: 0 }), /Todavía no tienes fichas/);
});

test("con todas sabidas se dice que vuelven igual", () => {
  assert.match(alDia({ tocan: 0, todas: 5, sabidas: 5 }), /Te sabes las 5/);
});

test("con una sola no se dice «te sabes las 1»", () => {
  const t = alDia({ tocan: 0, todas: 1, sabidas: 1 });
  assert.equal(t, "Te la sabes. Vuelve sola cuando toque, para que no se te olvide.");
});

test("con algunas a medias se explica cómo vuelven", () => {
  const t = alDia({ tocan: 0, todas: 5, sabidas: 2 });
  assert.match(t, /las que fallaste vuelven antes/);
});
