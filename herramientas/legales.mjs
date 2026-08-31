// Escribe los textos legales de legal/ desde la única fuente que hay.
//
// Uso: npm run legales
//
// El texto vive en app/src/dominio/legales.ts porque la aplicación tiene que
// poder mostrarlo sin conexión. Estos archivos existen para poder leerlos en el
// repositorio y para que la licencia pueda apuntarles. Se generan: editarlos a
// mano es escribir algo que la siguiente corrida borra, y —peor— dejar que el
// repositorio diga una cosa y la aplicación otra.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DOCUMENTOS, comoMarkdown } from "../app/src/dominio/legales.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const carpeta = join(raiz, "legal");
mkdirSync(carpeta, { recursive: true });

// `--revisar` no escribe: dice si algo quedó atrás. Va en las pruebas, para que
// un cambio en el texto que no se regeneró no llegue a publicarse.
const soloRevisar = process.argv.includes("--revisar");
const atrasados = [];

for (const d of DOCUMENTOS) {
  const ruta = join(carpeta, `${d.id}.md`);
  const nuevo = comoMarkdown(d);
  let viejo = null;
  try { viejo = readFileSync(ruta, "utf8"); } catch { /* todavía no existe */ }

  if (soloRevisar) {
    if (viejo !== nuevo) atrasados.push(`legal/${d.id}.md`);
    continue;
  }
  if (viejo === nuevo) { console.log(`igual  legal/${d.id}.md`); continue; }
  writeFileSync(ruta, nuevo);
  console.log(`${viejo === null ? "nuevo " : "escrito"} legal/${d.id}.md`);
}

if (soloRevisar && atrasados.length) {
  console.error(`Quedaron atrás: ${atrasados.join(", ")}`);
  console.error("Corre `npm run legales` y agrega los archivos al commit.");
  process.exit(1);
}
if (soloRevisar) console.log("Los textos legales del repositorio están al día.");
