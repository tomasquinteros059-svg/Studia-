// El equipo de tres, del lado del servidor.
//
// Acá viven las instrucciones que se le mandan al modelo y la conversión de
// lo que devuelve. No importa nada del entorno —ni Deno, ni el SDK, ni la
// base— justamente para poder probar esto sin levantar nada.
//
// Los tres corren en fila y cada uno recibe lo del anterior:
//
//   escucha   audio crudo o transcripción sucia  ->  transcripción por turnos
//   redacta   transcripción                      ->  el documento del rubro
//   entiende  el documento                       ->  el análisis, en JSON
//
// Corren en fila y no en paralelo a propósito. Quien redacta necesita saber
// quién dijo qué, y quien entiende necesita el documento ya ordenado: pedirle
// a los tres que trabajen sobre el audio crudo daría tres lecturas distintas
// de la misma reunión, y la persona tendría que arbitrar entre ellas.

export type Papel = "escucha" | "redacta" | "entiende";

/** Lo que la aplicación manda de la reunión. Nada de esto sale del modelo. */
export type Reunion = {
  titulo: string;
  /** Nombre del rubro, tal como lo ve la persona. */
  rubro: string;
  fecha: string;
  /** Quiénes participaron, si se anotaron. Puede venir vacío. */
  participantes: string[];
  /** Los puntos que se iban a tratar. Sirve para saber qué quedó sin tratar. */
  tabla: string[];
};

export const LARGO_MAXIMO_TRANSCRIPCION = 120_000;

/* --------------------------------------------------------------- escucha */

export function promptEscucha(instruccion: string, reunion: Reunion): string {
  const partes = [
    instruccion,
    `La reunión se llama "${reunion.titulo}" y es del ${reunion.fecha}.`,
  ];
  if (reunion.participantes.length > 0) {
    partes.push(
      `Los nombres que se anotaron antes de empezar son: ${reunion.participantes.join(", ")}. Úsalos cuando reconozcas a la persona; cuando no, usa una etiqueta de voz.`,
    );
  }
  partes.push(
    "Devuelve solo la transcripción, una intervención por bloque, con el nombre o la etiqueta al principio de la línea seguido de dos puntos. Sin encabezados ni comentarios tuyos.",
  );
  return partes.join("\n\n");
}

/* --------------------------------------------------------------- redacta */

export function promptRedacta(
  instruccion: string,
  reunion: Reunion,
  transcripcion: string,
): string {
  const partes = [
    instruccion,
    `Reunión: "${reunion.titulo}", ${reunion.rubro}, del ${reunion.fecha}.`,
  ];
  if (reunion.participantes.length > 0) {
    partes.push(`Participantes anotados: ${reunion.participantes.join(", ")}.`);
  }
  if (reunion.tabla.length > 0) {
    partes.push(
      `La tabla de la reunión era:\n${reunion.tabla.map((t) => `- ${t}`).join("\n")}\nSi un punto de la tabla no se trató, no lo inventes: se marca aparte más adelante.`,
    );
  }
  partes.push(`Transcripción:\n${transcripcion.trim()}`);
  return partes.join("\n\n");
}

/* -------------------------------------------------------------- entiende */

/**
 * El análisis se pide en JSON y no en prosa porque la aplicación lo usa: las
 * tareas se muestran como tareas, con su responsable y su plazo, y hay que
 * poder marcarlas. Un texto bonito habría que volver a leerlo entero.
 */
export const ESQUEMA_ANALISIS = {
  type: "object",
  additionalProperties: false,
  required: ["resumen", "acuerdos", "tareas", "pendientes", "sin_tratar", "aportes", "contradicciones"],
  properties: {
    resumen: {
      type: "string",
      description: "Qué se hizo en la reunión, en dos o tres frases. En pasado y sin adjetivos.",
    },
    acuerdos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["numero", "texto", "firme"],
        properties: {
          numero: { type: "integer" },
          texto: { type: "string" },
          firme: {
            type: "boolean",
            description: "true si se acordó; false si solo se propuso o quedó en evaluación.",
          },
        },
      },
    },
    tareas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["que", "responsable", "plazo", "prioridad", "acuerdo"],
        properties: {
          que: { type: "string", description: "Qué hay que hacer, empezando por un verbo." },
          responsable: {
            type: ["string", "null"],
            description: "Quién quedó a cargo. null si en la reunión no se dijo. NO lo adivines.",
          },
          plazo: {
            type: ["string", "null"],
            description: "Fecha aaaa-mm-dd. null si no se puso plazo. NO inventes una fecha.",
          },
          prioridad: { type: "string", enum: ["alta", "normal"] },
          acuerdo: {
            type: ["integer", "null"],
            description: "Número del acuerdo del que sale, si sale de uno.",
          },
        },
      },
    },
    pendientes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["texto", "porque"],
        properties: {
          texto: { type: "string" },
          porque: { type: ["string", "null"], description: "Qué falta para poder cerrarlo." },
        },
      },
    },
    sin_tratar: {
      type: "array",
      items: { type: "string" },
      description: "Puntos de la tabla que no se alcanzaron a tratar. Vacío si se trató todo o si no había tabla.",
    },
    aportes: {
      type: "array",
      items: { type: "string" },
      description: "Qué conviene llevar, preguntar o preparar para la próxima reunión.",
    },
    contradicciones: {
      type: "array",
      items: { type: "string" },
      description: "Puntos donde dos personas entendieron cosas distintas, o algo choca con lo acordado antes.",
    },
  },
} as const;

export function promptEntiende(
  instruccion: string,
  reunion: Reunion,
  documento: string,
): string {
  const partes = [
    instruccion,
    `Reunión: "${reunion.titulo}", ${reunion.rubro}, del ${reunion.fecha}.`,
    "Hoy es " + reunion.fecha + ". Cuando en la reunión digan un plazo relativo (\"el viernes\", \"en dos semanas\"), conviértelo a fecha desde ese día. Si el plazo es ambiguo, deja el plazo en null en vez de elegir una fecha.",
  ];
  if (reunion.tabla.length > 0) {
    partes.push(
      `La tabla era:\n${reunion.tabla.map((t) => `- ${t}`).join("\n")}\nRevisa cuáles de estos puntos no aparecen tratados en el documento y ponlos en sin_tratar.`,
    );
  }
  partes.push(`Documento de la reunión:\n${documento.trim()}`);
  return partes.join("\n\n");
}

/* --------------------------------------------------- leer lo que devolvió */

export type TareaCruda = {
  que: string;
  responsable: string | null;
  plazo: string | null;
  prioridad: "alta" | "normal";
  acuerdo: number | null;
};

export type Analisis = {
  resumen: string;
  acuerdos: { numero: number; texto: string; firme: boolean }[];
  tareas: TareaCruda[];
  pendientes: { texto: string; porque: string | null }[];
  sinTratar: string[];
  aportes: string[];
  contradicciones: string[];
};

export const ANALISIS_VACIO: Analisis = {
  resumen: "", acuerdos: [], tareas: [], pendientes: [],
  sinTratar: [], aportes: [], contradicciones: [],
};

/**
 * Convierte lo que devolvió el modelo en algo que la aplicación pueda mostrar.
 *
 * Es deliberadamente desconfiada. Un campo que no se entiende no tumba el
 * análisis completo: se descarta esa fila y el resto se muestra igual. Perder
 * una tarea es malo; perder el acta entera porque una fecha vino torcida, peor.
 */
export function leerAnalisis(crudo: unknown): Analisis {
  if (!esObjeto(crudo)) return ANALISIS_VACIO;

  return {
    resumen: texto(crudo.resumen) ?? "",
    acuerdos: lista(crudo.acuerdos).flatMap((a, i) => {
      if (!esObjeto(a)) return [];
      const t = texto(a.texto);
      if (t === null) return [];
      return [{
        numero: entero(a.numero) ?? i + 1,
        texto: t,
        // Sin decir que es firme, no lo es: un acuerdo que no se acordó
        // pesa distinto y darlo por firme es el error caro de los dos.
        firme: a.firme === true,
      }];
    }),
    tareas: lista(crudo.tareas).flatMap((t) => {
      if (!esObjeto(t)) return [];
      const que = texto(t.que);
      if (que === null) return [];
      return [{
        que,
        responsable: texto(t.responsable),
        plazo: fecha(t.plazo),
        prioridad: t.prioridad === "alta" ? "alta" : "normal",
        acuerdo: entero(t.acuerdo),
      }];
    }),
    pendientes: lista(crudo.pendientes).flatMap((p) => {
      if (!esObjeto(p)) return [];
      const t = texto(p.texto);
      return t === null ? [] : [{ texto: t, porque: texto(p.porque) }];
    }),
    sinTratar: textos(crudo.sin_tratar),
    aportes: textos(crudo.aportes),
    contradicciones: textos(crudo.contradicciones),
  };
}

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

const texto = (x: unknown): string | null => {
  if (typeof x !== "string") return null;
  const limpio = x.trim();
  return limpio.length === 0 ? null : limpio;
};

const textos = (x: unknown): string[] =>
  lista(x).map(texto).filter((t): t is string => t !== null);

const entero = (x: unknown): number | null =>
  typeof x === "number" && Number.isInteger(x) ? x : null;

/**
 * Una fecha solo se acepta si es una fecha de verdad. "el viernes", "2026-13-45"
 * o "próxima semana" se descartan: una tarea sin plazo se ve como lo que es, y
 * una con un plazo falso se ve como si estuviera resuelta.
 */
export function fecha(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const limpio = x.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) return null;
  const d = new Date(`${limpio}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Rebota los días que no existen: new Date("2026-02-31") se corre a marzo.
  return d.toISOString().slice(0, 10) === limpio ? limpio : null;
}

/* ------------------------------------------------------------ validaciones */

export function validarTranscripcion(
  contenido: unknown,
): { ok: true; texto: string } | { ok: false; motivo: string } {
  if (typeof contenido !== "string") {
    return { ok: false, motivo: "La transcripción debe ser texto." };
  }
  const limpio = contenido.trim();
  if (limpio.length === 0) {
    return { ok: false, motivo: "No hay nada que analizar: la reunión llegó vacía." };
  }
  if (limpio.length > LARGO_MAXIMO_TRANSCRIPCION) {
    return {
      ok: false,
      motivo: "La reunión es demasiado larga para analizarla de una vez. Pártela en dos.",
    };
  }
  return { ok: true, texto: limpio };
}
