// El asistente del docente con el servidor conectado.
//
// Aparte de Asistente.prueba.tsx porque ahí se prueba el camino de la
// demostración, que necesita el módulo de verdad; acá se reemplaza por un
// doble para poder mirar qué se le pidió.
//
// Vale la pena tener estas pruebas: durante un tiempo la pantalla contestaba
// siempre con la lógica del aparato, incluso conectada. El comentario del
// código decía que con servidor la pregunta iba a la función, y la llamada no
// estaba escrita. Se veía bien —contestaba, y con datos de verdad— pero era
// otro asistente: sin Claude y sin búsqueda.

import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RAMO, renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(), misTareas: jest.fn(),
  evaluacionesDe: jest.fn(), materiaDe: jest.fn(),
  cursoDe: jest.fn(), entregasDe: jest.fn(), notasDe: jest.fn(), avanceDe: jest.fn(),
  entregasDeVarias: jest.fn(), notasDeVarias: jest.fn(),
}));

jest.mock("../../lib/asistente.ts", () => ({
  preguntarAlAsistente: jest.fn(),
  TURNOS_QUE_VIAJAN: 20,
}));

jest.mock("../../lib/quien-soy.ts", () => ({
  usarQuienSoy: () => ({
    yo: { nombre: "Ana Ríos", correo: "ana@studia.cl", rol: "profesor",
          papel: "profesor", dicta: ["r-cal"] },
    listo: true,
  }),
}));

jest.mock("../../lib/config.ts", () => ({
  MODO_DEMO: false,
  hayBackend: true,
  URL_SUPABASE: "https://pruebas.supabase.co", CLAVE_ANON: "clave", AVISO_DEMO: "",
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 420, height: 900, scale: 2, fontScale: 1 }),
}));

import * as consultas from "../../lib/consultas.ts";
import * as cliente from "../../lib/asistente.ts";
import Asistente from "./Asistente.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const asistente = cliente as jest.Mocked<typeof cliente>;

beforeEach(() => {
  jest.clearAllMocks();
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  asistente.preguntarAlAsistente.mockResolvedValue(
    { texto: "Josefa Pérez no ha entregado la guía 3.", filas: [], intencion: null } as never,
  );
});

const abrir = async () => {
  const t = await renderPantalla(Asistente, {});
  await waitFor(() => expect(t.getByText("Pregúntame por tu curso")).toBeTruthy());
  return t;
};

const preguntar = async (t: Awaited<ReturnType<typeof abrir>>, texto: string) => {
  await act(async () => {
    fireEvent.changeText(t.getByLabelText("Pregunta al asistente"), texto);
  });
  await act(async () => { fireEvent.press(t.getByLabelText("Preguntar")); });
};

describe("el asistente del docente, conectado", () => {
  test("la pregunta va a la función y la respuesta se ve en el hilo", async () => {
    const t = await abrir();
    await preguntar(t, "¿quién no ha entregado?");

    await waitFor(() => expect(asistente.preguntarAlAsistente).toHaveBeenCalledWith(
      expect.objectContaining({ pregunta: "¿quién no ha entregado?" }),
    ));
    await waitFor(() =>
      expect(t.getByText("Josefa Pérez no ha entregado la guía 3.")).toBeTruthy());
  });

  test("no se traen los datos del curso: los busca el servidor", async () => {
    const t = await abrir();
    await preguntar(t, "¿quién no ha entregado?");
    await waitFor(() => expect(asistente.preguntarAlAsistente).toHaveBeenCalled());

    // Eran decenas de consultas —el curso, las tareas, las entregas de cada
    // tarea— para dejarlas sin usar.
    expect(mock.misAsignaturas).not.toHaveBeenCalled();
    expect(mock.misTareas).not.toHaveBeenCalled();
  });

  test("lo dicho antes viaja como contexto de la pregunta siguiente", async () => {
    const t = await abrir();
    await preguntar(t, "¿quién no ha entregado?");
    await waitFor(() => expect(t.getByText("Josefa Pérez no ha entregado la guía 3.")).toBeTruthy());

    asistente.preguntarAlAsistente.mockResolvedValue(
      { texto: "En Álgebra están todos al día.", filas: [], intencion: null } as never,
    );
    await preguntar(t, "¿y en el otro ramo?");

    await waitFor(() => expect(asistente.preguntarAlAsistente).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pregunta: "¿y en el otro ramo?",
        turnos: [
          { role: "user", content: "¿quién no ha entregado?" },
          { role: "assistant", content: "Josefa Pérez no ha entregado la guía 3." },
        ],
      }),
    ));
  });

  test("si la función falla, el motivo se lee en el hilo y la pregunta sigue ahí", async () => {
    asistente.preguntarAlAsistente.mockRejectedValue(
      new Error("Vas muy rápido. Espera un momento.") as never,
    );
    const t = await abrir();
    await preguntar(t, "¿quién no ha entregado?");

    await waitFor(() => expect(t.getByText("Vas muy rápido. Espera un momento.")).toBeTruthy());
    // La pregunta no se borra: así se ve a cuál no se pudo contestar.
    expect(t.getByText("¿quién no ha entregado?")).toBeTruthy();
  });

  test("después de fallar se puede volver a preguntar", async () => {
    asistente.preguntarAlAsistente.mockRejectedValueOnce(
      new Error("El asistente no está disponible en este momento.") as never,
    );
    const t = await abrir();
    await preguntar(t, "primera");
    await waitFor(() =>
      expect(t.getByText("El asistente no está disponible en este momento.")).toBeTruthy());

    await preguntar(t, "segunda");
    await waitFor(() =>
      expect(t.getByText("Josefa Pérez no ha entregado la guía 3.")).toBeTruthy());
  });
});
