// ¿Puede aparecer un dato de ejemplo con el servidor conectado?
//
// Uso:  npm run prueba:sin-ejemplos
//
// StudIA trae un modo demostración con un colegio entero inventado —Eduardo,
// Ana Ríos, Cálculo I— para poder recorrer la aplicación sin servidor. Eso es
// útil y es un riesgo: si una pantalla lee esos datos sin preguntar si hay
// servidor, un colegio de verdad ve gente que no existe.
//
// Ya pasó una vez. El panel de administración revisaba los choques de horario
// contra los profesores de ejemplo, así que con el servidor conectado la
// revisión se hacía contra profesores inventados: salía siempre limpia, y no
// porque el horario estuviera bien.
//
// La regla: un archivo que traiga algo de un módulo `*-demo` tiene que
// preguntar por `MODO_DEMO`, o declararse de demostración con la marca de
// abajo. Traer solo tipos no cuenta: los tipos no llegan al aparato.

import ts from "../app/node_modules/typescript/lib/typescript.js";
import { readFileSync, globSync } from "node:fs";

/** La marca para una pantalla que solo se monta sin servidor. */
const MARCA = "SOLO EN DEMOSTRACIÓN";

const ES_DEMO = /(^|\/)[\w-]*-demo\.ts$/;

const archivos = [...globSync("app/src/**/*.ts"), ...globSync("app/src/**/*.tsx")]
  .filter((f) => !f.includes(".prueba.") && !ES_DEMO.test(f))
  .sort();

const quejas = [];
let revisados = 0;
const declarados = [];

for (const ruta of archivos) {
  const texto = readFileSync(ruta, "utf8");
  const fuente = ts.createSourceFile(ruta, texto, ts.ScriptTarget.ESNext, true);

  const traidos = [];
  for (const nodo of fuente.statements) {
    if (!ts.isImportDeclaration(nodo)) continue;
    if (!/-demo\.ts$/.test(nodo.moduleSpecifier.text)) continue;

    const clausula = nodo.importClause;
    if (!clausula || clausula.isTypeOnly) continue;   // `import type`: no viaja nada

    const nombres = [];
    const enlaces = clausula.namedBindings;
    if (enlaces && ts.isNamedImports(enlaces)) {
      for (const e of enlaces.elements) if (!e.isTypeOnly) nombres.push(e.name.text);
    } else if (enlaces && ts.isNamespaceImport(enlaces)) {
      nombres.push(`* como ${enlaces.name.text}`);
    }
    if (clausula.name) nombres.push(clausula.name.text);
    if (nombres.length) traidos.push({ de: nodo.moduleSpecifier.text, nombres });
  }

  if (!traidos.length) continue;
  revisados++;

  if (texto.includes(MARCA)) { declarados.push(ruta); continue; }
  if (/\bMODO_DEMO\b/.test(texto)) continue;

  for (const t of traidos) {
    quejas.push(`${ruta} · trae ${t.nombres.join(", ")} de ${t.de} sin preguntar por MODO_DEMO`);
  }
}

if (quejas.length) {
  for (const q of quejas) console.error(q);
  console.error(`\n${quejas.length} lugar(es) donde un dato de ejemplo puede llegar a un colegio de verdad.`);
  console.error(`Si la pantalla solo se monta sin servidor, escríbelo: «${MARCA}».`);
  process.exit(1);
}

console.log(`${revisados} archivos tocan los datos de ejemplo, y los ${revisados} preguntan antes.`);
if (declarados.length) {
  console.log(`\nDeclarados de demostración (${declarados.length}):`);
  for (const d of declarados) console.log(`  ${d}`);
}
