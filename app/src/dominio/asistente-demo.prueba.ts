import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUGERENCIAS, cursoNombrado, entender, responder,
  type CursoParaElAsistente,
} from "./asistente-demo.ts";

const enDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const alumnos = [
  { id: "a1", nombre: "Eduardo Q." },
  { id: "a2", nombre: "Josefa Pérez" },
  { id: "a3", nombre: "Matías Contreras" },
];

const CURSO: CursoParaElAsistente = {
  codigo: "MAT1610",
  nombre: "Cálculo I",
  inscritos: alumnos,
  tareas: [{
    id: "t1", titulo: "Guía 4", puntos: 20, vence_en: enDias(-1),
    entregas: [
      { id: "e1", tarea_id: "t1", estudiante_id: "a1", estudiante: "Eduardo Q.",
        entregado_en: enDias(-2), puntos_obtenidos: 18 },
      { id: "e2", tarea_id: "t1", estudiante_id: "a2", estudiante: "Josefa Pérez",
        entregado_en: enDias(-2), puntos_obtenidos: null },
    ],
  }],
  evaluaciones: [{
    id: "ev1", titulo: "Control 1", peso: 100,
    notas: [
      { evaluacion_id: "ev1", estudiante_id: "a1", estudiante: "Eduardo Q.", nota: 6.0, publicada: true },
      { evaluacion_id: "ev1", estudiante_id: "a2", estudiante: "Josefa Pérez", nota: 3.0, publicada: false },
      { evaluacion_id: "ev1", estudiante_id: "a3", estudiante: "Matías Contreras", nota: null, publicada: false },
    ],
  }],
  avance: [
    { estudiante_id: "a1", estudiante: "Eduardo Q.", hechos: 8, totales: 9, ultimo_acceso: enDias(0) },
    { estudiante_id: "a2", estudiante: "Josefa Pérez", hechos: 2, totales: 9, ultimo_acceso: enDias(-12) },
    { estudiante_id: "a3", estudiante: "Matías Contreras", hechos: 9, totales: 9, ultimo_acceso: null },
  ],
};

const preguntar = (p: string) => responder(p, [CURSO]);

// ── Entender la pregunta ────────────────────────────────────────────────

test("reconoce quién no ha entregado", () => {
  for (const p of ["¿quién no ha entregado?", "quienes faltan por entregar",
                   "a quién le falta la entrega"]) {
    assert.equal(entender(p), "sin-entregar", p);
  }
});

test("reconoce quién viene quedándose atrás", () => {
  for (const p of ["¿quién no ha estudiado?", "cómo va el avance del curso",
                   "quién no ha visto el material", "quién no se ha conectado"]) {
    assert.equal(entender(p), "sin-estudiar", p);
  }
});

test("reconoce lo que falta por corregir", () => {
  assert.equal(entender("¿qué me queda por corregir?"), "por-corregir");
  assert.equal(entender("tengo entregas sin revisar"), "por-corregir");
});

test("reconoce las preguntas por notas", () => {
  for (const p of ["¿cómo le fue al curso?", "cuál fue el promedio del control 1",
                   "cuántos aprobaron"]) {
    assert.equal(entender(p), "como-le-fue", p);
  }
});

test("reconoce a quién le va mal", () => {
  assert.equal(entender("¿quién viene en riesgo?"), "en-riesgo");
  assert.equal(entender("a quién le está yendo mal"), "en-riesgo");
});

test("una pregunta ajena no se fuerza a ninguna intención", () => {
  assert.equal(entender("¿cuál es la capital de Francia?"), null);
});

// ── Responder ───────────────────────────────────────────────────────────

test("nombra a quien no entregó, y no a quien sí", () => {
  const r = preguntar("¿quién no ha entregado?");
  assert.deepEqual(r.filas, ["Matías Contreras"]);
  assert.match(r.texto, /faltan 1 persona de 3/);
});

test("cuando entregaron todos lo dice y no lista a nadie", () => {
  const todos: CursoParaElAsistente = {
    ...CURSO,
    tareas: [{
      ...CURSO.tareas[0]!,
      entregas: alumnos.map((a, i) => ({
        id: `x${i}`, tarea_id: "t1", estudiante_id: a.id, estudiante: a.nombre,
        entregado_en: enDias(-2), puntos_obtenidos: 15,
      })),
    }],
  };
  const r = responder("¿quién no ha entregado?", [todos]);
  assert.deepEqual(r.filas, []);
  assert.match(r.texto, /Entregaron los 3/);
});

test("los rezagados salen por poco material o por no entrar", () => {
  const r = preguntar("¿quién no ha estudiado?");
  const texto = r.filas.join(" · ");
  // Josefa por material, Matías por no haber entrado nunca.
  assert.match(texto, /Josefa Pérez · 2 de 9/);
  assert.match(texto, /Matías Contreras.*nunca ha entrado/);
  // Eduardo va al día: no debería aparecer.
  assert.ok(!texto.includes("Eduardo"));
});

test("dice hace cuántos días que alguien no entra", () => {
  const r = preguntar("cómo va el avance");
  assert.match(r.filas.join(" "), /sin entrar hace 12 días/);
});

test("lista lo que falta por corregir con nombre y tarea", () => {
  const r = preguntar("¿qué me queda por corregir?");
  assert.deepEqual(r.filas, ["Josefa Pérez · Guía 4"]);
});

test("el promedio se calcula solo con las notas puestas", () => {
  const r = preguntar("¿cómo le fue al curso?");
  assert.match(r.texto, /promedio fue 4,5 y aprobaron 1 de 2/);
});

test("avisa cuando hay notas que el curso todavía no ve", () => {
  const r = preguntar("¿cómo le fue en el control 1?");
  assert.match(r.texto, /1 nota está puesta y el curso todavía no las ve/);
});

test("la distribución solo muestra los tramos con gente", () => {
  const r = preguntar("¿cómo le fue al curso?");
  assert.deepEqual(r.filas, ["3.0 a 4.0 · 1 alumno", "6.0 a 7.0 · 1 alumno"]);
});

test("quien viene bajo cuatro aparece en riesgo", () => {
  const r = preguntar("¿quién viene en riesgo?");
  assert.deepEqual(r.filas, ["Josefa Pérez · 3,0"]);
});

test("el resumen junta las tres cosas que esperan trabajo", () => {
  const r = preguntar("¿cómo va el curso en general?");
  assert.equal(r.intencion, "resumen");
  assert.deepEqual(r.filas, [
    "1 entrega por corregir",
    "1 nota sin publicar",
    "2 personas quedándose atrás",
  ]);
});

test("una pregunta que no entiende no se inventa una respuesta", () => {
  const r = preguntar("¿cuál es la capital de Francia?");
  assert.equal(r.intencion, null);
  assert.deepEqual(r.filas, []);
  assert.match(r.texto, /Todavía no sé responder eso sin servidor/);
  // Y ofrece lo que sí puede.
  assert.match(r.texto, /quién no ha entregado/);
});

test("sin ramos asignados lo dice en vez de fallar", () => {
  const r = responder("¿quién no ha entregado?", []);
  assert.match(r.texto, /Todavía no tienes ramos/);
});

// ── Elegir el curso ─────────────────────────────────────────────────────

const OTRO: CursoParaElAsistente = { ...CURSO, codigo: "FIS1503", nombre: "Física I" };

test("elige el curso que la pregunta nombra", () => {
  assert.equal(cursoNombrado("cómo va Física I", [CURSO, OTRO])?.codigo, "FIS1503");
  assert.equal(cursoNombrado("cómo va FIS1503", [CURSO, OTRO])?.codigo, "FIS1503");
});

test("sin nombrar ninguno usa el primero", () => {
  assert.equal(cursoNombrado("¿quién no ha entregado?", [CURSO, OTRO])?.codigo, "MAT1610");
});

test("el nombre del curso se reconoce sin acentos ni mayúsculas", () => {
  assert.equal(cursoNombrado("como va fisica i", [CURSO, OTRO])?.codigo, "FIS1503");
});

test("las sugerencias que se ofrecen son preguntas que sabe responder", () => {
  for (const s of SUGERENCIAS) {
    assert.notEqual(entender(s), null, s);
  }
});
