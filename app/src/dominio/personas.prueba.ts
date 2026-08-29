import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOMBRE_DEL_ROL, buscar, cuentaPorRol, inicialesDePersona, primerNombre,
} from "./personas.ts";

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

// ── El registro ─────────────────────────────────────────────────────────

const GENTE = [
  { nombre: "José Pérez", correo: "jose.perez@colegio.cl", rol: "estudiante" as const },
  { nombre: "Ana Ríos", correo: "ana.rios@colegio.cl", rol: "profesor" as const },
  { nombre: "Secretaría", correo: "secretaria@colegio.cl", rol: "administrador" as const },
  { nombre: "Ana Soto", correo: "asoto@otro.cl", rol: "estudiante" as const },
];

test("buscar encuentra a José escribiendo jose, sin tilde", () => {
  assert.deepEqual(buscar(GENTE, "jose").map((p) => p.nombre), ["José Pérez"]);
  assert.deepEqual(buscar(GENTE, "JOSÉ").map((p) => p.nombre), ["José Pérez"]);
});

test("buscar también sirve por correo, que es como se identifica a alguien", () => {
  assert.deepEqual(buscar(GENTE, "asoto@").map((p) => p.nombre), ["Ana Soto"]);
  assert.equal(buscar(GENTE, "colegio.cl").length, 3);
});

test("sin texto, la lista queda entera y sin tocar", () => {
  assert.equal(buscar(GENTE, "").length, GENTE.length);
  assert.equal(buscar(GENTE, "   ").length, GENTE.length);
  const copia = buscar(GENTE, "");
  copia.pop();
  assert.equal(GENTE.length, 4);
});

test("una búsqueda sin resultados devuelve nada, no todo", () => {
  assert.deepEqual(buscar(GENTE, "nadie"), []);
});

test("se cuenta cuánta gente hay de cada rol", () => {
  assert.deepEqual(cuentaPorRol(GENTE), { estudiante: 2, profesor: 1, administrador: 1 });
});

test("una lista vacía cuenta cero en los tres, no queda incompleta", () => {
  assert.deepEqual(cuentaPorRol([]), { estudiante: 0, profesor: 0, administrador: 0 });
});

test("cada rol tiene nombre para mostrar", () => {
  assert.equal(NOMBRE_DEL_ROL.estudiante, "Estudiante");
  assert.equal(NOMBRE_DEL_ROL.profesor, "Docente");
  assert.equal(NOMBRE_DEL_ROL.administrador, "Administración");
});
