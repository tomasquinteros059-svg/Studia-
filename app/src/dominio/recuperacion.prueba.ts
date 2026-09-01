import { test } from "node:test";
import assert from "node:assert/strict";
import { leerEnlace } from "./recuperacion.ts";

test("el enlace bueno trae los dos tokens", () => {
  const e = leerEnlace("studia://recuperar#access_token=aaa&refresh_token=bbb&type=recovery&expires_in=3600");
  assert.deepEqual(e, { tipo: "recuperar", acceso: "aaa", refresco: "bbb" });
});

// Según cómo rebote, lo mismo puede llegar como consulta normal. Leer una
// forma sola deja a la persona a medio camino y sin explicación.
test("da igual si viene detrás de # o de ?", () => {
  const e = leerEnlace("studia://recuperar?access_token=aaa&refresh_token=bbb&type=recovery");
  assert.deepEqual(e, { tipo: "recuperar", acceso: "aaa", refresco: "bbb" });
});

// El enlace dura una hora y la gente abre el correo al otro día. Es el caso
// más común de todos, no uno raro.
test("un enlace vencido lo dice, y dice qué hacer", () => {
  const e = leerEnlace("studia://recuperar#error=access_denied&error_code=otp_expired"
    + "&error_description=Email+link+is+invalid+or+has+expired");
  assert.equal(e.tipo, "problema");
  assert.match(e.tipo === "problema" ? e.mensaje : "", /venció.*Pide uno nuevo/s);
});

test("un enlace ya usado también se explica en castellano", () => {
  const e = leerEnlace("studia://recuperar#error=invalid_request&error_description=Token+invalid");
  assert.equal(e.tipo, "problema");
  assert.match(e.tipo === "problema" ? e.mensaje : "", /ya no sirve/);
});

test("un enlace de recuperación sin tokens no se da por bueno", () => {
  const e = leerEnlace("studia://recuperar#type=recovery&expires_in=3600");
  assert.equal(e.tipo, "problema");
  assert.match(e.tipo === "problema" ? e.mensaje : "", /incompleto/);
});

test("abrir la app por cualquier otra razón no dispara nada", () => {
  assert.deepEqual(leerEnlace("studia://"), { tipo: "otro" });
  assert.deepEqual(leerEnlace("studia://tarea/17"), { tipo: "otro" });
  assert.deepEqual(leerEnlace("studia://algo#type=signup&access_token=a&refresh_token=b"), { tipo: "otro" });
  assert.deepEqual(leerEnlace(null), { tipo: "otro" });
  assert.deepEqual(leerEnlace(""), { tipo: "otro" });
});
