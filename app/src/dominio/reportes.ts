// Reportar una respuesta de la inteligencia artificial.
//
// Google Play exige que una aplicación que genera contenido con IA traiga
// adentro la manera de avisar que algo salió mal, sin salirse a buscar un
// correo. Acá viven las decisiones de ese aviso: qué motivos se ofrecen, qué
// se manda y qué no.
//
// Nada de esto habla con la red. Es lo que se puede probar sin servidor.

/** De dónde salió el texto que se está reportando. */
export type Origen = "tutor" | "asistente" | "quiz" | "fichas" | "resumen";

export type Motivo = "ofensivo" | "falso" | "peligroso" | "otro";

/**
 * Los motivos, en el orden en que se muestran.
 *
 * Están escritos desde el lado de quien reporta y no desde el de quien
 * modera: nadie que acaba de leer algo que le molestó va a elegir entre
 * «contenido inapropiado» y «desinformación». Elige entre «me trató mal» y
 * «esto no es verdad».
 */
export const MOTIVOS: { motivo: Motivo; texto: string; detalle: string }[] = [
  {
    motivo: "ofensivo",
    texto: "Me trató mal o dijo algo hiriente",
    detalle: "Insultos, burlas, algo discriminador.",
  },
  {
    motivo: "falso",
    texto: "Está equivocado",
    detalle: "Dice algo que no es cierto, o resuelve mal.",
  },
  {
    motivo: "peligroso",
    texto: "Puede hacerle daño a alguien",
    detalle: "Algo que no debería decirle a un estudiante.",
  },
  {
    motivo: "otro",
    texto: "Otra cosa",
    detalle: "Cuéntame abajo qué pasó.",
  },
];

/** Lo más largo que acepta la base. Un texto más largo se guarda recortado. */
export const LARGO_CONTENIDO = 4000;
export const LARGO_DETALLE = 1000;

export type Reporte = {
  origen: Origen;
  contenido: string;
  motivo: Motivo;
  detalle?: string;
};

export type Revision =
  | { ok: true; reporte: Reporte }
  | { ok: false; motivo: string };

/**
 * Deja el reporte listo para mandar, o dice por qué no se puede.
 *
 * El contenido se recorta y no se rechaza: que un reporte se pierda porque la
 * respuesta del tutor era larga sería exactamente al revés de lo que hace
 * falta. Lo que sí se rechaza es reportar algo vacío, que no le sirve a nadie.
 */
export function revisar(entrada: {
  origen: Origen;
  contenido: string;
  motivo: Motivo | null;
  detalle?: string;
}): Revision {
  if (!entrada.motivo) {
    return { ok: false, motivo: "Elige qué pasó con esta respuesta." };
  }

  const contenido = entrada.contenido.trim();
  if (!contenido) {
    return { ok: false, motivo: "No hay ninguna respuesta que reportar." };
  }

  const detalle = entrada.detalle?.trim();
  if (entrada.motivo === "otro" && !detalle) {
    return { ok: false, motivo: "Cuéntame en una línea qué pasó." };
  }

  return {
    ok: true,
    reporte: {
      origen: entrada.origen,
      motivo: entrada.motivo,
      // El principio, que es donde está lo que molestó. Cortar por el final
      // dejaría fuera justamente la parte que alguien alcanzó a leer.
      contenido: contenido.slice(0, LARGO_CONTENIDO),
      ...(detalle ? { detalle: detalle.slice(0, LARGO_DETALLE) } : {}),
    },
  };
}

/** Lo que se le dice a quien reportó. Ni un trámite ni una promesa vacía. */
export const GRACIAS =
  "Gracias. Alguien de tu establecimiento lo va a mirar.";
