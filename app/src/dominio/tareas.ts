// Estado y orden de las tareas.

export type EstadoTarea = "pendiente" | "entregada" | "atrasada";

export type Tarea = {
  id: string;
  titulo: string;
  vence_en: string;
  puntos: number;
  entregada_en?: string | null;
};

export function estadoDeTarea(tarea: Tarea, ahora: Date = new Date()): EstadoTarea {
  if (tarea.entregada_en) return "entregada";
  return new Date(tarea.vence_en).getTime() < ahora.getTime() ? "atrasada" : "pendiente";
}

/** Días calendario hasta el vencimiento. Negativo si ya venció. */
export function diasHasta(fechaISO: string, ahora: Date = new Date()): number {
  const dia = 24 * 60 * 60 * 1000;
  const a = new Date(fechaISO);
  const inicioVence = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const inicioHoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((inicioVence - inicioHoy) / dia);
}

/** "Mañana", "En 3 días", "Venció" — lo que un estudiante diría. */
export function cuandoVence(tarea: Tarea, ahora: Date = new Date()): string {
  if (tarea.entregada_en) return "Entregada";
  const dias = diasHasta(tarea.vence_en, ahora);
  if (dias < 0) return "Venció";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

/**
 * Orden de la lista: primero lo que hay que hacer —lo atrasado antes que
 * todo—, y las entregadas al final, la más reciente arriba.
 */
export function ordenarTareas<T extends Tarea>(tareas: T[]): T[] {
  return [...tareas].sort((a, b) => {
    const entregadaA = a.entregada_en ? 1 : 0;
    const entregadaB = b.entregada_en ? 1 : 0;
    if (entregadaA !== entregadaB) return entregadaA - entregadaB;

    const venceA = new Date(a.vence_en).getTime();
    const venceB = new Date(b.vence_en).getTime();
    // Entre las entregadas, la más reciente primero.
    return entregadaA ? venceB - venceA : venceA - venceB;
  });
}
