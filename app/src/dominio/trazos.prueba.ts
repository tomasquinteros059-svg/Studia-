import { strict as afirmar } from "node:assert";
import { describe, test } from "node:test";
import {
  aligerar, borrarDonde, comoCurva, dibuja, grosorEn, guardar, hayTinta, leer,
  velocidad, VERSION_TRAZOS, type Punto, type Trazo,
} from "./trazos.ts";

const p = (x: number, y: number, t = 0): Punto => ({ x, y, t });

const trazo = (extra: Partial<Trazo> = {}): Trazo => ({
  id: "t1", util: "lapiz", color: "#171C3F", grosor: 3,
  puntos: [p(0, 0), p(10, 0), p(20, 0)],
  ...extra,
});

describe("el rechazo de palma", () => {
  test("antes de ver un lápiz, el dedo escribe", () => {
    // En un teléfono sin lápiz es la única forma de escribir.
    afirmar.equal(dibuja("touch", false), true);
  });

  test("después de ver un lápiz, el dedo deja de escribir", () => {
    // La palma apoyada llega como un toque igual que un dedo: si siguiera
    // dibujando, cada renglón vendría con un borrón al lado.
    afirmar.equal(dibuja("touch", true), false);
  });

  test("el lápiz escribe siempre, haya o no habido lápiz antes", () => {
    afirmar.equal(dibuja("pen", false), true);
    afirmar.equal(dibuja("pen", true), true);
  });

  test("si no se sabe qué tocó, se dibuja", () => {
    // Hay plataformas que no informan el tipo. Negarse ahí dejaría la
    // función inútil en vez de prudente.
    afirmar.equal(dibuja("", true), true);
  });

  test("el ratón escribe aunque haya habido lápiz", () => {
    afirmar.equal(dibuja("mouse", true), true);
  });
});

describe("el grosor", () => {
  test("quieto, el trazo vale lo que dice el útil", () => {
    afirmar.equal(grosorEn(4, 0), 4);
  });

  test("rápido adelgaza, pero nunca desaparece", () => {
    const rapido = grosorEn(4, 10);
    afirmar.ok(rapido < 4, "debería ser más fino");
    afirmar.ok(rapido >= 0.5, "un trazo que desaparece se lee como que la pantalla no respondió");
  });

  test("más rápido, más fino, sin saltos", () => {
    const lento = grosorEn(4, 0.3);
    const medio = grosorEn(4, 1.1);
    const rapido = grosorEn(4, 2.2);
    afirmar.ok(lento > medio && medio > rapido);
  });

  test("la velocidad no se va a infinito con dos puntos en el mismo instante", () => {
    // Dos eventos con el mismo timestamp llegan de verdad; sin el piso de un
    // milisegundo, esto sería una división por cero.
    afirmar.ok(Number.isFinite(velocidad(p(0, 0, 5), p(30, 40, 5))));
    afirmar.equal(velocidad(p(0, 0, 0), p(3, 4, 5)), 1);
  });
});

describe("la curva", () => {
  test("sin puntos no dibuja nada", () => {
    afirmar.equal(comoCurva([]), "");
  });

  test("un solo toque es un punto, no una nada", () => {
    // Poner el lápiz y levantarlo debe dejar marca: es como se pone una tilde.
    afirmar.equal(comoCurva([p(5, 7)]), "M5,7 L5,7");
  });

  test("varios puntos salen como curvas y no como esquinas", () => {
    const d = comoCurva([p(0, 0), p(10, 10), p(20, 0), p(30, 10)]);
    afirmar.ok(d.startsWith("M0,0"));
    afirmar.ok(d.includes("Q"), "debería curvar entre puntos");
    afirmar.ok(d.endsWith("L30,10"));
  });

  test("se redondea a dos decimales, que es lo que se nota", () => {
    const d = comoCurva([p(1.23456, 2.34567)]);
    afirmar.equal(d, "M1.23,2.35 L1.23,2.35");
  });
});

describe("aligerar", () => {
  test("una recta larga queda en sus dos extremos", () => {
    const recta = Array.from({ length: 50 }, (_, i) => p(i, 0, i));
    afirmar.deepEqual(aligerar(recta).length, 2);
  });

  test("una curva conserva su forma", () => {
    const curva = Array.from({ length: 50 }, (_, i) => p(i, Math.sin(i / 4) * 20, i));
    const corta = aligerar(curva);
    afirmar.ok(corta.length > 5, "no debería aplanar una curva");
    afirmar.ok(corta.length < curva.length, "algo debería sacar");
  });

  test("empieza y termina donde empezaba y terminaba", () => {
    const puntos = [p(0, 0), p(5, 9), p(10, 1), p(15, 8), p(20, 0)];
    const corta = aligerar(puntos);
    afirmar.deepEqual(corta[0], puntos[0]);
    afirmar.deepEqual(corta[corta.length - 1], puntos[puntos.length - 1]);
  });

  test("dos puntos o menos se quedan como están", () => {
    afirmar.equal(aligerar([p(0, 0), p(1, 1)]).length, 2);
    afirmar.equal(aligerar([p(0, 0)]).length, 1);
  });
});

describe("la goma", () => {
  test("borra el trazo que se toca, entero", () => {
    // Y no un pedazo: borrar por trazo es un gesto, borrar píxeles obliga a
    // repasar con pulso fino lo que se quiere sacar.
    const quedan = borrarDonde([trazo({ id: "a" }), trazo({ id: "b", puntos: [p(200, 200)] })], 10, 0);
    afirmar.deepEqual(quedan.map((t) => t.id), ["b"]);
  });

  test("no borra lo que está lejos", () => {
    const quedan = borrarDonde([trazo()], 500, 500);
    afirmar.equal(quedan.length, 1);
  });

  test("un trazo grueso se alcanza desde un poco más lejos", () => {
    const fino = borrarDonde([trazo({ grosor: 2 })], 10, 20, 5);
    const grueso = borrarDonde([trazo({ grosor: 40 })], 10, 20, 5);
    afirmar.equal(fino.length, 1, "el fino no se alcanza");
    afirmar.equal(grueso.length, 0, "el grueso sí");
  });
});

describe("guardar y leer", () => {
  test("lo guardado vuelve igual", () => {
    const uno = [trazo({ id: "a" }), trazo({ id: "b", util: "destacador" })];
    afirmar.deepEqual(leer(guardar(uno)), uno);
  });

  test("lleva versión, para que un apunte viejo se pueda seguir abriendo", () => {
    afirmar.equal(JSON.parse(guardar([])).v, VERSION_TRAZOS);
  });

  test("una versión que no conocemos se lee como vacío, no revienta", () => {
    const futuro = JSON.stringify({ v: 99, trazos: [trazo()] });
    afirmar.deepEqual(leer(futuro), []);
  });

  test("basura no tumba la pantalla", () => {
    // El apunte todavía tiene su texto: perder la pantalla entera por unos
    // trazos ilegibles sería perder también lo que sí está bien.
    for (const malo of ["", "{", "null", "[]", '{"v":1}', '{"v":1,"trazos":"no"}']) {
      afirmar.deepEqual(leer(malo), []);
    }
    afirmar.deepEqual(leer(null), []);
    afirmar.deepEqual(leer(undefined), []);
  });

  test("descarta el trazo mal formado y conserva los demás", () => {
    const mezcla = JSON.stringify({
      v: VERSION_TRAZOS,
      trazos: [trazo({ id: "bueno" }), { id: "malo" }, { ...trazo(), util: "pincel" }],
    });
    afirmar.deepEqual(leer(mezcla).map((t) => t.id), ["bueno"]);
  });

  test("saber si hay algo dibujado", () => {
    afirmar.equal(hayTinta([]), false);
    afirmar.equal(hayTinta([trazo()]), true);
  });
});
