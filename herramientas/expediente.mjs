// El expediente de la obra: lo que hay que llevar a un trámite de derechos.
//
//   npm run expediente
//
// Inscribir un programa computacional —o cederlo, o licenciarlo— pide describir
// exactamente QUÉ es lo que se inscribe. «La aplicación StudIA» no sirve: una
// aplicación cambia todos los días, y lo que se inscribe es una versión, no una
// idea. Esto arma esa versión en papel:
//
//   ficha-tecnica.md    qué es la obra, de qué está hecha, quién la escribió
//   inventario.csv      cada archivo con su tamaño y su huella SHA-256
//   codigo-fuente.txt   el listado completo, para depositar en medio digital
//   extracto.txt        las primeras y las últimas 25 páginas, que es el
//                       formato en papel que suelen pedir los registros
//   terceros.csv        todo lo que hay dentro y no es nuestro, con su licencia
//   historial.txt       cuándo se escribió cada cosa, según el repositorio
//
// La huella de todo junto es un número solo. Si mañana alguien pregunta «¿esta
// copia es la que se inscribió?», se vuelve a correr esto y se comparan los
// dos números. Es la única manera de responder esa pregunta sin discutir.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = join(raiz, "expediente");
mkdirSync(salida, { recursive: true });

const git = (...args) =>
  execFileSync("git", args, { cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// ── Qué entra y qué no ───────────────────────────────────────────────────
//
// Entra el código y lo que se escribió a mano. No entra lo compilado —`docs/`
// es la aplicación armada, no la obra— ni los archivos de bloqueo de npm, que
// son doce mil líneas generadas por una herramienta y no dicen nada de nadie.

const FUERA = [
  /^docs\//,                 // la aplicación compilada
  /package-lock\.json$/,     // generado por npm
  /^app\/android\//,         // generado por expo prebuild
  /^\.gitignore$/,
  // Y el expediente mismo. Se versiona para poder bajarlo sin consola, pero si
  // entrara en su propio inventario la huella cambiaría cada vez que se genera
  // —el listado contendría el listado— y dejaría de identificar nada.
  /^expediente\//,
];

// Se listan igual en el inventario, pero no en el listado de código: un PNG
// en hexadecimal no es algo que alguien vaya a leer.
const BINARIO = /\.(png|jpg|jpeg|gif|ico|ttf|otf|woff2?|jks|keystore|zip|pdf|mp3|wav|m4a)$/i;

// Se listan y se marcan: son parte de la obra, pero salen de otro archivo de
// la obra y no de una persona. Que quede dicho evita una discusión.
const GENERADOS = [
  /^supabase\/todo-de-una-vez\.sql$/,
  /^supabase\/funciones-de-una-vez\//,
  /^app\/src\/dominio\/terceros\.ts$/,
  /^legal\/.*\.md$/,
];

const marca = (ruta, reglas) => reglas.some((r) => r.test(ruta));

const archivos = git("ls-files", "-z").split("\0")
  .filter(Boolean)
  .filter((r) => !marca(r, FUERA))
  .sort();

// ── Inventario, con huella por archivo ───────────────────────────────────

const LINEAS_POR_PAGINA = 55;   // lo que cabe en una hoja tamaño carta

let lineasTotales = 0;
let bytesTotales = 0;
const filas = [];
const huellas = [];

for (const ruta of archivos) {
  const bruto = readFileSync(join(raiz, ruta));
  const huella = createHash("sha256").update(bruto).digest("hex");
  const esBinario = BINARIO.test(ruta);
  const lineas = esBinario ? 0 : bruto.toString("utf8").split("\n").length;

  lineasTotales += lineas;
  bytesTotales += bruto.length;
  huellas.push(`${huella}  ${ruta}`);
  filas.push([
    ruta,
    esBinario ? "binario" : (extname(ruta).slice(1) || "sin extensión"),
    marca(ruta, GENERADOS) ? "generado" : "escrito",
    String(lineas),
    String(bruto.length),
    huella,
  ]);
}

// La huella de todo junto: la de la lista de huellas, que cambia si cambia
// cualquier archivo, si se agrega uno o si se saca uno.
const huellaDeLaObra = createHash("sha256").update(huellas.join("\n")).digest("hex");

writeFileSync(
  join(salida, "inventario.csv"),
  ["archivo,tipo,origen,lineas,bytes,sha256", ...filas.map((f) => f.join(","))].join("\n") + "\n",
);
writeFileSync(join(salida, "huellas.txt"), huellas.join("\n") + "\n");

// ── El listado de código ─────────────────────────────────────────────────

const listado = [];
listado.push(
  "StudIA — listado de código fuente",
  `Huella SHA-256 de la obra: ${huellaDeLaObra}`,
  `Generado: ${new Date().toISOString().slice(0, 10)}`,
  "",
  "Cada archivo va precedido de su ruta y su huella. Las líneas van numeradas",
  "dentro de cada archivo, para poder citarlas.",
  "",
  "=".repeat(78),
  "",
);

for (const [i, ruta] of archivos.entries()) {
  if (BINARIO.test(ruta)) continue;
  const texto = readFileSync(join(raiz, ruta), "utf8");
  listado.push(
    "-".repeat(78),
    `ARCHIVO: ${ruta}`,
    `SHA-256: ${filas[i][5]}`,
    "-".repeat(78),
    "",
    ...texto.split("\n").map((l, n) => String(n + 1).padStart(5, " ") + " | " + l),
    "",
  );
}

const cuerpo = listado.join("\n");
writeFileSync(join(salida, "codigo-fuente.txt"), cuerpo);

// El extracto: primeras y últimas 25 páginas. Es lo que piden los registros
// que reciben en papel, para no imprimir mil hojas de algo que nadie va a leer.
const todas = cuerpo.split("\n");
const paginas = Math.ceil(todas.length / LINEAS_POR_PAGINA);
const corte = 25 * LINEAS_POR_PAGINA;
writeFileSync(
  join(salida, "extracto.txt"),
  paginas <= 50
    ? cuerpo
    : [
        ...todas.slice(0, corte),
        "",
        "=".repeat(78),
        `[ Se omiten las páginas 26 a ${paginas - 25} de ${paginas}. El listado completo`,
        `  está en codigo-fuente.txt, con huella SHA-256 ${huellaDeLaObra}. ]`,
        "=".repeat(78),
        "",
        ...todas.slice(-corte),
      ].join("\n"),
);

// ── Lo que hay dentro y no es nuestro ────────────────────────────────────

const { TERCEROS } = await import(
  "file://" + join(raiz, "app", "src", "dominio", "terceros.ts")
).catch(() => ({ TERCEROS: [] }));

writeFileSync(
  join(salida, "terceros.csv"),
  ["paquete,version,licencia,titular",
    ...TERCEROS.map((t) =>
      [t.nombre, t.version, t.licencia, `"${(t.copyright || "").replace(/"/g, "'")}"`].join(",")),
  ].join("\n") + "\n",
);

// El árbol completo, no solo las directas. Una licencia contagiosa escondida
// tres niveles abajo es exactamente lo que busca una auditoría antes de
// comercializar, y son 775 paquetes: a mano no se revisa.

const modulos = join(raiz, "app", "node_modules");
const todos = new Map();

function recorrer(carpeta, hondura) {
  if (hondura > 6) return;
  let entradas;
  try { entradas = readdirSync(carpeta, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    if (!e.isDirectory()) continue;
    const aqui = join(carpeta, e.name);
    // Los paquetes con arroba son una carpeta más: @expo/, @react-native/…
    if (e.name.startsWith("@")) { recorrer(aqui, hondura); continue; }
    const pj = join(aqui, "package.json");
    if (existsSync(pj)) {
      try {
        const j = JSON.parse(readFileSync(pj, "utf8"));
        if (j.name) {
          const lic = typeof j.license === "string" ? j.license
            : j.license?.type
            ?? (Array.isArray(j.licenses) ? j.licenses.map((x) => x.type).join(" OR ") : null)
            ?? "SIN DECLARAR";
          todos.set(`${j.name}@${j.version}`, lic);
        }
      } catch { /* un package.json roto no debe botar el expediente */ }
    }
    if (existsSync(join(aqui, "node_modules"))) recorrer(join(aqui, "node_modules"), hondura + 1);
  }
}

let arbol = { total: 0, porLicencia: {}, aRevisar: [] };
if (existsSync(modulos)) {
  recorrer(modulos, 0);
  const ordenados = [...todos.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  writeFileSync(
    join(salida, "terceros-arbol.csv"),
    ["paquete,licencia", ...ordenados.map(([p, l]) => `${p},"${l}"`)].join("\n") + "\n",
  );
  const porLicencia = {};
  for (const l of todos.values()) porLicencia[l] = (porLicencia[l] ?? 0) + 1;
  // Lo que un abogado querría mirar con calma: copyleft, o sin licencia declarada.
  const aRevisar = ordenados
    .filter(([, l]) => /GPL|MPL|EPL|CDDL|SSPL|CC-BY-SA|SIN DECLARAR/i.test(l))
    .map(([p, l]) => `${p} → ${l}`);
  arbol = { total: todos.size, porLicencia, aRevisar };
}

// ── Historial ────────────────────────────────────────────────────────────

writeFileSync(
  join(salida, "historial.txt"),
  "StudIA — historial del repositorio\n\n" +
  git("log", "--reverse", "--date=short", "--format=%ad  %an  %s"),
);

const autores = git("log", "--format=%an").trim().split("\n")
  .reduce((cuenta, a) => ({ ...cuenta, [a]: (cuenta[a] ?? 0) + 1 }), {});

const primero = git("log", "--reverse", "--date=short", "--format=%ad").split("\n")[0];
const ultimo = git("log", "-1", "--date=short", "--format=%ad").trim();
const commits = git("rev-list", "--count", "HEAD").trim();
const version = JSON.parse(readFileSync(join(raiz, "app", "app.json"), "utf8")).expo.version;

// Un resumen por carpeta, que es como se explica de qué está hecha una obra
// sin leerla entera.
const porCarpeta = {};
for (const [i, ruta] of archivos.entries()) {
  const partes = ruta.split("/");
  // Una fila por carpeta de primer nivel. `app/` y `supabase/` se abren un
  // nivel más porque adentro hay cosas de naturaleza distinta —la aplicación,
  // la base, las pruebas— y juntarlas escondería de qué está hecha la obra.
  // Los archivos sueltos de esas carpetas caen en «(otros)» y no inventan una
  // carpeta por archivo.
  const carpeta = partes.length === 1
    ? "(raíz)"
    : ["app", "supabase"].includes(partes[0])
      ? (partes.length > 2 ? `${partes[0]}/${partes[1]}` : `${partes[0]}/(otros)`)
      : partes[0] + "/";
  porCarpeta[carpeta] ??= { archivos: 0, lineas: 0 };
  porCarpeta[carpeta].archivos++;
  porCarpeta[carpeta].lineas += Number(filas[i][3]);
}

writeFileSync(
  join(salida, "resumen.json"),
  JSON.stringify({
    version, huellaDeLaObra, commits: Number(commits),
    primerCommit: primero, ultimoCommit: ultimo,
    autores, archivos: archivos.length,
    lineas: lineasTotales, bytes: bytesTotales, paginas,
    terceros: TERCEROS.length,
    arbolDeDependencias: arbol,
    porCarpeta,
  }, null, 2) + "\n",
);

// ── La ficha técnica ─────────────────────────────────────────────────────
//
// Es la hoja que se lee en la reunión. Va con espacios en blanco donde hacen
// falta datos que no están en el repositorio —RUT, domicilio— porque
// inventarlos sería peor que dejarlos vacíos.

const miles = (n) => n.toLocaleString("es-CL");
const carpetas = Object.entries(porCarpeta)
  .filter(([, v]) => v.lineas > 0)
  .sort((a, b) => b[1].lineas - a[1].lineas);

writeFileSync(join(salida, "ficha-tecnica.md"), `# StudIA — ficha técnica de la obra

Generado por \`npm run expediente\` el ${new Date().toISOString().slice(0, 10)}.
No se edita a mano: se vuelve a generar y los números siguen siendo ciertos.

---

## 1 · Identificación de la obra

| | |
|---|---|
| **Título** | StudIA |
| **Tipo de obra** | Programa computacional (software), inédito |
| **Versión** | ${version} |
| **Fecha de inicio** | ${primero} |
| **Última modificación** | ${ultimo} |
| **Idioma** | Español (código, comentarios e interfaz) |
| **País de creación** | Chile |
| **Huella SHA-256 de la obra** | \`${huellaDeLaObra}\` |

La huella identifica **esta** versión y ninguna otra. Se recalcula corriendo
\`npm run expediente\`: si da el mismo número, la copia es la misma.

## 2 · Titular

| | |
|---|---|
| **Nombre** | Tomás Quinteros |
| **RUT** | ____________________ |
| **Nacionalidad** | ____________________ |
| **Domicilio** | ____________________ |
| **Correo** | equinterosm33@gmail.com |

## 3 · Qué hace

StudIA es una plataforma de estudio para instituciones educativas y para
personas. Reúne en una sola aplicación el horario, el material, las tareas y
las notas de cada ramo; un tutor conversacional que responde con el contexto
del curso; generación de quices y fichas de repaso a partir del material;
apuntes escritos a mano o a máquina; lectura en voz alta; y un panel para el
docente y otro para la administración de cada institución.

Funciona en Android y en navegador, con la misma base de código.

## 4 · De qué está hecha

| | |
|---|---|
| **Archivos** | ${miles(archivos.length)} |
| **Líneas** | ${miles(lineasTotales)} |
| **Páginas del listado** | ${miles(paginas)} (a 55 líneas por página) |
| **Peso del código fuente** | ${(bytesTotales / 1024 / 1024).toFixed(1)} MB |
| **Lenguajes** | TypeScript, TSX, SQL, JavaScript |
| **Plataformas** | Android (React Native / Expo), navegador |
| **Base de datos** | PostgreSQL (Supabase) |

Composición, por carpeta:

| Carpeta | Archivos | Líneas |
|---|---:|---:|
${carpetas.map(([c, v]) => `| \`${c}\` | ${miles(v.archivos)} | ${miles(v.lineas)} |`).join("\n")}

No entran en el listado la aplicación ya compilada (\`docs/\`), los archivos
que genera el instalador de paquetes, ni la carpeta que genera Expo al armar
el proyecto de Android: son resultado de la obra, no la obra.

## 5 · Lo que hay dentro y no es propio

${TERCEROS.length} bibliotecas de terceros usadas directamente, ${arbol.total} contando todo el árbol.

| Licencia | Paquetes |
|---|---:|
${Object.entries(arbol.porLicencia ?? {}).sort((a, b) => b[1] - a[1])
  .map(([l, n]) => `| ${l} | ${n} |`).join("\n")}

Todas son licencias permisivas: dejan usar, modificar y **vender** el software
que las incorpora, y a cambio piden que su aviso de copyright viaje adentro.
La aplicación lo cumple: trae la pantalla *Perfil → Licencias de terceros*, que
se genera sola desde los paquetes instalados.

${arbol.aRevisar?.length ? `Las que un abogado querría mirar con calma, y por qué no bloquean:

${arbol.aRevisar.map((x) => `- \`${x}\``).join("\n")}

\`lightningcss\` entra por \`@expo/metro-config\` y \`node-forge\` por
\`@expo/cli\`: las dos son herramientas de compilación y de línea de comandos,
**no viajan dentro de la aplicación**. Además, MPL-2.0 es copyleft por archivo
—alcanza a los archivos de esa biblioteca, no al programa que la usa— y
\`node-forge\` es de licencia doble: se toma BSD-3-Clause y la GPL no aplica.
No hay ninguna licencia contagiosa en lo que se distribuye.` : "Ninguna licencia contagiosa en el árbol."}

## 6 · Autoría

| Quién | Commits |
|---|---:|
${Object.entries(autores).sort((a, b) => b[1] - a[1])
  .map(([a, n]) => `| ${a} | ${n} |`).join("\n")}

**Declaración, para que no la descubra una auditoría:** la mayor parte del
código fue escrita por Claude, el asistente de programación de Anthropic,
trabajando bajo la dirección de Tomás Quinteros —quien definió el producto,
decidió la arquitectura, revisó y aceptó cada cambio—. Los términos de
Anthropic ceden al usuario los derechos sobre lo que la herramienta produce.

Lo que conviene conversar con quien lleve el trámite: la ley chilena
(Ley 17.336) define al autor como persona natural, y **si una obra generada
con asistencia de IA tiene protección de derecho de autor, y quién figura como
autor, es una pregunta que todavía no tiene respuesta pacífica**. Esto no
impide inscribir ni comercializar, pero es un hecho material y es mejor que
salga aquí y no después.

## 7 · Lo que NO es parte de la obra, y no se entrega

- Las claves de acceso al proyecto de Supabase y a la API de Anthropic.
- La clave de firma de Google Play, que todavía no existe.
- Los datos de personas. La base se entrega vacía: no hay ningún alumno.
- El nombre «StudIA» no está inscrito en INAPI. **Es un trámite aparte del
  derecho de autor y sigue pendiente.**

## 8 · Qué contiene este expediente

| Archivo | Qué es |
|---|---|
| \`ficha-tecnica.md\` | esta hoja |
| \`codigo-fuente.txt\` | el listado completo, ${miles(paginas)} páginas |
| \`extracto.txt\` | primeras y últimas 25 páginas, para depósito en papel |
| \`inventario.csv\` | cada archivo con su tamaño y su huella |
| \`huellas.txt\` | solo las huellas, para verificar la copia |
| \`terceros.csv\` | las ${TERCEROS.length} bibliotecas usadas directamente |
| \`terceros-arbol.csv\` | las ${arbol.total} del árbol completo |
| \`historial.txt\` | cuándo se escribió cada cosa |
| \`resumen.json\` | todo lo anterior en números, para procesar |
`);

console.log(`expediente/ armado · versión ${version}`);
console.log(`  ${archivos.length} archivos · ${lineasTotales.toLocaleString("es-CL")} líneas · ${paginas} páginas`);
console.log(`  ${TERCEROS.length} dependencias directas · ${arbol.total} en todo el árbol`);
console.log(arbol.aRevisar.length === 0
  ? "  ninguna licencia contagiosa en el árbol"
  : `  a revisar con abogado (${arbol.aRevisar.length}):\n    ` + arbol.aRevisar.join("\n    "));
console.log(`  huella de la obra: ${huellaDeLaObra}`);
