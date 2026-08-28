import { test } from "node:test";
import assert from "node:assert/strict";
import * as demo from "./datos-demo.ts";

test("trae las seis asignaturas, con color y créditos", async () => {
  const ramos = await demo.misAsignaturas();
  assert.equal(ramos.length, 6);
  for (const r of ramos) {
    assert.match(r.color, /^#[0-9A-Fa-f]{6}$/, r.nombre);
    assert.ok(r.creditos > 0);
    assert.ok(r.intro_tutor.trim().endsWith("?"), r.nombre);
  }
});

test("hay una clase en vivo y grabadas con duración", async () => {
  const viva = await demo.claseEnVivo();
  assert.ok(viva);
  assert.equal(viva!.estado, "en_vivo");

  const clases = await demo.clasesDe("cal");
  const grabadas = clases.filter((c) => c.estado === "grabada");
  assert.ok(grabadas.length >= 2);
  for (const g of grabadas) assert.ok((g.duracion_seg ?? 0) > 0, g.titulo);
});

test("los capítulos caen dentro de la duración de su clase", async () => {
  const capitulos = await demo.capitulosDe("c1");
  assert.equal(capitulos.length, 4);
  const clase = (await demo.clasesDe("cal")).find((c) => c.id === "c1")!;
  for (const c of capitulos) {
    assert.ok(c.segundo >= 0 && c.segundo <= clase.duracion_seg!, c.titulo);
  }
});

test("hay tareas pendientes, atrasadas y entregadas", async () => {
  const tareas = await demo.misTareas();
  const ahora = Date.now();
  assert.ok(tareas.some((t) => !t.entregada_en && new Date(t.vence_en).getTime() > ahora), "pendiente");
  assert.ok(tareas.some((t) => !t.entregada_en && new Date(t.vence_en).getTime() < ahora), "atrasada");
  assert.ok(tareas.some((t) => t.entregada_en), "entregada");
});

test("los pesos de cada ramo suman 100", async () => {
  for (const ramo of await demo.misAsignaturas()) {
    const evs = await demo.evaluacionesDe(ramo.id);
    const suma = evs.reduce((a, e) => a + e.peso, 0);
    assert.equal(suma, 100, `${ramo.nombre} suma ${suma}`);
  }
});

test("hay un ramo bajo 4,0, para que se vea la proyección", async () => {
  const porRamo = await demo.todasLasEvaluaciones();
  const enRiesgo = [...porRamo.values()].some((evs) => {
    const rendidas = evs.filter((e) => e.nota !== null);
    if (!rendidas.length) return false;
    const peso = rendidas.reduce((a, e) => a + e.peso, 0);
    return rendidas.reduce((a, e) => a + e.peso * e.nota!, 0) / peso < 4;
  });
  assert.ok(enRiesgo, "el demo debería mostrar al menos un ramo en riesgo");
});

test("marcar material va y vuelve", async () => {
  const antes = (await demo.materiaDe("cal"))[2]!.materiales[0]!;
  assert.equal(antes.completado, false);

  await demo.marcarMaterial(antes.id, true);
  assert.equal((await demo.materiaDe("cal"))[2]!.materiales[0]!.completado, true);

  await demo.marcarMaterial(antes.id, false);
  assert.equal((await demo.materiaDe("cal"))[2]!.materiales[0]!.completado, false);
});

test("entregar una tarea queda registrado", async () => {
  const antes = await demo.tareaPorId("t6");
  assert.equal(antes!.entregada_en, null);
  await demo.entregarTarea("t6");
  assert.ok((await demo.tareaPorId("t6"))!.entregada_en);
});

test("un apunte se crea, se escribe y se fija", async () => {
  const cuantos = (await demo.misApuntes()).length;
  const nuevo = await demo.crearApunte("fis", "Clase de prueba");
  assert.equal((await demo.misApuntes()).length, cuantos + 1);

  await demo.guardarApunte(nuevo.id, { contenido: "Diagrama de cuerpo libre." });
  assert.equal((await demo.apuntePorId(nuevo.id))!.contenido, "Diagrama de cuerpo libre.");

  await demo.fijarApunte(nuevo.id, true);
  assert.equal((await demo.apuntePorId(nuevo.id))!.fijado, true);

  await demo.borrarApunte(nuevo.id);
  assert.equal((await demo.misApuntes()).length, cuantos);
});

test("responder un hilo actualiza su conteo", async () => {
  const antes = (await demo.foroDe("cal")).find((h) => h.id === "f2")!;
  await demo.responderHilo("f2", "Yo lo resolví mirando el dominio.");
  const despues = (await demo.foroDe("cal")).find((h) => h.id === "f2")!;
  assert.equal(despues.respuestas, antes.respuestas + 1);
  assert.equal((await demo.respuestasDe("f2")).at(-1)!.autor_nombre, "Eduardo Q.");
});

test("abrir un hilo nuevo lo deja arriba y consultable", async () => {
  const id = await demo.crearHilo("cal", "¿Alguien tiene la guía 5?", "No la encuentro en el material.");
  const hilo = await demo.hiloPorId(id);
  assert.equal(hilo!.titulo, "¿Alguien tiene la guía 5?");
  assert.equal((await demo.foroDe("cal"))[0]!.id, id);
});

test("las notificaciones se marcan leídas", async () => {
  assert.ok((await demo.misNotificaciones()).some((n) => !n.leida));
  await demo.marcarTodasLeidas();
  assert.equal((await demo.misNotificaciones()).filter((n) => !n.leida).length, 0);
});

test("cada notificación apunta a algo que existe", async () => {
  const [ramos, tareas] = await Promise.all([demo.misAsignaturas(), demo.misTareas()]);
  for (const n of await demo.misNotificaciones()) {
    assert.ok(ramos.some((r) => r.id === n.asignatura_id), `ramo de ${n.titulo}`);
    if (n.ref_tipo === "tarea") {
      assert.ok(tareas.some((t) => t.id === n.ref_id), `tarea de ${n.titulo}`);
    }
    if (n.ref_tipo === "hilo") {
      assert.ok(await demo.hiloPorId(n.ref_id!), `hilo de ${n.titulo}`);
    }
  }
});
