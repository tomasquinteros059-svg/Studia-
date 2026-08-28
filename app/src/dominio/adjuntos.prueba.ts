import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TAMANO_MAXIMO, comoPeso, detalleDe, extensionDe, minutosDeLectura,
  revisar, tipoDe, tituloDesdeNombre, type Adjunto,
} from "./adjuntos.ts";

const archivo = (a: Partial<Adjunto>): Adjunto =>
  ({ nombre: "apunte.pdf", mime: "application/pdf", tamano: 1024, ...a });

// ── Extensión y tipo ────────────────────────────────────────────────────

test("la extensión sale de después del último punto", () => {
  assert.equal(extensionDe("apunte.final.pdf"), "pdf");
  assert.equal(extensionDe("APUNTE.PDF"), "pdf");
});

test("un archivo sin extensión no tiene", () => {
  assert.equal(extensionDe("apunte"), "");
  // Un nombre que empieza con punto es oculto, no una extensión.
  assert.equal(extensionDe(".oculto"), "");
});

test("el tipo se decide por la extensión, no por el MIME", () => {
  // Android reporta application/octet-stream la mitad de las veces.
  assert.equal(tipoDe("clase.mp4"), "video");
  assert.equal(tipoDe("apunte.pdf"), "documento");
  assert.equal(tipoDe("datos.csv"), "ejercicios");
});

test("el audio cuenta como video: es material que se escucha", () => {
  assert.equal(tipoDe("grabacion.m4a"), "video");
});

test("una extensión desconocida no tiene tipo", () => {
  assert.equal(tipoDe("programa.exe"), null);
  assert.equal(tipoDe("sinextension"), null);
});

// ── Revisar ─────────────────────────────────────────────────────────────

test("un PDF normal pasa", () => {
  assert.deepEqual(revisar(archivo({})), { ok: true, tipo: "documento" });
});

test("un archivo sin nombre se rechaza", () => {
  const r = revisar(archivo({ nombre: "   " }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /no tiene nombre/);
});

test("una extensión desconocida se rechaza diciendo cuál era", () => {
  const r = revisar(archivo({ nombre: "virus.exe" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.motivo, /\.exe/);
    assert.match(r.motivo, /Sirven PDF, Word, imágenes/);
  }
});

test("un archivo demasiado grande se rechaza con las dos cifras", () => {
  const r = revisar(archivo({ tamano: TAMANO_MAXIMO + 1 }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.motivo, /20,0 MB/);
    assert.match(r.motivo, /Pártelo o comprímelo/);
  }
});

test("justo en el máximo todavía pasa", () => {
  assert.equal(revisar(archivo({ tamano: TAMANO_MAXIMO })).ok, true);
});

test("un tamaño desconocido no bloquea la subida", () => {
  // Algunos aparatos no lo reportan. Rechazar por eso sería castigar al
  // usuario por un dato que no depende de él.
  assert.equal(revisar(archivo({ tamano: 0 })).ok, true);
  assert.equal(revisar(archivo({ tamano: -1 })).ok, true);
});

// ── Cómo se ve ──────────────────────────────────────────────────────────

test("el peso se escribe con coma decimal", () => {
  assert.equal(comoPeso(2.4 * 1024 * 1024), "2,4 MB");
  assert.equal(comoPeso(500), "500 B");
  assert.equal(comoPeso(2048), "2 KB");
});

test("un tamaño desconocido lo dice en vez de mostrar cero", () => {
  assert.equal(comoPeso(0), "tamaño desconocido");
});

test("el título propuesto sale del nombre, ya presentable", () => {
  assert.equal(tituloDesdeNombre("apunte_limites-laterales.pdf"), "Apunte limites laterales");
  assert.equal(tituloDesdeNombre("/ruta/larga/clase 3.mp4"), "Clase 3");
});

test("un archivo sin nombre legible igual propone algo", () => {
  assert.equal(tituloDesdeNombre(".pdf"), "Material sin nombre");
});

test("el detalle junta extensión y peso", () => {
  assert.equal(detalleDe(archivo({ nombre: "guia.pdf", tamano: 1024 * 1024 })), "PDF · 1,0 MB");
});

test("los minutos de lectura usan la misma velocidad que el lector", () => {
  assert.equal(minutosDeLectura("palabra ".repeat(155)), 1);
  assert.equal(minutosDeLectura("palabra ".repeat(300)), 2);
  assert.equal(minutosDeLectura(""), 1);
});
