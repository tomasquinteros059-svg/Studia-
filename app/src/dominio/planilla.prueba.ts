import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comoHora, leerCsv, leerDia, leerHora, resumenDeCarga, revisar, type Planillas, nominaDe } from "./planilla.ts";

// ── El CSV ──────────────────────────────────────────────────────────────

test("lee una planilla simple", () => {
  const filas = leerCsv("codigo,nombre\nMAT1610,Cálculo I\n");
  assert.equal(filas.length, 1);
  assert.equal(filas[0]!.celdas.codigo, "MAT1610");
  assert.equal(filas[0]!.celdas.nombre, "Cálculo I");
});

test("las líneas se numeran como en la planilla, contando la cabecera", () => {
  const filas = leerCsv("a\n1\n2\n");
  assert.deepEqual(filas.map((f) => f.linea), [2, 3]);
});

test("una coma dentro de comillas no parte la celda", () => {
  const filas = leerCsv('codigo,nombre\nMAT1610,"Cálculo I, primera parte"\n');
  assert.equal(filas[0]!.celdas.nombre, "Cálculo I, primera parte");
});

test("las comillas dobles adentro se leen como una", () => {
  const filas = leerCsv('t\n"Dijo ""hola"" y se fue"\n');
  assert.equal(filas[0]!.celdas.t, 'Dijo "hola" y se fue');
});

test("el BOM y los CRLF de Excel no ensucian la primera columna", () => {
  const filas = leerCsv("﻿codigo,nombre\r\nMAT1610,Cálculo\r\n");
  assert.equal(filas[0]!.celdas.codigo, "MAT1610");
});

test("las líneas en blanco se ignoran", () => {
  assert.equal(leerCsv("a\n1\n\n\n2\n").length, 2);
});

test("la cabecera no distingue mayúsculas ni espacios", () => {
  const filas = leerCsv(" Codigo , Nombre \nMAT1610,Cálculo\n");
  assert.equal(filas[0]!.celdas.codigo, "MAT1610");
});

test("una celda que falta al final queda vacía y no indefinida", () => {
  const filas = leerCsv("a,b,c\n1,2\n");
  assert.equal(filas[0]!.celdas.c, "");
});

test("una planilla vacía no da filas", () => {
  assert.deepEqual(leerCsv(""), []);
  assert.deepEqual(leerCsv("codigo,nombre\n"), []);
});

// ── Días y horas ────────────────────────────────────────────────────────

test("el día se puede escribir con nombre o con número", () => {
  assert.equal(leerDia("Lunes"), 1);
  assert.equal(leerDia("miercoles"), 3);
  assert.equal(leerDia("MIÉRCOLES"), 3);
  assert.equal(leerDia("5"), 5);
});

test("un día que no existe se rechaza", () => {
  for (const malo of ["Lunez", "0", "8", "", "mañana"]) {
    assert.equal(leerDia(malo), null, malo);
  }
});

test("la hora acepta una o dos cifras", () => {
  assert.equal(leerHora("8:30"), 510);
  assert.equal(leerHora("08:30"), 510);
  assert.equal(leerHora("14:00"), 840);
});

test("una hora imposible se rechaza", () => {
  for (const mala of ["25:00", "10:75", "8.30", "830", "", "8:3"]) {
    assert.equal(leerHora(mala), null, mala);
  }
});

test("los minutos vuelven a verse como hora", () => {
  assert.equal(comoHora(510), "08:30");
  assert.equal(comoHora(840), "14:00");
});

// ── La revisión completa ────────────────────────────────────────────────

const BASE: Planillas = {
  personas: [
    "correo,nombre,rol",
    "ana@colegio.cl,Ana Ríos,profesor",
    "eduardo@colegio.cl,Eduardo Q.,estudiante",
  ].join("\n"),
  asignaturas: [
    "codigo,nombre,profesor,color,creditos",
    "MAT1610,Cálculo I,Ana Ríos,#208AEF,10",
  ].join("\n"),
  horario: [
    "codigo,dia,hora_inicio,hora_fin,sala,tipo",
    "MAT1610,Lunes,08:30,10:00,A-201,Cátedra",
  ].join("\n"),
  dictados: ["correo,codigo,papel", "ana@colegio.cl,MAT1610,profesor"].join("\n"),
  inscripciones: ["correo,codigo", "eduardo@colegio.cl,MAT1610"].join("\n"),
  materia: [
    "codigo,modulo,orden_modulo,tipo,titulo,detalle,orden,lectura",
    "MAT1610,1 · Límites,1,documento,Apunte de límites,Lectura · 4 min,1,limites.txt",
  ].join("\n"),
  lecturas: ["limites.txt"],
};

const con = (cambio: Partial<Planillas>): Planillas => ({ ...BASE, ...cambio });

test("un colegio bien llenado no tiene problemas", () => {
  const { colegio, problemas } = revisar(BASE);
  assert.deepEqual(problemas, []);
  assert.equal(colegio.personas.length, 2);
  assert.equal(colegio.asignaturas.length, 1);
  assert.equal(colegio.horario.length, 1);
  assert.equal(colegio.materia.length, 1);
});

test("se informan todos los problemas juntos, no el primero", () => {
  const { problemas } = revisar(con({
    personas: ["correo,nombre,rol", "no-es-correo,Sin Arroba,estudiante", "otro@colegio.cl,,estudiante"].join("\n"),
  }));
  const mensajes = problemas.map((x) => x.mensaje).join(" · ");
  assert.match(mensajes, /no parece un correo/);
  assert.match(mensajes, /Falta el nombre/);
});

test("una persona inválida arrastra las planillas que la nombran", () => {
  // No es ruido: el dictado y la inscripción de verdad quedaron colgando, y
  // arreglar la fila de personas arregla las tres.
  const { problemas } = revisar(con({
    personas: ["correo,nombre,rol", "eduardo@colegio.cl,Eduardo Q.,estudiante"].join("\n"),
  }));
  assert.deepEqual(
    problemas.map((x) => x.archivo).sort(),
    ["dictados.csv"],
  );
});

test("cada problema dice archivo y línea", () => {
  const { problemas } = revisar(con({
    horario: ["codigo,dia,hora_inicio,hora_fin,sala", "MAT1610,Lunes,10:00,08:30,A-201"].join("\n"),
  }));
  assert.equal(problemas[0]!.archivo, "horario.csv");
  assert.equal(problemas[0]!.linea, 2);
  assert.match(problemas[0]!.mensaje, /termina.*antes de empezar/);
});

test("un ramo que no está en asignaturas se caza en cada planilla", () => {
  const { problemas } = revisar(con({
    horario: ["codigo,dia,hora_inicio,hora_fin,sala", "FIS1503,Lunes,08:30,10:00,C-002"].join("\n"),
  }));
  assert.match(problemas[0]!.mensaje, /FIS1503 no está en asignaturas\.csv/);
});

test("una persona que no está en personas se caza al inscribirla", () => {
  const { problemas } = revisar(con({
    inscripciones: ["correo,codigo", "fantasma@colegio.cl,MAT1610"].join("\n"),
  }));
  assert.match(problemas[0]!.mensaje, /fantasma@colegio\.cl no está en personas\.csv/);
});

test("un estudiante no puede aparecer dictando", () => {
  const { problemas } = revisar(con({
    dictados: ["correo,codigo,papel", "eduardo@colegio.cl,MAT1610,profesor"].join("\n"),
  }));
  assert.match(problemas[0]!.mensaje, /está como estudiante/);
});

test("los correos repetidos se avisan", () => {
  const { problemas } = revisar(con({
    personas: ["correo,nombre,rol", "ana@colegio.cl,Ana,profesor", "ana@colegio.cl,Ana Otra Vez,profesor"].join("\n"),
  }));
  assert.match(problemas[0]!.mensaje, /aparece dos veces/);
});

test("un color mal escrito se avisa antes de llegar a la base", () => {
  const { problemas } = revisar(con({
    asignaturas: ["codigo,nombre,color,creditos", "MAT1610,Cálculo,azul,10"].join("\n"),
  }));
  assert.match(problemas[0]!.mensaje, /#RRGGBB/);
});

test("la bibliografía se separa con barra", () => {
  const { colegio } = revisar(con({
    asignaturas: ["codigo,nombre,color,creditos,bibliografia",
      "MAT1610,Cálculo,#208AEF,10,Stewart | Spivak"].join("\n"),
  }));
  assert.deepEqual(colegio.asignaturas[0]!.bibliografia, ["Stewart", "Spivak"]);
});

test("un documento sin lectura ni url no entra", () => {
  const { problemas } = revisar(con({
    materia: ["codigo,modulo,orden_modulo,tipo,titulo,orden",
      "MAT1610,1 · Límites,1,documento,Apunte sin nada,1"].join("\n"),
  }));
  assert.match(problemas[0]!.mensaje, /no habría nada que abrir/);
});

test("una lectura que no existe en la carpeta se avisa", () => {
  const { problemas } = revisar(con({ lecturas: [] }));
  assert.match(problemas[0]!.mensaje, /datos\/lecturas\/limites\.txt/);
});

test("dos materiales en la misma posición de un módulo chocan", () => {
  const { problemas } = revisar(con({
    materia: ["codigo,modulo,orden_modulo,tipo,titulo,orden,url",
      "MAT1610,1 · Límites,1,video,Uno,1,http://a",
      "MAT1610,1 · Límites,1,video,Otro,1,http://b"].join("\n"),
  }));
  assert.match(problemas[0]!.mensaje, /ya hay algo en la posición 1/);
});

test("el mismo orden en módulos distintos no choca", () => {
  const { problemas } = revisar(con({
    materia: ["codigo,modulo,orden_modulo,tipo,titulo,orden,url",
      "MAT1610,1 · Límites,1,video,Uno,1,http://a",
      "MAT1610,2 · Derivada,2,video,Otro,1,http://b"].join("\n"),
  }));
  assert.deepEqual(problemas, []);
});

// ── Choques de horario ──────────────────────────────────────────────────
// Los casos están en app/src/dominio/horario.prueba.ts: acá solo se
// comprueba que la revisión de planillas los incorpore.

test("los choques aparecen en la revisión completa", () => {
  const { problemas } = revisar(con({
    horario: ["codigo,dia,hora_inicio,hora_fin,sala",
      "MAT1610,Lunes,08:30,10:00,A-201",
      "MAT1610,Lunes,09:00,10:30,A-201"].join("\n"),
  }));
  assert.ok(problemas.some((x) => /sala A-201 está tomada/.test(x.mensaje)));
});

// ── Lo que se dice antes de aplicar ─────────────────────────────────────

const colegioCon = (codigos: string[], bloques = 0) => ({
  asignaturas: codigos.map((codigo) => ({ codigo })) as never,
  horario: Array.from({ length: bloques }, () => ({})) as never,
});

test("separa los ramos que entran de los que ya estaban", () => {
  const r = resumenDeCarga(colegioCon(["MAT1610", "FIS1503"]), [{ codigo: "MAT1610" }]);
  assert.deepEqual(r.nuevos, ["FIS1503"]);
  assert.deepEqual(r.actualizados, ["MAT1610"]);
});

test("dice qué ramos quedan intactos: una planilla parcial no borra el resto", () => {
  const r = resumenDeCarga(colegioCon(["MAT1610"]), [{ codigo: "MAT1610" }, { codigo: "EAE1110" }]);
  assert.deepEqual(r.intactos, ["EAE1110"]);
});

test("el código se compara sin importar mayúsculas: la planilla las mezcla", () => {
  const r = resumenDeCarga(colegioCon(["mat1610"]), [{ codigo: "MAT1610" }]);
  assert.deepEqual(r.actualizados, ["mat1610"]);
  assert.deepEqual(r.nuevos, []);
  assert.deepEqual(r.intactos, []);
});

test("cuenta los bloques de horario que trae la planilla", () => {
  assert.equal(resumenDeCarga(colegioCon(["MAT1610"], 14), []).bloques, 14);
});

test("un colegio vacío no rompe el resumen", () => {
  const r = resumenDeCarga(colegioCon([]), []);
  assert.deepEqual(r, { nuevos: [], actualizados: [], bloques: 0, intactos: [] });
});

// ── La nómina de la institución ─────────────────────────────────────────
//
// Lo que se manda al servidor cuando una universidad entrega su planilla. La
// gente casi nunca tiene cuenta todavía: cada fila queda esperando a nombre
// de un correo.

test("todos van en la nómina, tengan ramo o no", () => {
  const nomina = nominaDe({
    personas: [
      { correo: "alumna@u.cl", nombre: "Alumna", rol: "estudiante" },
      { correo: "secre@u.cl", nombre: "Secretaría", rol: "administrador" },
    ],
    inscripciones: [{ correo: "alumna@u.cl", codigo: "MAT1610" }],
    dictados: [],
  });

  // La secretaría no está inscrita en nada y aun así pertenece: es lo que le
  // da el plan de la institución.
  assert.ok(nomina.some((f) => f.correo === "secre@u.cl" && f.codigo === null));
  assert.equal(nomina.filter((f) => f.correo === "alumna@u.cl").length, 2);
});

test("el correo viaja en minúsculas y el código en mayúsculas", () => {
  // La planilla trae «Juan.Perez@U.CL» y la persona se registra en
  // minúsculas. Sin normalizar, no se encuentran nunca.
  const nomina = nominaDe({
    personas: [{ correo: "Juan.Perez@U.CL", nombre: "Juan", rol: "estudiante" }],
    inscripciones: [{ correo: "JUAN.PEREZ@u.cl", codigo: "mat1610" }],
    dictados: [],
  });

  assert.ok(nomina.every((f) => f.correo === "juan.perez@u.cl"));
  assert.ok(nomina.some((f) => f.codigo === "MAT1610"));
});

test("quien dicta va con su papel", () => {
  const nomina = nominaDe({
    personas: [{ correo: "ana@u.cl", nombre: "Ana", rol: "profesor" }],
    inscripciones: [],
    dictados: [
      { correo: "ana@u.cl", codigo: "MAT1610", papel: "profesor" },
      { correo: "ana@u.cl", codigo: "MAT1203", papel: "ayudante" },
    ],
  });

  const suyas = nomina.filter((f) => f.codigo !== null);
  assert.equal(suyas.length, 2);
  assert.deepEqual(suyas.map((f) => f.papel).sort(), ["ayudante", "profesor"]);
});

test("una fila repetida no se manda dos veces", () => {
  const nomina = nominaDe({
    personas: [{ correo: "a@u.cl", nombre: "A", rol: "estudiante" }],
    inscripciones: [
      { correo: "a@u.cl", codigo: "MAT1610" },
      { correo: "A@U.CL", codigo: "mat1610" },
    ],
    dictados: [],
  });
  assert.equal(nomina.length, 2);
});

test("sin nadie en las planillas la nómina va vacía", () => {
  assert.deepEqual(nominaDe({ personas: [], inscripciones: [], dictados: [] }), []);
});
