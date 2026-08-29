import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROVEEDORES, motivoDeFalla, nombreDe, sesionDesdeUrl,
} from "./acceso-proveedores.ts";

test("los proveedores tienen nombre para mostrar", () => {
  assert.equal(nombreDe("google"), "Google");
  assert.equal(nombreDe("azure"), "Microsoft");
  assert.ok(PROVEEDORES.every((p) => p.nombre && p.marca));
});

// ── Las fallas, dichas para quien las lee ───────────────────────────────

test("un proveedor sin configurar se explica, y dice qué hacer mientras", () => {
  const m = motivoDeFalla("google", "Unsupported provider: provider is not enabled");
  assert.match(m, /Google/);
  assert.match(m, /no está habilitado/);
  assert.match(m, /correo/);
});

test("si la persona canceló no se le muestra ningún error", () => {
  assert.equal(motivoDeFalla("google", "User cancelled the flow"), "");
  assert.equal(motivoDeFalla("azure", "The operation was dismissed"), "");
});

test("un problema de red se dice como problema de red", () => {
  assert.match(motivoDeFalla("google", "Network request failed"), /internet/);
});

test("una falla que no se reconoce igual dice qué hacer", () => {
  const m = motivoDeFalla("azure", "algo rarísimo pasó");
  assert.match(m, /Microsoft/);
  assert.match(m, /correo/);
});

// ── Lo que vuelve del proveedor ─────────────────────────────────────────

test("lee los datos de sesión del fragmento", () => {
  const v = sesionDesdeUrl("studia://#access_token=abc&refresh_token=def&expires_in=3600");
  assert.deepEqual(v, { access_token: "abc", refresh_token: "def" });
});

test("también los lee si vienen en la consulta", () => {
  const v = sesionDesdeUrl("https://studia.cl/?access_token=abc&refresh_token=def");
  assert.deepEqual(v, { access_token: "abc", refresh_token: "def" });
});

test("media sesión no es sesión", () => {
  assert.equal(sesionDesdeUrl("studia://#access_token=abc"), null);
  assert.equal(sesionDesdeUrl("studia://#refresh_token=def"), null);
  assert.equal(sesionDesdeUrl("studia://"), null);
  assert.equal(sesionDesdeUrl(""), null);
});

test("una vuelta con error no se confunde con una sesión", () => {
  assert.equal(
    sesionDesdeUrl("studia://#error=access_denied&error_description=El%20usuario%20canceló"),
    null,
  );
});

test("lo que viene codificado se decodifica", () => {
  const v = sesionDesdeUrl("studia://#access_token=a%2Bb&refresh_token=c%2Fd");
  assert.deepEqual(v, { access_token: "a+b", refresh_token: "c/d" });
});

test("el fragmento manda sobre la consulta si vinieran los dos", () => {
  const v = sesionDesdeUrl("studia://?access_token=viejo&refresh_token=viejo#access_token=nuevo&refresh_token=nuevo");
  assert.deepEqual(v, { access_token: "nuevo", refresh_token: "nuevo" });
});
