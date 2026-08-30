// Qué proponerle preguntar al tutor.
//
// Una pantalla de chat en blanco es la peor pantalla de una aplicación: sabe
// hacer muchas cosas y no dice ninguna, así que la persona escribe «hola» o
// se va. Las sugerencias existen para eso.
//
// Pero unas sugerencias fijas —«explícame el tema», «dame un ejemplo»— no
// sirven mucho más que el vacío: son las mismas para todos y para siempre.
// Estas salen de lo que a esta persona le está pasando en este ramo: en qué
// se equivocó la última vez, qué se le viene, y qué material tiene sin ver.
// Ese orden no es casual, y es lo único que decide este archivo.

export type Falla = { pregunta: string; tema: string };
export type Pendiente = { titulo: string; vence_en: string };
export type TemaSinVer = { titulo: string };

export type QueOfrecer = {
  /** Lo que salió mal en el último quiz de este ramo. */
  fallas: readonly Falla[];
  /** Tareas de este ramo sin entregar. */
  pendientes: readonly Pendiente[];
  /** Módulos del ramo con material sin marcar. */
  temas: readonly TemaSinVer[];
};

export const CUANTAS_SUGERENCIAS = 3;

/** Recorta un título largo sin partir una palabra por la mitad. */
export function acortar(texto: string, largo = 46): string {
  const limpio = texto.trim().replace(/\s+/g, " ");
  if (limpio.length <= largo) return limpio;
  const cortado = limpio.slice(0, largo);
  const ultimoEspacio = cortado.lastIndexOf(" ");
  return `${(ultimoEspacio > largo * 0.6 ? cortado.slice(0, ultimoEspacio) : cortado).trimEnd()}…`;
}

/**
 * Hasta tres cosas que ofrecerle preguntar, de la más útil a la menos.
 *
 * El orden es una opinión sobre qué le sirve a alguien que abre el tutor:
 *
 *  1. Lo que ya se sabe que no entendió, porque es lo único de la lista que
 *     está *comprobado*. Una pregunta que falló en un quiz es una duda que
 *     existe, no una que uno supone.
 *  2. Lo que se le viene, porque el tiempo es lo que aprieta.
 *  3. Lo que no ha mirado, que es lo más útil de lo que queda cuando no hay
 *     ni error ni fecha encima.
 *
 * Nunca se repite la misma clase de sugerencia dos veces: tres preguntas
 * sobre tres errores distintos se leen como un reproche.
 */
export function sugerenciasDe(que: QueOfrecer): string[] {
  const lista: string[] = [];

  const falla = que.fallas[0];
  if (falla) lista.push(`¿Por qué me equivoqué en «${acortar(falla.pregunta)}»?`);

  const pendiente = [...que.pendientes]
    .sort((a, b) => a.vence_en.localeCompare(b.vence_en))[0];
  if (pendiente) lista.push(`¿Cómo parto «${acortar(pendiente.titulo)}»?`);

  const tema = que.temas[0];
  if (tema) lista.push(`Explícame «${acortar(tema.titulo)}»`);

  // De fondo, dos que sirven siempre y no prometen la respuesta hecha: el
  // tutor no resuelve, y una sugerencia que diga «dame la solución» estaría
  // ofreciendo algo que la aplicación se niega a hacer.
  for (const suelta of ["No entendí la clase de hoy", "Ponme un ejercicio para practicar"]) {
    if (lista.length >= CUANTAS_SUGERENCIAS) break;
    lista.push(suelta);
  }

  return lista.slice(0, CUANTAS_SUGERENCIAS);
}

/**
 * Las preguntas falladas del último quiz terminado de un ramo.
 *
 * Solo del último: los de antes ya se repasaron o ya no importan, y ofrecer
 * un error de hace tres semanas es ruido.
 */
export function fallasDelUltimoQuiz(
  quices: readonly {
    asignatura_id: string;
    tema: string;
    preguntas: readonly { pregunta: string; correcta: number }[];
    respuestas: readonly (number | null)[];
    terminado_en: string | null;
    creado_en: string;
  }[],
  asignaturaId: string,
): Falla[] {
  const ultimo = quices
    .filter((q) => q.asignatura_id === asignaturaId && q.terminado_en !== null)
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0];
  if (!ultimo) return [];

  return ultimo.preguntas
    .filter((p, i) => ultimo.respuestas[i] !== p.correcta)
    .map((p) => ({ pregunta: p.pregunta, tema: ultimo.tema }));
}
