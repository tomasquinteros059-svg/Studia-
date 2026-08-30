// Las fichas de repaso, del lado de quien las estudia.
//
// El cálculo de cuándo vuelve cada una vive en la base, para que no se pueda
// adelantar desde afuera. Acá vive lo otro: cuáles tocan hoy, en qué orden
// mostrarlas, y cómo decir en palabras cuánto falta para la próxima. Nada de
// eso toca la red, así que se prueba solo.

export type Ficha = {
  id: string;
  tema: string;
  pregunta: string;
  respuesta: string;
  aciertos: number;
  fallos: number;
  /** Nula significa que nunca se ha visto: toca ya. */
  vuelve_en: string | null;
};

/** Los mismos saltos que la base, para poder decirlos antes de guardarlos. */
export const SALTOS = [1, 3, 7, 16, 35] as const;

/** Cuántos días hasta que vuelva, si se acierta ahora. */
export function cuandoVuelve(aciertos: number, acerto: boolean): number {
  if (!acerto) return 0;
  return SALTOS[Math.min(aciertos, SALTOS.length - 1)] ?? 35;
}

/** "mañana", "en 3 días", "en 5 semanas". Como se dice, no como se guarda. */
export function enCuanto(dias: number): string {
  if (dias <= 0) return "hoy mismo";
  if (dias === 1) return "mañana";
  if (dias < 14) return `en ${dias} días`;
  return `en ${Math.round(dias / 7)} semanas`;
}

/** Una ficha toca cuando nunca se ha visto, o cuando ya pasó su fecha. */
export const toca = (f: Ficha, ahora: Date = new Date()): boolean =>
  f.vuelve_en === null || new Date(f.vuelve_en) <= ahora;

/**
 * Las que hay que repasar ahora, en el orden en que conviene mostrarlas.
 *
 * Primero las que nunca se han visto, porque una ficha sin estrenar no ha
 * enseñado nada todavía. Después las atrasadas, de la más atrasada a la menos.
 * A igualdad, la que más se ha fallado: es la que peor está.
 */
export function tocanAhora(fichas: readonly Ficha[], ahora: Date = new Date()): Ficha[] {
  return fichas
    .filter((f) => toca(f, ahora))
    .sort((a, b) => {
      if ((a.vuelve_en === null) !== (b.vuelve_en === null)) return a.vuelve_en === null ? -1 : 1;
      if (a.vuelve_en && b.vuelve_en) {
        const orden = a.vuelve_en.localeCompare(b.vuelve_en);
        if (orden !== 0) return orden;
      }
      return b.fallos - a.fallos;
    });
}

export type Cuenta = {
  /** Cuántas tocan ahora. */
  tocan: number;
  /** Cuántas hay en total. */
  todas: number;
  /** Cuántas están asentadas: tres aciertos seguidos o más. */
  sabidas: number;
};

/**
 * Tres aciertos seguidos es donde ponemos «ya la sé».
 *
 * Es una raya en la arena y conviene decirlo: con dos podría ser suerte, y
 * esperar a cinco haría que el número no se moviera nunca y dejara de
 * significar algo para quien lo mira.
 */
export const ACIERTOS_PARA_SABIDA = 3;

export function contar(fichas: readonly Ficha[], ahora: Date = new Date()): Cuenta {
  return {
    tocan: fichas.filter((f) => toca(f, ahora)).length,
    todas: fichas.length,
    sabidas: fichas.filter((f) => f.aciertos >= ACIERTOS_PARA_SABIDA).length,
  };
}

/** Qué decirle a alguien que ya repasó todo lo que tocaba. */
export function alDia(cuenta: Cuenta): string {
  if (cuenta.todas === 0) return "Todavía no tienes fichas de este tema.";
  if (cuenta.sabidas === cuenta.todas) {
    // Con una sola, «te sabes las 1» es lo que pasa cuando se arma una frase
    // pegando un número al medio sin mirar.
    return cuenta.todas === 1
      ? "Te la sabes. Vuelve sola cuando toque, para que no se te olvide."
      : `Te sabes las ${cuenta.todas}. Vuelven solas cuando toque, para que no se te olviden.`;
  }
  return "Por hoy no queda ninguna. Las que repasaste vuelven más adelante, "
    + "y las que fallaste vuelven antes.";
}
