import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EQUIPOS } from "../app/src/dominio/rubros.ts";
import { DESTINO, generar } from "./generar-rubros.ts";

test("la copia que usan las funciones está al día", () => {
  const enDisco = readFileSync(DESTINO, "utf-8");
  assert.equal(enDisco, generar(),
    `${DESTINO} quedó atrás de app/src/dominio/rubros.ts. Corre: npm run generar`);
});

test("la copia trae los cinco rubros con sus tres instrucciones", async () => {
  const copia = await import("../supabase/functions/_compartido/rubros-generado.ts");
  for (const e of EQUIPOS) {
    const c = copia.EQUIPOS[e.id];
    assert.ok(c, `falta ${e.id} en la copia`);
    for (const papel of ["escucha", "redacta", "entiende"] as const) {
      const original = e.agentes.find((a) => a.papel === papel)!.instruccion;
      assert.equal(c[papel], original, `${e.id}/${papel} no coincide`);
    }
    assert.equal(c.nombre, e.nombre);
    assert.equal(c.documento, e.documento);
  }
});
