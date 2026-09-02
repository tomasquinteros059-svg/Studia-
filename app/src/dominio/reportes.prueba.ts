import { test } from "node:test";
import assert from "node:assert/strict";
import { LARGO_CONTENIDO, MOTIVOS, revisar } from "./reportes.ts";

test("sin elegir qué pasó no se manda nada", () => {
  const r = revisar({ origen: "tutor", contenido: "una respuesta", motivo: null });
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.motivo : "", /Elige/);
});

test("no se puede reportar una respuesta vacía", () => {
  const r = revisar({ origen: "tutor", contenido: "   ", motivo: "ofensivo" });
  assert.equal(r.ok, false);
});

test("«otra cosa» pide que cuenten qué pasó", () => {
  const sinDetalle = revisar({ origen: "tutor", contenido: "algo", motivo: "otro" });
  assert.equal(sinDetalle.ok, false);

  const conDetalle = revisar({
    origen: "tutor", contenido: "algo", motivo: "otro", detalle: "me repitió lo mismo tres veces",
  });
  assert.equal(conDetalle.ok, true);
});

test("los otros motivos no piden detalle", () => {
  for (const { motivo } of MOTIVOS.filter((m) => m.motivo !== "otro")) {
    const r = revisar({ origen: "tutor", contenido: "algo", motivo });
    assert.equal(r.ok, true, `${motivo} debería poder mandarse sin detalle`);
  }
});

test("una respuesta larguísima se recorta en vez de rechazarse", () => {
  // Que un reporte se pierda porque la respuesta era larga sería justo al
  // revés de lo que hace falta.
  const larga = "a".repeat(LARGO_CONTENIDO + 500);
  const r = revisar({ origen: "resumen", contenido: larga, motivo: "falso" });

  assert.equal(r.ok, true);
  assert.equal(r.ok && r.reporte.contenido.length, LARGO_CONTENIDO);
});

test("se guarda el principio, que es lo que alcanzaron a leer", () => {
  const larga = "ESTO ES LO QUE MOLESTÓ. " + "relleno ".repeat(2000);
  const r = revisar({ origen: "tutor", contenido: larga, motivo: "ofensivo" });
  assert.ok(r.ok && r.reporte.contenido.startsWith("ESTO ES LO QUE MOLESTÓ."));
});

test("el detalle vacío no viaja como cadena vacía", () => {
  const r = revisar({ origen: "quiz", contenido: "algo", motivo: "falso", detalle: "   " });
  assert.equal(r.ok, true);
  assert.equal(r.ok && "detalle" in r.reporte, false);
});

test("los espacios de más no llegan a la base", () => {
  const r = revisar({
    origen: "fichas", contenido: "  la respuesta  ", motivo: "falso", detalle: "  no es así  ",
  });
  assert.equal(r.ok && r.reporte.contenido, "la respuesta");
  assert.equal(r.ok && r.reporte.detalle, "no es así");
});

test("los motivos están escritos para quien reporta, no para quien modera", () => {
  // Nadie que acaba de leer algo que le molestó elige entre «contenido
  // inapropiado» y «desinformación».
  for (const m of MOTIVOS) {
    assert.ok(m.texto.length > 0 && m.detalle.length > 0);
    assert.ok(!/inapropiado|desinformaci/i.test(m.texto), `«${m.texto}» está en jerga`);
  }
  assert.equal(MOTIVOS.length, 4);
});
