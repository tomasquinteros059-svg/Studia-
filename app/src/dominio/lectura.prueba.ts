import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAXIMO_FRASE, PREFERENCIAS_POR_DEFECTO, TAMANOS, VELOCIDADES,
  agruparEnParrafos, anterior, citar, estiloDeLectura, minutosDeEscucha,
  normalizarPreferencias, paletaDeLectura, palabras, partirEnFrases, progreso,
  retomar, siguiente, velocidadDe,
} from "./lectura.ts";

const textos = (t: string) => partirEnFrases(t).map((f) => f.texto);

// ── Cortar el texto ─────────────────────────────────────────────────────

test("corta en las frases de siempre", () => {
  assert.deepEqual(
    textos("El límite existe. La función es continua. ¿Y en el borde?"),
    ["El límite existe.", "La función es continua.", "¿Y en el borde?"],
  );
});

test("un decimal no parte la frase", () => {
  assert.deepEqual(textos("La constante vale 3.1416 en este caso."),
    ["La constante vale 3.1416 en este caso."]);
});

test("una coma decimal tampoco", () => {
  assert.deepEqual(textos("El promedio fue 5,4 el semestre pasado."),
    ["El promedio fue 5,4 el semestre pasado."]);
});

test("las abreviaturas no cierran la frase", () => {
  assert.deepEqual(
    textos("Lo vio el Dr. Salas. Después opinó la Sra. Rojas."),
    ["Lo vio el Dr. Salas.", "Después opinó la Sra. Rojas."],
  );
});

test("una abreviatura con acento se reconoce igual", () => {
  assert.deepEqual(textos("Ver la pág. 12 del apunte."), ["Ver la pág. 12 del apunte."]);
});

test("etcétera abreviado no corta", () => {
  assert.deepEqual(
    textos("Sirve para áreas, volúmenes, etc. Lo veremos el jueves."),
    ["Sirve para áreas, volúmenes, etc.", "Lo veremos el jueves."],
  );
});

test("una abreviatura seguida de minúscula no corta", () => {
  assert.deepEqual(textos("Mide 3 cm aprox. según el enunciado."),
    ["Mide 3 cm aprox. según el enunciado."]);
});

test("una inicial suelta no corta", () => {
  assert.deepEqual(textos("El método de J. Newton converge rápido."),
    ["El método de J. Newton converge rápido."]);
});

test("un punto pegado a la palabra siguiente no cierra", () => {
  // Así se escriben las funciones y los dominios: f(x).g(x) no son dos frases.
  assert.deepEqual(textos("Evalúa f(x).g(x) en el punto."), ["Evalúa f(x).g(x) en el punto."]);
});

test("los signos de admiración y pregunta cierran", () => {
  assert.deepEqual(textos("¡Ojo acá! Es el paso que más se equivoca."),
    ["¡Ojo acá!", "Es el paso que más se equivoca."]);
});

test("los puntos suspensivos van con la frase que cierran", () => {
  assert.deepEqual(textos("Y así sucesivamente… Ahora el caso general."),
    ["Y así sucesivamente…", "Ahora el caso general."]);
});

test("la última frase sin punto no se pierde", () => {
  assert.deepEqual(textos("Primero esto. Y esto queda sin punto"),
    ["Primero esto.", "Y esto queda sin punto"]);
});

test("cada viñeta se lee por separado", () => {
  assert.deepEqual(
    textos("Pasos:\n- Derivar\n- Igualar a cero\n- Revisar el signo"),
    ["Pasos:", "- Derivar", "- Igualar a cero", "- Revisar el signo"],
  );
});

test("los párrafos se numeran y las líneas en blanco no crean párrafos vacíos", () => {
  const frases = partirEnFrases("Uno. Dos.\n\n\n   \n\nTres.");
  assert.deepEqual(frases.map((f) => f.parrafo), [0, 0, 1]);
});

test("los índices son correlativos", () => {
  const frases = partirEnFrases("Uno. Dos.\n\nTres.");
  assert.deepEqual(frases.map((f) => f.indice), [0, 1, 2]);
});

test("un texto vacío no produce frases", () => {
  assert.deepEqual(partirEnFrases("   \n\n  "), []);
});

test("una frase larguísima se parte para que la voz no la trunque", () => {
  const larga = `${"palabra ".repeat(120)}final.`;
  const partes = partirEnFrases(larga);
  assert.ok(partes.length > 1, "debería partirse");
  for (const p of partes) assert.ok(p.texto.length <= MAXIMO_FRASE, p.texto.length);
});

test("al partir una frase larga no se pierde ni una palabra", () => {
  const larga = `${"alfa bravo charlie delta echo foxtrot ".repeat(20)}fin.`;
  const juntas = partirEnFrases(larga).map((f) => f.texto).join(" ");
  assert.equal(palabras(juntas), palabras(larga));
});

test("una frase larga se corta en la coma cuando hay", () => {
  const larga = `${"uno dos tres cuatro cinco ".repeat(10)}, y acá sigue el resto de la idea.`;
  const partes = partirEnFrases(larga);
  assert.ok(partes[0].texto.endsWith(","), partes[0].texto.slice(-30));
});

test("un texto sin espacios se corta igual antes que perderse", () => {
  const partes = partirEnFrases("x".repeat(700));
  assert.ok(partes.length >= 3);
  assert.equal(partes.map((p) => p.texto).join("").length, 700);
});

// ── Agrupar ─────────────────────────────────────────────────────────────

test("agrupa las frases por párrafo respetando el orden", () => {
  const grupos = agruparEnParrafos(partirEnFrases("Uno. Dos.\n\nTres."));
  assert.deepEqual(grupos.map((g) => g.frases.length), [2, 1]);
  assert.deepEqual(grupos.map((g) => g.indice), [0, 1]);
});

// ── Moverse por el texto ────────────────────────────────────────────────

test("avanza hasta la última frase y ahí devuelve null", () => {
  assert.equal(siguiente(0, 3), 1);
  assert.equal(siguiente(2, 3), null);
});

test("retroceder desde la primera frase se queda en la primera", () => {
  assert.equal(anterior(0), 0);
  assert.equal(anterior(4), 3);
});

test("retomar acepta lo guardado si está en rango", () => {
  assert.equal(retomar(3, 10), 3);
});

test("retomar vuelve al principio si el texto se acortó", () => {
  assert.equal(retomar(40, 10), 0);
});

test("retomar vuelve al principio si quedó en la última frase", () => {
  // Terminó de escuchar: abrir el lector ya en el final no sirve de nada.
  assert.equal(retomar(9, 10), 0);
});

test("retomar tolera basura guardada", () => {
  for (const basura of [null, undefined, -1, NaN, Infinity, "3" as unknown as number]) {
    assert.equal(retomar(basura as number, 10), 0, String(basura));
  }
});

test("retomar en un texto vacío no explota", () => {
  assert.equal(retomar(5, 0), 0);
});

test("el progreso va de la primera frase al final", () => {
  assert.equal(progreso(0, 4), 0.25);
  assert.equal(progreso(3, 4), 1);
  assert.equal(progreso(0, 0), 0);
});

// ── Duración ────────────────────────────────────────────────────────────

test("estima los minutos que faltan por escuchar", () => {
  const frases = partirEnFrases(`${"palabra ".repeat(299)}fin.`);
  assert.equal(minutosDeEscucha(frases, 1), 2);
});

test("más rápido, menos minutos", () => {
  const frases = partirEnFrases(`${"palabra ".repeat(600)}fin.`);
  assert.ok(minutosDeEscucha(frases, 1.6) < minutosDeEscucha(frases, 1));
});

test("lo que ya se escuchó no cuenta", () => {
  const frases = partirEnFrases(`${"palabra ".repeat(600)}fin.`);
  assert.ok(minutosDeEscucha(frases, 1, frases.length - 1) < minutosDeEscucha(frases, 1, 0));
});

test("un texto corto igual muestra un minuto y no cero", () => {
  assert.equal(minutosDeEscucha(partirEnFrases("Hola."), 1), 1);
});

test("sin texto no hay minutos", () => {
  assert.equal(minutosDeEscucha([], 1), 0);
});

// ── Preferencias ────────────────────────────────────────────────────────

test("el interlineado sale de la letra, no de un número fijo", () => {
  const chico = estiloDeLectura({ ...PREFERENCIAS_POR_DEFECTO, tamano: 0 });
  const grande = estiloDeLectura({ ...PREFERENCIAS_POR_DEFECTO, tamano: TAMANOS.length - 1 });
  assert.ok(grande.lineHeight > chico.lineHeight);
  assert.ok(grande.anchoMaximo > chico.anchoMaximo);
});

test("más interlineado es más alto con la misma letra", () => {
  const normal = estiloDeLectura({ ...PREFERENCIAS_POR_DEFECTO, interlineado: "normal" });
  const doble = estiloDeLectura({ ...PREFERENCIAS_POR_DEFECTO, interlineado: "doble" });
  assert.equal(normal.fontSize, doble.fontSize);
  assert.ok(doble.lineHeight > normal.lineHeight);
});

test("un tamaño fuera de rango cae en el por defecto", () => {
  const roto = estiloDeLectura({ ...PREFERENCIAS_POR_DEFECTO, tamano: 99 });
  assert.equal(roto.fontSize, TAMANOS[PREFERENCIAS_POR_DEFECTO.tamano]);
});

test("la velocidad sale del índice guardado", () => {
  assert.equal(velocidadDe({ ...PREFERENCIAS_POR_DEFECTO, velocidad: 0 }), VELOCIDADES[0]);
  assert.equal(velocidadDe({ ...PREFERENCIAS_POR_DEFECTO, velocidad: 99 }), 1);
});

test("la velocidad por defecto es la normal", () => {
  assert.equal(velocidadDe(PREFERENCIAS_POR_DEFECTO), 1);
});

test("cada fondo trae su juego completo de colores", () => {
  for (const f of ["papel", "sepia", "noche"] as const) {
    const p = paletaDeLectura(f);
    for (const clave of ["fondo", "texto", "resalte", "atenuado", "borde"] as const) {
      assert.match(p[clave], /^#[0-9A-Fa-f]{6}$/, `${f}.${clave}`);
    }
  }
});

test("un fondo desconocido no deja la pantalla sin colores", () => {
  assert.deepEqual(paletaDeLectura("marciano" as never), paletaDeLectura("papel"));
});

test("preferencias guardadas de otra versión no rompen el lector", () => {
  assert.deepEqual(normalizarPreferencias(null), PREFERENCIAS_POR_DEFECTO);
  assert.deepEqual(normalizarPreferencias("{}"), PREFERENCIAS_POR_DEFECTO);
  assert.deepEqual(normalizarPreferencias({ tamano: "grande", fondo: "azul" }), PREFERENCIAS_POR_DEFECTO);
});

test("preferencias válidas se respetan", () => {
  const guardado = { tamano: 4, interlineado: "doble", fondo: "noche", foco: true, velocidad: 0 };
  assert.deepEqual(normalizarPreferencias(guardado), guardado);
});

test("se rescata lo que sirve aunque el resto venga mal", () => {
  const p = normalizarPreferencias({ fondo: "sepia", tamano: -3, foco: "sí" });
  assert.equal(p.fondo, "sepia");
  assert.equal(p.tamano, PREFERENCIAS_POR_DEFECTO.tamano);
  assert.equal(p.foco, false);
});

test("un tamaño con decimales no se acepta a medias", () => {
  assert.equal(normalizarPreferencias({ tamano: 2.5 }).tamano, PREFERENCIAS_POR_DEFECTO.tamano);
});

// ── Citar ───────────────────────────────────────────────────────────────

test("citar pone comillas y aplana los saltos de línea", () => {
  assert.equal(citar("  el límite\n  existe  "), "«el límite existe»");
});
