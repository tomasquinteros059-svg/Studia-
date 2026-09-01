// Le pregunta al servidor de verdad qué está y qué falta.
//
// Uso:  npm run comprobar-servidor
//
// Nace de mirar la guía de puesta en marcha: son ocho pasos en dos sitios web
// distintos, y la manera de darse cuenta de que uno quedó a medias era instalar
// el APK y toparse con una pantalla que no anda. Esto lo pregunta antes, en
// veinte segundos, y dice cuál de los pasos falta.
//
// Usa la clave anónima a propósito, que es la que lleva la aplicación. Así lo
// que comprueba es lo que va a vivir un teléfono, no lo que ve un
// administrador: con la clave de servicio todo respondería que sí, incluidas
// las políticas de acceso que estuvieran mal puestas.

import { readFileSync } from "node:fs";

// ── De dónde salen la dirección y la clave ───────────────────────────────

function delEntorno(nombre) {
  return process.env[nombre]?.trim();
}

/** También de app/.env, que es donde están cuando uno prueba en su computador. */
function delArchivo(nombre) {
  for (const ruta of ["app/.env", ".env"]) {
    try {
      const linea = readFileSync(ruta, "utf8")
        .split("\n")
        .find((l) => l.trim().startsWith(`${nombre}=`));
      if (linea) return linea.slice(linea.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    } catch { /* no está, se sigue buscando */ }
  }
  return undefined;
}

const URL_BASE = (delEntorno("EXPO_PUBLIC_SUPABASE_URL") ?? delArchivo("EXPO_PUBLIC_SUPABASE_URL") ?? "")
  .replace(/\/+$/, "");
const CLAVE = delEntorno("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? delArchivo("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? "";

if (!URL_BASE || !CLAVE) {
  console.error("No encontré la dirección del proyecto ni la clave anónima.\n");
  console.error("Ponlas en app/.env:");
  console.error("  EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co");
  console.error("  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...\n");
  console.error("O pásalas por el entorno, en la misma línea del comando.");
  process.exit(1);
}

// ── Qué se espera encontrar ──────────────────────────────────────────────

const TABLAS = [
  "perfiles", "asignaturas", "inscripciones", "bloques_horario", "modulos",
  "materiales", "clases", "tareas", "entregas", "evaluaciones", "notas",
  "hilos", "respuestas", "conversaciones", "notificaciones", "apuntes",
  "dictados", "sesiones_estudio", "quices", "fichas", "escuchas",
  "tramos_oidos", "planificacion", "aparatos", "errores",
];

const FUNCIONES = [
  ["tutor", "el tutor no responde"],
  ["asistente", "el asistente de quien dicta no responde"],
  ["quiz", "no se pueden crear quices"],
  ["fichas", "no se generan fichas de repaso"],
  ["resumen", "no se resume la clase"],
  ["sala", "la clase en vivo no entra"],
  ["borrar-cuenta", "Play Store rechaza la app"],
  ["avisar", "los avisos no salen del teléfono"],
];

// ── Cómo se cuenta ───────────────────────────────────────────────────────

const bien = [];
const mal = [];
const dudas = [];

const ok = (que) => { bien.push(que); console.log(`  ok    ${que}`); };
const falla = (que, arreglo) => { mal.push({ que, arreglo }); console.log(`  FALTA ${que}`); };
const duda = (que) => { dudas.push(que); console.log(`  ¿?    ${que}`); };

const cabeceras = { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` };

async function pedir(camino, opciones = {}) {
  try {
    const r = await fetch(`${URL_BASE}${camino}`, {
      ...opciones,
      headers: { ...cabeceras, ...(opciones.headers ?? {}) },
    });
    return { estado: r.status, cuerpo: await r.text().catch(() => "") };
  } catch (e) {
    return { estado: 0, cuerpo: String(e) };
  }
}

// ── 1 · Que el proyecto exista y conteste ────────────────────────────────

console.log(`\nProyecto: ${URL_BASE}\n`);
console.log("Conexión:");

const raiz = await pedir("/rest/v1/");
if (raiz.estado === 0) {
  falla("el proyecto no contesta", "Revisa la dirección y tu internet.");
  console.error("\nSin conexión no se puede comprobar nada más.");
  process.exit(1);
}
if (raiz.estado === 401) {
  falla("la clave anónima no sirve para este proyecto",
    "Cópiala de nuevo desde Project Settings → API → anon public.");
  process.exit(1);
}
ok("el proyecto contesta y la clave sirve");

// ── 2 · Las tablas ───────────────────────────────────────────────────────
//
// Un 404 es que no existe; cualquier otra respuesta es que está. Una tabla
// vacía por las políticas de acceso responde 200 con una lista vacía, y eso
// acá cuenta como que está: es justo lo que tiene que pasarle a un teléfono
// sin sesión.

console.log("\nTablas:");
const faltantes = [];
for (const tabla of TABLAS) {
  const r = await pedir(`/rest/v1/${tabla}?select=*&limit=1`);
  if (r.estado === 404) faltantes.push(tabla);
}
if (faltantes.length === 0) ok(`las ${TABLAS.length} tablas están`);
else falla(`faltan ${faltantes.length} tablas: ${faltantes.join(", ")}`,
  "Corre `supabase db push`. Si ya lo corriste, mira si alguna migración falló.");

// ── 3 · Que las políticas de acceso estén puestas ────────────────────────
//
// Es la comprobación que de verdad importa y la que nadie hace. Sin sesión,
// la clave anónima no puede ver ni un perfil ni una nota. Si acá vuelven
// filas, la base está abierta a cualquiera que tenga el APK, que es
// cualquiera.

console.log("\nPolíticas de acceso:");
let abierto = 0;
for (const tabla of ["perfiles", "notas", "apuntes", "conversaciones", "errores"]) {
  const r = await pedir(`/rest/v1/${tabla}?select=*&limit=1`);
  if (r.estado === 200 && r.cuerpo.trim() !== "[]") {
    abierto++;
    falla(`${tabla} se lee sin haber entrado`,
      `Revisa que la tabla tenga \`alter table public.${tabla} enable row level security\`.`);
  }
}
if (abierto === 0) ok("sin sesión no se lee nada: las políticas están puestas");

// ── 4 · Las funciones ────────────────────────────────────────────────────
//
// Un 404 es que no está desplegada. Un 401 es que está y pide sesión, que es
// exactamente lo que tiene que contestar: se llama sin la de nadie.

console.log("\nFunciones del servidor:");
const sinDesplegar = [];
for (const [nombre, consecuencia] of FUNCIONES) {
  const r = await pedir(`/functions/v1/${nombre}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (r.estado === 404) sinDesplegar.push(`${nombre} (${consecuencia})`);
}
if (sinDesplegar.length === 0) ok(`las ${FUNCIONES.length} funciones están desplegadas`);
else falla(`faltan ${sinDesplegar.length}: ${sinDesplegar.join(", ")}`,
  "Corre `supabase functions deploy`.");

// ── 5 · Cómo se entra ────────────────────────────────────────────────────

console.log("\nEntrada:");
const ajustes = await pedir("/auth/v1/settings");
if (ajustes.estado !== 200) {
  duda("no pude leer los ajustes de entrada");
} else {
  let datos = {};
  try { datos = JSON.parse(ajustes.cuerpo); } catch { /* queda vacío */ }

  const proveedores = Object.entries(datos.external ?? {})
    .filter(([, activo]) => activo)
    .map(([nombre]) => nombre);
  if (proveedores.includes("google") || proveedores.includes("azure")) {
    ok(`entrar con: ${proveedores.join(", ")}`);
  } else {
    duda("Google y Microsoft no están activados (la app lo dice y ofrece el correo)");
  }

  if (datos.mailer_autoconfirm === false || datos.mailer_autoconfirm === undefined) {
    ok("la cuenta se confirma por correo (la app avisa que hay que ir a leerlo)");
  } else {
    duda("la cuenta no pide confirmación: cualquiera puede registrar el correo de otro");
  }
}

// La dirección de retorno no se puede leer desde afuera: Supabase no la
// publica. Se dice, en vez de callarlo y que parezca comprobado.
duda("la dirección de retorno `studia://recuperar` no se puede comprobar desde acá; "
  + "revísala en Authentication → URL Configuration");

// El bucket tampoco: listar sus archivos necesita una sesión, y acá no hay.
duda("el bucket `material` tampoco; se comprueba subiendo un archivo desde la app");

// ── Lo que quedó ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(66)}`);
if (mal.length === 0) {
  console.log(`\nTodo lo que se puede comprobar desde acá está bien (${bien.length} de ${bien.length}).`);
  if (dudas.length > 0) console.log(`Quedan ${dudas.length} cosas por mirar a mano, arriba.`);
  process.exit(0);
}

console.log(`\nFalta ${mal.length === 1 ? "una cosa" : `${mal.length} cosas`}:\n`);
for (const { que, arreglo } of mal) console.log(`  · ${que}\n    ${arreglo}\n`);
console.log("El paso a paso completo está en documentacion/poner-en-marcha.md");
process.exit(1);
