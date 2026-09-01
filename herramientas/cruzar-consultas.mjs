// Cruza cada consulta de la aplicación contra el esquema de verdad.
//
// Uso:  npm run prueba:consultas          (dentro de prueba:bd, que arma la base)
//       node herramientas/cruzar-consultas.mjs --catalogo <archivo.json>
//
// El motivo: `supabase.from("evaluacines").select("nota")` compila, pasa los
// tipos y pasa las pruebas con datos falsos. Falla recién en el teléfono de
// alguien, contra el servidor de verdad, con un mensaje que en la pantalla se
// lee como «no pude cargar tus notas». Una letra cambiada en un nombre de
// columna no tiene por qué esperar hasta ahí para que alguien se entere.
//
// El catálogo sale del Postgres que levantan las pruebas de acceso con las
// migraciones aplicadas: no es una copia a mano del esquema, que se
// desactualizaría, sino la base misma respondiendo qué columnas tiene.

import ts from "../app/node_modules/typescript/lib/typescript.js";
import { readFileSync, globSync } from "node:fs";

const catalogoEn = process.argv[process.argv.indexOf("--catalogo") + 1];
if (!catalogoEn || catalogoEn.startsWith("--")) {
  console.error("Falta --catalogo <archivo.json>. Se arma con: npm run prueba:bd");
  process.exit(2);
}
const catalogo = JSON.parse(readFileSync(catalogoEn, "utf8"));
const TABLAS = catalogo.tablas;
const RELACIONES = catalogo.relaciones ?? {};
const FUNCIONES = catalogo.funciones ?? {};
// Lo que además puede *tocar* una sesión normal. Que la columna exista no
// basta: los permisos van por columna, y una recién agregada no se lee hasta
// que alguien la conceda. Es la clase de error que no aparece en ninguna
// prueba y sale como «no pude cargar» en el teléfono de alguien.
const PERMISOS = catalogo.permisos ?? {};
const PERMISOS_TABLA = catalogo.permisos_de_tabla ?? {};
const FUNCIONES_PERMITIDAS = catalogo.funciones_permitidas ?? [];

// Los que filtran por una columna: el primer argumento es su nombre.
const POR_COLUMNA = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
  "contains", "containedBy", "overlaps", "order",
]);
// Los que reciben un objeto con columnas por clave.
const POR_OBJETO = new Set(["insert", "update", "upsert"]);

const archivos = [
  ...globSync("app/src/**/*.ts"),
  ...globSync("app/src/**/*.tsx"),
  ...globSync("supabase/functions/*/index.ts"),
].filter((f) => !f.includes(".prueba."));

const quejas = [];
let revisadas = 0;
const sinRevisar = [];   // lo que se arma en tiempo de ejecución y no se puede leer acá

// ── Ayudas ───────────────────────────────────────────────────────────────

function donde(fuente, nodo) {
  const { line } = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente));
  return `${fuente.fileName}:${line + 1}`;
}

/**
 * Separa por comas de primer nivel: "id, materiales(a, b), titulo" son tres.
 * Partir por comas a secas rompería lo incrustado.
 */
function porComas(texto) {
  const partes = [];
  let hondura = 0;
  let actual = "";
  for (const c of texto) {
    if (c === "(") hondura++;
    if (c === ")") hondura--;
    if (c === "," && hondura === 0) { partes.push(actual); actual = ""; continue; }
    actual += c;
  }
  partes.push(actual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

function existeColumna(tabla, columna) {
  return (TABLAS[tabla] ?? []).includes(columna);
}

// La aplicación entra con la clave anónima, así que los permisos la limitan.
// Las funciones del servidor no siempre: varias usan la clave de servicio, que
// se los salta. Ahí se comprueba que exista, y nada más.
let conPermisos = true;

function concedida(permiso, tabla, columna) {
  if (!conPermisos) return true;
  return ((PERMISOS[permiso] ?? {})[tabla] ?? []).includes(columna);
}

function concedidaLaTabla(permiso, tabla) {
  if (!conPermisos) return true;
  return (PERMISOS_TABLA[permiso] ?? []).includes(tabla);
}

function seIncrusta(tabla, nombre) {
  return (RELACIONES[tabla] ?? []).includes(nombre);
}

/** Revisa "id, titulo, materiales(id, tipo)" contra una tabla. */
function revisarSelect(tabla, texto, lugar) {
  for (const pieza of porComas(texto)) {
    if (pieza === "*" || pieza === "count") continue;

    const incrustado = /^([\w]+)\s*(?:!\w+)?\s*\(([\s\S]*)\)$/.exec(pieza);
    if (incrustado) {
      const [, nombre, dentro] = incrustado;
      if (!TABLAS[nombre]) {
        quejas.push(`${lugar} · "${tabla}" incrusta "${nombre}", que no es ninguna tabla`);
        continue;
      }
      if (!seIncrusta(tabla, nombre)) {
        quejas.push(`${lugar} · "${tabla}" incrusta "${nombre}" y no hay clave foránea entre las dos`);
        continue;
      }
      revisarSelect(nombre, dentro, lugar);
      continue;
    }

    // "alias:columna" y "columna->>campo": lo que se comprueba es la columna.
    const columna = pieza.split(":").pop().split("->")[0].trim();
    if (!existeColumna(tabla, columna)) {
      quejas.push(`${lugar} · "${tabla}" no tiene la columna "${columna}"`);
    } else if (!concedida("SELECT", tabla, columna)) {
      quejas.push(`${lugar} · "${tabla}.${columna}" existe pero no está concedida para leer`);
    }
  }
}

// ── Recorrer un archivo ──────────────────────────────────────────────────

function revisarArchivo(ruta) {
  conPermisos = ruta.startsWith("app/");
  const fuente = ts.createSourceFile(ruta, readFileSync(ruta, "utf8"), ts.ScriptTarget.ESNext, true);

  // Las listas de columnas guardadas en una constante: `const CAMPOS = "..."`.
  const constantes = new Map();
  const anotarConstantes = (nodo) => {
    if (ts.isVariableDeclaration(nodo) && ts.isIdentifier(nodo.name) &&
        nodo.initializer && ts.isStringLiteral(nodo.initializer)) {
      constantes.set(nodo.name.text, nodo.initializer.text);
    }
    ts.forEachChild(nodo, anotarConstantes);
  };
  anotarConstantes(fuente);

  /** El texto de un argumento, sea literal o una constante de este archivo. */
  function comoTexto(arg) {
    if (!arg) return null;
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
    if (ts.isIdentifier(arg) && constantes.has(arg.text)) return constantes.get(arg.text);
    return null;
  }

  /** Un eslabón de la cadena: `.metodo(args)` aplicado sobre `nodo`. */
  function siguiente(nodo) {
    const acceso = nodo.parent;
    if (!acceso || !ts.isPropertyAccessExpression(acceso) || acceso.expression !== nodo) return null;
    const llamada = acceso.parent;
    if (!llamada || !ts.isCallExpression(llamada) || llamada.expression !== acceso) return null;
    return { metodo: acceso.name.text, args: llamada.arguments, nodo: llamada };
  }

  /** Sigue la cadena desde un `.from("tabla")` y revisa cada eslabón. */
  function seguirCadena(tabla, desde) {
    let actual = desde;
    let paso;
    while ((paso = siguiente(actual))) {
      revisarEslabon(tabla, paso, donde(fuente, paso.nodo));
      actual = paso.nodo;
    }
    return actual; // dónde terminó, para saber si quedó guardada en una variable
  }

  function revisarEslabon(tabla, { metodo, args }, lugar) {
    if (metodo === "select") {
      const texto = comoTexto(args[0]);
      if (args.length === 0) return;            // select() = todas las columnas
      if (texto === null) { sinRevisar.push(`${lugar} · .select() con una lista armada en el momento`); return; }
      revisarSelect(tabla, texto, lugar);
      return;
    }
    if (POR_COLUMNA.has(metodo)) {
      const columna = comoTexto(args[0]);
      if (columna === null) { sinRevisar.push(`${lugar} · .${metodo}() con la columna armada en el momento`); return; }
      // `.order("nota", { referencedTable: "notas" })` ordena por la incrustada.
      const opciones = args[1];
      if (opciones && ts.isObjectLiteralExpression(opciones)) {
        const ajena = opciones.properties.find(
          (p) => p.name && ["referencedTable", "foreignTable"].includes(p.name.getText(fuente)),
        );
        if (ajena) { sinRevisar.push(`${lugar} · .${metodo}() ordena por una tabla incrustada`); return; }
      }
      // PostgREST deja filtrar por una columna de lo incrustado:
      // .eq("conversaciones.estudiante_id", …) sobre .select("…conversaciones!inner(…)").
      const camino = columna.split(".");
      let sobre = tabla;
      for (let i = 0; i < camino.length - 1; i++) {
        if (!seIncrusta(sobre, camino[i])) {
          quejas.push(`${lugar} · .${metodo}("${columna}") y "${sobre}" no incrusta "${camino[i]}"`);
          return;
        }
        sobre = camino[i];
      }
      const hoja = camino[camino.length - 1];
      if (!existeColumna(sobre, hoja)) {
        quejas.push(`${lugar} · .${metodo}("${columna}") y "${sobre}" no tiene la columna "${hoja}"`);
      }
      return;
    }
    if (POR_OBJETO.has(metodo)) {
      const objetos = [];
      const juntar = (a) => {
        if (!a) return;
        if (ts.isObjectLiteralExpression(a)) { objetos.push(a); return; }
        if (ts.isParenthesizedExpression(a)) { juntar(a.expression); return; }
        if (ts.isArrayLiteralExpression(a)) { a.elements.forEach(juntar); return; }
        // `.insert(bloques.map((b) => ({ … })))`: la lista se arma mientras
        // corre, pero las columnas están ahí escritas y sí se pueden revisar.
        if (ts.isCallExpression(a) && ts.isPropertyAccessExpression(a.expression) &&
            a.expression.name.text === "map" && a.arguments.length) {
          const vuelta = a.arguments[0];
          if ((ts.isArrowFunction(vuelta) || ts.isFunctionExpression(vuelta)) && vuelta.body) {
            if (ts.isBlock(vuelta.body)) {
              for (const st of vuelta.body.statements) {
                if (ts.isReturnStatement(st) && st.expression) juntar(st.expression);
              }
            } else {
              juntar(vuelta.body);
            }
            return;
          }
        }
        sinRevisar.push(`${lugar} · .${metodo}() con un valor armado en el momento`);
      };
      juntar(args[0]);
      // upsert escribe por los dos caminos según haya fila o no.
      const necesita = metodo === "insert" ? ["INSERT"] : metodo === "update" ? ["UPDATE"] : ["INSERT", "UPDATE"];
      for (const obj of objetos) {
        for (const prop of obj.properties) {
          if (!prop.name) { sinRevisar.push(`${lugar} · .${metodo}() con un objeto esparcido`); continue; }
          if (ts.isComputedPropertyName(prop.name)) { sinRevisar.push(`${lugar} · .${metodo}() con una clave calculada`); continue; }
          const columna = prop.name.text;
          if (!existeColumna(tabla, columna)) {
            quejas.push(`${lugar} · .${metodo}() escribe "${columna}" y "${tabla}" no tiene esa columna`);
            continue;
          }
          for (const permiso of necesita) {
            if (!concedida(permiso, tabla, columna)) {
              quejas.push(`${lugar} · .${metodo}() escribe "${tabla}.${columna}" y no está concedida (${permiso})`);
            }
          }
        }
      }
      return;
    }
    if (metodo === "delete") {
      if (!concedidaLaTabla("DELETE", tabla)) {
        quejas.push(`${lugar} · .delete() sobre "${tabla}" y no está concedido borrar ahí`);
      }
    }
  }

  // Dónde quedó guardada cada consulta: `let q = supabase.from("x")…`, que
  // después crece con `q = q.eq(...)` en un if.
  const guardadas = new Map();

  const recorrer = (nodo) => {
    if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression)) {
      const metodo = nodo.expression.name.text;

      if (metodo === "from") {
        const tabla = comoTexto(nodo.arguments[0]);
        if (tabla !== null && TABLAS[tabla] === undefined) {
          // storage.from("material") es otra cosa: baldes, no tablas.
          const sobre = nodo.expression.expression.getText(fuente);
          if (!sobre.includes("storage")) {
            quejas.push(`${donde(fuente, nodo)} · no existe la tabla "${tabla}"`);
          }
        } else if (tabla !== null) {
          revisadas++;
          const fin = seguirCadena(tabla, nodo);
          const padre = fin.parent;
          if (padre && ts.isVariableDeclaration(padre) && ts.isIdentifier(padre.name)) {
            guardadas.set(padre.name.text, tabla);
          } else if (padre && ts.isBinaryExpression(padre) && ts.isIdentifier(padre.left)) {
            guardadas.set(padre.left.text, tabla);
          }
        }
      }

      if (metodo === "rpc") {
        const nombre = comoTexto(nodo.arguments[0]);
        if (nombre === null) sinRevisar.push(`${donde(fuente, nodo)} · .rpc() con el nombre armado en el momento`);
        else if (!FUNCIONES[nombre]) {
          quejas.push(`${donde(fuente, nodo)} · no existe la función "${nombre}"`);
        } else if (conPermisos && !FUNCIONES_PERMITIDAS.includes(nombre)) {
          quejas.push(`${donde(fuente, nodo)} · "${nombre}" existe pero no está concedida para llamarla`);
        } else {
          revisadas++;
          const args = nodo.arguments[1];
          if (args && ts.isObjectLiteralExpression(args)) {
            for (const prop of args.properties) {
              if (!prop.name || ts.isComputedPropertyName(prop.name)) { sinRevisar.push(`${donde(fuente, nodo)} · .rpc() con un argumento armado en el momento`); continue; }
              if (!FUNCIONES[nombre].includes(prop.name.text)) {
                quejas.push(`${donde(fuente, nodo)} · "${nombre}" no recibe ningún argumento "${prop.name.text}"`);
              }
            }
          }
        }
      }
    }
    ts.forEachChild(nodo, recorrer);
  };
  recorrer(fuente);

  // Segunda pasada, para las consultas que crecen dentro de un `if`.
  if (guardadas.size) {
    const recorrerGuardadas = (nodo) => {
      if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression) &&
          ts.isIdentifier(nodo.expression.expression) && guardadas.has(nodo.expression.expression.text)) {
        revisarEslabon(
          guardadas.get(nodo.expression.expression.text),
          { metodo: nodo.expression.name.text, args: nodo.arguments },
          donde(fuente, nodo),
        );
      }
      ts.forEachChild(nodo, recorrerGuardadas);
    };
    recorrerGuardadas(fuente);
  }
}

for (const archivo of archivos) revisarArchivo(archivo);

for (const q of quejas) console.error(q);

if (quejas.length) {
  console.error(`\n${quejas.length} consulta(s) que el servidor de verdad rechazaría`);
  process.exit(1);
}
console.log(`${revisadas} consultas cruzadas contra el esquema · ${Object.keys(TABLAS).length} tablas`);

// Decir cuáles quedaron fuera y no solo cuántas: un número no deja ver si el
// agujero está creciendo.
if (sinRevisar.length) {
  console.log(`\nSin revisar, porque se arman mientras corre (${sinRevisar.length}):`);
  for (const s of sinRevisar) console.log(`  ${s}`);
}
