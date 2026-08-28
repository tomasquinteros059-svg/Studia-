// Cómo se ordena y se filtra el tablero de apuntes.

export type ApunteDeTablero = {
  id: string;
  titulo: string;
  contenido: string;
  fijado: boolean;
  actualizado_en: string;
  asignatura_id: string;
};

/** Los fijados primero; dentro de cada grupo, el más reciente arriba. */
export function ordenarTablero<T extends ApunteDeTablero>(apuntes: T[]): T[] {
  return [...apuntes].sort((a, b) => {
    if (a.fijado !== b.fijado) return a.fijado ? -1 : 1;
    return new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime();
  });
}

/** Sin acentos y en minúsculas: buscar "calculo" tiene que encontrar "Cálculo". */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Filtra por título y contenido. Todas las palabras de la búsqueda tienen que
 * aparecer, en cualquier orden: buscar "valor medio" no debería exigir que
 * estén pegadas.
 */
export function filtrarApuntes<T extends ApunteDeTablero>(apuntes: T[], busqueda: string): T[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return apuntes;

  return apuntes.filter((a) => {
    const heno = normalizar(`${a.titulo} ${a.contenido}`);
    return palabras.every((p) => heno.includes(p));
  });
}

/** Las primeras líneas, para la tarjeta del tablero. */
export function vistaPrevia(contenido: string, maximo = 180): string {
  const limpio = contenido.replace(/\s+/g, " ").trim();
  if (limpio.length <= maximo) return limpio;
  // Se corta en el último espacio para no partir una palabra por la mitad.
  const cortado = limpio.slice(0, maximo);
  const espacio = cortado.lastIndexOf(" ");
  return `${espacio > maximo * 0.6 ? cortado.slice(0, espacio) : cortado}…`;
}

/** Cuántas columnas caben en el tablero. */
export function columnasDelTablero(ancho: number): number {
  if (ancho >= 1300) return 4;
  if (ancho >= 900) return 3;
  if (ancho >= 620) return 2;
  return 1;
}
