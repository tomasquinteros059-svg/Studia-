import { strict as afirmar } from "node:assert";
import { describe, test } from "node:test";
import { buscarMaterial, comoSeResume, contarPorTipo, juntarMaterial } from "./biblioteca.ts";

const mat = (id: string, titulo: string, tipo: "video" | "documento" | "ejercicios", orden: number) =>
  ({ id, titulo, detalle: `${orden} min`, tipo, orden });

const RAMOS = [
  {
    id: "cal", nombre: "Cálculo I",
    modulos: [
      { id: "u1", titulo: "Límites", materiales: [mat("m2", "Ejercicios de límites", "ejercicios", 2), mat("m1", "Idea de límite", "video", 1)] },
      { id: "u2", titulo: "La derivada", materiales: [mat("m3", "Regla de la cadena", "video", 1)] },
    ],
  },
  {
    id: "alg", nombre: "Álgebra Lineal",
    modulos: [{ id: "u3", titulo: "Bases", materiales: [mat("m4", "Apunte de bases", "documento", 1)] }],
  },
];

describe("juntar el material", () => {
  test("aplana todos los ramos en una lista", () => {
    afirmar.equal(juntarMaterial(RAMOS).length, 4);
  });

  test("cada pieza sabe de qué ramo y de qué unidad salió", () => {
    const uno = juntarMaterial(RAMOS).find((p) => p.id === "m3")!;
    afirmar.equal(uno.ramo, "Cálculo I");
    afirmar.equal(uno.unidad, "La derivada");
  });

  test("respeta el orden que le dio el profesor, no el de llegada", () => {
    // Ese orden es una decisión suya; reordenarlo sería reemplazar su criterio.
    const deLimites = juntarMaterial(RAMOS).filter((p) => p.unidad === "Límites");
    afirmar.deepEqual(deLimites.map((p) => p.id), ["m1", "m2"]);
  });

  test("sin ramos no hay lista, y nada revienta", () => {
    afirmar.deepEqual(juntarMaterial([]), []);
  });
});

describe("buscar", () => {
  const todo = juntarMaterial(RAMOS);

  test("por título", () => {
    afirmar.deepEqual(buscarMaterial(todo, "cadena").map((p) => p.id), ["m3"]);
  });

  test("por unidad y por ramo, que son otras dos maneras de acordarse", () => {
    afirmar.equal(buscarMaterial(todo, "Bases").length, 1);
    afirmar.equal(buscarMaterial(todo, "Cálculo").length, 3);
  });

  test("sin tildes ni mayúsculas encuentra igual", () => {
    // Quien busca «calculo» quiere encontrar «Cálculo».
    afirmar.equal(buscarMaterial(todo, "calculo").length, 3);
    afirmar.equal(buscarMaterial(todo, "LIMITES").length, 2);
  });

  test("una búsqueda vacía devuelve todo, no nada", () => {
    afirmar.equal(buscarMaterial(todo, "   ").length, 4);
  });

  test("lo que no está, no aparece", () => {
    afirmar.deepEqual(buscarMaterial(todo, "termodinámica"), []);
  });
});

describe("cómo se resume", () => {
  test("cuenta por tipo", () => {
    afirmar.deepEqual(contarPorTipo(juntarMaterial(RAMOS)),
      { video: 2, documento: 1, ejercicios: 1 });
  });

  test("dice singular cuando es uno", () => {
    // «1 videos» es de las cosas que hacen que una pantalla se vea sin terminar.
    const dicho = comoSeResume(juntarMaterial(RAMOS));
    afirmar.match(dicho, /2 videos/);
    afirmar.match(dicho, /1 lectura\b/);
    afirmar.match(dicho, /1 guía\b/);
  });

  test("sin material lo dice, en vez de una fila de ceros", () => {
    afirmar.match(comoSeResume([]), /Todavía no has subido material/);
  });
});
