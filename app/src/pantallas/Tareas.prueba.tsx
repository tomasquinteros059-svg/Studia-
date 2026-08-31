import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RAMO, TAREA_PENDIENTE, renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  misTareas: jest.fn(), misAsignaturas: jest.fn(), materiaDe: jest.fn(),
}));
jest.mock("../lib/quiz.ts", () => ({ generarQuiz: jest.fn() }));

import * as consultas from "../lib/consultas.ts";
import * as quizLib from "../lib/quiz.ts";
import Tareas from "./Tareas.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockQuiz = quizLib as jest.Mocked<typeof quizLib>;

const MODULO = {
  id: "m-1", titulo: "Límites y continuidad", orden: 1,
  materiales: [{ id: "mat-1", titulo: "Apunte de límites", tipo: "lectura" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mock.misTareas.mockResolvedValue([TAREA_PENDIENTE] as never);
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.materiaDe.mockResolvedValue([MODULO] as never);
  mockQuiz.generarQuiz.mockResolvedValue({ id: "q-1" } as never);
});

const abrir = async () => {
  const t = await renderPantalla(Tareas, undefined);
  await waitFor(() => expect(t.getByText(TAREA_PENDIENTE.titulo)).toBeTruthy());
  return t;
};

const armar = async (t: Awaited<ReturnType<typeof abrir>>) => {
  await act(async () => {
    fireEvent.press(t.getByLabelText("Crear un quiz con mi material"));
  });
};

describe("las tareas", () => {
  test("los filtros siguen filtrando, y el botón nuevo no es uno de ellos", async () => {
    const t = await abrir();

    // Un botón que parece filtro y no filtra es de las cosas que hacen que
    // alguien deje de confiar en una barra entera.
    for (const f of ["Pendientes", "Entregadas", "Todas"]) {
      expect(t.getByRole("tab", { name: f })).toBeTruthy();
    }
    expect(t.getByRole("button", { name: "Crear un quiz con mi material" })).toBeTruthy();
    expect(t.queryByRole("tab", { name: /Crear quiz/ })).toBeNull();
  });

  test("crear quiz pregunta primero de qué ramo", async () => {
    const t = await abrir();
    await armar(t);

    expect(t.getByText("¿De qué te tomo la prueba?")).toBeTruthy();
    expect(t.getByLabelText(`Quiz de ${RAMO.nombre}`)).toBeTruthy();
    // Todavía no pide la materia de nada: sería traer los seis ramos para que
    // alguien elija uno.
    expect(mock.materiaDe).not.toHaveBeenCalled();
  });

  test("elegido el ramo, ofrece sus temas", async () => {
    const t = await abrir();
    await armar(t);
    await act(async () => { fireEvent.press(t.getByLabelText(`Quiz de ${RAMO.nombre}`)); });

    await waitFor(() => expect(mock.materiaDe).toHaveBeenCalledWith(RAMO.id));
    expect(t.getByLabelText("Ponerme a prueba en Límites y continuidad")).toBeTruthy();
  });

  test("elegido el tema, arma el quiz con ese material y lo abre", async () => {
    const t = await abrir();
    await armar(t);
    await act(async () => { fireEvent.press(t.getByLabelText(`Quiz de ${RAMO.nombre}`)); });
    await waitFor(() => expect(t.getByLabelText("Ponerme a prueba en Límites y continuidad")).toBeTruthy());

    await act(async () => {
      fireEvent.press(t.getByLabelText("Ponerme a prueba en Límites y continuidad"));
    });

    await waitFor(() => expect(mockQuiz.generarQuiz).toHaveBeenCalledWith({
      moduloId: MODULO.id, asignaturaId: RAMO.id, tema: MODULO.titulo,
    }));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Quiz",
      expect.objectContaining({ quizId: "q-1" }));
  });

  test("un tema sin material no se ofrece", async () => {
    // Ofrecerlo sería ofrecer un botón que falla: sin material no hay de qué
    // sacar preguntas.
    mock.materiaDe.mockResolvedValue([
      MODULO, { id: "m-2", titulo: "Unidad vacía", orden: 2, materiales: [] },
    ] as never);

    const t = await abrir();
    await armar(t);
    await act(async () => { fireEvent.press(t.getByLabelText(`Quiz de ${RAMO.nombre}`)); });

    await waitFor(() => expect(t.getByLabelText("Ponerme a prueba en Límites y continuidad")).toBeTruthy());
    expect(t.queryByLabelText("Ponerme a prueba en Unidad vacía")).toBeNull();
  });

  test("un ramo sin nada de material lo dice, en vez de una lista vacía", async () => {
    mock.materiaDe.mockResolvedValue([] as never);

    const t = await abrir();
    await armar(t);
    await act(async () => { fireEvent.press(t.getByLabelText(`Quiz de ${RAMO.nombre}`)); });

    await waitFor(() => expect(t.getByText(/todavía no tiene material/)).toBeTruthy());
    expect(t.getByText("Elegir otro ramo")).toBeTruthy();
  });

  test("dice de dónde salen las preguntas", async () => {
    // Es lo que lo distingue de un quiz genérico de internet.
    const t = await abrir();
    await armar(t);
    expect(t.getByText(/de tu propio material/)).toBeTruthy();
  });
});
