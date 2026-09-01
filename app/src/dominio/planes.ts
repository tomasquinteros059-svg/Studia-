// Qué plan tiene cada quien, y qué cambia eso.
//
// Hoy cambia una sola cosa y es la que importa acá: si la aplicación sirve sin
// conexión. En los planes pagados lo que hace falta para estudiar queda
// guardado en el aparato, y una sala sin cobertura o un metro bajo tierra
// dejan de ser el fin de la tarde.
//
// El plan vive en el perfil y lo escribe el servidor. Que el cliente no pueda
// tocarlo no es desconfianza: cualquiera puede abrir el APK y llamar a la base
// con la clave anónima, así que un plan que se pudiera auto-asignar sería un
// adorno. La base lo impide con un disparador, igual que con el rol.

export type Plan = "gratis" | "personal" | "institucion";

export const PLAN_POR_OMISION: Plan = "gratis";

const PLANES: Plan[] = ["gratis", "personal", "institucion"];

/** Lo que venga de afuera, convertido en un plan de verdad. */
export function planValido(algo: unknown): Plan {
  return typeof algo === "string" && (PLANES as string[]).includes(algo)
    ? algo as Plan
    : PLAN_POR_OMISION;
}

/**
 * Si este plan guarda las cosas en el aparato para poder estudiar sin señal.
 *
 * Los dos pagados sí; el gratis no. Que la lista esté escrita con los dos
 * nombres y no como «cualquiera menos gratis» es a propósito: si mañana
 * aparece un cuarto plan, esto tiene que obligar a decidir en vez de
 * regalárselo por descarte.
 */
export function guardaSinConexion(plan: Plan): boolean {
  return plan === "personal" || plan === "institucion";
}

/** Cómo se llama el plan en la pantalla. */
export const NOMBRE_DEL_PLAN: Record<Plan, string> = {
  gratis: "Gratis",
  personal: "Personal",
  institucion: "Institución",
};

/**
 * Qué se le dice a alguien sobre su plan, en su perfil.
 *
 * Al de plan gratis se le cuenta qué se está perdiendo, una vez y sin
 * insistir. A los otros dos se les dice que lo tienen: una función que
 * funciona en silencio es una función que nadie sabe que pagó.
 */
export function comoSeCuentaElPlan(plan: Plan): string {
  return plan === "gratis"
    ? "Con el plan Personal, tus ramos y tus apuntes quedan guardados en el "
      + "teléfono y puedes seguir estudiando sin señal."
    : "Tus ramos y tus apuntes quedan guardados en el teléfono: puedes seguir "
      + "estudiando sin señal.";
}

// ── De cuándo es lo que se está viendo ───────────────────────────────────
//
// Una copia guardada no se esconde ni se disfraza de datos frescos. Se dice
// que es una copia y de cuándo, y quien la mira decide si le sirve. Es lo
// contrario de lo que hace casi todo el software, que muestra lo viejo como si
// fuera de ahora y deja que uno se dé cuenta solo, tarde.

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** A partir de acá, además de la fecha, se avisa que puede estar vieja. */
export const YA_ES_VIEJA = 30 * DIA;

export function comoSeVeLaCopia(guardadaEn: number, ahora: number): string {
  const desde = Math.max(0, ahora - guardadaEn);

  const cuando =
    desde < 2 * MINUTO ? "recién"
      : desde < HORA ? `hace ${Math.round(desde / MINUTO)} min`
        : desde < DIA ? `hace ${Math.round(desde / HORA)} h`
          : desde < 2 * DIA ? "ayer"
            : `hace ${Math.round(desde / DIA)} días`;

  const base = `Sin conexión · guardado ${cuando}`;
  return desde >= YA_ES_VIEJA ? `${base} · puede estar desactualizado` : base;
}
