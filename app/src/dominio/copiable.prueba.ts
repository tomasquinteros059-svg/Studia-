import { test } from "node:test";
import assert from "node:assert/strict";
import { queNoSeGuarda, sePuedeGuardar } from "./copiable.ts";

test("lo que una pantalla suele devolver se puede guardar", () => {
  assert.equal(sePuedeGuardar({
    tareas: [{ id: "t1", titulo: "Guía 4", puntos: 20, entregada: false, nota: null }],
    ramos: [{ id: "r1", nombre: "Cálculo I", color: null }],
  }), true);
  assert.equal(sePuedeGuardar([]), true);
  assert.equal(sePuedeGuardar(null), true);
});

// El error que casi se publica: un Map pasado por JSON vuelve como {}, la
// pantalla lo usa y revienta en el primer render. Sin señal, que es justo
// cuando la copia existe.
test("un Map se rechaza, y se dice dónde estaba", () => {
  const malo = queNoSeGuarda({ tareas: [], porId: new Map() });
  assert.equal(malo, "datos.porId es un Map");
});

test("lo demás que no vuelve igual también", () => {
  assert.match(queNoSeGuarda({ vistos: new Set() }) ?? "", /Set/);
  assert.match(queNoSeGuarda({ cuando: new Date() }) ?? "", /fecha/);
  assert.match(queNoSeGuarda({ hacer: () => 1 }) ?? "", /función/);
  assert.match(queNoSeGuarda({ nada: undefined }) ?? "", /undefined/);
});

// Una instancia pierde su prototipo al volver, y con él los métodos que la
// pantalla vaya a llamar.
test("una instancia de una clase no se guarda", () => {
  class Ramo { id = "r1"; }
  assert.match(queNoSeGuarda({ ramo: new Ramo() }) ?? "", /instancia/);
});

test("lo malo se encuentra por hondo que esté, y se dice el camino entero", () => {
  const malo = queNoSeGuarda({ modulos: [{ titulo: "Límites", indice: new Map() }] });
  assert.equal(malo, "datos.modulos[0].indice es un Map");
});

test("null sí se guarda: es un valor, no un hueco", () => {
  assert.equal(sePuedeGuardar({ nota: null, trazos: null }), true);
});
