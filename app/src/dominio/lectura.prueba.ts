import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAXIMO_FRASE, PREFERENCIAS_POR_DEFECTO, TAMANOS, VELOCIDADES,
  agruparEnParrafos, anterior, citar, estiloDeLectura, minutosDeEscucha,
  normalizarPreferencias, paletaDeLectura, palabras, paraVoz, partirEnFrases,
  progreso, retomar, siguiente, velocidadDe,
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

// ── Lo que se oye ───────────────────────────────────────────────────────

test("un inciso entre paréntesis se oye como pausa, no como palabra", () => {
  assert.equal(
    paraVoz("El teorema (que ya vimos en clase) exige continuidad."),
    "El teorema, que ya vimos en clase, exige continuidad.",
  );
});

test("la notación de función se dice como se dice en clase", () => {
  assert.equal(paraVoz("Evalúa f(x) en el punto."), "Evalúa f de x en el punto.");
  assert.equal(paraVoz("La derivada de f(x) por g(x)."), "La derivada de f de x por g de x.");
});

test("una palabra entera pegada al paréntesis no es una función", () => {
  assert.equal(paraVoz("El intervalo abierto(a,b) queda."), "El intervalo abierto a,b queda.");
});

test("una barra entre términos se dice sobre", () => {
  assert.equal(paraVoz("Vale |x|/x en el cero."), "Vale x sobre x en el cero.");
  assert.equal(paraVoz("La razón es 3/4."), "La razón es 3 sobre 4.");
});

test("un intervalo se dice sin nombrar los corchetes", () => {
  assert.equal(
    paraVoz("Si f es continua en [a,b] y derivable en (a,b)."),
    "Si f es continua en a,b y derivable en a,b.",
  );
});

test("un paréntesis sin cerrar no deja el signo suelto", () => {
  assert.equal(paraVoz("Queda (así en el apunte."), "Queda así en el apunte.");
});

test("las comillas no se pronuncian", () => {
  assert.equal(paraVoz('Lo llamó «el caso raro» sin explicar.'),
    "Lo llamó el caso raro sin explicar.");
});

test("los puntos suspensivos se vuelven pausa", () => {
  assert.equal(paraVoz("Y así sucesivamente… Ahora el caso general."),
    "Y así sucesivamente, Ahora el caso general.");
});

test("la raya de inciso se vuelve coma", () => {
  assert.equal(paraVoz("El pivote — el primero no nulo — manda."),
    "El pivote, el primero no nulo, manda.");
});

test("la viñeta de una lista no se dice", () => {
  assert.equal(paraVoz("- Derivar y simplificar"), "Derivar y simplificar");
});

test("los asteriscos no se nombran", () => {
  assert.equal(paraVoz("Ver el caso *importante* del apunte."), "Ver el caso importante del apunte.");
});

test("no deja comas pegadas ni colgando", () => {
  assert.equal(paraVoz("El punto (a) (b) queda."), "El punto a b queda.");
  assert.equal(paraVoz("Termina (con esto)."), "Termina, con esto.");
});

test("el punto final se conserva: es la entonación de cierre", () => {
  assert.ok(paraVoz("Una frase cualquiera.").endsWith("."));
});

test("los decimales y porcentajes se dejan como están", () => {
  assert.equal(paraVoz("Vale 3.1416 y sube 20% al año."), "Vale 3.1416 y sube 20% al año.");
});

test("una línea sin nada pronunciable no se manda a la voz", () => {
  assert.equal(paraVoz("———"), "");
  assert.equal(paraVoz("(( ))"), "");
  assert.equal(paraVoz("   "), "");
});

test("un texto sin signos raros sale igual que entró", () => {
  const limpio = "La derivada mide la razón a la que cambia una función.";
  assert.equal(paraVoz(limpio), limpio);
});

test("lo que se ve no cambia: paraVoz no toca las frases", () => {
  const frases = partirEnFrases("El teorema (que ya vimos) exige continuidad.");
  assert.equal(frases[0].texto, "El teorema (que ya vimos) exige continuidad.");
});
