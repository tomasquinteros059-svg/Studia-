// Qué se puede guardar en el aparato sin que vuelva roto.
//
// Nace de un error que casi se publica. La copia se guarda como texto JSON, y
// una pantalla devolvía sus datos con un `Map` adentro. Un `Map` pasado por
// JSON vuelve como `{}`: la pantalla cargaba, intentaba usarlo y reventaba en
// el primer render. Sin señal, que es justo cuando la copia existe.
//
// La lección no es «acuérdate de no usar Map». Es que el guardado tiene que
// negarse a guardar lo que no va a poder devolver igual, y que el peor
// resultado posible sea quedarse sin copia —la aplicación funciona como antes—
// en vez de una pantalla que revienta.

/** Qué se encontró que no se puede guardar, o null si todo estaba bien. */
export function queNoSeGuarda(valor: unknown, camino = "datos"): string | null {
  if (valor === null) return null;

  switch (typeof valor) {
    case "string": case "number": case "boolean": return null;
    case "undefined": return `${camino} es undefined`;
    case "function": return `${camino} es una función`;
    case "symbol": return `${camino} es un símbolo`;
    case "bigint": return `${camino} es un bigint`;
  }

  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) {
      const malo = queNoSeGuarda(valor[i], `${camino}[${i}]`);
      if (malo) return malo;
    }
    return null;
  }

  // Map, Set y Date vuelven de JSON como otra cosa: los dos primeros como un
  // objeto vacío y la fecha como texto. Ninguna se parece a lo que era.
  if (valor instanceof Map) return `${camino} es un Map`;
  if (valor instanceof Set) return `${camino} es un Set`;
  if (valor instanceof Date) return `${camino} es una fecha`;

  const objeto = valor as Record<string, unknown>;
  // Solo objetos simples. Una instancia de una clase pierde su prototipo al
  // volver, y con él los métodos que la pantalla vaya a llamar.
  const proto = Object.getPrototypeOf(objeto);
  if (proto !== Object.prototype && proto !== null) return `${camino} es una instancia`;

  for (const clave of Object.keys(objeto)) {
    const malo = queNoSeGuarda(objeto[clave], `${camino}.${clave}`);
    if (malo) return malo;
  }
  return null;
}

export const sePuedeGuardar = (valor: unknown): boolean => queNoSeGuarda(valor) === null;
