// Arma el listado de licencias de terceros que muestra la aplicación.
//
// Uso: npm run licencias
//
// No es un trámite: MIT, BSD y Apache exigen que su aviso de copyright viaje
// con el software. Un APK que las usa y no las nombra las está incumpliendo, y
// además Play Store pide la pantalla de atribuciones. Escribirla a mano sería
// garantizar que quede vieja en la primera actualización de dependencias.
//
// Se listan las dependencias directas. Las transitivas son cientos y ninguna
// pantalla de teléfono sirve para leerlas: quien necesite el árbol completo lo
// saca de `npm ls`, que es la fuente y no una copia.
//
// Los textos se guardan una sola vez. Treinta paquetes MIT traen el mismo
// permiso palabra por palabra, y repetirlo treinta veces engordaría el paquete
// de la aplicación a cambio de nada.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(raiz, "app");
const modulos = join(app, "node_modules");

const paquete = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
const nombres = Object.keys(paquete.dependencies ?? {}).sort();

if (!existsSync(modulos)) {
  console.error("No hay app/node_modules. Corre primero: npm --prefix app install");
  process.exit(1);
}

/** El archivo de licencia, con cualquiera de los nombres que se usan. */
function textoDeLicencia(carpeta) {
  let archivos;
  try { archivos = readdirSync(carpeta); } catch { return null; }
  const elegido = archivos.find((a) => /^(licen[cs]e|copying)(\.|$)/i.test(a));
  if (!elegido) return null;
  try {
    const texto = readFileSync(join(carpeta, elegido), "utf8").trim();
    // Un archivo que solo dice «ver la web» no es la licencia; mejor no fingir.
    return texto.length > 60 ? texto : null;
  } catch { return null; }
}

/** La línea de copyright, que es lo que la licencia obliga a conservar. */
function copyrightDe(texto, respaldo) {
  const linea = (texto ?? "").split("\n").find((l) => /copyright/i.test(l) && /\d{4}|\(c\)|©/i.test(l));
  return linea ? linea.trim().replace(/\s+/g, " ") : respaldo;
}

const textos = [];
const terceros = [];

for (const nombre of nombres) {
  const carpeta = join(modulos, ...nombre.split("/"));
  let meta;
  try { meta = JSON.parse(readFileSync(join(carpeta, "package.json"), "utf8")); } catch { meta = null; }
  if (!meta) { console.warn(`sin instalar: ${nombre}`); continue; }

  const licencia = typeof meta.license === "string" ? meta.license
    : meta.license?.type ?? meta.licenses?.[0]?.type ?? "sin declarar";
  const texto = textoDeLicencia(carpeta);
  const autor = typeof meta.author === "string" ? meta.author : meta.author?.name;

  let indice = -1;
  if (texto) {
    indice = textos.indexOf(texto);
    if (indice < 0) indice = textos.push(texto) - 1;
  }

  terceros.push({
    nombre,
    version: meta.version ?? "",
    licencia,
    copyright: copyrightDe(texto, autor ? `© ${autor}` : ""),
    texto: indice,
  });
}

const sinTexto = terceros.filter((t) => t.texto < 0);

const salida = `// Las licencias de las bibliotecas que usa StudIA.
//
// GENERADO por herramientas/licencias.mjs. No editar a mano: se reescribe.
// Para actualizarlo después de cambiar dependencias: npm run licencias
//
// Está en el dominio porque es texto y nada más: no depende de React ni de
// Expo, y así la prueba puede leerlo sin arrancar una pantalla.

export type Tercero = {
  nombre: string;
  version: string;
  /** El identificador SPDX que declara el paquete: "MIT", "Apache-2.0"… */
  licencia: string;
  /** La línea que la licencia obliga a conservar. Vacía si el paquete no la trae. */
  copyright: string;
  /** Índice en TEXTOS, o -1 si el paquete no incluyó el archivo. */
  texto: number;
};

/** Los textos, sin repetir: muchos paquetes traen la misma licencia MIT. */
export const TEXTOS: string[] = ${JSON.stringify(textos, null, 2)};

export const TERCEROS: Tercero[] = ${JSON.stringify(terceros, null, 2)};

/** El texto de una licencia, o null si el paquete no lo incluyó. */
export function textoDe(t: Tercero): string | null {
  return t.texto >= 0 ? TEXTOS[t.texto] ?? null : null;
}
`;

const destino = join(app, "src", "dominio", "terceros.ts");

// `--revisar` no escribe: dice si el listado quedó atrás. Va en las pruebas,
// porque una dependencia agregada sin regenerar esto deja la app incumpliendo
// una licencia sin que nada avise.
if (process.argv.includes("--revisar")) {
  let viejo = null;
  try { viejo = readFileSync(destino, "utf8"); } catch { /* todavía no existe */ }
  if (viejo !== salida) {
    console.error("El listado de licencias quedó atrás respecto de las dependencias.");
    console.error("Corre `npm run licencias` y agrega el archivo al commit.");
    process.exit(1);
  }
  console.log(`Las licencias de los ${terceros.length} paquetes están al día.`);
  process.exit(0);
}

writeFileSync(destino, salida);
console.log(`${terceros.length} paquetes · ${textos.length} textos distintos · ${(salida.length / 1024).toFixed(0)} kB`);
if (sinTexto.length) {
  console.log(`Sin archivo de licencia (queda solo el nombre y el SPDX): ${sinTexto.map((t) => t.nombre).join(", ")}`);
}
