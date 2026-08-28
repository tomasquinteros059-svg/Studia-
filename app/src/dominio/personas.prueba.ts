import { test } from "node:test";
import assert from "node:assert/strict";
import { inicialesDePersona, primerNombre } from "./personas.ts";

test("el saludo usa solo el primer nombre", () => {
  assert.equal(primerNombre("Eduardo Quintero Muñoz"), "Eduardo");
  assert.equal(primerNombre("  Ana   Ríos "), "Ana");
  assert.equal(primerNombre("Ana"), "Ana");
});

test("sin nombre no se inventa uno", () => {
  assert.equal(primerNombre(""), "");
  assert.equal(primerNombre("   "), "");
});

test("las iniciales toman el nombre y el apellido, no los dos nombres", () => {
  assert.equal(inicialesDePersona("María de los Ángeles Soto"), "MS");
  assert.equal(inicialesDePersona("Ana Ríos"), "AR");
  assert.equal(inicialesDePersona("Secretaría Académica"), "SA");
});

test("un nombre de una sola palabra da una sola letra", () => {
  assert.equal(inicialesDePersona("Tomás"), "T");
});

test("los puntos de las abreviaturas no cuentan como palabra", () => {
  assert.equal(inicialesDePersona("Eduardo Q."), "EQ");
  assert.equal(inicialesDePersona("Dr. Salas"), "DS");
});

test("sin nombre, no hay iniciales que dibujar", () => {
  assert.equal(inicialesDePersona(""), "");
  assert.equal(inicialesDePersona("   "), "");
});
