import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_POR_OMISION, YA_ES_VIEJA, comoSeCuentaElPlan, comoSeVeLaCopia,
  guardaSinConexion, planValido,
} from "./planes.ts";

test("estudiar sin señal es de los planes pagados", () => {
  assert.equal(guardaSinConexion("personal"), true);
  assert.equal(guardaSinConexion("institucion"), true);
  assert.equal(guardaSinConexion("gratis"), false);
});

// Ante la duda, el plan más chico. Un error de escritura en la base no puede
// regalar lo que se cobra.
test("lo que no se reconoce cae en el plan gratis", () => {
  assert.equal(planValido("personal"), "personal");
  assert.equal(planValido("premium"), PLAN_POR_OMISION);
  assert.equal(planValido(null), PLAN_POR_OMISION);
  assert.equal(planValido(undefined), PLAN_POR_OMISION);
  assert.equal(planValido(7), PLAN_POR_OMISION);
});

test("al del plan gratis se le cuenta qué le falta, sin insistir", () => {
  assert.match(comoSeCuentaElPlan("gratis"), /Con el plan Personal/);
  assert.match(comoSeCuentaElPlan("gratis"), /sin señal/);
});

// Una función que funciona en silencio es una función que nadie sabe que pagó.
test("al que paga se le dice que lo tiene", () => {
  assert.ok(!comoSeCuentaElPlan("personal").includes("Con el plan Personal"));
  assert.match(comoSeCuentaElPlan("institucion"), /sin señal/);
});

const AHORA = Date.parse("2026-09-01T12:00:00Z");
const hace = (ms: number) => comoSeVeLaCopia(AHORA - ms, AHORA);

test("se dice que es una copia y de cuándo, no se disfraza de datos frescos", () => {
  assert.equal(hace(30_000), "Sin conexión · guardado recién");
  assert.equal(hace(20 * 60_000), "Sin conexión · guardado hace 20 min");
  assert.equal(hace(5 * 3_600_000), "Sin conexión · guardado hace 5 h");
  assert.equal(hace(30 * 3_600_000), "Sin conexión · guardado ayer");
  assert.equal(hace(4 * 86_400_000), "Sin conexión · guardado hace 4 días");
});

// Mostrar algo de hace dos meses como si fuera de ahora es peor que no
// mostrar nada: nadie revisa la fecha si la pantalla no la subraya.
test("pasado un mes se avisa además que puede estar vieja", () => {
  assert.match(hace(YA_ES_VIEJA), /puede estar desactualizado/);
  assert.ok(!hace(YA_ES_VIEJA - 86_400_000).includes("desactualizado"));
});

// Un reloj atrasado no puede producir «guardado hace -3 días».
test("una copia del futuro se dice «recién», no en negativo", () => {
  assert.equal(comoSeVeLaCopia(AHORA + 86_400_000, AHORA), "Sin conexión · guardado recién");
});
