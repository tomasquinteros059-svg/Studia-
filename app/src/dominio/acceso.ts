// Qué pasa cuando alguien escribe su correo para entrar.
//
// StudIA tiene dos públicos y una sola aplicación. Quien estudia en una
// institución llega con sus ramos, su horario y sus profesores ya cargados;
// quien llega por su cuenta arma su propio espacio y sube su material. La
// diferencia la decide el dominio del correo, y por eso vive acá: es una
// regla de negocio, no un detalle de la pantalla.
//
// El día que se conecten las APIs de cada universidad, lo que cambia es de
// dónde salen los ramos, no esta decisión.

export type Institucion = {
  /** El dominio que la identifica, ya normalizado. */
  dominio: string;
  nombre: string;
  /** Si es falso, todavía no hay convenio: entra, pero por su cuenta. */
  conectada: boolean;
};

/**
 * Las instituciones conocidas. Un dominio de aquí entra por el camino
 * institucional; cualquier otro entra por el propio.
 *
 * Los subdominios cuentan: en Chile casi todas separan al alumnado
 * (`alumnos.uc.cl`, `ug.uchile.cl`) del cuerpo académico, y las dos formas
 * apuntan a la misma casa de estudios.
 */
export const INSTITUCIONES: Institucion[] = [
  { dominio: "uc.cl", nombre: "Pontificia Universidad Católica de Chile", conectada: false },
  { dominio: "uchile.cl", nombre: "Universidad de Chile", conectada: false },
  { dominio: "usach.cl", nombre: "Universidad de Santiago de Chile", conectada: false },
  { dominio: "utfsm.cl", nombre: "Universidad Técnica Federico Santa María", conectada: false },
  { dominio: "udec.cl", nombre: "Universidad de Concepción", conectada: false },
  { dominio: "uach.cl", nombre: "Universidad Austral de Chile", conectada: false },
  { dominio: "uai.cl", nombre: "Universidad Adolfo Ibáñez", conectada: false },
  { dominio: "udp.cl", nombre: "Universidad Diego Portales", conectada: false },
  { dominio: "unab.cl", nombre: "Universidad Andrés Bello", conectada: false },
  { dominio: "duoc.cl", nombre: "Duoc UC", conectada: false },
  { dominio: "inacap.cl", nombre: "Inacap", conectada: false },
];

export type Camino =
  | { tipo: "institucion"; institucion: Institucion; correo: string }
  | { tipo: "propio"; correo: string }
  | { tipo: "invalido"; motivo: string };

const LARGO_MAXIMO = 254;

/** Minúsculas y sin espacios: la gente escribe el correo como le sale. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function dominioDe(correo: string): string {
  const partes = normalizarCorreo(correo).split("@");
  return partes.length === 2 ? (partes[1] ?? "") : "";
}

/**
 * Un correo es de una institución si su dominio es el de ella o termina en
 * un punto seguido de ese dominio. Lo segundo importa y lo primero no basta:
 * `alumnos.uc.cl` es la Católica, pero `nouc.cl` no lo es.
 */
export function institucionDe(correo: string): Institucion | null {
  const dominio = dominioDe(correo);
  if (!dominio) return null;
  return INSTITUCIONES.find(
    (i) => dominio === i.dominio || dominio.endsWith(`.${i.dominio}`),
  ) ?? null;
}

const FORMA = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Por dónde entra quien escribió este correo. */
export function caminoDe(correo: string): Camino {
  const limpio = normalizarCorreo(correo);

  if (limpio.length === 0) return { tipo: "invalido", motivo: "Escribe tu correo." };
  if (limpio.length > LARGO_MAXIMO) {
    return { tipo: "invalido", motivo: "Ese correo es demasiado largo." };
  }
  if (!FORMA.test(limpio)) {
    return { tipo: "invalido", motivo: "Eso no parece un correo. Revísalo." };
  }

  const institucion = institucionDe(limpio);
  return institucion
    ? { tipo: "institucion", institucion, correo: limpio }
    : { tipo: "propio", correo: limpio };
}

/** Lo que se le dice a la persona antes de pedirle la clave. */
export function comoSePresenta(camino: Camino): string {
  switch (camino.tipo) {
    case "invalido":
      return camino.motivo;
    case "institucion":
      return camino.institucion.conectada
        ? `Te reconocimos de ${camino.institucion.nombre}. Tus ramos, tu horario y tus notas van a aparecer solos.`
        : `Tu correo es de ${camino.institucion.nombre}, pero todavía no tenemos convenio con ella. Puedes entrar y armar tu espacio por tu cuenta; cuando haya convenio, tus ramos aparecen solos.`;
    case "propio":
      return "Vas a entrar por tu cuenta: armas tus propios ramos y subes tu material. El tutor y el lector funcionan igual.";
  }
}
