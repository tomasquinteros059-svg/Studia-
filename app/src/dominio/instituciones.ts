// El contrato de una institución, y qué se puede hacer con él.
//
// StudIA se vende de dos maneras. A una persona, por Google Play: paga, Play
// avisa y el servidor le deja el plan puesto. A una institución, por contrato:
// se conversa, se factura y se firma afuera, y lo que queda escrito acá es una
// sola cosa —cuántas personas cubre—.
//
// Antes el plan se ponía persona por persona desde el panel, y eso tenía un
// problema que no era de pantalla: nada decía cuántos se habían contratado, así
// que nadie podía saber si se estaban entregando de más. Ahora se contratan N
// cupos y la nómina los ocupa; esta unidad es la que sabe cuántos quedan y qué
// se le dice a quien está mirando.

import type { Plan } from "./planes.ts";

/**
 * Lo único que el panel puede poner o sacar.
 *
 * No es `Plan`: «personal» sale de Google Play y no se toca desde acá, ni
 * para darlo ni para quitarlo. Que el tipo lo diga evita tener que acordarse.
 */
export type PlanDeCupo = "gratis" | "institucion";

export type Contrato = {
  id: string;
  nombre: string;
  /** Lo que se firmó. */
  cupos: number;
  /** Cuántas personas de la institución ya tienen el plan puesto. */
  ocupados: number;
  /** Gente de la nómina que todavía no se registra. Ocupará cupos al entrar. */
  esperando: number;
  /** Nulo mientras el contrato no tenga fecha de término. */
  vence_en: string | null;
};

/** Cuántos quedan. Nunca negativo: un contrato reducido no debe verse como −3. */
export function cuposLibres(c: Contrato): number {
  return Math.max(0, c.cupos - c.ocupados);
}

export function vencido(c: Contrato, ahora: Date = new Date()): boolean {
  return c.vence_en !== null && new Date(c.vence_en).getTime() <= ahora.getTime();
}

/**
 * Si a esta persona se le puede dar un cupo ahora.
 *
 * Las tres razones para que no, en orden: ya lo tiene, paga por Google Play
 * —darle uno sería gastar un cupo en alguien que ya tiene todo— o no quedan.
 * La base comprueba lo mismo; esto es para que el botón no invite a algo que
 * va a fallar.
 */
export function sePuedeDarCupo(c: Contrato, plan: Plan, ahora?: Date): boolean {
  if (plan === "institucion" || plan === "personal") return false;
  return !vencido(c, ahora) && cuposLibres(c) > 0;
}

/** Si el cupo de esta persona se le puede quitar desde el panel. */
export function sePuedeQuitarCupo(plan: Plan): boolean {
  // El plan Personal lo puso Google Play. Quitárselo desde acá no le devuelve
  // el dinero y le corta lo que compró.
  return plan === "institucion";
}

/**
 * El contrato en una línea, para el encabezado del panel.
 *
 * Lo primero es lo que se acabó o lo que falta, porque es lo único sobre lo
 * que hay que hacer algo. Un contrato sano se resume y no se explica.
 */
export function comoVaElContrato(c: Contrato, ahora?: Date): string {
  if (vencido(c, ahora)) {
    return `${c.nombre} · contrato vencido: no se están entregando cupos nuevos`;
  }

  const libres = cuposLibres(c);
  const base = `${c.nombre} · ${c.ocupados} de ${c.cupos} cupos`;

  if (c.esperando > libres) {
    const faltan = c.esperando - libres;
    return `${base} · faltan ${faltan} para la gente de la nómina que aún no entra`;
  }
  if (libres === 0) return `${base} · sin cupos libres`;
  if (c.esperando > 0) {
    return `${base} · ${c.esperando} de la nómina todavía no se registra`;
  }
  return `${base} · quedan ${libres}`;
}

/** Por qué el botón está apagado. Se muestra al tocarlo, no antes. */
export function porQueNoHayCupo(c: Contrato, plan: Plan, ahora?: Date): string {
  if (plan === "personal") {
    return "Esta persona ya paga el plan Personal por Google Play. Darle un "
      + "cupo de la institución sería gastarlo en alguien que ya tiene todo.";
  }
  if (vencido(c, ahora)) {
    return "El contrato está vencido. Mientras no se renueve no se entregan "
      + "cupos nuevos; quien ya tiene el suyo no lo pierde.";
  }
  return "No quedan cupos en el contrato. Quítale el cupo a alguien que ya no "
    + "esté en la institución, o amplía el contrato.";
}

/**
 * Si el contrato pide atención ahora.
 *
 * Vencido, sin cupos libres, o con más gente esperando en la nómina que
 * cupos para recibirla. Los tres se arreglan antes de que alguien se quede
 * afuera; el resto del tiempo el encabezado es informativo y no debe gritar.
 */
export function hayQueMirarElContrato(c: Contrato, ahora?: Date): boolean {
  return vencido(c, ahora) || cuposLibres(c) === 0 || c.esperando > cuposLibres(c);
}
