import { test } from "node:test";
import assert from "node:assert/strict";
import { comoSeVe, cualGana, valeGuardarlo, type Borrador } from "./borrador.ts";

const borrador = (escritoEn: number): Borrador =>
  ({ apunteId: "a1", contenido: "lo que escribí en clase", trazos: null, escritoEn });

test("gana lo del aparato si es más nuevo que lo del servidor", () => {
  const antes = Date.parse("2026-09-01T10:00:00Z");
  assert.equal(cualGana(borrador(antes + 5000), "2026-09-01T10:00:00Z"), "borrador");
});

test("gana el servidor si alguien lo editó después en otro aparato", () => {
  const antes = Date.parse("2026-09-01T10:00:00Z");
  assert.equal(cualGana(borrador(antes - 5000), "2026-09-01T10:00:00Z"), "servidor");
});

// El empate ocurre cuando el borrador sí se subió y quedó una copia de más.
// Si ganara el borrador, cada vez que se abre el apunte resucitaría texto
// viejo.
test("en empate gana el servidor, para que la copia sobrante se descarte sola", () => {
  const justo = Date.parse("2026-09-01T10:00:00Z");
  assert.equal(cualGana(borrador(justo), "2026-09-01T10:00:00Z"), "servidor");
});

test("sin borrador manda el servidor, y sin servidor manda el borrador", () => {
  assert.equal(cualGana(null, "2026-09-01T10:00:00Z"), "servidor");
  assert.equal(cualGana(borrador(1000), null), "borrador");
});

// Una fecha rota no puede hacer que se pierda lo que la persona escribió.
test("si la fecha del servidor no se entiende, se conserva lo escrito", () => {
  assert.equal(cualGana(borrador(1000), "cualquier cosa"), "borrador");
});

// Un apunte recién abierto y cerrado no es un borrador: guardarlo pisaría con
// vacío lo que hubiera en el servidor.
test("un apunte vacío no se guarda como borrador", () => {
  assert.equal(valeGuardarlo("", null), false);
  assert.equal(valeGuardarlo("   \n ", null), false);
  assert.equal(valeGuardarlo("algo", null), true);
  // Un dibujo sin texto sí vale.
  assert.equal(valeGuardarlo("", '{"v":1}'), true);
});

// «Sin guardar» era mentira en los dos sentidos: asusta, y a la vez no dice
// que la aplicación se está encargando.
test("lo que espera turno no se anuncia como perdido", () => {
  assert.equal(comoSeVe("en_el_aparato"), "Guardado en el teléfono · sube solo");
  assert.ok(!comoSeVe("en_el_aparato").toLowerCase().includes("sin guardar"));
  assert.equal(comoSeVe("limpio"), "Guardado");
});
