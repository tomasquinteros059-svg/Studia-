import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUANTAS_POR_DEFECTO, cuantasPedir, leerFichas, leerPreguntas, promptFichas,
  promptQuiz, suficientes, suficientesFichas,
} from "./quiz-nucleo.ts";

const CTX = {
  asignatura: "Cálculo I", codigo: "MAT1610", tema: "Integrales",
  materiales: ["Integración por partes", "Integrales impropias"],
  texto: "", cuantas: 5,
};

// ── El prompt ───────────────────────────────────────────────────────────

test("el prompt nombra el ramo, el tema y el material", () => {
  const p = promptQuiz(CTX);
  assert.match(p, /Cálculo I \(MAT1610\)/);
  assert.match(p, /«Integrales»/);
  assert.match(p, /- Integración por partes/);
  assert.match(p, /5 preguntas/);
});

test("sin lecturas se le dice que no invente contenido del ramo", () => {
  assert.match(promptQuiz(CTX), /No inventes contenido específico del ramo/);
});

test("con lecturas se las manda, y recortadas si son enormes", () => {
  const p = promptQuiz({ ...CTX, texto: "x".repeat(50_000) });
  assert.match(p, /Contenido de las lecturas/);
  assert.ok(p.length < 40_000, `el prompt salió de ${p.length}`);
});

// ── Leer lo que devolvió el modelo ──────────────────────────────────────

const BUENA = {
  pregunta: "¿Qué técnica conviene para ∫ x·eˣ dx?",
  opciones: ["Sustitución simple", "Por partes", "Fracciones parciales", "Sustitución trigonométrica"],
  correcta: 1,
  explicacion: "Un polinomio por una exponencial pide por partes: derivas el polinomio.",
};

test("un arreglo limpio se lee tal cual", () => {
  assert.deepEqual(leerPreguntas(JSON.stringify([BUENA])), [BUENA]);
});

test("se tolera el bloque de código, que el modelo pone igual", () => {
  const texto = "```json\n" + JSON.stringify([BUENA]) + "\n```";
  assert.equal(leerPreguntas(texto).length, 1);
});

test("se tolera una frase de cortesía antes del arreglo", () => {
  const texto = `Claro, acá van las preguntas:\n${JSON.stringify([BUENA])}`;
  assert.equal(leerPreguntas(texto).length, 1);
});

test("se tolera que venga envuelto en un objeto", () => {
  assert.equal(leerPreguntas(JSON.stringify({ preguntas: [BUENA] })).length, 1);
});

test("una respuesta que no es JSON no revienta: devuelve nada", () => {
  for (const basura of ["", "no sé responder eso", "{", "null", "42"]) {
    assert.deepEqual(leerPreguntas(basura), [], basura);
  }
});

// ── Lo que se descarta, que es lo importante ────────────────────────────

test("una pregunta sin cuatro alternativas se descarta", () => {
  const tres = { ...BUENA, opciones: ["a", "b", "c"] };
  const cinco = { ...BUENA, opciones: ["a", "b", "c", "d", "e"] };
  assert.deepEqual(leerPreguntas(JSON.stringify([tres, cinco])), []);
});

test("un índice que no apunta a ninguna alternativa se descarta", () => {
  for (const correcta of [-1, 4, 1.5, "dos"]) {
    assert.deepEqual(leerPreguntas(JSON.stringify([{ ...BUENA, correcta }])), [],
      `correcta = ${String(correcta)}`);
  }
});

test("un índice escrito como texto sí se acepta: el modelo lo hace igual", () => {
  assert.equal(leerPreguntas(JSON.stringify([{ ...BUENA, correcta: "1" }]))[0]?.correcta, 1);
});

test("sin índice se descarta, que es el caso que haría mentir al quiz", () => {
  // `Number(null)` es cero, y cero es un índice válido: sin esto, una pregunta
  // a la que el modelo se le olvidó marcar la correcta pasaría diciendo que la
  // respuesta buena es la A.
  for (const correcta of [null, undefined, ""]) {
    assert.deepEqual(leerPreguntas(JSON.stringify([{ ...BUENA, correcta }])), [],
      `correcta = ${String(correcta)}`);
  }
});

test("dos alternativas iguales se descartan: habría dos correctas o ninguna", () => {
  const repetida = { ...BUENA, opciones: ["Por partes", "por partes", "c", "d"] };
  assert.deepEqual(leerPreguntas(JSON.stringify([repetida])), []);
});

test("una alternativa vacía se descarta", () => {
  const vacia = { ...BUENA, opciones: ["a", "", "c", "d"] };
  assert.deepEqual(leerPreguntas(JSON.stringify([vacia])), []);
});

test("sin enunciado o sin explicación se descarta", () => {
  assert.deepEqual(leerPreguntas(JSON.stringify([{ ...BUENA, pregunta: "¿?" }])), []);
  assert.deepEqual(leerPreguntas(JSON.stringify([{ ...BUENA, explicacion: "" }])), []);
});

test("lo malo se descarta y lo bueno se queda: no se pierde el quiz entero", () => {
  const mala = { ...BUENA, correcta: 9 };
  const otra = { ...BUENA, pregunta: "¿Converge ∫₁^∞ 1/x² dx?" };
  const leidas = leerPreguntas(JSON.stringify([BUENA, mala, otra]));
  assert.equal(leidas.length, 2);
  assert.equal(leidas[1]?.pregunta, "¿Converge ∫₁^∞ 1/x² dx?");
});

test("los espacios de más se limpian al leer", () => {
  const suelta = { ...BUENA, pregunta: "  ¿Qué técnica conviene?  ", opciones: [" a1 ", "b2", "c3", "d4"] };
  const leida = leerPreguntas(JSON.stringify([suelta]))[0];
  assert.equal(leida?.pregunta, "¿Qué técnica conviene?");
  assert.equal(leida?.opciones[0], "a1");
});

// ── Cuántas ─────────────────────────────────────────────────────────────

test("la cantidad pedida se acota a algo que alguien termine", () => {
  assert.equal(cuantasPedir(5), 5);
  assert.equal(cuantasPedir(1), 3);
  assert.equal(cuantasPedir(99), 8);
  assert.equal(cuantasPedir("cuatro"), CUANTAS_POR_DEFECTO);
  assert.equal(cuantasPedir(undefined), CUANTAS_POR_DEFECTO);
});

test("con menos de tres preguntas sanas no hay quiz que valga", () => {
  assert.equal(suficientes([BUENA, BUENA]), false);
  assert.equal(suficientes([BUENA, BUENA, BUENA]), true);
});

// ── Las fichas ──────────────────────────────────────────────────────────

test("el prompt de fichas pide memoria, no desarrollo", () => {
  const p = promptFichas({ ...CTX, cuantas: 10 });
  assert.match(p, /10 fichas/);
  assert.match(p, /de memoria/);
  assert.match(p, /Nada de preguntas que necesiten desarrollar/);
  assert.match(p, /«Integrales»/);
});

const FICHA = { pregunta: "¿Fórmula de integración por partes?", respuesta: "∫u dv = uv − ∫v du" };

test("un arreglo de fichas limpio se lee tal cual", () => {
  assert.deepEqual(leerFichas(JSON.stringify([FICHA])), [FICHA]);
});

test("una ficha sin respuesta se descarta: no es media ficha", () => {
  assert.deepEqual(leerFichas(JSON.stringify([{ ...FICHA, respuesta: "" }])), []);
  assert.deepEqual(leerFichas(JSON.stringify([{ ...FICHA, pregunta: "¿?" }])), []);
});

test("las que no cabrían en la tabla se descartan acá, no en la base", () => {
  assert.deepEqual(leerFichas(JSON.stringify([{ ...FICHA, pregunta: "¿".repeat(301) }])), []);
  assert.deepEqual(leerFichas(JSON.stringify([{ ...FICHA, respuesta: "x".repeat(601) }])), []);
});

test("dos fichas con la misma pregunta son una ficha y una molestia", () => {
  const leidas = leerFichas(JSON.stringify([
    FICHA, { ...FICHA, pregunta: FICHA.pregunta.toUpperCase(), respuesta: "otra cosa" },
  ]));
  assert.equal(leidas.length, 1);
});

test("con menos de cuatro fichas no vale la pena un mazo", () => {
  assert.equal(suficientesFichas([FICHA, FICHA, FICHA]), false);
  assert.equal(suficientesFichas([FICHA, FICHA, FICHA, FICHA]), true);
});
