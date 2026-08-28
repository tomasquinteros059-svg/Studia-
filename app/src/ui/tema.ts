// El sistema visual de Acta.
//
// La idea que ordena todo: **esto se parece a un documento, no a un panel**.
// El producto es un acta —de asamblea, de obra, de directorio— y la gente que
// lo va a usar convive con actas, minutas y libros de obra. De ahí salen las
// decisiones: tinta sobre papel, filetes finos en vez de sombras, acuerdos
// con su número colgando en el margen, y las cifras alineadas como en una
// planilla.
//
// El azul de tinta no es decorativo. El celeste de aplicación —ese #208AEF
// que trae media internet— dice "software"; un ultramar dice "documento", y
// es lo que este producto necesita decir para que alguien confíe en pegarle
// una asamblea adentro.

import { Platform } from "react-native";
import type { TextStyle } from "react-native";

export const color = {
  /* La tinta y el papel. */
  texto:       "#15181C",
  textoSuave:  "#5A5F66",
  textoTenue:  "#8B9097",
  fondo:       "#F3F3F0",
  papel:       "#FFFFFF",
  elemento:    "#EAEAE5",
  borde:       "#E4E4DF",
  bordeFuerte: "#CFCFC8",

  /* La marca: un ultramar de tinta, no un celeste de aplicación. */
  marca:       "#23429B",
  marcaOscura: "#172C6B",
  sobreMarca:  "#FFFFFF",

  /* Los estados. Van aparte de la marca a propósito: si el color de la marca
     también significara "todo bien", no quedaría ninguno para decirlo. */
  vivo:        "#B3261E",
  ambar:       "#92500B",
  ok:          "#1F6B45",

  nocturno:    "#15181C",
} as const;

export const radio = { campo: 10, boton: 10, tarjeta: 12, burbuja: 14, pastilla: 999 } as const;

export const espacio = { xs: 4, s: 8, m: 14, l: 18, xl: 26 } as const;

/** El filete de un documento: lo más fino que el aparato sepa dibujar. */
export const FILETE = Platform.select({ ios: 0.5, default: 0.7 }) as number;

/**
 * Para códigos, horas y cifras. En un acta los números se alinean, y una
 * tipografía de ancho fijo es lo que hace que un código de sala dictado en
 * voz alta se lea sin equivocarse.
 */
export const monoespaciada = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, monospace",
}) as string;

/** Cifras que se alinean en columna, como en una planilla. */
export const cifras: { fontVariant: TextStyle["fontVariant"] } = {
  fontVariant: ["tabular-nums"],
};

export const tipo = {
  /* La escala. Seis tamaños y ni uno más: cada uno tiene su trabajo. */
  portada:   { fontSize: 29, fontWeight: "700", letterSpacing: -0.6, color: color.texto },
  titulo:    { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, color: color.texto },
  subtitulo: { fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: color.texto },
  fila:      { fontSize: 15.5, fontWeight: "600", letterSpacing: -0.1, color: color.texto },
  cuerpo:    { fontSize: 14.5, color: color.texto },
  detalle:   { fontSize: 12.5, color: color.textoSuave },
  /* El rótulo de sección de un documento: chico, espaciado, en versales. */
  etiqueta: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: color.textoTenue,
  },
} as const;

/** Un color de estado, atenuado, para el fondo de una pastilla o un icono. */
export const tenue = (hex: string) => `${hex}14`;

/** Algo más marcado que `tenue`, para un bloque que sí tiene que pesar. */
export const velado = (hex: string) => `${hex}24`;

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const nombreDia = (n: number) => DIAS[n] ?? "";
export const diaCorto = (n: number) => (DIAS[n] ?? "").slice(0, 3);

/** "1:04:00" o "14:32" — para duraciones. */
export function duracion(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dosDigitos(m)}:${dosDigitos(s)}` : `${dosDigitos(m)}:${dosDigitos(s)}`;
}

/** "Jue 20 ago" */
export function fechaCorta(iso: string): string {
  const f = new Date(iso);
  const dia = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][f.getDay()] ?? "";
  const mes = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][f.getMonth()] ?? "";
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${f.getDate()} ${mes}`;
}

/** "Vie 28 ago, 23:59" */
export function fechaYHora(iso: string): string {
  const f = new Date(iso);
  return `${fechaCorta(iso)}, ${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

/** "08:30" a partir de "08:30:00" */
export const hora = (t: string) => t.slice(0, 5);
