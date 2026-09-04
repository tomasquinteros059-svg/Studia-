import { test } from "node:test";
import assert from "node:assert/strict";
import { HAY_COMPRA_EN_PLAY, accionDelPlan, comoEstaElCobro, seMuestranPrecios } from "./tienda.ts";

test("en el navegador los precios se muestran", () => {
  assert.equal(seMuestranPrecios("web"), true);
});

test("en el teléfono no se muestran mientras no se pueda cobrar ahí mismo", () => {
  // Es la política de Play: precios de contenido digital que llevan a pagar
  // por fuera son motivo de rechazo.
  assert.equal(seMuestranPrecios("android"), HAY_COMPRA_EN_PLAY);
  assert.equal(seMuestranPrecios("ios"), HAY_COMPRA_EN_PLAY);
});

test("el plan personal no ofrece un botón que no puede cumplir", () => {
  const boton = accionDelPlan("personal", "android");
  if (HAY_COMPRA_EN_PLAY) {
    assert.deepEqual(boton, { texto: "Empezar con Personal", tipo: "entrar" });
  } else {
    // Mostrar «Empezar con Personal» y llevar a una pantalla que no cobra es
    // exactamente lo que Play rechaza.
    assert.equal(boton, null);
  }
});

test("en el navegador el plan personal sí lleva botón", () => {
  assert.deepEqual(accionDelPlan("personal", "web"),
    { texto: "Empezar con Personal", tipo: "entrar" });
});

test("el gratis siempre lleva botón: no hay nada que cobrar", () => {
  for (const donde of ["web", "android", "ios"]) {
    assert.deepEqual(accionDelPlan("gratis", donde),
      { texto: "Crear cuenta gratis", tipo: "entrar" });
  }
});

test("la institución escribe, en todas partes", () => {
  // Un contrato con un colegio se conversa y se factura afuera; Play no se
  // mete en eso.
  for (const donde of ["web", "android", "ios"]) {
    assert.deepEqual(accionDelPlan("institucion", donde),
      { texto: "Escríbenos", tipo: "escribir" });
  }
});

test("lo que se dice del cobro no promete lo que no hay", () => {
  const enElTelefono = comoEstaElCobro("android");
  assert.match(enElTelefono, /parten en el plan gratis/);
  assert.doesNotMatch(enElTelefono, /\$|CLP|USD/);
});

test("y en el navegador tampoco", () => {
  assert.match(comoEstaElCobro("web"), /Todavía no hay cobro conectado/);
});
