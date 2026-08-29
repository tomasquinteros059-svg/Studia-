// El sistema visual de StudIA.
//
// La idea que ordena todo: **el color siempre significa un ramo**.
//
// Cada asignatura tiene el suyo, y ese color es dueño de la pantalla cuando
// estás adentro: la cabecera, el ícono, la frase que el lector va resaltando.
// Así sabes dónde estás sin leer nada, que es lo que de verdad hace fácil una
// aplicación con seis ramos encima.
//
// El corolario es lo que la mantiene elegante: si el color es del ramo,
// entonces NADA MÁS lleva color. Los botones son tinta, la barra de abajo es
// tinta, las tarjetas son papel. Seis colores fuertes sobre un fondo neutro
// se ven vivos; los mismos seis peleando con un celeste de marca se ven
// desordenados.

import { Platform } from "react-native";
import type { TextStyle } from "react-native";

// El color de cada ramo vive en el dominio: no es una decisión de estilo,
// es la regla con la que la persona sabe dónde está.
export { COLORES_DE_RAMO, colorDeRamo, inicialesDeRamo } from "../dominio/ramos.ts";

export const color = {
  /* Tinta y papel. El negro tira a cálido, no a azul: acompaña mejor a los
     seis colores de ramo, que son todos saturados. */
  texto:       "#191A1F",
  textoSuave:  "#5C5E66",
  textoTenue:  "#8E9098",
  fondo:       "#F7F6F4",
  papel:       "#FFFFFF",
  elemento:    "#EFEEEA",
  borde:       "#E8E6E2",
  bordeFuerte: "#D5D2CC",

  /* Lo que en el resto de la aplicación sería "la marca". Acá es tinta: los
     botones principales son negros para que el color quede libre. */
  marca:       "#191A1F",
  marcaOscura: "#000000",
  sobreMarca:  "#FFFFFF",

  /* Estados. Van aparte de los colores de ramo porque significan otra cosa:
     un ramo es dónde estás, un estado es qué te pasa. */
  vivo:        "#C0392B",
  ambar:       "#B26A08",
  ok:          "#1B7A4F",

  nocturno:    "#191A1F",
} as const;

/* Más redondo que un panel de trabajo: esto lo usa alguien estudiando en su
   casa, no alguien firmando un acta. */
export const radio = { campo: 14, boton: 16, tarjeta: 20, burbuja: 18, pastilla: 999 } as const;

export const espacio = { xs: 4, s: 8, m: 14, l: 20, xl: 30 } as const;

/** El filete más fino que el aparato sepa dibujar. */
export const FILETE = Platform.select({ ios: 0.5, default: 0.7 }) as number;

/**
 * Las tipografías de la portada.
 *
 * Solo llegan en el navegador: las carga la página que envuelve al paquete
 * web, junto al resto de la hoja. En el teléfono no se cargan a propósito
 * —serían un megabyte de fuentes dentro del APK para una sola pantalla— y
 * cae en la del sistema, que es la que usa toda la aplicación de todos modos.
 */
export const letra = {
  titulo: Platform.select({ web: "'Bricolage Grotesque', system-ui, sans-serif", default: undefined }),
  cuerpo: Platform.select({ web: "'Instrument Sans', system-ui, sans-serif", default: undefined }),
  mano: Platform.select({ web: "'Caveat', 'Bradley Hand', cursive", default: undefined }),
} as const;

/** Cifras que se alinean: notas, horas, minutos de lectura. */
export const cifras: { fontVariant: TextStyle["fontVariant"] } = {
  fontVariant: ["tabular-nums"],
};

export const tipo = {
  /* Grande y con aire: se lee de reojo, con el teléfono apoyado en la mesa. */
  portada:   { fontSize: 30, fontWeight: "700", letterSpacing: -0.8, color: color.texto },
  titulo:    { fontSize: 23, fontWeight: "700", letterSpacing: -0.5, color: color.texto },
  subtitulo: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: color.texto },
  fila:      { fontSize: 16, fontWeight: "600", letterSpacing: -0.2, color: color.texto },
  cuerpo:    { fontSize: 15.5, color: color.texto },
  detalle:   { fontSize: 13, color: color.textoSuave },
  etiqueta: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: color.textoTenue,
  },
} as const;

/** Un color de ramo apenas insinuado, para el fondo de una baldosa. */
export const tenue = (hex: string) => `${hex}14`;

/** Algo más presente, para lo que sí tiene que pesar. */
export const velado = (hex: string) => `${hex}26`;

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const nombreDia = (n: number) => DIAS[n] ?? "";
export const diaCorto = (n: number) => (DIAS[n] ?? "").slice(0, 3);

/** "1:04:00" o "14:32" — para duraciones de clases. */
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
