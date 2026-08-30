import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  quizPorId: jest.fn(),
  responderQuiz: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import Quiz from "./Quiz.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const P = (correcta: number, pregunta: string) => ({
  pregunta,
  opciones: ["Alfa", "Beta", "Gama", "Delta"],
  correcta,
  explicacion: `Es porque ${pregunta.toLowerCase()} funciona así.`,
});

const QUIZ = {
  id: "q-1",
  asignatura_id: "r-cal",
  tema: "Integrales",
  preguntas: [P(1, "Primera"), P(0, "Segunda"), P(3, "Tercera")],
  respuestas: [] as (number | null)[],
  terminado_en: null as string | null,
  creado_en: new Date().toISOString(),
};

const abrir = async (quiz = QUIZ) => {
  mock.quizPorId.mockResolvedValue(quiz as never);
  mock.responderQuiz.mockResolvedValue(undefined as never);
  const t = await renderPantalla(Quiz, { quizId: quiz.id });
  await waitFor(() => expect(mock.quizPorId).toHaveBeenCalledWith(quiz.id));
  return t;
};

/** Responder la de turno y pasar a la siguiente. */
const contestar = async (t: Awaited<ReturnType<typeof abrir>>, letra: string, seguir = true) => {
  await act(async () => { fireEvent.press(t.getByLabelText(new RegExp(`^${letra}\\.`))); });
  if (seguir) {
    await act(async () => {
      fireEvent.press(t.getByText(/Siguiente|Ver cómo me fue/));
    });
  }
};

beforeEach(() => jest.clearAllMocks());

describe("el quiz", () => {
  test("empieza en la primera pregunta y dice dónde vas", async () => {
    const t = await abrir();

    expect(t.getByText("Pregunta 1 de 3")).toBeTruthy();
    expect(t.getByText("Primera")).toBeTruthy();
    expect(t.getByText("Repaso · Integrales")).toBeTruthy();
    // Todavía no se muestra ninguna explicación.
    expect(t.queryByText(/funciona así/)).toBeNull();
  });

  test("un quiz a medias se retoma donde quedó, no desde el principio", async () => {
    const t = await abrir({ ...QUIZ, respuestas: [1, 0] });
    expect(t.getByText("Pregunta 3 de 3")).toBeTruthy();
    expect(t.getByText("Tercera")).toBeTruthy();
  });

  test("al responder se explica al momento, sin esperar al final", async () => {
    const t = await abrir();

    await act(async () => { fireEvent.press(t.getByLabelText("B. Beta")); });

    expect(t.getByText(/Es porque primera funciona así/)).toBeTruthy();
    expect(t.getByText("Bien.")).toBeTruthy();
  });

  test("al equivocarse se dice cuál era la correcta, que es lo que hacía falta", async () => {
    const t = await abrir();

    await act(async () => { fireEvent.press(t.getByLabelText("C. Gama")); });

    expect(t.getByText("La correcta era otra.")).toBeTruthy();
    // La buena queda marcada aunque no se haya elegido.
    expect(t.getByLabelText("B. Beta").props.accessibilityState.disabled).toBe(true);
  });

  test("una respuesta ya dada no se puede cambiar", async () => {
    const t = await abrir();

    await act(async () => { fireEvent.press(t.getByLabelText("C. Gama")); });
    await act(async () => { fireEvent.press(t.getByLabelText("B. Beta")); });

    // Sigue siendo la equivocada: la segunda apretada no hizo nada.
    await waitFor(() => expect(mock.responderQuiz).toHaveBeenCalledTimes(1));
    expect(mock.responderQuiz).toHaveBeenCalledWith("q-1", [2, null, null], false);
  });

  test("cada respuesta se guarda apenas se da, para poder salir a medias", async () => {
    const t = await abrir();

    await contestar(t, "B");
    await waitFor(() => expect(mock.responderQuiz).toHaveBeenCalledWith("q-1", [1, null, null], false));

    await contestar(t, "A");
    await waitFor(() => expect(mock.responderQuiz).toHaveBeenCalledWith("q-1", [1, 0, null], false));
  });

  test("al responder la última, el quiz queda marcado como terminado", async () => {
    const t = await abrir({ ...QUIZ, respuestas: [1, 0] });

    await act(async () => { fireEvent.press(t.getByLabelText("D. Delta")); });

    await waitFor(() => expect(mock.responderQuiz).toHaveBeenCalledWith("q-1", [1, 0, 3], true));
  });

  test("al final se dice cuántas van buenas y cuáles fallaron", async () => {
    const t = await abrir();

    await contestar(t, "B");   // buena
    await contestar(t, "C");   // mala
    await contestar(t, "D");   // buena

    await waitFor(() => expect(t.getByText("2/3")).toBeTruthy());
    expect(t.getByText("Vas bien")).toBeTruthy();
    expect(t.getByText(/quedó una para repasar/)).toBeTruthy();
    // El detalle nombra las tres preguntas.
    for (const p of ["Primera", "Segunda", "Tercera"]) {
      expect(t.getByText(p)).toBeTruthy();
    }
  });

  test("con todas malas no se felicita de mentira", async () => {
    const t = await abrir();

    await contestar(t, "D");
    await contestar(t, "D");
    await contestar(t, "A");

    await waitFor(() => expect(t.getByText("0/3")).toBeTruthy());
    expect(t.getByText("Todavía no, y está bien")).toBeTruthy();
  });

  test("repetirlo lo deja como nuevo y lo dice a la base", async () => {
    const t = await abrir({ ...QUIZ, respuestas: [1, 0, 3], terminado_en: new Date().toISOString() });

    await waitFor(() => expect(t.getByText("3/3")).toBeTruthy());
    await act(async () => { fireEvent.press(t.getByText("Repetir el quiz")); });

    expect(t.getByText("Pregunta 1 de 3")).toBeTruthy();
    await waitFor(() => expect(mock.responderQuiz).toHaveBeenCalledWith("q-1", [], false));
  });

  test("se dice que esto no es una nota y no lo ve nadie", async () => {
    const t = await abrir({ ...QUIZ, respuestas: [1, 0, 3] });
    await waitFor(() => expect(t.getByText(/no es una nota y no lo ve nadie más/)).toBeTruthy());
  });

  test("si la red falla al guardar, la respuesta igual se muestra", async () => {
    const t = await abrir();
    mock.responderQuiz.mockRejectedValue(new Error("sin internet") as never);

    await act(async () => { fireEvent.press(t.getByLabelText("B. Beta")); });

    // Perder lo respondido por un problema de red sería peor que guardarlo tarde.
    expect(t.getByText(/Es porque primera funciona así/)).toBeTruthy();
    expect(t.getByText(/Siguiente/)).toBeTruthy();
  });
});
