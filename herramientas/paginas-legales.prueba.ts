import { test } from "node:test";
import assert from "node:assert/strict";
import { PRIVACIDAD, TERMINOS } from "../app/src/dominio/legales.ts";
// @ts-expect-error el generador es JavaScript y no tiene tipos propios
import { paginaLegal } from "./paginas-legales.mjs";

test("la página trae el documento entero", () => {
  const html: string = paginaLegal(PRIVACIDAD, "/studia");
  for (const s of PRIVACIDAD.secciones) assert.ok(html.includes(s.titulo), s.titulo);
  assert.match(html, /<html lang="es">/);
  assert.match(html, /Política de privacidad/);
});

test("la negrita se marca y los asteriscos no llegan a la página", () => {
  const html: string = paginaLegal(PRIVACIDAD);
  assert.match(html, /<strong>El audio de las clases no se guarda\.<\/strong>/);
  assert.ok(!html.includes("**"));
});

// Un «<» del texto legal que llegara crudo cortaría la página justo ahí, y lo
// que sigue —que suele ser el resto del documento— no se vería.
test("lo que en HTML significa otra cosa se escapa", () => {
  const inventado = {
    id: "terminos", titulo: 'Prueba & "comillas"', bajada: "a < b",
    actualizado: "2026-08-31",
    secciones: [{ titulo: "1. <script>", parrafos: ["Nada de <b>esto</b> se interpreta."] }],
  };
  const html: string = paginaLegal(inventado);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;esto&lt;/b&gt;"));
  assert.ok(html.includes("Prueba &amp; &quot;comillas&quot;"));
});

test("el pie reclama la propiedad y enlaza los dos documentos", () => {
  const html: string = paginaLegal(TERMINOS, "/studia");
  assert.match(html, /Todos los derechos reservados/);
  assert.match(html, /href="\/studia\/privacidad\.html"/);
  assert.match(html, /noai/);
});
