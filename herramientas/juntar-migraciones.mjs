// Junta las 27 migraciones en un solo archivo para pegarlo en el Editor SQL.
//
// Uso:  npm run juntar-migraciones
//
// Nace de una tablet. La guía de puesta en marcha supone un computador con la
// consola de Supabase instalada, y `supabase db push` aplica las migraciones en
// orden sin que uno tenga que pensar. Desde una tablet no hay consola: lo único
// que hay es el Editor SQL del panel, que recibe texto pegado. Esto arma ese
// texto.
//
// Sale ordenado por nombre de archivo, que es como los ordena la consola de
// Supabase, y termina anotando las migraciones como aplicadas para que un
// `db push` posterior desde un computador no intente repetirlas.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const CARPETA = "supabase/migrations";
// Con --revisar no escribe: compara y se queja si el archivo quedó viejo. Así
// una migración nueva no se olvida aquí en silencio.
const REVISAR = process.argv.includes("--revisar");
const SALIDA = process.argv.find((a) => a.endsWith(".sql")) ?? "supabase/todo-de-una-vez.sql";

const archivos = readdirSync(CARPETA)
  .filter((n) => n.endsWith(".sql"))
  .sort(); // los nombres empiezan con la fecha, así que ordenar es cronológico

if (archivos.length === 0) {
  console.error(`No hay migraciones en ${CARPETA}.`);
  process.exit(1);
}

/** `20260825000100_esquema.sql` → `{ version: "20260825000100", nombre: "esquema" }` */
function partes(archivo) {
  const sinExtension = archivo.replace(/\.sql$/, "");
  const guion = sinExtension.indexOf("_");
  return {
    version: sinExtension.slice(0, guion),
    nombre: sinExtension.slice(guion + 1),
  };
}

const trozos = [];

trozos.push(
  [
    "-- StudIA · todas las migraciones, en orden, para pegar de una vez.",
    "--",
    "-- Generado por herramientas/juntar-migraciones.mjs. No lo edites a mano:",
    "-- lo que vale son los archivos de supabase/migrations, y este se rehace.",
    "--",
    `-- ${archivos.length} migraciones, de ${partes(archivos[0]).version} a ${partes(archivos.at(-1)).version}.`,
    "--",
    "-- Supabase corre todo esto junto: si una línea falla, deshace el resto y",
    "-- no queda nada a medias.",
    "",
  ].join("\n"),
);

for (const archivo of archivos) {
  const { version, nombre } = partes(archivo);
  const cuerpo = readFileSync(join(CARPETA, archivo), "utf8").trimEnd();
  trozos.push(
    [
      "",
      "-- ───────────────────────────────────────────────────────────────────",
      `-- ${version} · ${nombre.replace(/_/g, " ")}`,
      "-- ───────────────────────────────────────────────────────────────────",
      "",
      cuerpo,
      "",
    ].join("\n"),
  );
}

// Anotarlas como aplicadas. Es la misma tabla que lleva la consola de Supabase:
// sin esto, un `db push` desde un computador las correría todas de nuevo y se
// caería en el primer `create table` que ya existe.
const filas = archivos
  .map((a) => {
    const { version, nombre } = partes(a);
    return `  ('${version}', '${nombre.replace(/'/g, "''")}')`;
  })
  .join(",\n");

trozos.push(
  [
    "",
    "-- ───────────────────────────────────────────────────────────────────",
    "-- Quedan anotadas como aplicadas",
    "-- ───────────────────────────────────────────────────────────────────",
    "",
    "create schema if not exists supabase_migrations;",
    "",
    "create table if not exists supabase_migrations.schema_migrations (",
    "  version text primary key,",
    "  statements text[],",
    "  name text",
    ");",
    "",
    "insert into supabase_migrations.schema_migrations (version, name) values",
    filas,
    "on conflict (version) do nothing;",
    "",
  ].join("\n"),
);

const texto = trozos.join("\n");
const kb = (Buffer.byteLength(texto, "utf8") / 1024).toFixed(0);

if (REVISAR) {
  let guardado;
  try {
    guardado = readFileSync(SALIDA, "utf8");
  } catch {
    console.error(`Falta ${SALIDA}. Córrelo con: npm run juntar-migraciones`);
    process.exit(1);
  }
  if (guardado !== texto) {
    console.error(`${SALIDA} no coincide con las migraciones. Vuelve a generarlo:`);
    console.error("  npm run juntar-migraciones");
    process.exit(1);
  }
  console.log(`${SALIDA} al día · ${archivos.length} migraciones`);
} else {
  mkdirSync(dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, texto, "utf8");
  console.log(`${archivos.length} migraciones → ${SALIDA} (${kb} KB, ${texto.split("\n").length} líneas)`);
}
