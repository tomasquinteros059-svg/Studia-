// Verifica que las funciones de Supabase (que corren en Deno) sean TypeScript
// sintácticamente válido. No las ejecuta: acá no hay Deno.
import ts from "../../app/node_modules/typescript/lib/typescript.js";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const archivos = globSync("supabase/functions/**/*.ts").filter((f) => !f.endsWith(".prueba.ts"));
let fallas = 0;

for (const archivo of archivos) {
  const fuente = ts.createSourceFile(
    archivo, readFileSync(archivo, "utf8"), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS,
  );
  const errores = fuente.parseDiagnostics ?? [];
  if (errores.length) {
    fallas += errores.length;
    for (const d of errores) {
      const { line, character } = fuente.getLineAndCharacterOfPosition(d.start);
      console.error(`${archivo}:${line + 1}:${character + 1} · ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
    }
  } else {
    console.log(`ok · ${archivo}`);
  }
}

if (fallas) { console.error(`\n${fallas} error(es) de sintaxis`); process.exit(1); }
console.log(`\n${archivos.length} archivos sin errores de sintaxis`);
