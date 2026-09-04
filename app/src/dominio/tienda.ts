// Dónde se puede pagar, y qué se puede decir en cada lado.
//
// No es una decisión de diseño: es la política de Google Play. Una aplicación
// que vende contenido digital tiene que cobrarlo con el sistema de Play, y no
// puede mostrar precios que lleven a pagar por fuera. Un catálogo de precios
// con un botón que en realidad manda a otra parte es motivo de rechazo, y
// después de suspensión.
//
// En el navegador no rige nada de eso: ahí los precios se muestran como lo que
// son, información de una página.
//
// Cuando existan los productos creados en Play y el módulo de compra dentro de
// la aplicación, `HAY_COMPRA_EN_PLAY` pasa a `true` y los precios vuelven a
// aparecer en el teléfono, ya con un botón que cobra de verdad.

import type { Plan } from "./planes.ts";

/**
 * ¿Está conectado el cobro por Google Play?
 *
 * Falso hasta que existan los productos en Play Console y el módulo de compra
 * en la aplicación. Es una sola línea a propósito: el día que exista, se
 * cambia acá y no en seis pantallas.
 */
export const HAY_COMPRA_EN_PLAY = false;

/** En el teléfono, un precio solo se muestra si se puede cobrar ahí mismo. */
export function seMuestranPrecios(plataforma: string): boolean {
  return plataforma === "web" || HAY_COMPRA_EN_PLAY;
}

/**
 * Qué dice el botón de cada plan, según dónde se esté mirando.
 *
 * `null` significa que ese plan no lleva botón: mostrarlo sin poder cumplir lo
 * que ofrece es peor que no mostrarlo.
 */
export function accionDelPlan(
  plan: Plan,
  plataforma: string,
): { texto: string; tipo: "entrar" | "escribir" } | null {
  if (plan === "institucion") {
    // Un contrato con un colegio no es una compra dentro de la aplicación:
    // se conversa, se factura y se firma afuera. Play no se mete ahí.
    return { texto: "Escríbenos", tipo: "escribir" };
  }
  if (plan === "gratis") {
    return { texto: "Crear cuenta gratis", tipo: "entrar" };
  }
  // El personal: solo cuando se pueda cobrar de verdad.
  return seMuestranPrecios(plataforma)
    ? { texto: "Empezar con Personal", tipo: "entrar" }
    : null;
}

/** Lo que se dice del cobro, que cambia según dónde y según si ya existe. */
export function comoEstaElCobro(plataforma: string): string {
  if (HAY_COMPRA_EN_PLAY) {
    return "El plan Personal se paga con Google Play, con tu método de siempre.";
  }
  if (plataforma === "web") {
    return (
      "Todavía no hay cobro conectado: las cuentas nuevas parten en el plan " +
      "gratis y nadie va a pagar nada sin que se le diga antes."
    );
  }
  return (
    "El plan Personal todavía no se puede contratar desde la aplicación. " +
    "Las cuentas nuevas parten en el plan gratis."
  );
}
