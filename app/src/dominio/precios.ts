// Los planes y lo que cuestan.
//
// Los montos no son una conversión del dólar: son precios pensados en cada
// moneda, redondeados a una cifra que se pueda decir en voz alta. Convertir
// 16 dólares a pesos chilenos da 15.238, que no es un precio, es el resultado
// de una división.
//
// El formato de los números se hace a mano y no con `Intl`. En el navegador
// `Intl` está completo, pero en Android el motor puede traerlo recortado según
// cómo se compiló, y un precio que en un teléfono sale «14990» y en otro
// «14.990» es exactamente la clase de detalle que hace desconfiar de una
// pantalla de precios.

export type Moneda = {
  codigo: string;
  nombre: string;
  simbolo: string;
  /** Lo que cuesta el plan Personal al mes, en esta moneda. */
  personal: number;
  /** Qué separa los miles. En casi toda América Latina es el punto. */
  separador: "." | ",";
};

export const MONEDAS: Moneda[] = [
  { codigo: "CLP", nombre: "Peso chileno",     simbolo: "$",   personal: 14990, separador: "." },
  { codigo: "USD", nombre: "Dólar",            simbolo: "US$", personal: 16,    separador: "," },
  { codigo: "MXN", nombre: "Peso mexicano",    simbolo: "$",   personal: 299,   separador: "," },
  { codigo: "COP", nombre: "Peso colombiano",  simbolo: "$",   personal: 64900, separador: "." },
  { codigo: "PEN", nombre: "Sol peruano",      simbolo: "S/",  personal: 59,    separador: "," },
  { codigo: "ARS", nombre: "Peso argentino",   simbolo: "$",   personal: 18900, separador: "." },
  { codigo: "UYU", nombre: "Peso uruguayo",    simbolo: "$",   personal: 650,   separador: "." },
  { codigo: "BRL", nombre: "Real brasileño",   simbolo: "R$",  personal: 89,    separador: "." },
  { codigo: "EUR", nombre: "Euro",             simbolo: "€",   personal: 15,    separador: "." },
];

/** La de referencia: es contra la que se comparan todas las demás. */
export const MONEDA_BASE = "USD";

const POR_PAIS: Record<string, string> = {
  CL: "CLP", MX: "MXN", CO: "COP", PE: "PEN", AR: "ARS", UY: "UYU", BR: "BRL",
  ES: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", PT: "EUR",
  US: "USD", EC: "USD", PA: "USD", SV: "USD", PR: "USD",
};

export const monedaPorCodigo = (codigo: string): Moneda =>
  MONEDAS.find((m) => m.codigo === codigo) ?? MONEDAS.find((m) => m.codigo === MONEDA_BASE)!;

/**
 * Qué moneda mostrarle a alguien cuyo idioma es «es-CL», «pt-BR» o «es».
 *
 * Sin país no se adivina: alguien con el teléfono en «es» a secas puede estar
 * en cualquier parte, y mostrarle pesos chilenos porque sí es peor que
 * mostrarle dólares, que al menos se entiende como el precio de referencia.
 */
export function monedaDeIdioma(idioma: string | undefined | null): Moneda {
  const partes = (idioma ?? "").replace(/_/g, "-").split("-");
  const pais = partes.length > 1 ? (partes[partes.length - 1] ?? "").toUpperCase() : "";
  return monedaPorCodigo(POR_PAIS[pais] ?? MONEDA_BASE);
}

/** "14990" a "14.990". Agrupa de a tres desde la derecha. */
export function agrupar(monto: number, separador: "." | ","): string {
  const entero = Math.round(Math.abs(monto)).toString();
  const grupos: string[] = [];
  for (let i = entero.length; i > 0; i -= 3) {
    grupos.unshift(entero.slice(Math.max(0, i - 3), i));
  }
  return (monto < 0 ? "-" : "") + grupos.join(separador);
}

/** "$14.990", "US$16", "€15". */
export const comoPrecio = (monto: number, moneda: Moneda): string =>
  `${moneda.simbolo}${agrupar(monto, moneda.separador)}`;

/**
 * La línea de referencia debajo del precio.
 *
 * En dólares no se pone: decir «US$16 equivale a US$16» es ruido, y es
 * justamente el caso que se olvida cuando la línea se arma con una plantilla.
 */
export function referencia(moneda: Moneda): string | null {
  if (moneda.codigo === MONEDA_BASE) return null;
  const base = monedaPorCodigo(MONEDA_BASE);
  return `equivale a ${comoPrecio(base.personal, base)} al mes`;
}

// ── Los planes ────────────────────────────────────────────────────────────

export type Plan = {
  id: "gratis" | "personal" | "institucion";
  nombre: string;
  para: string;
  /** Null cuando el precio se conversa. */
  precio: "cero" | "personal" | null;
  periodo: string;
  /** Lo que trae. `false` es lo que no trae, y se muestra tachado. */
  incluye: { texto: string; hay: boolean }[];
  accion: string;
  destacado?: boolean;
};

export const PLANES: Plan[] = [
  {
    id: "gratis",
    nombre: "Gratis",
    para: "Para probar StudIA y ordenar tu semestre",
    precio: "cero",
    periodo: "para siempre",
    incluye: [
      { texto: "2 ramos activos", hay: true },
      { texto: "Apuntes y resúmenes", hay: true },
      { texto: "El planificador de la semana", hay: true },
      { texto: "5 quices al mes", hay: true },
      { texto: "El tutor sin límite", hay: false },
      { texto: "Fichas con repetición espaciada", hay: false },
      { texto: "Estudiar sin conexión", hay: false },
    ],
    accion: "Crear cuenta gratis",
  },
  {
    id: "personal",
    nombre: "Personal",
    para: "Para estudiar en serio, sin toparte con un tope",
    precio: "personal",
    periodo: "al mes",
    destacado: true,
    incluye: [
      { texto: "Ramos ilimitados", hay: true },
      { texto: "El tutor sin límite", hay: true },
      { texto: "Quices y fichas sin límite", hay: true },
      { texto: "Repetición espaciada en todos tus temas", hay: true },
      { texto: "El lector en voz alta", hay: true },
      { texto: "Tus notas y cuánto te falta para aprobar", hay: true },
      { texto: "Estudiar sin conexión: tus ramos guardados en el teléfono", hay: true },
    ],
    accion: "Empezar con Personal",
  },
  {
    id: "institucion",
    nombre: "Institución",
    para: "Para colegios, universidades y carreras",
    precio: null,
    periodo: "según el tamaño",
    incluye: [
      { texto: "Todo lo del plan Personal", hay: true },
      { texto: "Cuentas para todo el alumnado", hay: true },
      { texto: "Panel docente con el avance del curso", hay: true },
      { texto: "El semestre completo cargado de una vez", hay: true },
      { texto: "Acompañamiento para partir", hay: true },
      { texto: "Factura a nombre de la institución", hay: true },
    ],
    accion: "Escríbenos",
  },
];

/** El precio que va en la tarjeta de un plan, ya escrito. */
export function precioDe(plan: Plan, moneda: Moneda): string {
  if (plan.precio === null) return "Conversemos";
  if (plan.precio === "cero") return comoPrecio(0, moneda);
  return comoPrecio(moneda.personal, moneda);
}
