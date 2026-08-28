import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSTITUCIONES, caminoDe, comoSePresenta, dominioDe, institucionDe,
  normalizarCorreo,
} from "./acceso.ts";

// ── Normalizar ──────────────────────────────────────────────────────────

test("el correo se guarda en minúsculas y sin espacios", () => {
  assert.equal(normalizarCorreo("  Eduardo.Q@UC.CL  "), "eduardo.q@uc.cl");
});

test("el dominio sale de después del arroba", () => {
  assert.equal(dominioDe("eduardo@alumnos.uc.cl"), "alumnos.uc.cl");
});

test("sin arroba, o con dos, no hay dominio", () => {
  assert.equal(dominioDe("eduardo"), "");
  assert.equal(dominioDe("a@b@c"), "");
});

// ── Reconocer la institución ────────────────────────────────────────────

test("reconoce un correo institucional", () => {
  assert.equal(institucionDe("eduardo@uc.cl")?.nombre,
    "Pontificia Universidad Católica de Chile");
});

test("reconoce el subdominio de alumnos", () => {
  assert.equal(institucionDe("eduardo@alumnos.uc.cl")?.dominio, "uc.cl");
  assert.equal(institucionDe("ana@ug.uchile.cl")?.dominio, "uchile.cl");
});

test("un dominio que solo TERMINA parecido no cuenta", () => {
  // Sin el punto, "nouc.cl" pasaría por Católica: es el error clásico de
  // comparar con endsWith a secas, y sería dar acceso institucional a un
  // dominio que cualquiera puede comprar.
  assert.equal(institucionDe("alguien@nouc.cl"), null);
  assert.equal(institucionDe("alguien@falsouchile.cl"), null);
});

test("un correo común no es de ninguna institución", () => {
  for (const c of ["alguien@gmail.com", "alguien@hotmail.com", "alguien@empresa.cl"]) {
    assert.equal(institucionDe(c), null, c);
  }
});

test("reconocer no distingue mayúsculas", () => {
  assert.equal(institucionDe("Eduardo@Alumnos.UC.CL")?.dominio, "uc.cl");
});

// ── Elegir el camino ────────────────────────────────────────────────────

test("un correo institucional entra por su institución", () => {
  const c = caminoDe("eduardo@alumnos.usach.cl");
  assert.equal(c.tipo, "institucion");
  if (c.tipo === "institucion") {
    assert.equal(c.institucion.dominio, "usach.cl");
    assert.equal(c.correo, "eduardo@alumnos.usach.cl");
  }
});

test("cualquier otro correo entra por su cuenta", () => {
  const c = caminoDe("alguien@gmail.com");
  assert.equal(c.tipo, "propio");
});

test("el correo del camino ya viene normalizado", () => {
  const c = caminoDe("  ALGUIEN@Gmail.com ");
  if (c.tipo === "propio") assert.equal(c.correo, "alguien@gmail.com");
  else assert.fail("debería ser propio");
});

test("un correo mal escrito no entra por ningún lado", () => {
  for (const malo of ["", "   ", "eduardo", "eduardo@", "@uc.cl", "a b@uc.cl", "eduardo@uc"]) {
    assert.equal(caminoDe(malo).tipo, "invalido", JSON.stringify(malo));
  }
});

test("cada correo inválido dice qué le pasa", () => {
  const vacio = caminoDe("");
  const roto = caminoDe("eduardo");
  if (vacio.tipo !== "invalido" || roto.tipo !== "invalido") assert.fail("deberían ser inválidos");
  assert.match(vacio.motivo, /Escribe tu correo/);
  assert.match(roto.motivo, /no parece un correo/);
});

test("un correo larguísimo se rechaza en vez de viajar", () => {
  assert.equal(caminoDe(`${"a".repeat(250)}@uc.cl`).tipo, "invalido");
});

// ── Lo que se le dice a la persona ──────────────────────────────────────

test("a quien llega por su cuenta se le explica qué va a poder hacer", () => {
  const texto = comoSePresenta(caminoDe("alguien@gmail.com"));
  assert.match(texto, /armas tus propios ramos/);
  assert.match(texto, /El tutor y el lector funcionan igual/);
});

test("a quien viene de una institución sin convenio no se le miente", () => {
  // Decirle "tus ramos van a aparecer solos" y que no aparezcan es peor que
  // no reconocerlo: se explica que entra por su cuenta mientras tanto.
  const texto = comoSePresenta(caminoDe("eduardo@uc.cl"));
  assert.match(texto, /todavía no tenemos convenio/);
  assert.match(texto, /por tu cuenta/);
});

test("a quien viene de una institución conectada se le anticipa qué verá", () => {
  const conectada = { dominio: "x.cl", nombre: "Universidad X", conectada: true };
  const texto = comoSePresenta({ tipo: "institucion", institucion: conectada, correo: "a@x.cl" });
  assert.match(texto, /Tus ramos, tu horario y tus notas van a aparecer solos/);
});

test("un correo inválido muestra su propio motivo", () => {
  assert.match(comoSePresenta(caminoDe("eduardo")), /no parece un correo/);
});

// ── El registro de instituciones ────────────────────────────────────────

test("no hay dominios repetidos", () => {
  const dominios = INSTITUCIONES.map((i) => i.dominio);
  assert.equal(new Set(dominios).size, dominios.length);
});

test("los dominios están normalizados y son plausibles", () => {
  for (const i of INSTITUCIONES) {
    assert.equal(i.dominio, i.dominio.toLowerCase().trim(), i.dominio);
    assert.match(i.dominio, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/, i.dominio);
    assert.ok(i.nombre.length > 3, i.nombre);
  }
});

test("ninguna institución está marcada como conectada todavía", () => {
  // Marcar una como conectada sin la API detrás prometería ramos que no
  // llegan. Esta prueba se cae a propósito el día que haya una de verdad.
  assert.deepEqual(INSTITUCIONES.filter((i) => i.conectada), []);
});
