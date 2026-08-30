import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RAMO, RAMO_2, renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  misTareas: jest.fn(),
  misQuices: jest.fn(),
  materiaDe: jest.fn(),
}));
jest.mock("../lib/tutor.ts", () => ({ preguntarAlTutor: jest.fn() }));

import * as consultas from "../lib/consultas.ts";
import * as tutorLib from "../lib/tutor.ts";
import Tutor from "./Tutor.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const tutor = tutorLib as jest.Mocked<typeof tutorLib>;

const MODULO = {
  id: "m-1", titulo: "Integrales impropias", orden: 1,
  materiales: [{ id: "x-1", titulo: "Apunte", tipo: "documento", detalle: "", completado: false, leible: false }],
};

const QUIZ_FALLADO = {
  id: "q-1", asignatura_id: RAMO.id, tema: "Integrales",
  preguntas: [
    { pregunta: "¿Converge la impropia?", opciones: ["a", "b", "c", "d"], correcta: 1, explicacion: "…" },
    { pregunta: "¿Y por partes?", opciones: ["a", "b", "c", "d"], correcta: 0, explicacion: "…" },
  ],
  respuestas: [3, 0],
  terminado_en: "2026-08-20T11:00:00Z",
  creado_en: "2026-08-20T10:00:00Z",
};

const TAREA = {
  id: "t-1", asignatura_id: RAMO.id, titulo: "Tarea 3", enunciado: "", criterios: [],
  puntos: 20, vence_en: "2026-09-04T23:59:00Z", entregada_en: null, puntos_obtenidos: null,
};

const abrir = async (datos?: { tareas?: unknown[]; quices?: unknown[]; modulos?: unknown[] }) => {
  mock.misAsignaturas.mockResolvedValue([RAMO, RAMO_2] as never);
  mock.misTareas.mockResolvedValue((datos?.tareas ?? []) as never);
  mock.misQuices.mockResolvedValue((datos?.quices ?? []) as never);
  mock.materiaDe.mockResolvedValue((datos?.modulos ?? []) as never);
  tutor.preguntarAlTutor.mockResolvedValue(
    { conversacionId: "c-1", respuesta: "¿Y qué crees tú que pasa ahí?" } as never,
  );

  const t = await renderPantalla(Tutor);
  await waitFor(() => expect(t.getByText(RAMO.intro_tutor)).toBeTruthy());
  return t;
};

beforeEach(() => jest.clearAllMocks());

describe("el tutor", () => {
  test("abre con el primer ramo y su pregunta de apertura", async () => {
    const t = await abrir();

    expect(t.getByText("El Tutor")).toBeTruthy();
    expect(t.getByText(RAMO.intro_tutor)).toBeTruthy();
    expect(t.getByText(`${RAMO.nombre} · con su material`)).toBeTruthy();
  });

  test("preguntar manda el mensaje del ramo elegido y muestra la respuesta", async () => {
    const t = await abrir();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Tu mensaje"), "no entiendo las impropias");
    });
    await act(async () => { fireEvent.press(t.getByLabelText("Enviar")); });

    await waitFor(() => expect(t.getByText("¿Y qué crees tú que pasa ahí?")).toBeTruthy());
    expect(tutor.preguntarAlTutor).toHaveBeenCalledWith(expect.objectContaining({
      asignaturaId: RAMO.id, mensaje: "no entiendo las impropias",
    }));
    // Lo escrito queda en el hilo, no en el campo.
    expect(t.getByText("no entiendo las impropias")).toBeTruthy();
  });

  test("cambiar de ramo empieza de nuevo, con la apertura del otro", async () => {
    const t = await abrir();

    await act(async () => { fireEvent.press(t.getByLabelText(`Hablar de ${RAMO_2.nombre}`)); });

    expect(t.getByText(RAMO_2.intro_tutor)).toBeTruthy();
    expect(t.queryByText(RAMO.intro_tutor)).toBeNull();
    expect(t.getByText(`${RAMO_2.nombre} · con su material`)).toBeTruthy();
  });

  test("una conversación no se mezcla entre ramos", async () => {
    const t = await abrir();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Tu mensaje"), "una duda de cálculo");
    });
    await act(async () => { fireEvent.press(t.getByLabelText("Enviar")); });
    await waitFor(() => expect(t.getByText("una duda de cálculo")).toBeTruthy());

    await act(async () => { fireEvent.press(t.getByLabelText(`Hablar de ${RAMO_2.nombre}`)); });
    expect(t.queryByText("una duda de cálculo")).toBeNull();
  });

  // ── Las sugerencias ────────────────────────────────────────────────────

  test("sin nada que contar, propone las dos de fondo", async () => {
    const t = await abrir();
    expect(t.getByText("No entendí la clase de hoy")).toBeTruthy();
    expect(t.getByText("Ponme un ejercicio para practicar")).toBeTruthy();
  });

  test("lo primero que propone es el error comprobado del último quiz", async () => {
    const t = await abrir({ quices: [QUIZ_FALLADO], tareas: [TAREA], modulos: [MODULO] });

    await waitFor(() =>
      expect(t.getByText("¿Por qué me equivoqué en «¿Converge la impropia?»?")).toBeTruthy());
    expect(t.getByText("¿Cómo parto «Tarea 3»?")).toBeTruthy();
    expect(t.getByText("Explícame «Integrales impropias»")).toBeTruthy();
  });

  test("no propone temas de otro ramo", async () => {
    const t = await abrir({
      tareas: [{ ...TAREA, asignatura_id: RAMO_2.id, titulo: "De otro ramo" }],
    });
    expect(t.queryByText(/De otro ramo/)).toBeNull();
  });

  test("tocar una sugerencia la manda tal cual, sin tener que escribirla", async () => {
    const t = await abrir({ quices: [QUIZ_FALLADO] });

    const texto = "¿Por qué me equivoqué en «¿Converge la impropia?»?";
    await waitFor(() => expect(t.getByLabelText(texto)).toBeTruthy());
    await act(async () => { fireEvent.press(t.getByLabelText(texto)); });

    await waitFor(() => expect(tutor.preguntarAlTutor).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: texto })));
  });

  test("una vez que se está hablando, las sugerencias no interrumpen", async () => {
    const t = await abrir();
    expect(t.getByText("No entendí la clase de hoy")).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Tu mensaje"), "hola");
    });
    await act(async () => { fireEvent.press(t.getByLabelText("Enviar")); });

    await waitFor(() => expect(t.queryByText("No entendí la clase de hoy")).toBeNull());
  });

  test("si el tutor no responde, se dice y no se pierde lo escrito", async () => {
    const t = await abrir();
    tutor.preguntarAlTutor.mockRejectedValue(new Error("El tutor no está disponible.") as never);

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Tu mensaje"), "una duda");
    });
    await act(async () => { fireEvent.press(t.getByLabelText("Enviar")); });

    await waitFor(() => expect(t.getByText("El tutor no está disponible.")).toBeTruthy());
    // La pregunta sigue en el hilo: se puede volver a intentar sin reescribirla.
    expect(t.getByText("una duda")).toBeTruthy();
  });

  test("no se manda un mensaje vacío", async () => {
    const t = await abrir();

    await act(async () => { fireEvent.changeText(t.getByLabelText("Tu mensaje"), "   "); });
    await act(async () => { fireEvent.press(t.getByLabelText("Enviar")); });

    expect(tutor.preguntarAlTutor).not.toHaveBeenCalled();
  });
});
