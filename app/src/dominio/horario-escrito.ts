// Cargar un semestre entero de una vez, escribiéndolo.
//
// Quien llega sin institución tenía que crear los ramos de a uno, con un
// modal por ramo, y después no tenía dónde poner sus horas. Seis ramos son
// seis vueltas por el mismo formulario antes de poder usar la app.
//
// Acá se pega el horario tal como uno lo tiene escrito —en el cuaderno, en
// un correo del colegio, en la captura del sistema de matrícula— y de ahí
// salen los ramos y sus bloques. La gracia no es adivinar: es aceptar las
// tres o cuatro formas en que una persona escribe "los lunes de 8:30 a 10"
// y decir con claridad qué línea no se entendió, en vez de tragársela.

/** Un bloque de clase, con la hora ya normalizada a "HH:MM". */
export type BloqueEscrito = {
  /** 1 = lunes. */
  dia: number;
  inicio: string;
  fin: string;
  /** "" si no se escribió ninguna. */
  sala: string;
  tipo: string;
};

export type RamoEscrito = { nombre: string; bloques: BloqueEscrito[] };

/** Una línea que no se pudo usar, con el motivo en palabras. */
export type Reparo = { linea: number; texto: string; motivo: string };

export type HorarioEscrito = { ramos: RamoEscrito[]; reparos: Reparo[] };

const DIAS: { nombre: string; dia: number }[] = [
  { nombre: "lunes", dia: 1 },
  { nombre: "martes", dia: 2 },
  { nombre: "miercoles", dia: 3 },
  { nombre: "jueves", dia: 4 },
  { nombre: "viernes", dia: 5 },
  { nombre: "sabado", dia: 6 },
  { nombre: "domingo", dia: 7 },
];

const sinAcentos = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Dos letras bastan y no se pisan: "ma" es martes y "mi" es miércoles. Una
// sola sí se pisaría, y "M" queriendo decir martes que entra como miércoles
// es un error que nadie va a notar hasta llegar tarde a clase.
const DIA_SUELTO = "(?:lu|ma|mi|ju|vi|sa|do)[a-zé]*";
const HORA = "\\d{1,2}(?:[:.]\\d{2})?";
const SEPARADOR = "(?:-|–|—|a|hasta|al)";

// El día tiene que venir pegado a un rango de horas para contar como día.
// Eso es lo que evita que "Matemáticas" se lea como "martes": la palabra
// sola no basta, detrás tiene que haber una hora.
// Una hora de reloj: dos dígitos detrás de los dos puntos. Sirve para
// distinguir "Taller 2" —un nombre— de "Matemáticas 8:00 a 10:00", que es
// alguien intentando escribir un bloque y equivocándose en el día.
const RE_PARECE_HORA = /\d{1,2}[:.]\d{2}/;

const RE_BLOQUE = new RegExp(
  `\\b(${DIA_SUELTO})\\b[\\s,.:]*(?:de|desde)?\\s*` +
  `(${HORA})\\s*${SEPARADOR}\\s*(${HORA})` +
  `\\s*(?:hrs?|horas?)?\\b`,
  "i",
);

/** "8" → "08:00", "8.30" → "08:30". Null si la hora no existe en un reloj. */
export function leerHora(crudo: string): string | null {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(crudo.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** El número de día de una palabra escrita como sea. Null si no es un día. */
export function leerDia(palabra: string): number | null {
  const limpia = sinAcentos(palabra);
  if (limpia.length < 2) return null;
  return DIAS.find((d) => d.nombre.startsWith(limpia))?.dia ?? null;
}

// Lo que la gente escribe después de la hora. El tipo se reconoce por su
// raíz para que "lab", "laboratorio" y "labo" caigan en el mismo lugar.
const TIPOS: { raiz: string; tipo: string }[] = [
  { raiz: "lab", tipo: "Laboratorio" },
  { raiz: "ayud", tipo: "Ayudantía" },
  { raiz: "taller", tipo: "Taller" },
  { raiz: "practic", tipo: "Práctica" },
  { raiz: "catedra", tipo: "Cátedra" },
];

/** Separa "Lab B-104" en su tipo y su sala. */
export function leerCola(cola: string): { tipo: string; sala: string } {
  const palabras = cola.trim().split(/\s+/).filter(Boolean);
  const restantes: string[] = [];
  let tipo = "";

  for (const palabra of palabras) {
    const limpia = sinAcentos(palabra).replace(/[.,;:]/g, "");
    const hallado = !tipo ? TIPOS.find((t) => limpia.startsWith(t.raiz)) : undefined;
    if (hallado) tipo = hallado.tipo;
    else restantes.push(palabra);
  }

  return {
    tipo: tipo || "Clase",
    sala: restantes.join(" ").replace(/^[-–—,·|]+\s*/, "").trim(),
  };
}

/**
 * Lee un horario escrito a mano.
 *
 * Acepta las dos formas en que se escribe naturalmente, y las mezcla sin
 * problema porque cada línea se decide sola:
 *
 *     Cálculo I                          Cálculo I, lunes 8:30 a 10:00
 *     lunes 8:30 a 10:00 sala B-104      Física I, martes 14:00-16:00 lab
 *     miércoles 8:30 a 10:00
 *
 * Una línea sin día ni hora nombra un ramo. Una con día y hora es un bloque:
 * si trae texto por delante, ese texto dice de qué ramo es; si no, es del
 * último ramo nombrado. Un ramo repetido no se duplica, se le suman bloques.
 */
export function leerHorario(texto: string): HorarioEscrito {
  const ramos: RamoEscrito[] = [];
  const reparos: Reparo[] = [];
  // Por nombre normalizado, para que "Cálculo I" y "cálculo  i" sean el mismo.
  const porNombre = new Map<string, RamoEscrito>();
  let actual: RamoEscrito | null = null;

  const ramoDe = (nombre: string): RamoEscrito => {
    const limpio = nombre.replace(/\s+/g, " ").trim().replace(/[,;:·|]+$/, "").trim();
    const clave = sinAcentos(limpio);
    const existente = porNombre.get(clave);
    if (existente) return existente;
    const nuevo: RamoEscrito = { nombre: limpio, bloques: [] };
    porNombre.set(clave, nuevo);
    ramos.push(nuevo);
    return nuevo;
  };

  texto.replace(/\r\n/g, "\n").split("\n").forEach((cruda, i) => {
    const linea = cruda.trim();
    if (!linea) return;
    const numero = i + 1;
    const reparo = (motivo: string) => reparos.push({ linea: numero, texto: linea, motivo });

    const m = RE_BLOQUE.exec(linea);
    if (!m) {
      // Trae una hora de reloj pero no se pudo leer como bloque. Tomarla como
      // nombre de ramo crearía uno llamado "Matemáticas 8:00 a 10:00", que es
      // el peor final posible: se ve creado y está mal.
      if (RE_PARECE_HORA.test(linea)) {
        reparo("Parece un bloque, pero no reconocí el día. Escríbelo así: lunes 8:30 a 10:00.");
        return;
      }
      // Sin día ni hora: es el nombre de un ramo. Salvo que sea solo puntuación.
      if (!/[\p{L}\p{N}]/u.test(linea)) return;
      actual = ramoDe(linea);
      return;
    }

    const dia = leerDia(m[1]!);
    const inicio = leerHora(m[2]!);
    const fin = leerHora(m[3]!);

    if (dia === null) { reparo("No reconocí el día."); return; }
    if (!inicio || !fin) { reparo("Esa hora no existe en un reloj."); return; }
    if (fin <= inicio) { reparo("La hora de término va antes que la de inicio."); return; }

    const antes = linea.slice(0, m.index).trim().replace(/[,;:·|–—-]+$/, "").trim();
    const dueño = antes ? ramoDe(antes) : actual;
    if (!dueño) { reparo("No sé de qué ramo es: ponle el nombre antes o arriba."); return; }
    actual = dueño;

    const { tipo, sala } = leerCola(linea.slice(m.index + m[0].length));
    // Un bloque repetido tal cual es un copiar y pegar de más, no dos clases.
    const repetido = dueño.bloques.some(
      (b) => b.dia === dia && b.inicio === inicio && b.fin === fin);
    if (!repetido) dueño.bloques.push({ dia, inicio, fin, sala, tipo });
  });

  // Un ramo nombrado y nada más es perfectamente válido: alguien puede querer
  // el ramo para colgarle material y no tener horas fijas.
  return { ramos, reparos };
}

/** Cuántos bloques salieron en total, para decirlo antes de crear nada. */
export const cuantosBloques = (h: HorarioEscrito): number =>
  h.ramos.reduce((n, r) => n + r.bloques.length, 0);

/**
 * Une las partes de una línea saltándose las vacías.
 *
 * Un bloque puede no tener sala, y "Clase ·  · hasta 11:45" —con el punto
 * colgando— es lo que sale de pegar las partes a ciegas.
 */
export const unir = (partes: (string | null | undefined)[]): string =>
  partes.map((p) => p?.trim() ?? "").filter(Boolean).join(" · ");

/**
 * El color que le toca al ramo número `indice` de una carga, sabiendo
 * cuántos ramos propios ya existían.
 *
 * Existe para que la vista previa muestre exactamente los colores con que
 * van a quedar creados: si la cuenta se hace en dos lados, se separan.
 */
export function colorDeLaCarga(
  indice: number, yaExistentes: number, paleta: readonly string[],
): string {
  return paleta[(yaExistentes + indice) % paleta.length]!;
}
