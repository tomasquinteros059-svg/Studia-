// Lee las planillas del colegio y avisa qué está mal antes de tocar la base.
//
// Quien llena esto es una secretaría académica con una planilla abierta, no
// alguien escribiendo SQL. Por eso hay dos reglas de fondo acá:
//
//   1. Se revisa TODO y después se informa. Avisar del primer error, hacer
//      corregir, y recién ahí descubrir el segundo, es la peor manera de
//      hacerle perder la tarde a alguien.
//   2. Cada problema dice archivo, línea y qué se esperaba. "Error de
//      validación" no le sirve a nadie.

export type Problema = { archivo: string; linea: number; mensaje: string };

export type Fila = { _linea: number } & Record<string, string>;

/**
 * CSV de verdad, no `split(",")`: los nombres de ramo llevan comas, Excel
 * escribe BOM al principio y termina las líneas con CRLF.
 */
export function leerCsv(texto: string): Fila[] {
  const limpio = texto.replace(/^﻿/, "");
  const bruto: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += c;
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      fila.push(campo); campo = "";
    } else if (c === "\n") {
      fila.push(campo); bruto.push(fila); fila = []; campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }
  if (campo !== "" || fila.length > 0) { fila.push(campo); bruto.push(fila); }

  const conContenido = bruto.filter((f) => f.some((c) => c.trim() !== ""));
  const cabecera = conContenido.shift();
  if (!cabecera) return [];

  const columnas = cabecera.map((c) => c.trim().toLowerCase());
  // +2: la cabecera es la línea 1 y las planillas cuentan desde 1, no desde 0.
  return conContenido.map((valores, i) => {
    const f: Fila = { _linea: i + 2 };
    columnas.forEach((col, j) => { f[col] = (valores[j] ?? "").trim(); });
    return f;
  });
}

// ── Ayudas de validación ────────────────────────────────────────────────

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const sinAcentos = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Acepta "Martes", "martes", "MIERCOLES" o el número 1..7. */
export function leerDia(valor: string): number | null {
  const n = Number.parseInt(valor, 10);
  if (Number.isInteger(n) && n >= 1 && n <= 7) return n;
  const i = DIAS.findIndex((d) => sinAcentos(d) === sinAcentos(valor));
  return i === -1 ? null : i + 1;
}

/** "8:30" y "08:30" valen; "8.30" y "25:00" no. Devuelve minutos del día. */
export function leerHora(valor: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export const comoHora = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

const esCorreo = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const esColor = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

// ── Lo que sale de las planillas ────────────────────────────────────────

export type Persona = { correo: string; nombre: string; rol: string };
export type Asignatura = {
  codigo: string; nombre: string; profesor: string; ayudante: string | null;
  color: string; creditos: number; descripcion: string; requisitos: string;
  bibliografia: string[]; intro_tutor: string;
};
export type Bloque = {
  codigo: string; dia: number; inicio: number; fin: number; sala: string; tipo: string;
};
export type Dictado = { correo: string; codigo: string; papel: string };
export type Inscripcion = { correo: string; codigo: string };
export type Material = {
  codigo: string; modulo: string; orden_modulo: number;
  tipo: string; titulo: string; detalle: string; orden: number;
  lectura: string | null; url: string | null;
};

export type Colegio = {
  personas: Persona[];
  asignaturas: Asignatura[];
  horario: Bloque[];
  dictados: Dictado[];
  inscripciones: Inscripcion[];
  materia: Material[];
};

export type Planillas = {
  personas?: string;
  asignaturas?: string;
  horario?: string;
  dictados?: string;
  inscripciones?: string;
  materia?: string;
  /** Nombres de archivo presentes en datos/lecturas/. */
  lecturas?: string[];
};

// ── La revisión ─────────────────────────────────────────────────────────

class Bitacora {
  readonly problemas: Problema[] = [];
  anotar(archivo: string, linea: number, mensaje: string): void {
    this.problemas.push({ archivo, linea, mensaje });
  }
}

/**
 * Revisa las seis planillas y devuelve los datos junto con todo lo que
 * encontró mal. Si `problemas` no está vacío, no hay que escribir nada.
 */
export function revisar(p: Planillas): { colegio: Colegio; problemas: Problema[] } {
  const b = new Bitacora();
  const lecturas = new Set(p.lecturas ?? []);

  // ---- personas
  const personas: Persona[] = [];
  const correos = new Set<string>();
  for (const f of leerCsv(p.personas ?? "")) {
    const correo = (f.correo ?? "").toLowerCase();
    if (!esCorreo(correo)) { b.anotar("personas.csv", f._linea, `"${f.correo}" no parece un correo.`); continue; }
    if (correos.has(correo)) { b.anotar("personas.csv", f._linea, `${correo} aparece dos veces.`); continue; }
    if (!f.nombre) { b.anotar("personas.csv", f._linea, "Falta el nombre."); continue; }
    const rol = (f.rol || "estudiante").toLowerCase();
    if (!["estudiante", "profesor", "administrador"].includes(rol)) {
      b.anotar("personas.csv", f._linea, `Rol "${f.rol}": tiene que ser estudiante, profesor o administrador.`);
      continue;
    }
    correos.add(correo);
    personas.push({ correo, nombre: f.nombre, rol });
  }

  // ---- asignaturas
  const asignaturas: Asignatura[] = [];
  const codigos = new Set<string>();
  for (const f of leerCsv(p.asignaturas ?? "")) {
    const codigo = (f.codigo ?? "").toUpperCase();
    if (!codigo) { b.anotar("asignaturas.csv", f._linea, "Falta el código."); continue; }
    if (codigos.has(codigo)) { b.anotar("asignaturas.csv", f._linea, `El código ${codigo} está repetido.`); continue; }
    if (!f.nombre) { b.anotar("asignaturas.csv", f._linea, `${codigo} no tiene nombre.`); continue; }

    const color = f.color || "#208AEF";
    if (!esColor(color)) { b.anotar("asignaturas.csv", f._linea, `Color "${f.color}": va en formato #RRGGBB.`); continue; }

    const creditos = Number.parseInt(f.creditos || "0", 10);
    if (!Number.isInteger(creditos) || creditos <= 0) {
      b.anotar("asignaturas.csv", f._linea, `Créditos "${f.creditos}": tiene que ser un número mayor que cero.`);
      continue;
    }

    codigos.add(codigo);
    asignaturas.push({
      codigo,
      nombre: f.nombre,
      profesor: f.profesor || "Por definir",
      ayudante: f.ayudante || null,
      color,
      creditos,
      descripcion: f.descripcion || "",
      requisitos: f.requisitos || "",
      // Varios libros en una celda, separados por barra: es lo que se puede
      // escribir cómodo en una planilla.
      bibliografia: (f.bibliografia || "").split("|").map((x) => x.trim()).filter(Boolean),
      intro_tutor: f.intro_tutor || `Cuéntame en qué parte de ${f.nombre} estás y qué intentaste.`,
    });
  }

  const existeRamo = (archivo: string, linea: number, codigo: string): boolean => {
    if (codigos.has(codigo)) return true;
    b.anotar(archivo, linea, `El ramo ${codigo || "(vacío)"} no está en asignaturas.csv.`);
    return false;
  };
  const existePersona = (archivo: string, linea: number, correo: string): boolean => {
    if (correos.has(correo)) return true;
    b.anotar(archivo, linea, `${correo || "(vacío)"} no está en personas.csv.`);
    return false;
  };

  // ---- horario
  const horario: Bloque[] = [];
  for (const f of leerCsv(p.horario ?? "")) {
    const codigo = (f.codigo ?? "").toUpperCase();
    if (!existeRamo("horario.csv", f._linea, codigo)) continue;

    const dia = leerDia(f.dia ?? "");
    if (dia === null) { b.anotar("horario.csv", f._linea, `Día "${f.dia}": va el nombre (Lunes) o el número (1 a 7).`); continue; }

    const inicio = leerHora(f.hora_inicio ?? "");
    const fin = leerHora(f.hora_fin ?? "");
    if (inicio === null) { b.anotar("horario.csv", f._linea, `Hora de inicio "${f.hora_inicio}": va como 08:30.`); continue; }
    if (fin === null) { b.anotar("horario.csv", f._linea, `Hora de término "${f.hora_fin}": va como 10:00.`); continue; }
    if (fin <= inicio) { b.anotar("horario.csv", f._linea, `El bloque termina (${f.hora_fin}) antes de empezar (${f.hora_inicio}).`); continue; }
    if (!f.sala) { b.anotar("horario.csv", f._linea, "Falta la sala."); continue; }

    horario.push({ codigo, dia, inicio, fin, sala: f.sala, tipo: f.tipo || "Cátedra" });
  }

  // ---- dictados
  const dictados: Dictado[] = [];
  const yaDicta = new Set<string>();
  for (const f of leerCsv(p.dictados ?? "")) {
    const correo = (f.correo ?? "").toLowerCase();
    const codigo = (f.codigo ?? "").toUpperCase();
    if (!existePersona("dictados.csv", f._linea, correo)) continue;
    if (!existeRamo("dictados.csv", f._linea, codigo)) continue;

    const papel = (f.papel || "profesor").toLowerCase();
    if (!["profesor", "ayudante"].includes(papel)) {
      b.anotar("dictados.csv", f._linea, `Papel "${f.papel}": tiene que ser profesor o ayudante.`);
      continue;
    }
    const persona = personas.find((x) => x.correo === correo);
    if (persona && persona.rol === "estudiante") {
      b.anotar("dictados.csv", f._linea, `${correo} está como estudiante en personas.csv y acá dicta un ramo.`);
      continue;
    }
    const llave = `${correo}·${codigo}`;
    if (yaDicta.has(llave)) { b.anotar("dictados.csv", f._linea, `${correo} ya aparece en ${codigo}.`); continue; }
    yaDicta.add(llave);
    dictados.push({ correo, codigo, papel });
  }

  // ---- inscripciones
  const inscripciones: Inscripcion[] = [];
  const yaInscrito = new Set<string>();
  for (const f of leerCsv(p.inscripciones ?? "")) {
    const correo = (f.correo ?? "").toLowerCase();
    const codigo = (f.codigo ?? "").toUpperCase();
    if (!existePersona("inscripciones.csv", f._linea, correo)) continue;
    if (!existeRamo("inscripciones.csv", f._linea, codigo)) continue;
    const llave = `${correo}·${codigo}`;
    if (yaInscrito.has(llave)) { b.anotar("inscripciones.csv", f._linea, `${correo} ya está inscrito en ${codigo}.`); continue; }
    yaInscrito.add(llave);
    inscripciones.push({ correo, codigo });
  }

  // ---- materia
  const materia: Material[] = [];
  const yaOrden = new Set<string>();
  for (const f of leerCsv(p.materia ?? "")) {
    const codigo = (f.codigo ?? "").toUpperCase();
    if (!existeRamo("materia.csv", f._linea, codigo)) continue;
    if (!f.modulo) { b.anotar("materia.csv", f._linea, "Falta el módulo al que pertenece."); continue; }
    if (!f.titulo) { b.anotar("materia.csv", f._linea, "Falta el título del material."); continue; }

    const tipo = (f.tipo || "documento").toLowerCase();
    if (!["video", "documento", "ejercicios"].includes(tipo)) {
      b.anotar("materia.csv", f._linea, `Tipo "${f.tipo}": tiene que ser video, documento o ejercicios.`);
      continue;
    }

    const ordenModulo = Number.parseInt(f.orden_modulo || "1", 10);
    const orden = Number.parseInt(f.orden || "1", 10);
    if (!Number.isInteger(ordenModulo) || ordenModulo <= 0) {
      b.anotar("materia.csv", f._linea, `orden_modulo "${f.orden_modulo}": va un número desde 1.`); continue;
    }
    if (!Number.isInteger(orden) || orden <= 0) {
      b.anotar("materia.csv", f._linea, `orden "${f.orden}": va un número desde 1.`); continue;
    }

    const lectura = f.lectura || null;
    if (lectura && !lecturas.has(lectura)) {
      b.anotar("materia.csv", f._linea, `No encuentro datos/lecturas/${lectura}.`);
      continue;
    }
    // Un documento que no se puede ni leer ni abrir es una fila vacía con
    // título: aparece en la lista del alumno y no lleva a ninguna parte.
    if (tipo === "documento" && !lectura && !f.url) {
      b.anotar("materia.csv", f._linea, `"${f.titulo}" es un documento sin lectura ni url: no habría nada que abrir.`);
      continue;
    }

    const llave = `${codigo}·${f.modulo}·${orden}`;
    if (yaOrden.has(llave)) {
      b.anotar("materia.csv", f._linea, `En ${codigo} / ${f.modulo} ya hay algo en la posición ${orden}.`);
      continue;
    }
    yaOrden.add(llave);

    materia.push({
      codigo, modulo: f.modulo, orden_modulo: ordenModulo, tipo,
      titulo: f.titulo, detalle: f.detalle || "", orden,
      lectura, url: f.url || null,
    });
  }

  b.problemas.push(...choques(horario, dictados));

  return {
    colegio: { personas, asignaturas, horario, dictados, inscripciones, materia },
    problemas: b.problemas,
  };
}

/**
 * Lo que una planilla no puede ver sola: dos ramos en la misma sala a la
 * misma hora, o un profesor citado en dos partes a la vez. Es el error que
 * más caro sale, porque se descubre el primer día de clases.
 */
export function choques(horario: Bloque[], dictados: Dictado[]): Problema[] {
  const problemas: Problema[] = [];
  const seSolapan = (a: Bloque, x: Bloque) =>
    a.dia === x.dia && a.inicio < x.fin && x.inicio < a.fin;

  const docenteDe = new Map<string, string[]>();
  for (const d of dictados) {
    if (d.papel !== "profesor") continue;
    docenteDe.set(d.codigo, [...(docenteDe.get(d.codigo) ?? []), d.correo]);
  }

  for (let i = 0; i < horario.length; i++) {
    for (let j = i + 1; j < horario.length; j++) {
      const a = horario[i]!;
      const x = horario[j]!;
      if (!seSolapan(a, x)) continue;

      const cuando = `${DIAS[a.dia - 1]} ${comoHora(Math.max(a.inicio, x.inicio))}`;

      if (a.sala === x.sala) {
        problemas.push({
          archivo: "horario.csv", linea: 0,
          mensaje: `La sala ${a.sala} está tomada el ${cuando} por ${a.codigo} y ${x.codigo}.`,
        });
      }
      const comunes = (docenteDe.get(a.codigo) ?? [])
        .filter((c) => (docenteDe.get(x.codigo) ?? []).includes(c));
      for (const correo of comunes) {
        problemas.push({
          archivo: "horario.csv", linea: 0,
          mensaje: `${correo} tiene ${a.codigo} y ${x.codigo} juntos el ${cuando}.`,
        });
      }
    }
  }
  return problemas;
}
