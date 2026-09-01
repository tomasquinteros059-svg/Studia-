import { test } from "node:test";
import assert from "node:assert/strict";
import { claseDe, comoSeDice, vale_reintentar } from "./fallas.ts";

// Lo que de verdad aparecía sin señal, palabra por palabra.
test("sin internet se dice que no hay internet, no «Network request failed»", () => {
  const falla = new Error("No pude cargar tus asignaturas: TypeError: Network request failed");
  const dicho = comoSeDice(falla, "No pude cargar tus asignaturas");
  assert.match(dicho, /no hay internet/i);
  assert.ok(!dicho.includes("Network"));
  assert.ok(!dicho.includes("TypeError"));
});

test("las otras formas de quedarse sin red también se reconocen", () => {
  for (const m of ["Failed to fetch", "NetworkError when attempting to fetch",
                   "Load failed", "The request timed out", "Aborted"]) {
    assert.equal(claseDe(m), "red", m);
  }
});

// Cada una lleva a algo distinto, así que cada una se dice distinto.
test("una sesión vencida manda a entrar de nuevo, no a revisar el internet", () => {
  assert.match(comoSeDice(new Error("JWT expired")), /sesión venció/);
  assert.match(comoSeDice(new Error("invalid refresh token")), /sesión venció/);
});

test("un permiso denegado no se disfraza de problema de red", () => {
  assert.match(comoSeDice(new Error('new row violates row-level security policy')), /permiso/);
  assert.match(comoSeDice(new Error("permission denied for table notas")), /permiso/);
});

test("algo que ya no existe se dice en dos palabras", () => {
  assert.equal(comoSeDice(new Error("PGRST116: no rows returned")), "Eso ya no está.");
});

// El contexto lo escribió quien programó la consulta y sirve para ubicarse;
// la causa importa más cuando se conoce.
test("una falla desconocida se cuenta con lo que se estaba haciendo", () => {
  assert.equal(
    comoSeDice(new Error("algo rarísimo"), "No pude cargar tus asignaturas"),
    "No pude cargar tus asignaturas.",
  );
});

test("el punto final no se duplica", () => {
  assert.equal(comoSeDice(new Error("x"), "No pude guardarlo."), "No pude guardarlo.");
});

// El mensaje técnico no se le muestra a nadie: no le sirve a quien lo lee, y
// quien lo necesita lo tiene en la tabla de caídas.
test("sin contexto y sin reconocerla, no se muestra el mensaje técnico", () => {
  for (const tecnico of [
    "ECONNRESET at internal/stream(x)",
    "TypeError: cosa is not a function",
    "invalid input syntax for type uuid",
    "undefined is not an object",
  ]) {
    assert.equal(comoSeDice(new Error(tecnico)), "Algo salió mal. Vuelve a intentarlo.", tecnico);
  }
});

// El otro lado del mismo cuidado: un mensaje que alguien escribió pensando en
// quien lo va a leer no se puede reemplazar por uno genérico. Es lo único que
// ubica a la persona en qué estaba pasando.
test("un mensaje escrito para una persona se deja pasar", () => {
  for (const bueno of [
    "No pude cargar tus asignaturas",
    "Ese correo ya tiene cuenta. Inicia sesión.",
    "El puntaje va entre 0 y 20",
  ]) {
    assert.equal(comoSeDice(new Error(bueno)), bueno);
  }
});

test("aguanta cualquier cosa que le pasen", () => {
  assert.doesNotThrow(() => comoSeDice(undefined));
  assert.doesNotThrow(() => comoSeDice({ raro: true }, "Contexto"));
  assert.equal(comoSeDice("Network request failed"), comoSeDice(new Error("Network request failed")));
});

// Insistir con un permiso denegado no va a servir nunca; con la red, sí.
test("solo se ofrece reintentar cuando insistir puede servir", () => {
  assert.equal(vale_reintentar("red"), true);
  assert.equal(vale_reintentar("otra"), true);
  assert.equal(vale_reintentar("permiso"), false);
  assert.equal(vale_reintentar("sesion"), false);
  assert.equal(vale_reintentar("no_esta"), false);
});
