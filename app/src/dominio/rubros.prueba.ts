import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EQUIPOS, PAPELES, REGLAS_COMUNES, agenteDe, equipoDe, rubroPorLoQueSeDijo,
} from "./rubros.ts";

test("cada rubro tiene sus tres, y son los tres papeles", () => {
  for (const e of EQUIPOS) {
    assert.equal(e.agentes.length, 3, e.nombre);
    assert.deepEqual(e.agentes.map((a) => a.papel), [...PAPELES], e.nombre);
  }
});

test("no hay rubros repetidos", () => {
  const ids = EQUIPOS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("las instrucciones son de verdad distintas entre rubros", () => {
  for (const papel of PAPELES) {
    const textos = EQUIPOS.map((e) => agenteDe(e.id, papel).instruccion);
    assert.equal(new Set(textos).size, textos.length,
      `dos rubros comparten la instrucción de quien ${papel}`);
  }
});

test("los tres de un mismo rubro no dicen lo mismo", () => {
  for (const e of EQUIPOS) {
    const textos = e.agentes.map((a) => a.instruccion);
    assert.equal(new Set(textos).size, 3, e.nombre);
  }
});

test("las reglas que no se negocian están en quien redacta y en quien entiende", () => {
  for (const e of EQUIPOS) {
    for (const papel of ["redacta", "entiende"] as const) {
      assert.ok(agenteDe(e.id, papel).instruccion.includes(REGLAS_COMUNES),
        `${e.nombre}: quien ${papel} perdió las reglas comunes`);
    }
  }
});

test("quien entiende propone y no decide, en todos los rubros", () => {
  for (const e of EQUIPOS) {
    assert.match(agenteDe(e.id, "entiende").instruccion, /Propones, no decides/, e.nombre);
  }
});

test("quien entiende entrega las cuatro cosas que la persona necesita", () => {
  for (const e of EQUIPOS) {
    const i = agenteDe(e.id, "entiende").instruccion;
    for (const parte of ["qué se hizo", "qué quedó sin cerrar", "qué hay que hacer", "aportar"]) {
      assert.ok(i.includes(parte), `${e.nombre}: falta "${parte}"`);
    }
  }
});

test("en salud, quien escucha tiene prohibido escribir datos del paciente", () => {
  const i = agenteDe("salud", "escucha").instruccion;
  assert.match(i, /Nunca escribas nombres, RUT ni número de ficha/);
  assert.match(i, /Paciente 1/);
});

test("los rubros donde grabar tiene consecuencias lo avisan antes", () => {
  assert.ok(equipoDe("legal").cuidado, "una reunión con cliente sin aviso");
  assert.ok(equipoDe("salud").cuidado, "una reunión clínica sin aviso");
  assert.ok(equipoDe("edificios").cuidado, "una asamblea sin aviso sobre el quórum");
});

test("cada rubro trae ejemplos y vocabulario que valgan la pena", () => {
  for (const e of EQUIPOS) {
    assert.ok(e.ejemplos.length >= 3, e.nombre);
    assert.ok(e.vocabulario.length >= 6, e.nombre);
    assert.ok(e.loQueImporta.length >= 4, e.nombre);
    assert.ok(e.documento.trim().length > 0, e.nombre);
  }
});

test("pedir un rubro que no existe revienta en vez de devolver cualquier cosa", () => {
  // @ts-expect-error a propósito: es lo que pasaría con un dato viejo de la base.
  assert.throws(() => equipoDe("veterinaria"));
});

/* ------------------------------------------- adivinar el rubro por el texto */

test("reconoce una asamblea de copropietarios", () => {
  assert.equal(rubroPorLoQueSeDijo(
    "Se aprobó el prorrateo de los gastos comunes con cargo al fondo de reserva."), "edificios");
});

test("reconoce una reunión de obra", () => {
  assert.equal(rubroPorLoQueSeDijo(
    "La partida de tabiquería está atrasada y hay una interferencia con la especialidad de clima. Queda una RDI abierta."), "obras");
});

test("reconoce una reunión de estudio jurídico", () => {
  assert.equal(rubroPorLoQueSeDijo(
    "El mandato está vigente y el comparendo quedó fijado; la prescripción corre desde la notificación."), "legal");
});

test("con una sola palabra no se arriesga", () => {
  assert.equal(rubroPorLoQueSeDijo("Revisamos el presupuesto."), null);
});

test("con texto vacío tampoco", () => {
  assert.equal(rubroPorLoQueSeDijo("   "), null);
});

test("si dos rubros empatan, prefiere no proponer nada", () => {
  // "quórum" y "acta" los comparten legal y edificios: sin más señal, callarse.
  assert.equal(rubroPorLoQueSeDijo("Se verificó el quórum y se firmó el acta."), null);
});

test("no confunde una palabra metida dentro de otra", () => {
  assert.equal(rubroPorLoQueSeDijo("Contacta al contratista y confirma la metafísica."), null);
});

test("los acentos y las mayúsculas no cambian el resultado", () => {
  const con = rubroPorLoQueSeDijo("Se aprobó el PRORRATEO de los Gastos Comunes con cargo al Fondo de Reserva.");
  const sin = rubroPorLoQueSeDijo("se aprobo el prorrateo de los gastos comunes con cargo al fondo de reserva.");
  assert.equal(con, "edificios");
  assert.equal(sin, "edificios");
});
