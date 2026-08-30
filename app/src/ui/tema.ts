// El sistema visual de StudIA: un cuaderno.
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
// se ven vivos; los mismos seis peleando con un azul de marca se ven
// desordenados. Por eso el azul de acá abajo no rellena botones: es para las
// anotaciones al margen y los enlaces, que no son de ningún ramo.
//
// Sobre el material: es papel cuadriculado con tinta encima. Los filetes son
// de dos píxeles y de tinta —no grises de un píxel— y lo que se levanta del
// papel lleva una sombra dura corrida, sin desenfoque, como una calcomanía
// pegada en la tapa. Eso, y solo eso, es lo que hace que se vea dibujado a
// mano en vez de generado.

import { Platform } from "react-native";
import type { TextStyle } from "react-native";

// El color de cada ramo vive en el dominio: no es una decisión de estilo,
// es la regla con la que la persona sabe dónde está.
export { COLORES_DE_RAMO, colorDeRamo, inicialesDeRamo } from "../dominio/ramos.ts";

export const color = {
  /* Tinta y papel. La tinta es azul muy oscura, como la de un lápiz de pasta,
     y el papel tira a crema: juntos se ven escritos, no impresos. */
  texto:       "#171C3F",
  textoSuave:  "#6B6F85",
  textoTenue:  "#9498AB",
  fondo:       "#FBFAF5",
  papel:       "#FFFFFF",
  elemento:    "#F2F0E6",
  /* El filete de siempre y el que separa de verdad. El primero es la
     cuadrícula del papel; el segundo es trazo. */
  borde:       "rgba(23,28,63,0.14)",
  bordeFuerte: "#171C3F",

  /* Lo que en otra aplicación sería "la marca". Acá es tinta: los botones
     principales son de tinta para que el color quede libre. */
  marca:       "#171C3F",
  marcaOscura: "#0D1129",
  sobreMarca:  "#FFFFFF",

  /* El azul de las anotaciones. No rellena botones ni identifica secciones:
     es para lo escrito a mano al margen, los enlaces y el foco del teclado.
     Nada de eso compite con un ramo, que es la única cosa que el color
     nombra. */
  anotacion:   "#2F45D4",

  /* Estados. Van aparte de los colores de ramo porque significan otra cosa:
     un ramo es dónde estás, un estado es qué te pasa. */
  vivo:        "#E4574B",
  ambar:       "#C77A1E",
  ok:          "#1FA97C",

  nocturno:    "#171C3F",

  /* El destacador. Es la única excepción a la regla del color, y se sostiene
     porque no significa una categoría: significa «acá estás mirando», igual
     que en un cuaderno. Marca el día de hoy y nada más; el día que marque
     dos cosas distintas habrá dejado de servir. */
  destacador:  "#FFE14D",
  /* El destacador ya pasado sobre el papel: lo que queda cuando se raya algo
     y se lee el texto por encima. Es relleno, no marca. */
  destacadoSuave: "#FFF2AF",
} as const;

/* Más redondo que un panel de trabajo: esto lo usa alguien estudiando en su
   casa, no alguien firmando un acta. */
export const radio = { campo: 12, boton: 14, tarjeta: 16, burbuja: 18, pastilla: 999 } as const;

export const espacio = { xs: 4, s: 8, m: 14, l: 20, xl: 30 } as const;

/**
 * El grosor de un trazo.
 *
 * Antes esto era el filete más fino que el aparato supiera dibujar, medio
 * píxel en iOS. Ahora es dos: lo dibujado a mano no tiene hairlines, y un
 * borde de medio píxel gris es exactamente lo que hace que una interfaz se
 * vea salida de una plantilla. El nombre se queda porque lo usan cuarenta
 * archivos y sigue queriendo decir lo mismo: la raya de un borde.
 */
export const FILETE = 2;

/** La cuadrícula del papel: más suave que un borde, es fondo y no trazo. */
export const CUADRICULA = 28;

/**
 * La sombra dura, corrida y sin desenfoque.
 *
 * Es la firma de todo esto. Va en lo que se levanta del papel —botones,
 * tarjetas que se pueden tocar, la hoja de un quiz— y nunca en lo que es el
 * papel mismo. Si todo la lleva, deja de significar «esto se levanta».
 */
export const sombra = (px = 3) => `${px}px ${px}px 0 ${color.bordeFuerte}`;

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
  /* Grande y con aire: se lee de reojo, con el teléfono apoyado en la mesa.
     Los tres títulos llevan la tipografía de titulares; el cuerpo no, porque
     una cara con tanto carácter cansa cuando hay que leer un párrafo. */
  portada:   { fontSize: 30, fontWeight: "800", letterSpacing: -0.9, color: color.texto, fontFamily: letra.titulo },
  titulo:    { fontSize: 23, fontWeight: "800", letterSpacing: -0.6, color: color.texto, fontFamily: letra.titulo },
  subtitulo: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: color.texto, fontFamily: letra.titulo },
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
