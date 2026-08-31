import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CORREO, DESDE, DOCUMENTOS, PRIVACIDAD, TERMINOS, TITULAR,
  aviso, comoFecha, comoMarkdown, documento, trozos,
} from "./legales.ts";

test("el aviso de copyright lleva un año solo hasta que pasa el tiempo", () => {
  assert.equal(aviso(DESDE), `© 2026 ${TITULAR}. Todos los derechos reservados.`);
  assert.equal(aviso(DESDE + 3), `© 2026-2029 ${TITULAR}. Todos los derechos reservados.`);
});

test("la fecha se lee como se lee acá", () => {
  assert.equal(comoFecha("2026-08-31"), "31 de agosto de 2026");
  assert.equal(comoFecha("2026-01-01"), "1 de enero de 2026");
});

test("una fecha rota se muestra tal cual y no como «NaN de undefined»", () => {
  assert.equal(comoFecha("mañana"), "mañana");
  assert.equal(comoFecha("2026-13-01"), "2026-13-01");
});

test("la negrita de markdown se vuelve negrita y no asteriscos en pantalla", () => {
  assert.deepEqual(trozos("**El audio no se guarda.** Se descarta."), [
    { texto: "El audio no se guarda.", fuerte: true },
    { texto: " Se descarta.", fuerte: false },
  ]);
});

test("un párrafo sin marcas es un solo trozo, y uno vacío no deja huecos", () => {
  assert.deepEqual(trozos("Hoy StudIA no cobra."), [{ texto: "Hoy StudIA no cobra.", fuerte: false }]);
  assert.deepEqual(trozos("**Solo negrita.**"), [{ texto: "Solo negrita.", fuerte: true }]);
  assert.deepEqual(trozos(""), []);
});

// Una cláusula vacía en un documento legal no es un detalle de estilo: es una
// regla que alguien creyó escribir y no está.
test("ninguna sección queda sin título ni sin contenido", () => {
  for (const d of DOCUMENTOS) {
    assert.ok(d.secciones.length > 0, `${d.id} sin secciones`);
    for (const s of d.secciones) {
      assert.ok(s.titulo.trim(), `${d.id}: sección sin título`);
      assert.ok(s.parrafos.length > 0, `${d.id}: «${s.titulo}» sin párrafos`);
      for (const p of s.parrafos) assert.ok(p.trim(), `${d.id}: «${s.titulo}» con un párrafo vacío`);
    }
  }
});

// Si alguien cambia la dirección de contacto en la constante y el texto queda
// apuntando a la vieja, los derechos que la ley da no tienen a dónde ejercerse.
test("los dos documentos dicen a dónde escribir", () => {
  for (const d of DOCUMENTOS) {
    const todo = d.secciones.flatMap((s) => s.parrafos).join(" ");
    assert.ok(todo.includes(CORREO), `${d.id} no dice a dónde escribir`);
  }
});

// Estas dos frases no son adorno: son la promesa que el código cumple —el
// audio se descarta en el aparato, ver dominio/escucha.ts— y la que sostiene
// que la aplicación es propiedad de alguien. Si alguien las borra al reescribir
// el texto, la prueba avisa antes de que salga publicado.
test("la privacidad sigue diciendo que el audio no se guarda", () => {
  const todo = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ");
  assert.match(todo, /audio de las clases no se guarda/i);
  assert.match(todo, /no se venden/i);
});

test("los términos siguen reservando la propiedad del software", () => {
  const todo = TERMINOS.secciones.flatMap((s) => s.parrafos).join(" ");
  assert.ok(todo.includes(`La aplicación es de ${TITULAR}`) || todo.includes(TITULAR));
  assert.match(todo, /17\.336/);
  assert.match(todo, /entrenar/i);
});

test("el markdown trae todos los títulos y no se llena de líneas en blanco", () => {
  const md = comoMarkdown(PRIVACIDAD);
  assert.ok(md.startsWith("# StudIA — Política de privacidad"));
  for (const s of PRIVACIDAD.secciones) assert.ok(md.includes(`## ${s.titulo}`), s.titulo);
  assert.doesNotMatch(md, /\n\n\n/);
  assert.ok(md.endsWith("\n"));
});

test("se pide un documento por nombre y uno desconocido no deja la pantalla en blanco", () => {
  assert.equal(documento("privacidad").id, "privacidad");
  assert.equal(documento("terminos").id, "terminos");
  assert.equal(documento("lo que sea").id, "terminos");
});
