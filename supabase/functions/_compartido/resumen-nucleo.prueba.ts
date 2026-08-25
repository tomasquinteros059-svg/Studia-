import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LARGO_MAXIMO_APUNTE, partirRespuesta, promptResumen, validarApunte,
} from "./resumen-nucleo.ts";

const CTX = {
  asignatura: "Cálculo I", codigo: "MAT1610", profesor: "Ana Ríos",
  temario: ["Límites laterales", "Regla de la cadena"],
  transcripcion: "",
  apunte: "El teorema del valor medio dice que existe un c…",
};

test("el prompt sitúa el ramo y el temario", () => {
  const p = promptResumen(CTX);
  assert.match(p, /Cálculo I/);
  assert.match(p, /MAT1610/);
  assert.match(p, /- Límites laterales/);
  assert.match(p, /- Regla de la cadena/);
});

test("sin transcripción, prohíbe inventar lo que dijo el profesor", () => {
  assert.match(promptResumen(CTX), /No inventes lo que el profesor dijo/);
});

test("con transcripción, la incluye y no pone el aviso", () => {
  const p = promptResumen({ ...CTX, transcripcion: "Hoy vemos el TVM." });
  assert.match(p, /Hoy vemos el TVM\./);
  assert.doesNotMatch(p, /No inventes lo que el profesor dijo/);
});

test("el resumen no levanta la regla de no resolver ejercicios", () => {
  const p = promptResumen(CTX);
  assert.match(p, /no resuelves ejercicios/i);
  assert.match(p, /no lo terminas/);
});

test("parte la respuesta en sus tres bloques", () => {
  const r = partirRespuesta(`RESUMEN
Anotaste el teorema y sus hipótesis.

VACIOS
- La interpretación geométrica
- El caso de Rolle

CONSEJOS
- Repasa primero las hipótesis
- Comprueba con una función no derivable`);

  assert.match(r.cuerpo, /^Anotaste el teorema/);
  assert.doesNotMatch(r.cuerpo, /VACIOS/);
  assert.deepEqual(r.vacios, ["La interpretación geométrica", "El caso de Rolle"]);
  assert.equal(r.consejos.length, 2);
});

test("tolera acentos, minúsculas y adornos en los encabezados", () => {
  const r = partirRespuesta(`## Resumen
Cuerpo del resumen.

**Vacíos**
* Uno

### consejos:
• Dos`);
  assert.equal(r.cuerpo, "Cuerpo del resumen.");
  assert.deepEqual(r.vacios, ["Uno"]);
  assert.deepEqual(r.consejos, ["Dos"]);
});

test("«ninguno» se lee como lista vacía, no como un vacío llamado ninguno", () => {
  const r = partirRespuesta("RESUMEN\nAlgo.\n\nVACIOS\n- ninguno\n\nCONSEJOS\n- Repasa");
  assert.deepEqual(r.vacios, []);
  assert.deepEqual(r.consejos, ["Repasa"]);
});

test("si el modelo no respeta el formato, no se pierde el contenido", () => {
  const suelto = "Anotaste bien las hipótesis pero te faltó el caso de Rolle.";
  const r = partirRespuesta(suelto);
  assert.equal(r.cuerpo, suelto);
  assert.deepEqual(r.vacios, []);
  assert.deepEqual(r.consejos, []);
});

test("aguanta que falte un bloque", () => {
  const r = partirRespuesta("RESUMEN\nSolo el resumen.\n\nCONSEJOS\n- Uno");
  assert.equal(r.cuerpo, "Solo el resumen.");
  assert.deepEqual(r.vacios, []);
  assert.deepEqual(r.consejos, ["Uno"]);
});

test("aguanta que los bloques vengan en otro orden", () => {
  const r = partirRespuesta("RESUMEN\nCuerpo.\n\nCONSEJOS\n- C1\n\nVACIOS\n- V1");
  assert.equal(r.cuerpo, "Cuerpo.");
  assert.deepEqual(r.consejos, ["C1"]);
  assert.deepEqual(r.vacios, ["V1"]);
});

test("aguanta que falte el encabezado del resumen", () => {
  const r = partirRespuesta("Cuerpo sin encabezado.\n\nVACIOS\n- V1");
  assert.equal(r.cuerpo, "Cuerpo sin encabezado.");
  assert.deepEqual(r.vacios, ["V1"]);
});

test("una respuesta vacía no revienta", () => {
  assert.deepEqual(partirRespuesta(""), { cuerpo: "", vacios: [], consejos: [] });
  assert.deepEqual(partirRespuesta("   \n  "), { cuerpo: "", vacios: [], consejos: [] });
});

test("no deja viñetas vacías en las listas", () => {
  const r = partirRespuesta("RESUMEN\nA.\n\nVACIOS\n-\n-  \n- Real\n\nCONSEJOS\n- Otro");
  assert.deepEqual(r.vacios, ["Real"]);
});

test("el apunte se valida antes de gastar una llamada", () => {
  assert.equal(validarApunte("corto").ok, false);
  assert.equal(validarApunte(null).ok, false);
  assert.equal(validarApunte("x".repeat(LARGO_MAXIMO_APUNTE + 1)).ok, false);
  const bueno = validarApunte("  " + "a".repeat(60) + "  ");
  assert.equal(bueno.ok, true);
  if (bueno.ok) assert.equal(bueno.texto.length, 60);
});
