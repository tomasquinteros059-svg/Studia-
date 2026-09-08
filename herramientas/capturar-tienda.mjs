// Capturas para la ficha de Google Play, desde la versión web.
//
// Uso:  npm run web              (arma docs/)
//       npm run capturas
//
// Play pide entre 2 y 8 capturas de al menos 1080 px de lado mayor. Sacarlas a
// mano de una tablet significa repetir el recorrido entero cada vez que cambia
// una pantalla, y significa además cuidar que no aparezca el nombre de ningún
// estudiante de verdad. Acá salen de la versión web en modo demostración,
// donde los datos son de ejemplo por construcción.
//
// 360×640 a escala 3 son 1080×1920.
//
// Necesita puppeteer-core y un Chromium. No vienen con el proyecto:
//   npm i -D puppeteer-core
//   CHROMIUM=/ruta/al/chrome npm run capturas
// Sin eso no falla: lo dice y se va.

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const DOCS = "docs";
// Tres recorridos. El de la tienda muestra la aplicación con datos, que es lo
// que hay que enseñar en Play. El de «desde cero» muestra lo que ve alguien
// que acaba de crear su cuenta, que es lo que va a ver todo el que llegue. El
// del colegio muestra el panel de la administración de una institución: no va
// a Play —no lo abre un alumno— pero es lo que se enseña en una reunión de
// venta, y es la pantalla que más cambia cuando cambia el contrato.
const DESDE_CERO = process.argv.includes("--desde-cero");
const COLEGIO = process.argv.includes("--colegio");
const SALIDA = DESDE_CERO ? "capturas/desde-cero"
  : COLEGIO ? "capturas/colegio"
  : "capturas";
const CHROMIUM = process.env.CHROMIUM
  ?? ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
      "/usr/bin/chromium", "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome"].find((r) => existsSync(r));

if (!existsSync(join(DOCS, "index.html"))) {
  console.error("Falta docs/. Ármalo con:  npm run web");
  process.exit(1);
}

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  console.log("No está puppeteer-core; me salto las capturas.");
  console.log("Para tenerlas:  npm i -D puppeteer-core");
  process.exit(0);
}
if (!CHROMIUM) {
  console.log("No encontré un Chromium. Pásalo con CHROMIUM=/ruta/al/chrome");
  process.exit(0);
}

// ── Un servidor de una línea: la exportación sale con base /studia ────────

const TIPOS = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon",
  ".ttf": "font/ttf", ".woff2": "font/woff2", ".svg": "image/svg+xml",
};
const servidor = createServer((req, res) => {
  const pedido = decodeURIComponent(req.url.split("?")[0]).replace(/^\/Sitio\.ste/, "");
  let archivo = join(DOCS, pedido);
  // Una aplicación de una sola página: lo que no existe se contesta con ella.
  if (!existsSync(archivo) || statSync(archivo).isDirectory()) archivo = join(DOCS, "index.html");
  res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
  res.end(readFileSync(archivo));
});
await new Promise((listo) => servidor.listen(8123, listo));

// ── El recorrido ────────────────────────────────────────────────────────

mkdirSync(SALIDA, { recursive: true });

const nav = await puppeteer.launch({ executablePath: CHROMIUM, args: ["--no-sandbox", "--disable-gpu"] });
const pag = await nav.newPage();
await pag.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await pag.goto("http://localhost:8123/studia/", { waitUntil: "networkidle0", timeout: 60000 });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
await esperar(2500);

/** Por la etiqueta de accesibilidad, que no cambia cuando cambia el diseño. */
async function tocarEtiqueta(inicio) {
  const ok = await pag.evaluate((txt) => {
    const n = [...document.querySelectorAll("[aria-label]")].find(
      (e) => (e.getAttribute("aria-label") || "").startsWith(txt) && e.getBoundingClientRect().width > 0);
    if (!n) return false;
    n.click();
    return true;
  }, inicio);
  await esperar(1600);
  return ok;
}

async function tocarTexto(txt) {
  const ok = await pag.evaluate((t) => {
    const n = [...document.querySelectorAll("div,span,button")].reverse().find(
      (e) => (e.textContent || "").trim() === t && e.getBoundingClientRect().width > 0);
    if (!n) return false;
    (n.closest('[role="button"]') || n).click();
    return true;
  }, txt);
  await esperar(1600);
  return ok;
}

async function escribirEn(etiqueta, texto) {
  const campo = await pag.$(`[aria-label="${etiqueta}"]`);
  if (!campo) return false;
  await campo.click();
  await campo.type(texto);
  await esperar(400);
  return true;
}

const hechas = [];
async function foto(nombre) {
  await pag.screenshot({ path: `${SALIDA}/${nombre}.png` });
  hechas.push(nombre);
  console.log("  ·", nombre);
}

console.log("capturas:");

if (DESDE_CERO) {
  // Lo primero que ve alguien que llega, antes de tener cuenta.
  await foto("1-portada");
  await tocarTexto("Entrar");
  await foto("2-entrar");

  // Una cuenta nueva: un correo que nadie usó deja la aplicación en cero, que
  // es exactamente lo que hay que mirar.
  await escribirEn("Correo", "camila.rojas@liceo.cl");
  await foto("3-correo-puesto");
  await tocarTexto("Entrar");
  await esperar(2500);

  await foto("4-inicio");
  for (const [pestana, archivo] of [["Horario", "5-horario"], ["Tareas", "6-tareas"],
                                    ["Apuntes", "7-apuntes"], ["Tutor", "8-tutor"]]) {
    if (await tocarTexto(pestana)) { await esperar(1400); await foto(archivo); }
  }

  await nav.close();
  servidor.close();
  console.log(`\n${hechas.length} capturas en ${SALIDA}/ · 1080×1920`);
  console.log("Es la aplicación recién creada: sin ramos, sin tareas, sin nada.");
  process.exit(0);
}

if (COLEGIO) {
  // La secretaría académica: la cuenta que administra la institución.
  await tocarTexto("Entrar");
  await escribirEn("Correo", "secretaria@studia.cl");
  if (!await tocarEtiqueta("Entrar como Secretaría Académica")) {
    console.error("No encontré el perfil de administración. ¿Cambió la pantalla de entrada?");
    await nav.close(); servidor.close(); process.exit(1);
  }
  await esperar(2500);

  // Ramos es la pestaña con la que abre; el encabezado con el contrato está
  // arriba en las tres.
  await foto("1-el-colegio");
  for (const [pestana, archivo] of [["Horario", "2-horario"], ["Personas", "3-personas"]]) {
    if (await tocarTexto(pestana)) { await esperar(1400); await foto(archivo); }
  }

  // Y la carga del semestre, que es por donde entra una institución nueva.
  if (await tocarEtiqueta("Cargar el semestre")) {
    await esperar(1200);
    await foto("4-cargar-el-semestre");
  }

  await nav.close();
  servidor.close();
  console.log(`\n${hechas.length} capturas en ${SALIDA}/ · 1080×1920`);
  console.log("Es el panel de la administración de una institución: sus ramos,");
  console.log("su gente y su contrato. De otra institución no ve nada.");
  process.exit(0);
}

// Entrar como el estudiante de ejemplo, que es el que trae datos cargados.
// Registrarse con un correo cualquiera deja la aplicación vacía, y la captura
// de una app vacía es peor que ninguna captura.
await tocarTexto("Entrar");
await escribirEn("Correo", "eduardo@studia.cl");
if (!await tocarEtiqueta("Entrar como Eduardo")) {
  console.error("No encontré el perfil de ejemplo. ¿Cambió la pantalla de entrada?");
  await nav.close(); servidor.close(); process.exit(1);
}
await esperar(2500);

await foto("1-inicio");
for (const [pestana, archivo] of [["Horario", "2-horario"], ["Tareas", "3-tareas"], ["Apuntes", "4-apuntes"]]) {
  if (await tocarTexto(pestana)) { await esperar(1400); await foto(archivo); }
}

// El tutor con una pregunta ya hecha: es lo que hay que mostrar de esta app, y
// una pantalla de tutor vacía no dice nada.
if (await tocarTexto("Tutor")) {
  await esperar(1500);
  await tocarTexto("Cálculo I");
  await esperar(1500);
  if (await escribirEn("Tu mensaje", "No entiendo cómo resolver este límite")) {
    // Enter en un campo de varias líneas hace un salto de línea, no manda.
    await tocarTexto("Enviar");
    await esperar(3200);
  }
  await foto("5-tutor");
}

if (await tocarTexto("Horario")) {
  await esperar(1200);
  if (await tocarTexto("Cálculo I")) { await esperar(1600); await foto("6-ramo"); }
}

await nav.close();
servidor.close();

console.log(`\n${hechas.length} capturas en ${SALIDA}/ · 1080×1920`);
console.log("Llevan arriba la franja de «modo demostración»: para la ficha de");
console.log("Play conviene volver a sacarlas de la tablet con el APK conectado.");
