// Deja cada función del servidor en un solo archivo, para pegarla en el panel.
//
// Uso:  npm run juntar-funciones
//       npm run prueba:funciones-juntas     (compara sin escribir)
//
// Las ocho funciones comparten código: `_compartido/cors.ts` lo usan todas, y
// cada una tiene su núcleo con la lógica que sí se puede probar sin Deno. Eso
// funciona con la consola de Supabase, que sube la carpeta entera y resuelve
// los `../_compartido/`. En el editor del panel no: ahí cada función es su
// propia raíz y ese `../` no lleva a ninguna parte.
//
// Esto arma la versión pegable: el mismo código, con lo compartido incrustado
// arriba. No se edita a mano —lo que vale son los archivos de
// supabase/functions— y `--revisar` avisa si quedó viejo.

import ts from "../app/node_modules/typescript/lib/typescript.js";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const FUENTE = "supabase/functions";
const DESTINO = "supabase/funciones-de-una-vez";
const REVISAR = process.argv.includes("--revisar");

const funciones = readdirSync(FUENTE, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_compartido")
  .map((e) => e.name)
  .sort();

// ── Leer los imports de lo compartido ────────────────────────────────────

// Con el analizador de TypeScript y no a mano: los imports de las funciones
// grandes se reparten en diez líneas, y una expresión regular que cruce saltos
// de línea se come el import de arriba sin avisar.
function importsCompartidos(fuente) {
  const encontrados = [];
  for (const nodo of fuente.statements) {
    if (!ts.isImportDeclaration(nodo)) continue;
    const desde = nodo.moduleSpecifier.text;
    const coincide = /^\.\.\/_compartido\/([\w-]+\.ts)$/.exec(desde);
    if (!coincide) continue;
    const nombres = [];
    const enlaces = nodo.importClause?.namedBindings;
    if (enlaces && ts.isNamedImports(enlaces)) {
      for (const e of enlaces.elements) nombres.push((e.propertyName ?? e.name).text);
    }
    encontrados.push({
      archivo: coincide[1],
      nombres,
      desde: nodo.getStart(fuente),
      hasta: nodo.getEnd(),
    });
  }
  return encontrados;
}

/** Lo compartido se incrusta tal cual, sin el `export` de cada declaración. */
function sinExportar(texto) {
  return texto.replace(/^export\s+/gm, "").trimEnd();
}

function armar(funcion) {
  const ruta = join(FUENTE, funcion, "index.ts");
  const cuerpo = readFileSync(ruta, "utf8");
  const fuente = ts.createSourceFile(ruta, cuerpo, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  const traidos = importsCompartidos(fuente);

  // De atrás para adelante, para que sacar uno no corra los de más arriba.
  let sinImports = cuerpo;
  for (const t of [...traidos].reverse()) {
    sinImports = sinImports.slice(0, t.desde) + sinImports.slice(t.hasta);
  }
  sinImports = sinImports.replace(/\n{3,}/g, "\n\n");

  // Cada compartido una sola vez, en el orden en que la función los pide.
  const vistos = new Set();
  const pegados = [];
  for (const { archivo } of traidos) {
    if (vistos.has(archivo)) continue;
    vistos.add(archivo);
    pegados.push(
      [
        `// ── de _compartido/${archivo} ${"─".repeat(Math.max(0, 52 - archivo.length))}`,
        "",
        sinExportar(readFileSync(join(FUENTE, "_compartido", archivo), "utf8")),
        "",
      ].join("\n"),
    );
  }

  const encabezado = [
    `// StudIA · función "${funcion}", en un solo archivo.`,
    "//",
    "// Generado por herramientas/juntar-funciones.mjs para poder pegarla en el",
    "// editor del panel de Supabase. No lo edites acá: lo que vale es",
    `// ${FUENTE}/${funcion}/index.ts, y este se rehace.`,
    "",
    "",
  ].join("\n");

  const texto = `${encabezado}${sinImports.trimEnd()}\n\n${pegados.join("\n")}`;
  const esperados = traidos.flatMap((t) => t.nombres);
  // El original sin sus imports: es lo que tiene que sobrevivir entero.
  return { texto, esperados, original: sinImports };
}

// ── Comprobaciones ───────────────────────────────────────────────────────

/** Nombres declarados arriba del todo: funciones, constantes, tipos, clases. */
function declarados(archivo, texto) {
  const fuente = ts.createSourceFile(archivo, texto, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const nombres = new Set();
  const repetidos = [];
  const anotar = (n) => {
    if (nombres.has(n)) repetidos.push(n);
    nombres.add(n);
  };
  for (const nodo of fuente.statements) {
    if (ts.isVariableStatement(nodo)) {
      for (const d of nodo.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) anotar(d.name.text);
      }
    } else if (nodo.name && ts.isIdentifier(nodo.name)) {
      anotar(nodo.name.text);
    }
  }
  return { nombres, fuente, repetidos };
}

function revisar(funcion, texto, esperados, original) {
  const problemas = [];
  const archivo = `${DESTINO}/${funcion}.ts`;
  const { nombres, fuente, repetidos } = declarados(archivo, texto);

  // Incrustar puede tapar algo: si el núcleo y la función llaman igual a dos
  // cosas distintas, la segunda gana en silencio y la función cambia de
  // comportamiento sin que nadie lo note.
  for (const nombre of repetidos) {
    problemas.push(`${archivo} · "${nombre}" queda declarado dos veces`);
  }

  // Y que no se haya perdido nada por el camino: cada línea de código de la
  // función original tiene que seguir estando.
  const dentro = new Set(texto.split("\n").map((l) => l.trim()));
  for (const linea of original.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("//") || limpia.startsWith("*")) continue;
    if (!dentro.has(limpia)) problemas.push(`${archivo} · se perdió la línea: ${limpia.slice(0, 60)}`);
  }

  for (const d of fuente.parseDiagnostics ?? []) {
    const { line, character } = fuente.getLineAndCharacterOfPosition(d.start);
    problemas.push(`${archivo}:${line + 1}:${character + 1} · ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
  for (const nombre of esperados) {
    if (!nombres.has(nombre)) problemas.push(`${archivo} · se usa "${nombre}" y no quedó declarado`);
  }
  // Los comentarios de encabezado nombran _compartido a propósito; lo que no
  // puede quedar es un import, que en el panel no resolvería.
  for (const nodo of fuente.statements) {
    if (ts.isImportDeclaration(nodo) && nodo.moduleSpecifier.text.includes("_compartido")) {
      problemas.push(`${archivo} · quedó un import a _compartido`);
    }
  }
  return problemas;
}

// ── Correr ───────────────────────────────────────────────────────────────

let problemas = [];
const hechos = [];

for (const funcion of funciones) {
  const { texto, esperados, original } = armar(funcion);
  problemas = problemas.concat(revisar(funcion, texto, esperados, original));
  hechos.push({ funcion, texto, esperados });
}

if (problemas.length) {
  for (const p of problemas) console.error(p);
  console.error(`\n${problemas.length} problema(s)`);
  process.exit(1);
}

if (REVISAR) {
  let viejos = 0;
  for (const { funcion, texto } of hechos) {
    const ruta = `${DESTINO}/${funcion}.ts`;
    if (!existsSync(ruta) || readFileSync(ruta, "utf8") !== texto) {
      console.error(`${ruta} no coincide con ${FUENTE}/${funcion}/index.ts`);
      viejos++;
    }
  }
  if (viejos) {
    console.error("\nVuelve a generarlas:  npm run juntar-funciones");
    process.exit(1);
  }
  console.log(`${hechos.length} funciones al día · ${DESTINO}`);
} else {
  mkdirSync(DESTINO, { recursive: true });
  for (const { funcion, texto, esperados } of hechos) {
    writeFileSync(`${DESTINO}/${funcion}.ts`, texto, "utf8");
    const lineas = texto.split("\n").length;
    console.log(`${funcion.padEnd(14)} ${String(lineas).padStart(4)} líneas · ${esperados.length} piezas compartidas`);
  }
  console.log(`\n${hechos.length} funciones → ${DESTINO}`);
}
