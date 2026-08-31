// Los términos y la privacidad como páginas web sueltas.
//
// No es duplicar la pantalla de la aplicación: Play Store exige una dirección
// web pública para la política de privacidad, y una que solo se pueda leer
// habiendo instalado la aplicación no sirve para eso. Salen del mismo texto que
// la pantalla, así que no pueden decir algo distinto.
//
// Vive aparte de web.mjs para poder probarlo sin compilar el sitio entero.

import { DESDE, TITULAR, aviso, comoFecha } from "../app/src/dominio/legales.ts";

/** Lo que en HTML significa otra cosa. Sin esto, un `<` del texto rompe la página. */
function escapar(texto) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** El párrafo con su negrita, ya escapado: primero se escapa, después se marca. */
function parrafo(texto) {
  return `<p>${escapar(texto).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
}

/**
 * Un documento legal como página completa.
 *
 * @param {import("../app/src/dominio/legales.ts").Documento} d
 * @param {string} base Dónde se publica el sitio, para que los enlaces peguen.
 */
export function paginaLegal(d, base = "") {
  const secciones = d.secciones.map((s) => [
    `      <h2>${escapar(s.titulo)}</h2>`,
    ...s.parrafos.map((t) => `      ${parrafo(t)}`),
  ].join("\n")).join("\n");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StudIA — ${escapar(d.titulo)}</title>
    <meta name="description" content="${escapar(d.bajada)}" />
    <meta name="copyright" content="© ${DESDE} ${escapar(TITULAR)}. Todos los derechos reservados." />
    <meta name="robots" content="index, follow, noai, noimageai" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400..700&display=swap" />
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0; background: #FBFAF5; color: #171C3F;
        font: 400 16px/1.65 'Instrument Sans', system-ui, -apple-system, sans-serif;
      }
      main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.25rem 5rem; }
      h1 {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 2rem; letter-spacing: -0.03em; margin: 0 0 .5rem; text-wrap: balance;
      }
      h2 {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 1.15rem; letter-spacing: -0.02em; margin: 2.25rem 0 .5rem;
      }
      p { margin: 0 0 .85rem; }
      .bajada { color: #6B6F85; margin-bottom: .25rem; }
      .fecha { color: #9498AB; font-size: .875rem; }
      footer {
        margin-top: 3.5rem; padding-top: 1.25rem;
        border-top: 2px solid rgba(23, 28, 63, .14);
        color: #6B6F85; font-size: .875rem;
      }
      a { color: #2F45D4; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapar(d.titulo)}</h1>
      <p class="bajada">${escapar(d.bajada)}</p>
      <p class="fecha">Actualizado el ${comoFecha(d.actualizado)}.</p>
${secciones}
      <footer>
        ${aviso(new Date().getFullYear())}<br />
        <a href="${base}/">StudIA</a> ·
        <a href="${base}/terminos.html">Términos</a> ·
        <a href="${base}/privacidad.html">Privacidad</a>
      </footer>
    </main>
  </body>
</html>
`;
}
