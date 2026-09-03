import { test } from "node:test";
import assert from "node:assert/strict";
import {
  choquesDeHorario, comoHora, porHora, seSolapan, type BloqueDeClase,
} from "./horario.ts";

const b = (x: Partial<BloqueDeClase>): BloqueDeClase =>
  ({ codigo: "MAT1610", dia: 1, inicio: 510, fin: 600, sala: "A-201", ...x });

test("los minutos vuelven a verse como hora", () => {
  assert.equal(comoHora(510), "08:30");
  assert.equal(comoHora(840), "14:00");
  assert.equal(comoHora(0), "00:00");
});

test("dos bloques del mismo día que se pisan se solapan", () => {
  assert.equal(seSolapan(b({}), b({ inicio: 570, fin: 660 })), true);
});

test("bloques pegados no se solapan", () => {
  // Uno termina 10:00 y el otro empieza 10:00: eso es un horario normal.
  assert.equal(seSolapan(b({ inicio: 510, fin: 600 }), b({ inicio: 600, fin: 690 })), false);
});

test("el mismo horario en días distintos no se solapa", () => {
  assert.equal(seSolapan(b({}), b({ dia: 2 })), false);
});

test("un bloque contenido dentro de otro se solapa", () => {
  assert.equal(seSolapan(b({ inicio: 480, fin: 720 }), b({ inicio: 540, fin: 600 })), true);
});

test("dos ramos en la misma sala a la misma hora", () => {
  const c = choquesDeHorario([b({}), b({ codigo: "FIS1503" })], []);
  assert.equal(c.length, 1);
  assert.equal(c[0]!.tipo, "sala");
  assert.match(c[0]!.mensaje, /La sala A-201 está tomada el lunes 08:30/);
});

test("salas distintas a la misma hora no chocan", () => {
  assert.deepEqual(choquesDeHorario([b({}), b({ codigo: "FIS1503", sala: "C-002" })], []), []);
});

test("un profesor citado en dos ramos a la vez", () => {
  const c = choquesDeHorario(
    [b({}), b({ codigo: "MAT1203", sala: "B-104" })],
    [{ quien: "ana@colegio.cl", codigo: "MAT1610", papel: "profesor" },
     { quien: "ana@colegio.cl", codigo: "MAT1203", papel: "profesor" }],
  );
  assert.equal(c.length, 1);
  assert.equal(c[0]!.tipo, "docente");
  assert.match(c[0]!.mensaje, /ana@colegio\.cl tiene MAT1610 y MAT1203 juntos/);
});

test("profesores distintos en cada ramo no chocan", () => {
  const c = choquesDeHorario(
    [b({}), b({ codigo: "MAT1203", sala: "B-104" })],
    [{ quien: "ana@colegio.cl", codigo: "MAT1610", papel: "profesor" },
     { quien: "otro@colegio.cl", codigo: "MAT1203", papel: "profesor" }],
  );
  assert.deepEqual(c, []);
});

test("un ayudante repetido no se reporta como choque de profesor", () => {
  const c = choquesDeHorario(
    [b({}), b({ codigo: "MAT1203", sala: "B-104" })],
    [{ quien: "ana@colegio.cl", codigo: "MAT1610", papel: "ayudante" },
     { quien: "ana@colegio.cl", codigo: "MAT1203", papel: "ayudante" }],
  );
  assert.deepEqual(c, []);
});

test("sala y profesor chocando a la vez dan dos avisos distintos", () => {
  const c = choquesDeHorario(
    [b({}), b({ codigo: "MAT1203" })],
    [{ quien: "ana@colegio.cl", codigo: "MAT1610", papel: "profesor" },
     { quien: "ana@colegio.cl", codigo: "MAT1203", papel: "profesor" }],
  );
  assert.deepEqual(c.map((x) => x.tipo).sort(), ["docente", "sala"]);
});

test("el mismo ramo dos veces el mismo día en la misma sala también choca", () => {
  const c = choquesDeHorario([b({}), b({ inicio: 540, fin: 630 })], []);
  assert.equal(c.length, 1);
});

test("un horario vacío o de un solo bloque no da choques", () => {
  assert.deepEqual(choquesDeHorario([], []), []);
  assert.deepEqual(choquesDeHorario([b({})], []), []);
});

// ── El orden del día ────────────────────────────────────────────────────

test("el día se muestra de la primera clase a la última", () => {
  const dia = [
    { hora_inicio: "14:00", sala: "A" },
    { hora_inicio: "08:30", sala: "B" },
    { hora_inicio: "10:15", sala: "C" },
  ];
  assert.deepEqual(porHora(dia).map((b) => b.hora_inicio), ["08:30", "10:15", "14:00"]);
});

test("ordenar no toca la lista que le pasaron", () => {
  const dia = [{ hora_inicio: "14:00" }, { hora_inicio: "08:30" }];
  porHora(dia);
  assert.deepEqual(dia.map((b) => b.hora_inicio), ["14:00", "08:30"]);
});

test("dos clases a la misma hora no se pierden ni se duplican", () => {
  const dia = [{ hora_inicio: "10:00", sala: "A" }, { hora_inicio: "10:00", sala: "B" }];
  assert.deepEqual(porHora(dia).map((b) => b.sala).sort(), ["A", "B"]);
});
