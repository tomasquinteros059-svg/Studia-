import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comoVaElContrato, cuposLibres, hayQueMirarElContrato, porQueNoHayCupo, sePuedeDarCupo,
  sePuedeQuitarCupo, vencido, type Contrato,
} from "./instituciones.ts";

const contrato = (cambios: Partial<Contrato> = {}): Contrato => ({
  id: "i-1", nombre: "Universidad de Chile",
  cupos: 100, ocupados: 40, esperando: 0, vence_en: null,
  ...cambios,
});

const AHORA = new Date("2026-09-04T12:00:00Z");

test("los cupos que quedan salen de lo contratado menos lo entregado", () => {
  assert.equal(cuposLibres(contrato()), 60);
  assert.equal(cuposLibres(contrato({ ocupados: 100 })), 0);
});

// Un contrato que se reduce a la mitad con la gente ya adentro deja los
// ocupados por sobre los cupos. Mostrar «quedan −30» sería una manera rara de
// decir que no quedan.
test("un contrato reducido no muestra cupos negativos", () => {
  assert.equal(cuposLibres(contrato({ cupos: 20, ocupados: 50 })), 0);
});

test("un contrato sin fecha de término no vence", () => {
  assert.equal(vencido(contrato(), AHORA), false);
  assert.equal(vencido(contrato({ vence_en: "2026-12-31T00:00:00Z" }), AHORA), false);
  assert.equal(vencido(contrato({ vence_en: "2026-01-01T00:00:00Z" }), AHORA), true);
});

test("se le da cupo a quien no tiene ninguno y hay de dónde", () => {
  assert.equal(sePuedeDarCupo(contrato(), "gratis", AHORA), true);
  assert.equal(sePuedeDarCupo(contrato({ ocupados: 100 }), "gratis", AHORA), false);
  assert.equal(sePuedeDarCupo(contrato({ vence_en: "2026-01-01T00:00:00Z" }), "gratis", AHORA), false);
});

// Ya lo tiene, o ya tiene más: en los dos casos el botón no debe invitar.
test("a quien ya tiene plan no se le da un cupo encima", () => {
  assert.equal(sePuedeDarCupo(contrato(), "institucion", AHORA), false);
  assert.equal(sePuedeDarCupo(contrato(), "personal", AHORA), false);
});

// El plan Personal salió de Google Play. El panel de un colegio no puede
// cortarlo: no le devuelve el dinero a nadie y le quita lo que compró.
test("el plan que se pagó por Google Play no se quita desde el panel", () => {
  assert.equal(sePuedeQuitarCupo("institucion"), true);
  assert.equal(sePuedeQuitarCupo("personal"), false);
  assert.equal(sePuedeQuitarCupo("gratis"), false);
});

test("el contrato sano se resume y no se explica", () => {
  assert.equal(
    comoVaElContrato(contrato(), AHORA),
    "Universidad de Chile · 40 de 100 cupos · quedan 60",
  );
});

// Lo que hay que hacer algo al respecto va primero. Que falten cupos para la
// gente que ya está en la nómina es el único aviso que llega a tiempo: se ve
// antes de que esa gente se registre y se quede afuera.
test("lo primero es lo que falta", () => {
  assert.match(
    comoVaElContrato(contrato({ cupos: 50, ocupados: 45, esperando: 20 }), AHORA),
    /faltan 15/,
  );
  assert.match(
    comoVaElContrato(contrato({ cupos: 50, ocupados: 50 }), AHORA),
    /sin cupos libres/,
  );
  assert.match(
    comoVaElContrato(contrato({ esperando: 12 }), AHORA),
    /12 de la nómina todavía no se registra/,
  );
});

test("un contrato vencido lo dice antes que nada", () => {
  const c = contrato({ vence_en: "2026-01-01T00:00:00Z", esperando: 30 });
  assert.match(comoVaElContrato(c, AHORA), /contrato vencido/);
});

// Los tres motivos son distintos y llevan a acciones distintas: renovar,
// liberar un cupo, o no hacer nada porque esa persona ya pagó.
test("cada motivo para no dar el cupo se explica por su nombre", () => {
  assert.match(porQueNoHayCupo(contrato(), "personal", AHORA), /Google Play/);
  assert.match(
    porQueNoHayCupo(contrato({ vence_en: "2026-01-01T00:00:00Z" }), "gratis", AHORA),
    /vencido/,
  );
  assert.match(
    porQueNoHayCupo(contrato({ ocupados: 100 }), "gratis", AHORA),
    /No quedan cupos/,
  );
});

test("el encabezado avisa solo cuando hay algo que hacer", () => {
  assert.equal(hayQueMirarElContrato(contrato(), AHORA), false);
  assert.equal(hayQueMirarElContrato(contrato({ ocupados: 100 }), AHORA), true);
  assert.equal(hayQueMirarElContrato(contrato({ esperando: 80 }), AHORA), true);
  assert.equal(
    hayQueMirarElContrato(contrato({ vence_en: "2026-01-01T00:00:00Z" }), AHORA),
    true,
  );
  // Justo alcanza: 60 libres para 60 esperando. No hay nada que arreglar.
  assert.equal(hayQueMirarElContrato(contrato({ esperando: 60 }), AHORA), false);
});
