import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LARGO_MAXIMO, datosParaElPrompt, normalizarTurnos, promptAsistente,
  validarPregunta, type RamoResumido, type Turno,
} from "./asistente-nucleo.ts";

const RAMO: RamoResumido = {
  codigo: "MAT1610", nombre: "Cálculo I", inscritos: 20,
  tareas: ["Guía 4 · vence 2026-08-30 · 20 pts · entregaron 17 de 20 · 5 sin corregir"],
  evaluaciones: ["Control 1 · 20% · promedio 5,2 · aprueban 17 de 20 · 0 sin publicar"],
  rezagados: ["Josefa Pérez · 2 de 9 materiales · último hace 12 días"],
  horario: ["día 1 · 08:30 a 10:00 · A-201 · Cátedra"],
};

// ── El prompt ───────────────────────────────────────────────────────────

test("el prompt nombra a quien pregunta y su papel", () => {
  const p = promptAsistente("Ana Ríos", "profesor", [RAMO]);
  assert.match(p, /Ana Ríos/);
  assert.match(p, /profesora o profesor/);
});

test("al ayudante se le recuerda que no publica notas", () => {
  const p = promptAsistente("Ignacio Soto", "ayudante", [RAMO]);
  assert.match(p, /publicar notas es del profesor/i);
});

test("al profesor no se le mete la regla del ayudante", () => {
  const p = promptAsistente("Ana Ríos", "profesor", [RAMO]);
  assert.ok(!/Eres ayudante/.test(p));
});

test("la administración se nombra como el colegio y no como docente", () => {
  const p = promptAsistente("Secretaría", "administrador", []);
  assert.match(p, /administración académica/);
});

test("prohíbe inventar datos, en primer lugar", () => {
  const p = promptAsistente("Ana", "profesor", [RAMO]);
  assert.match(p, /REGLA PRIMERA: no inventas datos/);
  assert.match(p, /Nunca estimas un número/);
});

test("obliga a separar lo buscado en internet de lo del curso", () => {
  const p = promptAsistente("Ana", "profesor", [RAMO]);
  assert.match(p, /REGLA SEGUNDA/);
  assert.match(p, /Di de dónde viene lo que traes de una búsqueda/);
});

test("dice que el material privado del alumno no está, y por qué", () => {
  const p = promptAsistente("Ana", "profesor", [RAMO]);
  assert.match(p, /no tienes los apuntes de los alumnos/i);
  assert.match(p, /la base de datos no te lo entrega/);
});

test("separa el hecho de no entregar de la interpretación de no estudiar", () => {
  const p = promptAsistente("Ana", "profesor", [RAMO]);
  assert.match(p, /"no entregó" no es lo mismo que "no ha estudiado"/);
});

test("los datos del curso van al final, para que el resto se sirva de caché", () => {
  const p = promptAsistente("Ana", "profesor", [RAMO]);
  assert.ok(p.indexOf("DATOS DEL CURSO") > p.indexOf("REGLA PRIMERA"));
  assert.ok(p.trimEnd().endsWith("Cátedra"));
});

// ── Los datos ───────────────────────────────────────────────────────────

test("los datos traen cada sección del ramo", () => {
  const d = datosParaElPrompt([RAMO]);
  assert.match(d, /## Cálculo I \(MAT1610\) · 20 inscritos/);
  assert.match(d, /### Tareas/);
  assert.match(d, /### Evaluaciones/);
  assert.match(d, /### Quién viene quedándose atrás/);
  assert.match(d, /### Horario/);
});

test("una sección vacía dice que está vacía en vez de quedar en blanco", () => {
  // Si no dijera nada, el modelo leería el silencio como "no hay problema".
  const d = datosParaElPrompt([{ ...RAMO, rezagados: [], tareas: [] }]);
  assert.match(d, /Nadie: el curso viene al día/);
  assert.match(d, /Sin tareas publicadas/);
});

test("sin ramos lo dice explícitamente", () => {
  assert.match(datosParaElPrompt([]), /no tiene ramos asignados/);
});

test("deja claro que eso es todo lo que hay", () => {
  assert.match(datosParaElPrompt([RAMO]), /Es todo lo que tienes\. No hay más\./);
});

test("varios ramos salen separados", () => {
  const d = datosParaElPrompt([RAMO, { ...RAMO, codigo: "FIS1503", nombre: "Física I" }]);
  assert.match(d, /## Cálculo I/);
  assert.match(d, /## Física I/);
});

// ── La pregunta ─────────────────────────────────────────────────────────

test("una pregunta normal pasa, ya recortada", () => {
  const v = validarPregunta("  ¿quién no ha entregado?  ");
  assert.deepEqual(v, { ok: true, texto: "¿quién no ha entregado?" });
});

test("vacía, en blanco o de otro tipo se rechazan", () => {
  for (const malo of ["", "   ", 42, null, undefined, {}]) {
    assert.equal(validarPregunta(malo).ok, false, String(malo));
  }
});

test("una pregunta larguísima se rechaza con el límite en el mensaje", () => {
  const v = validarPregunta("a".repeat(LARGO_MAXIMO + 1));
  assert.equal(v.ok, false);
  if (!v.ok) assert.match(v.motivo, new RegExp(String(LARGO_MAXIMO)));
});

// ── Los turnos ──────────────────────────────────────────────────────────

const t = (role: Turno["role"], content: string): Turno => ({ role, content });

test("dos turnos seguidos del mismo lado se juntan", () => {
  const salida = normalizarTurnos([t("user", "hola"), t("user", "¿quién falta?")]);
  assert.equal(salida.length, 1);
  assert.equal(salida[0]!.content, "hola\n\n¿quién falta?");
});

test("el historial no puede empezar por el asistente", () => {
  const salida = normalizarTurnos([t("assistant", "hola"), t("user", "¿y?")]);
  assert.deepEqual(salida, [t("user", "¿y?")]);
});

test("los turnos vacíos se descartan", () => {
  assert.deepEqual(normalizarTurnos([t("user", "  "), t("user", "hola")]), [t("user", "hola")]);
});

test("una conversación que ya alterna queda igual", () => {
  const turnos = [t("user", "a"), t("assistant", "b"), t("user", "c")];
  assert.deepEqual(normalizarTurnos(turnos), turnos);
});

test("normalizar no modifica el arreglo que recibe", () => {
  const turnos = [t("user", "a"), t("user", "b")];
  normalizarTurnos(turnos);
  assert.equal(turnos.length, 2);
  assert.equal(turnos[0]!.content, "a");
});
