// Choques de horario: lo que una planilla no puede ver sola.
//
// Vive en el dominio de la app y no en el importador porque hacen falta los
// dos: el colegio lo revisa al cargar el semestre, y la pantalla de
// administración lo vuelve a revisar sobre lo que quedó cargado. La misma
// regla en dos lugares es la manera de que discrepen.

export type BloqueDeClase = {
  /** Código del ramo, para nombrarlo en el aviso. */
  codigo: string;
  /** 1 = lunes. */
  dia: number;
  /** Minutos desde medianoche. */
  inicio: number;
  fin: number;
  sala: string;
};

/** Quién dicta qué, para detectar a un profesor citado en dos partes. */
export type QuienDicta = { correo: string; codigo: string; papel: string };

export type Choque = {
  tipo: "sala" | "docente";
  mensaje: string;
};

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export const comoHora = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/**
 * Dos bloques chocan si comparten día y se pisan en el tiempo. Terminar justo
 * cuando el otro empieza no es un choque: así se arma un horario normal.
 */
export function seSolapan(a: BloqueDeClase, b: BloqueDeClase): boolean {
  return a.dia === b.dia && a.inicio < b.fin && b.inicio < a.fin;
}

/**
 * Dos ramos en la misma sala a la misma hora, o un profesor citado en dos
 * partes a la vez. Es el error que más caro sale, porque si no se descubre
 * el primer día de clases.
 */
export function choquesDeHorario(bloques: BloqueDeClase[], dictan: QuienDicta[]): Choque[] {
  const choques: Choque[] = [];

  // Solo el profesor: un ayudante repetido en dos ayudantías es un problema
  // del colegio, pero no necesariamente el mismo error.
  const profesoresDe = new Map<string, string[]>();
  for (const d of dictan) {
    if (d.papel !== "profesor") continue;
    profesoresDe.set(d.codigo, [...(profesoresDe.get(d.codigo) ?? []), d.correo]);
  }

  for (let i = 0; i < bloques.length; i++) {
    for (let j = i + 1; j < bloques.length; j++) {
      const a = bloques[i];
      const b = bloques[j];
      if (!a || !b || !seSolapan(a, b)) continue;

      const cuando = `${DIAS[a.dia - 1] ?? "?"} ${comoHora(Math.max(a.inicio, b.inicio))}`;

      if (a.sala === b.sala) {
        choques.push({
          tipo: "sala",
          mensaje: `La sala ${a.sala} está tomada el ${cuando} por ${a.codigo} y ${b.codigo}.`,
        });
      }

      const suyos = profesoresDe.get(b.codigo) ?? [];
      for (const correo of profesoresDe.get(a.codigo) ?? []) {
        if (!suyos.includes(correo)) continue;
        choques.push({
          tipo: "docente",
          mensaje: `${correo} tiene ${a.codigo} y ${b.codigo} juntos el ${cuando}.`,
        });
      }
    }
  }
  return choques;
}
