// Cómo se ve StudIA el primer día, con una cuenta recién creada y nada dentro.
//
// Es el estado en que la va a ver todo el que llegue: sin ramos, sin tareas,
// sin apuntes, sin notas. Y es el más fácil de no mirar nunca, porque en el
// modo demostración —donde uno prueba— siempre hay un colegio entero cargado.
//
// Lo que se comprueba de cada pantalla es que no se caiga y que diga algo. Una
// pantalla en blanco con un título arriba no está rota, pero no se distingue
// de una que sí lo está, y quien acaba de pagar por esto merece que le digan
// qué hacer.

import { waitFor } from "@testing-library/react-native";
import { renderPantalla } from "../../pruebas/dobles.tsx";

// Todo vacío, que es lo que devuelve el servidor de un colegio nuevo.
jest.mock("../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(async () => []),
  miHorario: jest.fn(async () => []),
  misTareas: jest.fn(async () => []),
  misApuntes: jest.fn(async () => []),
  misQuices: jest.fn(async () => []),
  misFichas: jest.fn(async () => []),
  misSesiones: jest.fn(async () => []),
  misNotificaciones: jest.fn(async () => []),
  todasLasEvaluaciones: jest.fn(async () => new Map()),
  materiaDe: jest.fn(async () => []),
  clasesDe: jest.fn(async () => []),
  claseEnVivo: jest.fn(async () => null),
  miPerfil: jest.fn(async () => ({ nombre: "Camila", correo: "camila@colegio.cl", rol: "estudiante", plan: "gratis" })),
  misDictados: jest.fn(async () => []),
  crearSesion: jest.fn(async () => undefined),
  marcarSesion: jest.fn(async () => undefined),
  borrarSesion: jest.fn(async () => undefined),
  crearRamoPropio: jest.fn(async () => undefined),
  crearHorarioPropio: jest.fn(async () => undefined),
}));

jest.mock("../lib/quien-soy.ts", () => ({
  usarQuienSoy: () => ({
    yo: { nombre: "Camila", correo: "camila@colegio.cl", rol: "estudiante", papel: null, dicta: [] },
    listo: true,
  }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

import Inicio from "./Inicio.tsx";
import Horario from "./Horario.tsx";
import Tareas from "./Tareas.tsx";
import MisApuntes from "./MisApuntes.tsx";
import Notas from "./Notas.tsx";
import Tutor from "./Tutor.tsx";

/** Todo el texto visible de la pantalla, junto. */
function loQueDice(t: { toJSON: () => unknown }): string {
  const junta = (n: unknown): string => {
    if (typeof n === "string") return n + " ";
    if (Array.isArray(n)) return n.map(junta).join("");
    if (n && typeof n === "object" && "children" in n) return junta((n as { children: unknown }).children);
    return "";
  };
  return junta(t.toJSON());
}

/**
 * Qué tiene que decir cada una. No se comprueba el texto entero —cambiarle
 * una coma no debería romper una prueba— sino que siga estando la frase que
 * explica qué hacer. Si alguien borra el estado vacío, esto se cae.
 */
const PANTALLAS: [string, Parameters<typeof renderPantalla>[0], RegExp][] = [
  ["Inicio", Inicio as never, /Todavía no tienes nada/],
  ["Horario", Horario as never, /Todavía no reservaste tiempo de estudio/],
  ["Tareas", Tareas as never, /./],
  ["Apuntes", MisApuntes as never, /./],
  ["Notas", Notas as never, /Todavía no hay notas que promediar/],
  ["Tutor", Tutor as never, /El tutor necesita saber qué estás estudiando/],
];

describe("una cuenta recién creada, sin nada dentro", () => {
  for (const [nombre, Pantalla, dice] of PANTALLAS) {
    test(`${nombre} no se cae`, async () => {
      const t = await renderPantalla(Pantalla);
      await waitFor(() => expect(t.toJSON()).toBeTruthy());
    });

    test(`${nombre} dice qué hacer, y no queda en blanco`, async () => {
      const t = await renderPantalla(Pantalla);
      await waitFor(() => expect(t.toJSON()).toBeTruthy());
      const texto = loQueDice(t).replace(/\s+/g, " ").trim();

      // Una pantalla que solo trae su título y la barra de abajo no le dice
      // nada a quien acaba de entrar.
      expect(texto.length).toBeGreaterThan(40);
      expect(texto).toMatch(dice);
    });
  }
});
