import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as datos from "./datos-reuniones.ts";
import { EQUIPOS } from "../dominio/rubros.ts";
import { huecos, misTareas } from "../dominio/acta.ts";
import { comoSeMuestra, sePuedeEntrar } from "../dominio/sala.ts";
import { comoSala } from "./tipos-reunion.ts";

beforeEach(() => datos.reiniciarReuniones());

test("las reuniones de ejemplo cubren rubros distintos", async () => {
  const rs = await datos.misReuniones();
  const rubros = new Set(rs.map((r) => r.rubro));
  assert.ok(rubros.size >= 3, "todas las de ejemplo son del mismo rubro");
  for (const r of rs) {
    assert.ok(EQUIPOS.some((e) => e.id === r.rubro), `${r.titulo} tiene un rubro que no existe`);
  }
});

test("vienen de la más reciente a la más vieja", async () => {
  const rs = await datos.misReuniones();
  const fechas = rs.map((r) => r.ocurrio_en);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test("la lista no arrastra el análisis entero: eso se pide al abrir", async () => {
  const [r] = await datos.misReuniones();
  assert.ok(r);
  assert.equal("resumen" in r, false);
  assert.equal("tareas" in r, false);
});

test("las de ejemplo se parecen a reuniones de verdad, no a folletos", async () => {
  const rs = await datos.misReuniones();
  const completas = await Promise.all(rs.map((r) => datos.reunionPorId(r.id)));

  const todas = completas.filter((r) => r !== null);
  assert.ok(todas.some((r) => huecos(r.tareas).sinResponsable.length > 0),
    "ninguna dejó un compromiso sin dueño");
  assert.ok(todas.some((r) => r.sinTratar.length > 0),
    "en todas se alcanzó a tratar la tabla completa");
  assert.ok(todas.some((r) => r.contradicciones.length > 0),
    "en ninguna alguien entendió otra cosa");
  assert.ok(todas.some((r) => r.acuerdos.some((a) => !a.firme)),
    "todos los acuerdos quedaron firmes");
});

test("cada tarea tiene un identificador propio", async () => {
  const tareas = await datos.misTareasDeTodas();
  const ids = tareas.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("las tareas saben de qué reunión salieron", async () => {
  const tareas = await datos.misTareasDeTodas();
  for (const t of tareas) {
    assert.ok(t.reunion.length > 0, t.que);
    assert.ok(t.reunion_id.length > 0, t.que);
  }
});

test("hay tareas a mi nombre, si no la pantalla de inicio se ve vacía", async () => {
  const tareas = await datos.misTareasDeTodas();
  const yo = await datos.quienSoy();
  assert.ok(misTareas(tareas, yo).length > 0);
});

/* --------------------------------------------------------------- escribir */

test("marcar una tarea la deja marcada", async () => {
  const tareas = await datos.misTareasDeTodas();
  const t = tareas.find((x) => !x.lista)!;
  await datos.marcarTarea(t.id, true);

  const r = await datos.reunionPorId(t.reunion_id);
  assert.equal(r!.tareas.find((x) => x.id === t.id)!.lista, true);
});

test("marcar no toca la semilla: reiniciar deja todo como estaba", async () => {
  const [t] = await datos.misTareasDeTodas();
  await datos.marcarTarea(t!.id, true);
  datos.reiniciarReuniones();

  const despues = await datos.misTareasDeTodas();
  assert.equal(despues.find((x) => x.id === t!.id)!.lista, false);
});

test("una tarea agregada a mano queda sin dueño ni fecha, y se nota", async () => {
  const [r] = await datos.misReuniones();
  await datos.agregarTarea(r!.id, "  Confirmar el quórum del reglamento  ");

  const completa = await datos.reunionPorId(r!.id);
  const nueva = completa!.tareas.find((t) => t.que === "Confirmar el quórum del reglamento");
  assert.ok(nueva, "no quedó la tarea");
  assert.equal(nueva.responsable, null);
  assert.equal(nueva.plazo, null);
  assert.ok(huecos(completa!.tareas).sinNada.some((t) => t.id === nueva.id));
});

test("agregar a una reunión que ya no existe avisa en vez de perderlo", async () => {
  await assert.rejects(() => datos.agregarTarea("no-existe", "Algo"));
});

test("una reunión nueva parte en borrador y sin nada adentro", async () => {
  const r = await datos.crearReunion({
    titulo: "  Comité del jueves  ", rubro: "gerencia",
    participantes: ["Ana"], tabla: ["Presupuesto"],
  });
  assert.equal(r.titulo, "Comité del jueves");
  assert.equal(r.estado, "borrador");
  assert.equal(r.mia, true);

  const completa = await datos.reunionPorId(r.id);
  assert.equal(completa!.resumen, "");
  assert.deepEqual(completa!.tareas, []);
});

test("la reunión nueva va primera, que es donde se la va a buscar", async () => {
  const r = await datos.crearReunion({
    titulo: "Recién creada", rubro: "gerencia", participantes: [], tabla: [],
  });
  const rs = await datos.misReuniones();
  assert.equal(rs[0]!.id, r.id);
});

test("borrar una reunión la saca de la lista", async () => {
  const [r] = await datos.misReuniones();
  await datos.borrarReunion(r!.id);
  const rs = await datos.misReuniones();
  assert.equal(rs.some((x) => x.id === r!.id), false);
});

/* ------------------------------------------------------- analizar de mentira */

test("analizar deja la reunión lista y con lo que se pueda sacar", async () => {
  const r = await datos.crearReunion({
    titulo: "Comité", rubro: "gerencia", participantes: [],
    tabla: ["Presupuesto de abril", "Dotación"],
  });
  await datos.analizarReunion(r.id,
    "Se acordó postergar las dos contrataciones hasta el cierre. " +
    "Hay que pedir una propuesta nueva al proveedor de logística. " +
    "Falta la proyección con el margen real. " +
    "Revisamos el presupuesto de abril con calma.");

  const c = await datos.reunionPorId(r.id);
  assert.equal(c!.estado, "listo");
  assert.ok(c!.resumen.length > 0);
  assert.ok(c!.acuerdos.length > 0, "no reconoció ningún acuerdo");
  assert.ok(c!.tareas.length > 0, "no reconoció ninguna tarea");
  assert.ok(c!.pendientes.length > 0, "no reconoció nada pendiente");
  // "Dotación" no se mencionó: queda como no tratado.
  assert.deepEqual(c!.sinTratar, ["Dotación"]);
});

test("una transcripción muy corta no inventa un resumen", async () => {
  const r = await datos.crearReunion({
    titulo: "Corta", rubro: "gerencia", participantes: [], tabla: [],
  });
  await datos.analizarReunion(r.id, "Hola.");

  const c = await datos.reunionPorId(r.id);
  assert.match(c!.resumen, /muy corta/);
  assert.deepEqual(c!.acuerdos, []);
});

test("analizar una reunión que ya no existe avisa", async () => {
  await assert.rejects(() => datos.analizarReunion("no-existe", "algo que se dijo"));
});

test("hay una sala abierta en los datos de ejemplo, si no el flujo no se puede ver", async () => {
  const rs = await datos.misReuniones();
  const abiertas = rs.filter((r) => sePuedeEntrar(comoSala(r)));
  assert.equal(abiertas.length >= 1, true, "ninguna sala de ejemplo está abierta");
  assert.ok(abiertas[0]!.codigo, "la sala abierta no tiene código");
});

test("el código de ejemplo se puede escribir como se dicta", async () => {
  const abierta = (await datos.misReuniones()).find((r) => sePuedeEntrar(comoSala(r)))!;
  const id = await datos.entrarConCodigo(comoSeMuestra(abierta.codigo!).toLowerCase());
  assert.equal(id, abierta.id);
});

test("un código de una sala cerrada no entra", async () => {
  const cerrada = (await datos.misReuniones()).find(
    (r) => r.codigo !== null && !sePuedeEntrar(comoSala(r)));
  assert.ok(cerrada, "no hay ninguna sala cerrada de ejemplo");
  assert.equal(await datos.entrarConCodigo(cerrada.codigo!), null);
});

test("abrir una sala le pone un código nuevo y la deja abierta", async () => {
  const r = await datos.crearReunion({
    titulo: "Nueva", rubro: "gerencia", participantes: [], tabla: [],
  });
  const codigo = await datos.abrirSala(r.id);

  const c = await datos.reunionPorId(r.id);
  assert.equal(c!.codigo, codigo);
  assert.equal(sePuedeEntrar(comoSala(c!)), true);
  assert.equal(await datos.entrarConCodigo(codigo), r.id);
});

test("cerrar la sala deja el código sin efecto", async () => {
  const r = await datos.crearReunion({
    titulo: "Nueva", rubro: "gerencia", participantes: [], tabla: [],
  });
  const codigo = await datos.abrirSala(r.id);
  await datos.cerrarSala(r.id);
  assert.equal(await datos.entrarConCodigo(codigo), null);
});

test("un código inventado no entra a ninguna parte", async () => {
  assert.equal(await datos.entrarConCodigo("XXXXXX"), null);
  assert.equal(await datos.entrarConCodigo("no es un código"), null);
});
