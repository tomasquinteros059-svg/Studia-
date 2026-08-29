import { test } from "node:test";
import assert from "node:assert/strict";
import { nombreDesde, revisarIngreso } from "./registro-demo.ts";

// ── El nombre que se supone ─────────────────────────────────────────────

test("del correo se saca un nombre presentable", () => {
  assert.equal(nombreDesde("jose.perez@uc.cl"), "Jose Perez");
  assert.equal(nombreDesde("ANA_RIOS@usach.cl"), "Ana Rios");
  assert.equal(nombreDesde("t.quinteros2@alumnos.uc.cl"), "T Quinteros");
});

test("un correo que es puros números no da nombre, y se pide", () => {
  assert.equal(nombreDesde("20452@uc.cl"), "");
  const r = revisarIngreso("20452@uc.cl", "");
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.motivo : "", /Escribe tu nombre/);
});

// ── Entrar ──────────────────────────────────────────────────────────────

test("sin correo no se entra, que es toda la regla", () => {
  for (const malo of ["", "   ", "tomas", "tomas@", "@uc.cl", "tomas@uc"]) {
    assert.equal(revisarIngreso(malo, "Tomás").ok, false, malo);
  }
});

test("con correo se entra, y el correo queda normalizado", () => {
  const r = revisarIngreso("  Tomas.Q@UC.CL ", "");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.correo, "tomas.q@uc.cl");
  assert.equal(r.nombre, "Tomas Q");
});

test("el nombre escrito manda sobre el supuesto, y se le sacan los espacios de más", () => {
  const r = revisarIngreso("tomas.q@uc.cl", "  Tomás   Quinteros ");
  assert.equal(r.ok, true);
  assert.equal(r.ok === true ? r.nombre : "", "Tomás Quinteros");
});

test("se reconoce la institución del correo, para poder decirlo", () => {
  const inst = revisarIngreso("tomas@alumnos.uc.cl", "Tomás");
  assert.equal(inst.ok === true ? inst.institucion : "", "Pontificia Universidad Católica de Chile");

  const propio = revisarIngreso("tomas@gmail.com", "Tomás");
  assert.equal(propio.ok === true ? propio.institucion : "x", null);
});

test("un nombre desmedido no pasa: es una lista, no un ensayo", () => {
  assert.equal(revisarIngreso("tomas@uc.cl", "a".repeat(61)).ok, false);
  assert.equal(revisarIngreso("tomas@uc.cl", "a".repeat(60)).ok, true);
});
