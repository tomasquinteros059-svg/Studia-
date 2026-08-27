import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANALISIS_VACIO, ESQUEMA_ANALISIS, fecha, leerAnalisis, promptEntiende,
  promptEscucha, promptRedacta, validarTranscripcion, type Reunion,
} from "./equipo-nucleo.ts";

const REUNION: Reunion = {
  titulo: "Asamblea extraordinaria",
  rubro: "Administración de edificios y condominios",
  fecha: "2026-09-01",
  participantes: ["Ana Ríos", "Pedro Soto"],
  tabla: ["Ascensores", "Gastos comunes", "Renovación del seguro"],
};

const SIN_DATOS: Reunion = { ...REUNION, participantes: [], tabla: [] };

/* --------------------------------------------------------------- prompts */

test("quien escucha recibe los nombres anotados, si los hay", () => {
  const p = promptEscucha("Transcribe.", REUNION);
  assert.match(p, /Ana Ríos, Pedro Soto/);
  assert.match(p, /cuando no, usa una etiqueta de voz/i);
});

test("sin nombres anotados no se le inventa una lista vacía", () => {
  const p = promptEscucha("Transcribe.", SIN_DATOS);
  assert.doesNotMatch(p, /nombres que se anotaron/);
});

test("quien redacta ve la tabla y se le advierte que no la complete", () => {
  const p = promptRedacta("Redacta.", REUNION, "Ana: Buenos días.");
  assert.match(p, /- Ascensores/);
  assert.match(p, /no lo inventes/);
  assert.match(p, /Ana: Buenos días\./);
});

test("quien entiende sabe qué día es, para convertir 'el viernes' en fecha", () => {
  const p = promptEntiende("Analiza.", REUNION, "ACTA...");
  assert.match(p, /Hoy es 2026-09-01/);
  assert.match(p, /deja el plazo en null/);
});

test("quien entiende recibe la tabla para saber qué no se trató", () => {
  const p = promptEntiende("Analiza.", REUNION, "ACTA...");
  assert.match(p, /ponlos en sin_tratar/);
});

test("sin tabla no se le pide comparar contra nada", () => {
  const p = promptEntiende("Analiza.", SIN_DATOS, "ACTA...");
  assert.doesNotMatch(p, /sin_tratar/);
});

test("los tres prompts arrancan con la instrucción de su rubro", () => {
  assert.ok(promptEscucha("SOY EL RELATOR.", REUNION).startsWith("SOY EL RELATOR."));
  assert.ok(promptRedacta("SOY EL ACTUARIO.", REUNION, "x").startsWith("SOY EL ACTUARIO."));
  assert.ok(promptEntiende("SOY EL ANALISTA.", REUNION, "x").startsWith("SOY EL ANALISTA."));
});

test("el esquema le prohíbe adivinar responsable y plazo", () => {
  const t = ESQUEMA_ANALISIS.properties.tareas.items.properties;
  assert.match(t.responsable.description, /NO lo adivines/);
  assert.match(t.plazo.description, /NO inventes una fecha/);
});

/* ------------------------------------------------------- leer el análisis */

const COMPLETO = {
  resumen: "Se revisaron los ascensores y se aprobó el presupuesto.",
  acuerdos: [
    { numero: 1, texto: "Se aprueba la mantención", firme: true },
    { numero: 2, texto: "Se evaluará cambiar de empresa", firme: false },
  ],
  tareas: [
    { que: "Pedir tres cotizaciones", responsable: "Ana", plazo: "2026-09-10", prioridad: "alta", acuerdo: 1 },
    { que: "Revisar el seguro", responsable: null, plazo: null, prioridad: "normal", acuerdo: null },
  ],
  pendientes: [{ texto: "Falta la cotización de Otis", porque: "no respondieron" }],
  sin_tratar: ["Renovación del seguro"],
  aportes: ["Llevar el detalle de morosidad"],
  contradicciones: ["El plazo de la mantención: dos versiones"],
};

test("un análisis completo se lee entero", () => {
  const a = leerAnalisis(COMPLETO);
  assert.equal(a.acuerdos.length, 2);
  assert.equal(a.acuerdos[1]!.firme, false);
  assert.equal(a.tareas.length, 2);
  assert.equal(a.tareas[0]!.prioridad, "alta");
  assert.equal(a.tareas[1]!.responsable, null);
  assert.deepEqual(a.sinTratar, ["Renovación del seguro"]);
  assert.equal(a.contradicciones.length, 1);
});

test("un acuerdo que no dice ser firme no lo es", () => {
  const a = leerAnalisis({ ...COMPLETO, acuerdos: [{ numero: 1, texto: "Algo" }] });
  assert.equal(a.acuerdos[0]!.firme, false);
});

test("una tarea con una fecha imposible queda sin plazo, no con una inventada", () => {
  const a = leerAnalisis({
    ...COMPLETO,
    tareas: [{ que: "Algo", responsable: "Ana", plazo: "2026-02-31", prioridad: "normal", acuerdo: null }],
  });
  assert.equal(a.tareas[0]!.plazo, null);
});

test("un plazo dicho en palabras no se convierte en fecha", () => {
  const a = leerAnalisis({
    ...COMPLETO,
    tareas: [{ que: "Algo", responsable: null, plazo: "el viernes", prioridad: "normal", acuerdo: null }],
  });
  assert.equal(a.tareas[0]!.plazo, null);
});

test("una fila rota se descarta sola, sin llevarse el resto", () => {
  const a = leerAnalisis({
    ...COMPLETO,
    tareas: [
      "esto no es una tarea",
      { que: "   ", responsable: "Ana", plazo: null, prioridad: "normal", acuerdo: null },
      { que: "La buena", responsable: "Ana", plazo: null, prioridad: "normal", acuerdo: null },
    ],
  });
  assert.deepEqual(a.tareas.map((t) => t.que), ["La buena"]);
  assert.equal(a.resumen, COMPLETO.resumen);
});

test("un responsable en blanco es no tener responsable", () => {
  const a = leerAnalisis({
    ...COMPLETO,
    tareas: [{ que: "Algo", responsable: "  ", plazo: null, prioridad: "normal", acuerdo: null }],
  });
  assert.equal(a.tareas[0]!.responsable, null);
});

test("un acuerdo sin número se numera por su posición, no se pierde", () => {
  const a = leerAnalisis({ ...COMPLETO, acuerdos: [{ texto: "Primero" }, { texto: "Segundo" }] });
  assert.deepEqual(a.acuerdos.map((x) => x.numero), [1, 2]);
});

test("una prioridad rara es normal, no alta: no se sube el volumen solo", () => {
  const a = leerAnalisis({
    ...COMPLETO,
    tareas: [{ que: "Algo", responsable: null, plazo: null, prioridad: "urgentísima", acuerdo: null }],
  });
  assert.equal(a.tareas[0]!.prioridad, "normal");
});

test("las listas de texto dejan fuera lo que no es texto", () => {
  const a = leerAnalisis({ ...COMPLETO, aportes: ["Bueno", 42, null, "  ", "Otro"] });
  assert.deepEqual(a.aportes, ["Bueno", "Otro"]);
});

test("una respuesta que no es un objeto devuelve un análisis vacío, no revienta", () => {
  assert.deepEqual(leerAnalisis(null), ANALISIS_VACIO);
  assert.deepEqual(leerAnalisis("una frase"), ANALISIS_VACIO);
  assert.deepEqual(leerAnalisis([1, 2]), ANALISIS_VACIO);
});

test("faltando campos enteros, lo que llegó se lee igual", () => {
  const a = leerAnalisis({ resumen: "Algo pasó." });
  assert.equal(a.resumen, "Algo pasó.");
  assert.deepEqual(a.tareas, []);
  assert.deepEqual(a.sinTratar, []);
});

/* ------------------------------------------------------------- las fechas */

test("solo pasan las fechas que existen de verdad", () => {
  assert.equal(fecha("2026-09-01"), "2026-09-01");
  assert.equal(fecha("2026-02-29"), null); // 2026 no es bisiesto
  assert.equal(fecha("2024-02-29"), "2024-02-29");
  assert.equal(fecha("2026-9-1"), null);
  assert.equal(fecha("01-09-2026"), null);
  assert.equal(fecha(20260901), null);
  assert.equal(fecha(null), null);
});

/* --------------------------------------------------------- la validación */

test("una reunión vacía se rechaza con una razón entendible", () => {
  const r = validarTranscripcion("   ");
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /vacía/);
});

test("una reunión enorme se rechaza diciendo qué hacer", () => {
  const r = validarTranscripcion("a".repeat(200_000));
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /Pártela en dos/);
});

test("lo que no es texto se rechaza antes de llegar al modelo", () => {
  assert.equal(validarTranscripcion({ audio: true }).ok, false);
});

test("una transcripción normal pasa, ya recortada de los bordes", () => {
  const r = validarTranscripcion("  Ana: Buenos días.  ");
  assert.deepEqual(r, { ok: true, texto: "Ana: Buenos días." });
});
