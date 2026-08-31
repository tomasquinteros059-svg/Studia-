import { strict as afirmar } from "node:assert";
import { describe, test } from "node:test";
import {
  acuerdo, comoQuedo, comoReloj, comoTexto, duracion, IGUALES, normalizar,
  parecido, unir, type Tramo,
} from "./escucha.ts";

const t = (aparato: string, segundo: number, texto: string, confianza = -1): Tramo =>
  ({ aparato, segundo, texto, confianza });

describe("normalizar", () => {
  test("saca tildes, puntuación y mayúsculas", () => {
    // Un reconocedor escribe «derivable» y otro «derivable,»: comparar en
    // crudo haría que dos aparatos que oyeron lo mismo se contaran como si
    // discreparan, que es justo al revés de lo que esto viene a hacer.
    afirmar.equal(normalizar("El teorema del VALOR medio, ¿sí?"), "el teorema del valor medio si");
    afirmar.equal(normalizar("continuación  derivación"), "continuacion derivacion");
  });

  test("la eñe se queda, porque es una letra", () => {
    afirmar.equal(normalizar("mañana"), "mañana");
  });
});

describe("parecido", () => {
  test("la misma frase con otra puntuación es la misma frase", () => {
    afirmar.equal(parecido("el teorema del valor medio", "El teorema del valor medio."), 1);
  });

  test("dos frases distintas no se parecen", () => {
    afirmar.equal(parecido("el teorema del valor medio", "mañana hay control de física"), 0);
  });

  test("perderse una palabra sigue siendo la misma frase", () => {
    afirmar.ok(parecido(
      "existe un punto donde la derivada vale la pendiente",
      "existe un punto donde la derivada vale pendiente",
    ) >= IGUALES);
  });

  test("dos vacíos son iguales, y uno vacío no se parece a nada", () => {
    afirmar.equal(parecido("", ""), 1);
    afirmar.equal(parecido("", "algo dicho"), 0);
  });
});

describe("las ventanas", () => {
  test("unos segundos de desfase siguen siendo el mismo momento", () => {
    // Ninguno marca el mismo segundo: uno empieza a oír antes, otro corta en
    // un silencio y arranca tarde.
    const clase = unir([
      t("a", 11, "el teorema del valor medio"),
      t("b", 12, "el teorema del valor medio"),
      t("c", 14, "el teorema del valor medio"),
    ]);
    afirmar.equal(clase.length, 1, "se partió en varias la misma frase");
    afirmar.equal(clase[0]!.votos, 3);
  });

  test("dos momentos distintos de la clase no se mezclan", () => {
    const clase = unir([
      t("a", 10, "el teorema del valor medio"),
      t("b", 200, "mañana hay control"),
    ]);
    afirmar.equal(clase.length, 2);
  });
});

describe("cruzar lo que oyeron varios", () => {
  test("gana lo que oyó la mayoría, no lo que oyó el primero", () => {
    const clase = unir([
      t("a", 10, "el problema del valor medio"),
      t("b", 11, "el teorema del valor medio"),
      t("c", 12, "el teorema del valor medio"),
      t("d", 10, "el teorema del valor medio"),
    ]);

    afirmar.equal(clase.length, 1);
    afirmar.match(clase[0]!.texto, /teorema/);
    afirmar.equal(clase[0]!.votos, 3);
    afirmar.equal(clase[0]!.deCuantos, 4);
  });

  test("con un empate decide la confianza del reconocedor", () => {
    const clase = unir([
      t("a", 10, "derivable en el abierto", 0.4),
      t("b", 10, "the river en el abierto", 0.9),
    ]);
    // Son dos versiones distintas y un voto cada una: manda la confianza.
    afirmar.match(clase[0]!.texto, /the river/);
  });

  test("sin confianza, el que se perdió menos palabras", () => {
    const clase = unir([
      t("a", 10, "existe un punto"),
      t("b", 10, "existe un punto donde la derivada vale la pendiente media"),
    ]);
    afirmar.match(clase[0]!.texto, /pendiente media/);
  });

  test("entrega la versión de alguien, no un cosido de todas", () => {
    // Coser pedazos de cinco transcripciones da frases que nadie dijo, y una
    // frase inventada en el apunte de una clase es peor que una con un error.
    const dichas = [
      "hay que revisar la guía cuatro",
      "hay que revisar la guía cuatro para el control",
      "hay que revisar la guía cuatro",
    ];
    const clase = unir(dichas.map((d, i) => t(`ap${i}`, 30, d)));
    afirmar.ok(dichas.includes(clase[0]!.texto), `salió algo que nadie dijo: ${clase[0]!.texto}`);
  });

  test("un aparato solo también deja clase, y se nota que va solo", () => {
    const clase = unir([t("a", 0, "buenos días, partamos")]);
    afirmar.equal(clase[0]!.votos, 1);
    afirmar.equal(clase[0]!.deCuantos, 1);
  });

  test("el mismo aparato repitiéndose no se vota a sí mismo", () => {
    // Si un teléfono manda el mismo tramo dos veces —una reanudación, un
    // reintento— no puede ganarle a lo que oyeron dos aparatos distintos.
    const clase = unir([
      t("a", 10, "esto lo dijo uno solo"),
      t("a", 11, "esto lo dijo uno solo"),
      t("b", 10, "esto lo oyeron dos personas"),
      t("c", 12, "esto lo oyeron dos personas"),
    ]);
    afirmar.match(clase[0]!.texto, /dos personas/);
    afirmar.equal(clase[0]!.votos, 2);
  });

  test("la clase sale en orden, aunque los tramos lleguen revueltos", () => {
    const clase = unir([
      t("a", 120, "y eso entra en el control"),
      t("b", 0, "buenos días"),
      t("a", 60, "vamos con el contraejemplo"),
    ]);
    afirmar.deepEqual(clase.map((c) => c.segundo), [0, 60, 120]);
  });

  test("los tramos en blanco no ocupan lugar", () => {
    const clase = unir([t("a", 10, "   "), t("b", 10, "algo de verdad")]);
    afirmar.equal(clase.length, 1);
    afirmar.equal(clase[0]!.texto, "algo de verdad");
  });

  test("sin nada oído, no hay clase", () => {
    afirmar.deepEqual(unir([]), []);
  });
});

describe("qué se puede decir de la clase", () => {
  const clase = unir([
    t("a", 0, "buenos días"), t("b", 0, "buenos días"),
    t("a", 60, "esto lo oyó uno solo"),
  ]);

  test("el texto corrido es lo que se le manda al resumen", () => {
    afirmar.equal(comoTexto(clase), "buenos días esto lo oyó uno solo");
  });

  test("el acuerdo cuenta los tramos que más de uno corroboró", () => {
    afirmar.equal(acuerdo(clase), 0.5);
  });

  test("con un solo teléfono se dice que no hay con qué contrastar", () => {
    // No está mal, pero no está corroborada por nadie, y quien la lea debería
    // saberlo antes de estudiar de ahí.
    afirmar.match(comoQuedo(clase, 1), /un solo teléfono/);
  });

  test("con varios se dice cuántos y cuánto coincidieron", () => {
    afirmar.match(comoQuedo(clase, 4), /4 teléfonos/);
    afirmar.match(comoQuedo(clase, 4), /50%/);
  });

  test("sin nada oído se dice eso, y no un 0% que suena a nota", () => {
    afirmar.match(comoQuedo([], 5), /No se alcanzó a oír/);
  });

  test("el reloj de cada tramo", () => {
    afirmar.equal(comoReloj(0), "00:00");
    afirmar.equal(comoReloj(83), "01:23");
    afirmar.equal(comoReloj(3600), "60:00");
  });

  test("la duración sale del último tramo, no de cuánto estuvo prendido", () => {
    // Si alguien deja el modo escucha corriendo después de que terminó la
    // clase, la clase no dura más.
    afirmar.equal(duracion(clase), 1);
    afirmar.equal(duracion([]), 0);
  });
});
