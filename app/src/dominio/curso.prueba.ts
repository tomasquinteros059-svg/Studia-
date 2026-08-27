import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aprobacion, distribucion, estadoDeTarea, faltanNota, porRevisar,
  promedioDelCurso, puedeCorregir, puedePublicarNotas, sinPublicar,
  type EntregaDeCurso, type NotaDeCurso,
} from "./curso.ts";

const entrega = (e: Partial<EntregaDeCurso> & { id: string }): EntregaDeCurso => ({
  tarea_id: "t1", estudiante_id: e.id, estudiante: e.id,
  entregado_en: "2026-08-20T10:00:00Z", puntos_obtenidos: null, ...e,
});

const nota = (n: number | null, publicada = false, quien = "alguien"): NotaDeCurso => ({
  evaluacion_id: "e1", estudiante_id: quien, estudiante: quien, nota: n, publicada,
});

// ── Entregas ────────────────────────────────────────────────────────────

test("por revisar son las entregadas sin puntaje", () => {
  const lista = porRevisar([
    entrega({ id: "a" }),
    entrega({ id: "b", puntos_obtenidos: 18 }),
    entrega({ id: "c", entregado_en: null }),
  ]);
  assert.deepEqual(lista.map((x) => x.id), ["a"]);
});

test("las más antiguas se corrigen primero", () => {
  const lista = porRevisar([
    entrega({ id: "nueva", entregado_en: "2026-08-25T10:00:00Z" }),
    entrega({ id: "vieja", entregado_en: "2026-08-20T10:00:00Z" }),
  ]);
  assert.deepEqual(lista.map((x) => x.id), ["vieja", "nueva"]);
});

test("un puntaje de cero cuenta como corregida", () => {
  // Cero es una nota, no un vacío: si esto se compara con falsy, la entrega
  // corregida con cero vuelve a la fila de trabajo para siempre.
  assert.deepEqual(porRevisar([entrega({ id: "a", puntos_obtenidos: 0 })]), []);
});

test("el estado de una tarea cuenta lo entregado y lo que falta", () => {
  const e = estadoDeTarea([
    entrega({ id: "a", puntos_obtenidos: 18 }),
    entrega({ id: "b" }),
    entrega({ id: "c", entregado_en: null }),
  ], 20);
  assert.deepEqual(e, { entregadas: 2, corregidas: 1, porRevisar: 1, sinEntregar: 18, inscritos: 20 });
});

test("si entregaron más de los inscritos, lo que falta es cero y no negativo", () => {
  const e = estadoDeTarea([entrega({ id: "a" }), entrega({ id: "b" })], 1);
  assert.equal(e.sinEntregar, 0);
});

test("una tarea sin entregas no rompe la cuenta", () => {
  assert.deepEqual(estadoDeTarea([], 20),
    { entregadas: 0, corregidas: 0, porRevisar: 0, sinEntregar: 20, inscritos: 20 });
});

// ── Notas ───────────────────────────────────────────────────────────────

test("el promedio ignora a quien no tiene nota", () => {
  assert.equal(promedioDelCurso([nota(4.0), nota(6.0), nota(null)]), 5);
});

test("el promedio se redondea a una décima", () => {
  assert.equal(promedioDelCurso([nota(4.1), nota(4.2), nota(4.4)]), 4.2);
});

test("sin ninguna nota puesta no hay promedio", () => {
  assert.equal(promedioDelCurso([nota(null), nota(null)]), null);
  assert.equal(promedioDelCurso([]), null);
});

test("aprueba desde 4,0 exacto", () => {
  assert.deepEqual(aprobacion([nota(3.9), nota(4.0), nota(4.1)]), { aprobados: 2, conNota: 3 });
});

test("la distribución reparte por tramo", () => {
  const d = distribucion([nota(1.5), nota(4.0), nota(4.9), nota(6.5)]);
  assert.deepEqual(d.map((t) => t.cuantos), [1, 0, 0, 2, 0, 1]);
});

test("el siete cae en el último tramo y no se pierde", () => {
  const d = distribucion([nota(7.0)]);
  assert.equal(d[5]!.cuantos, 1);
  assert.equal(d.reduce((n, t) => n + t.cuantos, 0), 1);
});

test("el uno cae en el primer tramo", () => {
  assert.equal(distribucion([nota(1.0)])[0]!.cuantos, 1);
});

test("la distribución no cuenta a quien no tiene nota", () => {
  assert.equal(distribucion([nota(null), nota(5.0)]).reduce((n, t) => n + t.cuantos, 0), 1);
});

test("cuenta las notas puestas que el curso todavía no ve", () => {
  assert.equal(sinPublicar([nota(5.0, false), nota(6.0, true), nota(null, false)]), 1);
});

test("dice quiénes quedaron sin nota", () => {
  assert.deepEqual(faltanNota([nota(5.0, false, "Ana"), nota(null, false, "Bruno")]), ["Bruno"]);
});

// ── Quién puede qué ─────────────────────────────────────────────────────

test("publicar notas es del profesor", () => {
  assert.equal(puedePublicarNotas("profesor"), true);
  assert.equal(puedePublicarNotas("ayudante"), false);
});

test("corregir lo hacen los dos", () => {
  assert.equal(puedeCorregir("profesor"), true);
  assert.equal(puedeCorregir("ayudante"), true);
});
