#!/usr/bin/env node --experimental-strip-types
// Convierte la carpeta datos/ en SQL listo para aplicar.
//
//   npm run importar
//
// No toca ninguna base: escribe datos/importado.sql y lo deja para revisar.
// Un colegio que carga un semestre entero merece poder mirar antes qué se va
// a escribir, y poder aplicarlo desde el editor SQL de Supabase sin instalar
// nada.
//
// Si algo está mal, no escribe nada y enumera todos los problemas.

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { revisar, comoHora, type Colegio, type Planillas } from "./planilla.ts";

const DATOS = join(import.meta.dirname, "..", "datos");
const SALIDA = join(DATOS, "importado.sql");

const leer = (nombre: string): string | undefined => {
  const ruta = join(DATOS, nombre);
  return existsSync(ruta) ? readFileSync(ruta, "utf8") : undefined;
};

const planillas: Planillas = {
  personas: leer("personas.csv"),
  asignaturas: leer("asignaturas.csv"),
  horario: leer("horario.csv"),
  dictados: leer("dictados.csv"),
  inscripciones: leer("inscripciones.csv"),
  materia: leer("materia.csv"),
  lecturas: existsSync(join(DATOS, "lecturas"))
    ? readdirSync(join(DATOS, "lecturas")).filter((n) => !n.startsWith("."))
    : [],
};

const { colegio, problemas } = revisar(planillas);

if (problemas.length > 0) {
  console.error(`\nNo escribí nada. Hay ${problemas.length} ${problemas.length === 1 ? "cosa" : "cosas"} que corregir:\n`);
  for (const p of problemas) {
    const donde = p.linea > 0 ? `${p.archivo}:${p.linea}` : p.archivo;
    console.error(`  ${donde.padEnd(22)} ${p.mensaje}`);
  }
  console.error("");
  process.exit(1);
}

// ── Escribir el SQL ─────────────────────────────────────────────────────

/** Una cadena para SQL. Las comillas simples se duplican. */
const t = (v: string | null): string =>
  v === null ? "null" : `'${v.replace(/'/g, "''")}'`;

const arreglo = (xs: string[]): string =>
  xs.length === 0 ? "'{}'" : `array[${xs.map(t).join(", ")}]`;

function sqlDe(c: Colegio): string {
  const l: string[] = [];
  const hoy = new Date().toISOString().slice(0, 10);

  l.push("-- Generado por `npm run importar` a partir de datos/.");
  l.push("-- No editar a mano: se rehace entero en la próxima importación.");
  l.push(`-- Fecha: ${hoy}`);
  l.push("");
  l.push("begin;");
  l.push("");

  // Idempotente a propósito: un colegio corrige la planilla y vuelve a
  // importar. Nada de esto debe duplicar filas ni borrar lo que los alumnos
  // ya escribieron.
  l.push("-- Las personas se crean como usuarios; la contraseña la definen ellas");
  l.push("-- por correo. Acá solo queda el perfil con su rol.");
  for (const p of c.personas) {
    l.push(`insert into public.perfiles (id, nombre, correo, rol)`);
    l.push(`  select u.id, ${t(p.nombre)}, ${t(p.correo)}, ${t(p.rol)}`);
    l.push(`    from auth.users u where u.email = ${t(p.correo)}`);
    l.push(`  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;`);
  }
  l.push("");

  for (const a of c.asignaturas) {
    l.push(`insert into public.asignaturas`);
    l.push(`  (codigo, nombre, profesor, ayudante, color, creditos, descripcion, requisitos, bibliografia, intro_tutor)`);
    l.push(`values (${t(a.codigo)}, ${t(a.nombre)}, ${t(a.profesor)}, ${t(a.ayudante)}, ${t(a.color)}, ${a.creditos},`);
    l.push(`        ${t(a.descripcion)}, ${t(a.requisitos)}, ${arreglo(a.bibliografia)}, ${t(a.intro_tutor)})`);
    // El índice único de `codigo` es parcial: solo cubre los ramos del
    // colegio. Sin repetir su condición, Postgres no sabe cuál inferir.
    l.push(`on conflict (codigo) where creador_id is null do update set`);
    l.push(`  nombre = excluded.nombre, profesor = excluded.profesor, ayudante = excluded.ayudante,`);
    l.push(`  color = excluded.color, creditos = excluded.creditos, descripcion = excluded.descripcion,`);
    l.push(`  requisitos = excluded.requisitos, bibliografia = excluded.bibliografia,`);
    l.push(`  intro_tutor = excluded.intro_tutor;`);
  }
  l.push("");

  const ramo = (codigo: string) => `(select id from public.asignaturas where codigo = ${t(codigo)})`;
  const persona = (correo: string) => `(select id from public.perfiles where correo = ${t(correo)})`;

  l.push("-- El horario se rehace entero: un bloque que se sacó de la planilla");
  l.push("-- tiene que desaparecer, y no hay nada del alumno colgando de él.");
  const codigos = c.asignaturas.map((a) => t(a.codigo)).join(", ");
  if (codigos) {
    l.push(`delete from public.bloques_horario where asignatura_id in`);
    l.push(`  (select id from public.asignaturas where codigo in (${codigos}));`);
  }
  for (const b of c.horario) {
    l.push(`insert into public.bloques_horario (asignatura_id, dia, hora_inicio, hora_fin, sala, tipo)`);
    l.push(`values (${ramo(b.codigo)}, ${b.dia}, ${t(comoHora(b.inicio))}, ${t(comoHora(b.fin))}, ${t(b.sala)}, ${t(b.tipo)});`);
  }
  l.push("");

  for (const d of c.dictados) {
    l.push(`insert into public.dictados (docente_id, asignatura_id, papel)`);
    l.push(`values (${persona(d.correo)}, ${ramo(d.codigo)}, ${t(d.papel)})`);
    l.push(`on conflict (docente_id, asignatura_id) do update set papel = excluded.papel;`);
  }
  l.push("");

  for (const i of c.inscripciones) {
    l.push(`insert into public.inscripciones (estudiante_id, asignatura_id)`);
    l.push(`values (${persona(i.correo)}, ${ramo(i.codigo)})`);
    l.push(`on conflict (estudiante_id, asignatura_id) do nothing;`);
  }
  l.push("");

  // Los módulos se identifican por título dentro del ramo: es lo que la
  // planilla tiene a mano, y un colegio no va a manejar identificadores.
  const modulos = new Map<string, { codigo: string; titulo: string; orden: number }>();
  for (const m of c.materia) {
    modulos.set(`${m.codigo}·${m.modulo}`, { codigo: m.codigo, titulo: m.modulo, orden: m.orden_modulo });
  }
  for (const m of modulos.values()) {
    l.push(`insert into public.modulos (asignatura_id, titulo, orden)`);
    l.push(`select ${ramo(m.codigo)}, ${t(m.titulo)}, ${m.orden}`);
    l.push(`where not exists (select 1 from public.modulos`);
    l.push(`  where asignatura_id = ${ramo(m.codigo)} and titulo = ${t(m.titulo)});`);
  }
  l.push("");

  const modulo = (codigo: string, titulo: string) =>
    `(select id from public.modulos where asignatura_id = ${ramo(codigo)} and titulo = ${t(titulo)})`;

  for (const m of c.materia) {
    const texto = m.lectura
      ? readFileSync(join(DATOS, "lecturas", m.lectura), "utf8").trim()
      : null;
    l.push(`insert into public.materiales (modulo_id, tipo, titulo, detalle, url, orden, texto)`);
    l.push(`values (${modulo(m.codigo, m.modulo)}, ${t(m.tipo)}, ${t(m.titulo)}, ${t(m.detalle)}, ${t(m.url)}, ${m.orden}, ${t(texto)})`);
    l.push(`on conflict (modulo_id, orden) do update set`);
    l.push(`  tipo = excluded.tipo, titulo = excluded.titulo, detalle = excluded.detalle,`);
    l.push(`  url = excluded.url, texto = excluded.texto;`);
  }

  l.push("");
  l.push("commit;");
  l.push("");
  return l.join("\n");
}

writeFileSync(SALIDA, sqlDe(colegio), "utf8");

const c = colegio;
console.log(`
Todo revisado, sin problemas.

  ${String(c.personas.length).padStart(4)} personas
  ${String(c.asignaturas.length).padStart(4)} asignaturas
  ${String(c.horario.length).padStart(4)} bloques de horario
  ${String(c.dictados.length).padStart(4)} dictados
  ${String(c.inscripciones.length).padStart(4)} inscripciones
  ${String(c.materia.length).padStart(4)} materiales

Escribí datos/importado.sql. Revísalo y aplícalo con:

  psql "$DATABASE_URL" -f datos/importado.sql

o pegándolo en el editor SQL de Supabase.
`);
