import { strict as afirmar } from "node:assert";
import { describe, test } from "node:test";
import {
  comoQuedaElMes, comoSeLee, comoTexto, deLaSemana, lunesDe, nombreDelMes,
  proponer, semanasDelMes,
} from "./planificacion.ts";

const unidad = (id: string, titulo: string, cuantos = 3) =>
  ({ id, titulo, materiales: Array.from({ length: cuantos }, (_, i) => i) });

describe("las semanas", () => {
  test("el lunes de una semana cualquiera", () => {
    // Miércoles 2 de septiembre de 2026.
    afirmar.equal(lunesDe(new Date(2026, 8, 2)).getDate(), 31);
  });

  test("el domingo pertenece a la semana que ya empezó, no a la que viene", () => {
    // Domingo 6 de septiembre de 2026 → lunes 31 de agosto.
    const l = lunesDe(new Date(2026, 8, 6));
    afirmar.equal(l.getDate(), 31);
    afirmar.equal(l.getMonth(), 7);
  });

  test("un lunes se queda donde está", () => {
    afirmar.equal(lunesDe(new Date(2026, 8, 7)).getDate(), 7);
  });

  test("una semana pertenece al mes en que cae su lunes", () => {
    // Si se contaran por días, la del 31 de agosto saldría en agosto y en
    // septiembre, y planificar dos veces lo mismo es peor que no planificarlo.
    const septiembre = semanasDelMes(2026, 8);
    afirmar.ok(septiembre.every((s) => s.empieza.getMonth() === 8));
  });

  test("las semanas van numeradas desde uno y son consecutivas", () => {
    const s = semanasDelMes(2026, 8);
    afirmar.deepEqual(s.map((x) => x.numero), s.map((_, i) => i + 1));
    for (let i = 1; i < s.length; i++) {
      const dias = (s[i]!.empieza.getTime() - s[i - 1]!.empieza.getTime()) / 86_400_000;
      afirmar.equal(dias, 7);
    }
  });

  test("cada semana dura siete días", () => {
    for (const s of semanasDelMes(2026, 8)) {
      afirmar.equal((s.termina.getTime() - s.empieza.getTime()) / 86_400_000, 6);
    }
  });

  test("se lee como se dice, y también cuando cruza de mes", () => {
    const s = semanasDelMes(2026, 8);
    afirmar.match(comoSeLee(s[0]!), /de septiembre/);
    const ultima = s[s.length - 1]!;
    // La última de septiembre de 2026 empieza el 28 y termina en octubre.
    afirmar.match(comoSeLee(ultima), /septiembre al .* de octubre/);
  });

  test("los meses tienen nombre en castellano", () => {
    afirmar.equal(nombreDelMes(0), "enero");
    afirmar.equal(nombreDelMes(8), "septiembre");
  });
});

describe("la propuesta", () => {
  const semanas = semanasDelMes(2026, 8);   // cuatro semanas

  test("con menos unidades que semanas, una por semana y el resto libre", () => {
    // Llenar el mes estirando materia sería inventarle trabajo a alguien.
    const bloques = proponer([unidad("u1", "Límites"), unidad("u2", "Derivadas")], semanas);
    afirmar.deepEqual(bloques.map((b) => b.semana), [1, 2]);
  });

  test("con más unidades que semanas, se agrupan sin salirse del mes", () => {
    const muchas = ["a", "b", "c", "d", "e", "f", "g"].map((x) => unidad(x, x.toUpperCase()));
    const bloques = proponer(muchas, semanas);
    afirmar.equal(bloques.length, 7);
    afirmar.ok(bloques.every((b) => b.semana >= 1 && b.semana <= semanas.length));
  });

  test("cada bloque recuerda de qué unidad salió", () => {
    const bloques = proponer([unidad("u1", "Límites")], semanas);
    afirmar.equal(bloques[0]!.modulo_id, "u1");
  });

  test("dice cuántos recursos trae, en singular cuando es uno", () => {
    afirmar.match(proponer([unidad("u1", "Límites", 1)], semanas)[0]!.detalle, /1 recurso\b/);
    afirmar.match(proponer([unidad("u1", "Límites", 4)], semanas)[0]!.detalle, /4 recursos/);
  });

  test("sin unidades o sin semanas no propone nada", () => {
    afirmar.deepEqual(proponer([], semanas), []);
    afirmar.deepEqual(proponer([unidad("u1", "Límites")], []), []);
  });
});

describe("cómo queda el mes", () => {
  test("cuando aprieta, se dice y se deja la decisión al profesor", () => {
    // Qué corre y qué no es decisión suya, y no se toma sola.
    afirmar.match(comoQuedaElMes(6, 4), /6 unidades en 4 semanas/);
    afirmar.match(comoQuedaElMes(6, 4), /Mira si alcanza/);
  });

  test("cuando sobra, también: es información, no un error", () => {
    afirmar.match(comoQuedaElMes(2, 4), /2 semanas libres/);
  });

  test("una semana libre se dice en singular", () => {
    afirmar.match(comoQuedaElMes(3, 4), /1 semana libre/);
  });

  test("cuando calza, se dice que calza", () => {
    afirmar.match(comoQuedaElMes(4, 4), /calza justo/);
  });

  test("sin unidades no se habla de semanas libres", () => {
    afirmar.match(comoQuedaElMes(0, 4), /todavía no tiene unidades/);
  });
});

describe("pasarle el plan al asistente", () => {
  const semanas = semanasDelMes(2026, 8);

  test("va en texto, como se lo mostrarías a un colega", () => {
    const bloques = proponer([unidad("u1", "Límites"), unidad("u2", "Derivadas")], semanas);
    const texto = comoTexto("Cálculo I", 2026, 8, semanas, bloques);

    afirmar.match(texto, /Plan de Cálculo I para septiembre de 2026/);
    afirmar.match(texto, /Semana 1 .*: Límites/);
  });

  test("las semanas vacías se dicen vacías, no se omiten", () => {
    // Que falte algo en una semana es justo lo que se quiere conversar.
    const texto = comoTexto("Cálculo I", 2026, 8, semanas, []);
    afirmar.match(texto, /sin nada planificado/);
  });

  test("se puede pedir lo de una semana suelta", () => {
    const bloques = proponer([unidad("u1", "Límites"), unidad("u2", "Derivadas")], semanas);
    afirmar.deepEqual(deLaSemana(bloques, 2).map((b) => b.titulo), ["Derivadas"]);
  });
});
