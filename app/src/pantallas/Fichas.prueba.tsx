import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  misFichas: jest.fn(),
  repasarFicha: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import Fichas from "./Fichas.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const f = (id: string, extra: Record<string, unknown> = {}) => ({
  id, tema: "Integrales",
  pregunta: `¿Pregunta ${id}?`, respuesta: `Respuesta ${id}`,
  aciertos: 0, fallos: 0, vuelve_en: null, ...extra,
});

const abrir = async (fichas: unknown[]) => {
  mock.misFichas.mockResolvedValue(fichas as never);
  mock.repasarFicha.mockResolvedValue(undefined as never);
  const t = await renderPantalla(Fichas, {
    asignaturaId: "r-cal", tema: "Integrales",
  });
  await waitFor(() => expect(mock.misFichas).toHaveBeenCalledWith("r-cal", "Integrales"));
  return t;
};

beforeEach(() => jest.clearAllMocks());

describe("las fichas", () => {
  test("muestra la pregunta y esconde la respuesta hasta voltearla", async () => {
    const t = await abrir([f("a")]);

    expect(t.getByText("¿Pregunta a?")).toBeTruthy();
    expect(t.queryByText("Respuesta a")).toBeNull();
    expect(t.getByText("toca para voltear ↻")).toBeTruthy();
  });

  test("voltearla muestra la respuesta y pregunta si se sabía", async () => {
    const t = await abrir([f("a")]);

    await act(async () => { fireEvent.press(t.getByLabelText("Voltear: ¿Pregunta a?")); });

    expect(t.getByText("Respuesta a")).toBeTruthy();
    expect(t.getByText("La sabía")).toBeTruthy();
    expect(t.getByText("No la sabía")).toBeTruthy();
  });

  test("decir que se sabía la aleja, y se dice cuándo vuelve", async () => {
    const t = await abrir([f("a")]);

    await act(async () => { fireEvent.press(t.getByLabelText("Voltear: ¿Pregunta a?")); });
    await act(async () => { fireEvent.press(t.getByLabelText("La sabía: ¿Pregunta a?")); });

    await waitFor(() => expect(mock.repasarFicha).toHaveBeenCalledWith("a", true));
    // Primer acierto: vuelve mañana.
    expect(t.getByText("Vuelve mañana")).toBeTruthy();
  });

  test("con racha, el plazo es más largo", async () => {
    const t = await abrir([f("a", { aciertos: 2, vuelve_en: dias(-1) })]);

    await act(async () => { fireEvent.press(t.getByLabelText("Voltear: ¿Pregunta a?")); });
    await act(async () => { fireEvent.press(t.getByLabelText("La sabía: ¿Pregunta a?")); });

    await waitFor(() => expect(t.getByText("Vuelve en 7 días")).toBeTruthy());
  });

  test("decir que no se sabía la trae de vuelta hoy", async () => {
    const t = await abrir([f("a", { aciertos: 4, vuelve_en: dias(-1) })]);

    await act(async () => { fireEvent.press(t.getByLabelText("Voltear: ¿Pregunta a?")); });
    await act(async () => { fireEvent.press(t.getByLabelText("No la sabía: ¿Pregunta a?")); });

    await waitFor(() => expect(mock.repasarFicha).toHaveBeenCalledWith("a", false));
    expect(t.getByText("Vuelve hoy mismo")).toBeTruthy();
  });

  test("si no se pudo anotar, no se dice que quedó guardado", async () => {
    const t = await abrir([f("a")]);
    mock.repasarFicha.mockRejectedValue(new Error("sin internet") as never);

    await act(async () => { fireEvent.press(t.getByLabelText("Voltear: ¿Pregunta a?")); });
    await act(async () => { fireEvent.press(t.getByLabelText("La sabía: ¿Pregunta a?")); });

    // Vuelve a quedar por repasar en vez de mostrar un plazo que es mentira.
    await waitFor(() => expect(t.queryByText(/^Vuelve /)).toBeNull());
    expect(t.getByText("Respuesta a")).toBeTruthy();
  });

  test("solo aparecen las que tocan, no el mazo entero", async () => {
    const t = await abrir([
      f("toca", { vuelve_en: dias(-1) }),
      f("nueva"),
      f("lejana", { aciertos: 3, vuelve_en: dias(9) }),
    ]);

    expect(t.getByText("¿Pregunta toca?")).toBeTruthy();
    expect(t.getByText("¿Pregunta nueva?")).toBeTruthy();
    expect(t.queryByText("¿Pregunta lejana?")).toBeNull();
  });

  test("la cuenta dice cuántas están asentadas y cuántas quedan", async () => {
    const t = await abrir([
      f("nueva"),
      f("sabida", { aciertos: 3, vuelve_en: dias(9) }),
      f("sabida2", { aciertos: 5, vuelve_en: dias(30) }),
    ]);

    expect(t.getByText(/2\s*de\s*3\s*asentadas/)).toBeTruthy();
    expect(t.getByText(/1 por repasar/)).toBeTruthy();
  });

  test("con todo repasado se dice que vuelven solas, no que se acabó", async () => {
    const t = await abrir([f("sabida", { aciertos: 3, vuelve_en: dias(9) })]);
    expect(t.getByText(/Te la sabes\. Vuelve sola/)).toBeTruthy();
  });

  test("sin fichas se dice eso, no una cuadrícula vacía", async () => {
    const t = await abrir([]);
    expect(t.getByText(/Todavía no tienes fichas/)).toBeTruthy();
  });
});
