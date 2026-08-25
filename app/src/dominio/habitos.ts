// Consejos sobre CÓMO estudia el estudiante.
//
// Salen de sus propios datos, no de una conjetura del modelo: si la app dice
// "entregas sobre la hora", tiene que poder mostrar cuáles. Un consejo que no
// se puede justificar con un dato concreto no se muestra.

export type TareaDeHabito = {
  id: string;
  titulo: string;
  ramo: string;
  vence_en: string;
  entregada_en: string | null;
};

export type RamoDeHabito = {
  id: string;
  nombre: string;
  /** Porcentaje del material completado, 0 a 100. */
  progreso: number;
  nota: number | null;
  apuntes: number;
};

export type Consejo = {
  clave: string;
  titulo: string;
  detalle: string;
  /** Menor es más urgente. */
  prioridad: number;
  tono: "alerta" | "aviso" | "bueno";
};

/** Se considera "sobre la hora" entregar dentro de las últimas seis. */
export const HORAS_AL_FILO = 6;
const MS_HORA = 3_600_000;

export function entregoAlFilo(t: TareaDeHabito): boolean {
  if (!t.entregada_en) return false;
  const margen = new Date(t.vence_en).getTime() - new Date(t.entregada_en).getTime();
  return margen >= 0 && margen <= HORAS_AL_FILO * MS_HORA;
}

export function estaAtrasada(t: TareaDeHabito, ahora: Date): boolean {
  return !t.entregada_en && new Date(t.vence_en).getTime() < ahora.getTime();
}

export function consejosDeEstudio(
  tareas: TareaDeHabito[],
  ramos: RamoDeHabito[],
  ahora: Date = new Date(),
): Consejo[] {
  const consejos: Consejo[] = [];

  // 1 · Un ramo en riesgo de reprobar es lo primero que hay que saber.
  for (const r of ramos) {
    if (r.nota !== null && r.nota < 4) {
      consejos.push({
        clave: `riesgo:${r.id}`,
        titulo: `${r.nombre} va bajo 4,0`,
        detalle:
          `Vas con ${r.nota.toFixed(1).replace(".", ",")}. Entra a la sección Notas del ramo: ` +
          "ahí dice exactamente qué necesitas en lo que falta.",
        prioridad: 1,
        tono: "alerta",
      });
    }
  }

  // 2 · Lo atrasado, con nombre y apellido.
  const atrasadas = tareas.filter((t) => estaAtrasada(t, ahora));
  if (atrasadas.length > 0) {
    const nombres = atrasadas.slice(0, 3).map((t) => `«${t.titulo}»`).join(", ");
    consejos.push({
      clave: "atrasadas",
      titulo: atrasadas.length === 1 ? "Tienes una tarea atrasada" : `Tienes ${atrasadas.length} tareas atrasadas`,
      detalle: `${nombres}${atrasadas.length > 3 ? " y otras" : ""}. Parte por la más antigua: mientras más espera, más cuesta retomarla.`,
      prioridad: 2,
      tono: "alerta",
    });
  }

  // 3 · Un ramo que se va quedando atrás respecto de los demás.
  if (ramos.length >= 2) {
    const promedio = ramos.reduce((a, r) => a + r.progreso, 0) / ramos.length;
    const rezagado = [...ramos].sort((a, b) => a.progreso - b.progreso)[0]!;
    if (promedio - rezagado.progreso >= 25) {
      consejos.push({
        clave: `rezagado:${rezagado.id}`,
        titulo: `${rezagado.nombre} se está quedando atrás`,
        detalle:
          `Llevas ${Math.round(rezagado.progreso)}% de su material, contra ${Math.round(promedio)}% ` +
          "en promedio del resto. Un rato corto pero seguido rinde más que una maratón antes de la prueba.",
        prioridad: 3,
        tono: "aviso",
      });
    }
  }

  // 4 · Entregar siempre sobre la hora.
  const entregadas = tareas.filter((t) => t.entregada_en);
  const alFilo = entregadas.filter(entregoAlFilo);
  if (entregadas.length >= 3 && alFilo.length / entregadas.length >= 0.6) {
    consejos.push({
      clave: "al_filo",
      titulo: "Sueles entregar sobre la hora",
      detalle:
        `${alFilo.length} de tus ${entregadas.length} entregas salieron en las últimas ` +
        `${HORAS_AL_FILO} horas de plazo. No es un problema hasta que algo falla: ` +
        "prueba fijarte un plazo propio un día antes.",
      prioridad: 4,
      tono: "aviso",
    });
  }

  // 5 · Un ramo que avanza pero del que no queda registro escrito.
  for (const r of ramos) {
    if (r.apuntes === 0 && r.progreso >= 30) {
      consejos.push({
        clave: `sin_apuntes:${r.id}`,
        titulo: `No tienes apuntes de ${r.nombre}`,
        detalle:
          "Escribir con tus palabras mientras escuchas es lo que más ayuda a recordar, " +
          "y de paso el tutor puede resumirte la clase después.",
        prioridad: 5,
        tono: "aviso",
      });
    }
  }

  // 6 · Cuando todo va bien, decirlo también.
  if (consejos.length === 0 && ramos.length > 0) {
    consejos.push({
      clave: "al_dia",
      titulo: "Vas al día",
      detalle:
        "Sin tareas atrasadas y ningún ramo bajo 4,0. Buen momento para adelantar " +
        "material del ramo que más te cuesta.",
      prioridad: 9,
      tono: "bueno",
    });
  }

  return consejos.sort((a, b) => a.prioridad - b.prioridad);
}
