// Arma la versión web para GitHub Pages, en docs/.
//
// Uso: npm run web
//      (node --experimental-strip-types, porque los textos legales viven en
//       app/src/dominio/legales.ts y desde ahí se arman las páginas de acá)
//
// Tres cosas que no son obvias y que si faltan dejan la página en blanco:
//
// - Pages sirve el sitio en /Sitio.ste/ y no en la raíz, así que la
//   exportación tiene que salir con esa base. Va y vuelve en app.json en vez
//   de quedar escrita: es una particularidad de dónde se publica, no de la
//   aplicación, y el APK no tiene por qué arrastrarla.
// - Pages pasa todo por Jekyll, y Jekyll ignora lo que empieza con guión
//   bajo. La carpeta que arma Expo se llama _expo: sin .nojekyll el sitio
//   carga y no encuentra su propio paquete.
// - Las tipografías de la portada no vienen en el paquete. Acá sí se pueden
//   pedir a Google —en el visor de artefactos no, por eso allá van
//   incrustadas—, y sin ellas la portada se ve con la letra del sistema.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(raiz, "app");
const config = join(app, "app.json");
const docs = join(raiz, "docs");

import { DESDE, DOCUMENTOS, TITULAR } from "../app/src/dominio/legales.ts";
import { paginaLegal } from "./paginas-legales.mjs";

const BASE = "/Sitio.ste";

const original = readFileSync(config, "utf8");
try {
  const c = JSON.parse(original);
  c.expo.experiments = { ...c.expo.experiments, baseUrl: BASE };
  writeFileSync(config, JSON.stringify(c, null, 2) + "\n");

  rmSync(join(app, "dist"), { recursive: true, force: true });
  execFileSync("npx", ["expo", "export", "--platform", "web"], {
    cwd: app, stdio: "inherit", env: { ...process.env, EXPO_NO_TELEMETRY: "1" },
  });
} finally {
  writeFileSync(config, original);
}

// docs/ es solo el sitio publicado. La documentación del proyecto se movió a
// documentacion/ porque Pages sirve todo lo que hay acá: la especificación
// completa del producto quedaba descargable por cualquiera que adivinara el
// nombre del archivo, sin que nada lo dijera.
//
// Se borra solo lo que genera este script, no la carpeta entera.
const GENERADO = [
  "_expo", "assets", "index.html", "404.html", "metadata.json", ".nojekyll",
  "robots.txt", "terminos.html", "privacidad.html",
];
for (const n of GENERADO) rmSync(join(docs, n), { recursive: true, force: true });
mkdirSync(docs, { recursive: true });
cpSync(join(app, "dist"), docs, { recursive: true });
writeFileSync(join(docs, ".nojekyll"), "");

// El aviso de propiedad, para quien mire el código de la página, y la señal
// que leen los rastreadores que respetan algo. No impide nada por sí sola
// —robots.txt tampoco—, pero deja constancia de que el permiso no se dio.
const PROPIEDAD = `
    <meta name="copyright" content="© ${DESDE} ${TITULAR}. Todos los derechos reservados." />
    <meta name="robots" content="index, follow, noai, noimageai" />
    <link rel="license" href="${BASE}/terminos.html" />`;

const FUENTES = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Caveat:wght@400..700&family=Instrument+Sans:wght@400..700&display=swap" />
    <style>
      /* El papel de la aplicación, explícito: un fondo transparente da un
         destello blanco antes de que la app pinte lo suyo. */
      html, body { background: #FBFAF5; }
      #cargando {
        position: fixed; inset: 0; display: flex; align-items: center;
        justify-content: center; background: #FBFAF5; color: #8E9098;
        font: 600 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
    </style>`;

const indice = join(docs, "index.html");
let html = readFileSync(indice, "utf8");
if (!html.includes("</head>")) throw new Error("La exportación no trae <head>: revisa qué cambió Expo.");
html = html.replace("</head>", `${PROPIEDAD}${FUENTES}\n  </head>`);
html = html.replace('<div id="root"></div>', '<div id="cargando">Abriendo StudIA…</div>\n    <div id="root"></div>');
html = html.replace("<html lang=\"en\">", '<html lang="es">');
writeFileSync(indice, html);

// Pages devuelve 404.html cuando la ruta no existe como archivo. Con la misma
// página adentro, entrar directo a una dirección de la aplicación abre la
// aplicación en vez de la pantalla de error de GitHub.
writeFileSync(join(docs, "404.html"), html);

// Los rastreadores que se llevan el sitio para entrenar modelos respetan esto
// solo si quieren, y varios no quieren. Igual va: sin el archivo, el permiso
// se presume dado; con él, la negativa está escrita y fechada.
const RASTREADORES = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai",
  "CCBot", "Google-Extended", "PerplexityBot", "Applebot-Extended", "Bytespider",
  "Amazonbot", "meta-externalagent", "FacebookBot", "Diffbot", "cohere-ai",
  "ImagesiftBot", "Omgilibot", "YouBot", "Timpibot", "Scrapy",
];
writeFileSync(
  join(docs, "robots.txt"),
  [
    "# StudIA — © " + DESDE + " " + TITULAR + ". Todos los derechos reservados.",
    "# El sitio se puede indexar para buscarlo; no se puede usar para entrenar",
    "# modelos ni para armar conjuntos de datos.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    ...RASTREADORES.flatMap((r) => [`User-agent: ${r}`, "Disallow: /", ""]),
  ].join("\n"),
);

// Los términos y la privacidad, además, como páginas sueltas. Play Store exige
// una dirección web pública para la política de privacidad, y una que solo se
// pueda leer habiendo instalado la aplicación no sirve para eso.
for (const d of DOCUMENTOS) {
  writeFileSync(join(docs, `${d.id === "terminos" ? "terminos" : "privacidad"}.html`), paginaLegal(d, BASE));
}

console.log("docs/ listo · base", BASE);
