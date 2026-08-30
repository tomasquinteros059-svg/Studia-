import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUANTAS_SUGERENCIAS, acortar, fallasDelUltimoQuiz, sugerenciasDe,
} from "./sugerencias.ts";

const NADA = { fallas: [], pendientes: [], temas: [] };

// ── Recortar ────────────────────────────────────────────────────────────

test("un título corto se deja como está", () => {
  assert.equal(acortar("Integrales impropias"), "Integrales impropias");
});

test("uno largo se corta por un espacio, no a la mitad de una palabra", () => {
  const largo = "El teorema fundamental del cálculo y sus consecuencias inmediatas";
  const corto = acortar(largo);
  assert.ok(corto.length <= 47, corto);
  assert.match(corto, /…$/);
  assert.ok(!corto.includes("consecue…"), `partió una palabra: ${corto}`);
});

test("una sola palabra kilométrica se corta igual, aunque quede fea", () => {
  // Sin esto, un título sin espacios se devolvería entero y rompería la línea.
  const corto = acortar("a".repeat(80));
  assert.ok(corto.length <= 47, corto);
});

test("los espacios de más se aplastan antes de medir", () => {
  assert.equal(acortar("  Límites   y  continuidad "), "Límites y continuidad");
});

// ── Qué se ofrece ───────────────────────────────────────────────────────

test("sin nada que decir, ofrece las dos de fondo y nunca promete la respuesta", () => {
  const s = sugerenciasDe(NADA);
  assert.deepEqual(s, ["No entendí la clase de hoy", "Ponme un ejercicio para practicar"]);
  for (const x of s) {
    assert.doesNotMatch(x, /resuélve|dame la (solución|respuesta)|hazme la tarea/i);
  }
});

test("lo comprobado va primero: el error del quiz antes que todo lo demás", () => {
  const s = sugerenciasDe({
    fallas: [{ pregunta: "¿Converge ∫₁^∞ 1/x² dx?", tema: "Integrales" }],
    pendientes: [{ titulo: "Tarea 3", vence_en: "2026-09-04T23:59:00Z" }],
    temas: [{ titulo: "Integrales impropias" }],
  });
  assert.deepEqual(s, [
    "¿Por qué me equivoqué en «¿Converge ∫₁^∞ 1/x² dx?»?",
    "¿Cómo parto «Tarea 3»?",
    "Explícame «Integrales impropias»",
  ]);
});

test("de las tareas se ofrece la que vence primero", () => {
  const s = sugerenciasDe({
    ...NADA,
    pendientes: [
      { titulo: "La lejana", vence_en: "2026-09-20T23:59:00Z" },
      { titulo: "La de mañana", vence_en: "2026-09-01T23:59:00Z" },
    ],
  });
  assert.equal(s[0], "¿Cómo parto «La de mañana»?");
});

test("no se ofrecen tres errores seguidos: eso se lee como un reproche", () => {
  const s = sugerenciasDe({
    fallas: [
      { pregunta: "Una", tema: "T" }, { pregunta: "Dos", tema: "T" }, { pregunta: "Tres", tema: "T" },
    ],
    pendientes: [], temas: [],
  });
  assert.equal(s.filter((x) => x.startsWith("¿Por qué me equivoqué")).length, 1);
  assert.equal(s.length, CUANTAS_SUGERENCIAS);
});

test("nunca más de tres, aunque haya de todo", () => {
  const s = sugerenciasDe({
    fallas: [{ pregunta: "Una", tema: "T" }],
    pendientes: [{ titulo: "T3", vence_en: "2026-09-04T00:00:00Z" }],
    temas: [{ titulo: "Tema 1" }, { titulo: "Tema 2" }],
  });
  assert.equal(s.length, 3);
});

test("los títulos largos llegan recortados a la sugerencia", () => {
  const s = sugerenciasDe({
    ...NADA,
    temas: [{ titulo: "Sustitución trigonométrica y sus casos particulares en integrales" }],
  });
  assert.match(s[0] ?? "", /^Explícame «.{1,50}…»$/);
});

// ── De qué quiz salen los errores ───────────────────────────────────────

const quiz = (
  id: string, asignatura: string, creado: string, terminado: string | null,
  respuestas: (number | null)[],
) => ({
  asignatura_id: asignatura, tema: `tema de ${id}`, creado_en: creado, terminado_en: terminado,
  preguntas: [
    { pregunta: `${id}·A`, correcta: 1 },
    { pregunta: `${id}·B`, correcta: 0 },
  ],
  respuestas,
});

test("las fallas salen del último quiz terminado de ese ramo", () => {
  const f = fallasDelUltimoQuiz([
    quiz("viejo", "cal", "2026-08-01T10:00:00Z", "2026-08-01T11:00:00Z", [0, 3]),
    quiz("nuevo", "cal", "2026-08-20T10:00:00Z", "2026-08-20T11:00:00Z", [1, 3]),
  ], "cal");
  assert.deepEqual(f.map((x) => x.pregunta), ["nuevo·B"]);
});

test("un quiz a medias no cuenta: todavía no se sabe cómo le fue", () => {
  assert.deepEqual(fallasDelUltimoQuiz([
    quiz("aMedias", "cal", "2026-08-20T10:00:00Z", null, [0, null]),
  ], "cal"), []);
});

test("los quices de otro ramo no se miran", () => {
  assert.deepEqual(fallasDelUltimoQuiz([
    quiz("otro", "fis", "2026-08-20T10:00:00Z", "2026-08-20T11:00:00Z", [0, 3]),
  ], "cal"), []);
});

test("un quiz perfecto no deja nada que ofrecer", () => {
  assert.deepEqual(fallasDelUltimoQuiz([
    quiz("perfecto", "cal", "2026-08-20T10:00:00Z", "2026-08-20T11:00:00Z", [1, 0]),
  ], "cal"), []);
});

test("no responder cuenta como fallar: quedó sin saberse", () => {
  const f = fallasDelUltimoQuiz([
    quiz("q", "cal", "2026-08-20T10:00:00Z", "2026-08-20T11:00:00Z", [null, 0]),
  ], "cal");
  assert.deepEqual(f.map((x) => x.pregunta), ["q·A"]);
});
