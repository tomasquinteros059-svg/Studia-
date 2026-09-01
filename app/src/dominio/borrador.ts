// Lo que se escribió y todavía no llegó al servidor.
//
// Nace de mirar la app sin señal, y es la peor de las fallas que aparecieron.
// Un apunte se guarda solo un rato después de dejar de escribir; si esa
// llamada falla —una sala sin cobertura, que es lo más común del mundo— la
// pantalla decía «Sin guardar» en letra chica arriba y no volvía a intentar.
// Al salir, cuarenta minutos de clase se perdían. Nadie se entera hasta que
// vuelve a abrir el apunte, en la noche, cuando ya no hay nada que hacer.
//
// La regla de fondo: lo que alguien escribió no se pierde nunca porque no
// había señal. Se guarda en el aparato y se sube cuando se pueda.

/** Un apunte que espera turno para subir. */
export type Borrador = {
  apunteId: string;
  contenido: string;
  /** Los trazos, ya serializados. Null es «el tablero quedó vacío». */
  trazos: string | null;
  /** Cuándo se escribió, en milisegundos. Es lo que decide quién gana. */
  escritoEn: number;
};

/**
 * Cuál de las dos versiones vale: la del aparato o la del servidor.
 *
 * Gana la más nueva, y en un empate gana el servidor. El empate ocurre cuando
 * el borrador se subió bien y quedó una copia local de más; darle la victoria
 * al servidor hace que esa copia se descarte sola en vez de resucitar texto
 * viejo cada vez que se abre el apunte.
 *
 * Que se compare por hora tiene un límite conocido: si alguien edita el mismo
 * apunte en dos aparatos con la hora mal puesta, gana el que crea estar en el
 * futuro. Es el precio de no montar un sistema de versiones para un caso que
 * casi no ocurre —un apunte lo escribe una persona, en una sala, en un
 * aparato—.
 */
export function cualGana(
  borrador: Borrador | null, servidorEn: string | null,
): "borrador" | "servidor" {
  if (!borrador) return "servidor";
  if (!servidorEn) return "borrador";
  const enServidor = Date.parse(servidorEn);
  if (!Number.isFinite(enServidor)) return "borrador";
  return borrador.escritoEn > enServidor ? "borrador" : "servidor";
}

/**
 * Si vale la pena guardar esto en el aparato.
 *
 * Un apunte vacío y sin trazos no es un borrador: es un apunte que se abrió y
 * se cerró. Guardarlo haría que un apunte recién creado pisara con vacío lo
 * que hubiera en el servidor.
 */
export function valeGuardarlo(contenido: string, trazos: string | null): boolean {
  return contenido.trim().length > 0 || trazos !== null;
}

/**
 * Qué se le dice a la persona sobre lo que todavía no subió.
 *
 * «Sin guardar» era mentira en los dos sentidos: asustaba —parece que se
 * perdió— y a la vez no decía que la aplicación se está encargando. Lo que
 * hay que transmitir es que está a salvo y que va a subir solo.
 */
export function comoSeVe(estado: "limpio" | "guardando" | "escribiendo" | "en_el_aparato"): string {
  switch (estado) {
    case "limpio": return "Guardado";
    case "guardando": return "Guardando…";
    case "escribiendo": return "Escribiendo…";
    case "en_el_aparato": return "Guardado en el teléfono · sube solo";
  }
}
