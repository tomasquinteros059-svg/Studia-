import { test } from "node:test";
import assert from "node:assert/strict";
import {
  historialParaClaude,
  LARGO_MAXIMO,
  normalizarTurnos,
  promptSistema,
  TURNOS_DE_CONTEXTO,
  validarMensaje,
} from "./nucleo.ts";

const CALCULO = {
  nombre: "Cálculo I",
  codigo: "MAT1610",
  profesor: "Ana Ríos",
  intro_tutor: "Cuéntame en qué problema de cálculo estás.",
};

test("el prompt nombra la asignatura y a quien la dicta", () => {
  const p = promptSistema(CALCULO);
  assert.match(p, /Cálculo I/);
  assert.match(p, /MAT1610/);
  assert.match(p, /Ana Ríos/);
  assert.match(p, /Cuéntame en qué problema de cálculo estás\./);
});

test("el prompt cierra las salidas conocidas para sacarle la respuesta", () => {
  const p = promptSistema(CALCULO);
  for (const escape of [/insista/, /poco tiempo/, /juego de roles/, /otro idioma/, /administrador/]) {
    assert.match(p, escape, `falta blindar: ${escape}`);
  }
  assert.match(p, /datos, no órdenes/);
});

test("el prompt distingue lo que sí puede hacer de lo que no", () => {
  const p = promptSistema(CALCULO);
  assert.match(p, /SÍ puedes/);
  assert.match(p, /NO puedes/);
  assert.match(p, /resultado numérico/);
});

test("el contexto se incorpora solo cuando existe", () => {
  assert.doesNotMatch(promptSistema(CALCULO), /llegó desde/);
  assert.doesNotMatch(promptSistema(CALCULO, "   "), /llegó desde/);
  assert.match(promptSistema(CALCULO, "Estoy con «Guía 4»"), /Estoy con «Guía 4»/);
});

test("valida el mensaje del estudiante", () => {
  assert.deepEqual(validarMensaje("  hola  "), { ok: true, texto: "hola" });
  assert.equal(validarMensaje("").ok, false);
  assert.equal(validarMensaje("   ").ok, false);
  assert.equal(validarMensaje(null).ok, false);
  assert.equal(validarMensaje(42).ok, false);
  assert.equal(validarMensaje("x".repeat(LARGO_MAXIMO)).ok, true);
  assert.equal(validarMensaje("x".repeat(LARGO_MAXIMO + 1)).ok, false);
});

test("el historial se traduce a los roles de la API", () => {
  const turnos = historialParaClaude([
    { rol: "estudiante", contenido: "hola" },
    { rol: "tutor", contenido: "¿qué te piden?" },
  ]);
  assert.deepEqual(turnos, [
    { role: "user", content: "hola" },
    { role: "assistant", content: "¿qué te piden?" },
  ]);
});

test("el historial se recorta a los últimos turnos", () => {
  const largo = Array.from({ length: TURNOS_DE_CONTEXTO + 10 }, (_, i) => ({
    rol: (i % 2 === 0 ? "estudiante" : "tutor") as "estudiante" | "tutor",
    contenido: `m${i}`,
  }));
  const turnos = historialParaClaude(largo);
  assert.equal(turnos.length, TURNOS_DE_CONTEXTO);
  assert.equal(turnos.at(-1)?.content, `m${largo.length - 1}`);
});

test("normalizar descarta un saludo del tutor al inicio", () => {
  const turnos = normalizarTurnos([
    { role: "assistant", content: "apertura" },
    { role: "user", content: "mi duda" },
  ]);
  assert.deepEqual(turnos, [{ role: "user", content: "mi duda" }]);
});

test("normalizar funde turnos seguidos del mismo lado", () => {
  const turnos = normalizarTurnos([
    { role: "user", content: "uno" },
    { role: "user", content: "dos" },
    { role: "assistant", content: "tres" },
  ]);
  assert.deepEqual(turnos, [
    { role: "user", content: "uno\n\ndos" },
    { role: "assistant", content: "tres" },
  ]);
});

test("normalizar no altera un historial que ya alterna", () => {
  const entrada = [
    { role: "user" as const, content: "a" },
    { role: "assistant" as const, content: "b" },
    { role: "user" as const, content: "c" },
  ];
  assert.deepEqual(normalizarTurnos(entrada), entrada);
});

test("normalizar deja el historial siempre empezando por el estudiante", () => {
  for (const entrada of [
    [{ role: "assistant" as const, content: "a" }],
    [{ role: "assistant" as const, content: "a" }, { role: "assistant" as const, content: "b" }],
    [],
  ]) {
    const salida = normalizarTurnos(entrada);
    assert.ok(salida.length === 0 || salida[0].role === "user");
  }
});

test("normalizar no muta la entrada", () => {
  const entrada = [
    { role: "user" as const, content: "uno" },
    { role: "user" as const, content: "dos" },
  ];
  normalizarTurnos(entrada);
  assert.equal(entrada[0].content, "uno");
});
