import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  BLOQUE, CLASE_VIVA, EVALUACIONES, NOTIFICACION, RAMO, RAMO_2,
  TAREA_ATRASADA, TAREA_ENTREGADA, TAREA_PENDIENTE, renderPantalla,
} from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  misTareas: jest.fn(),
  miHorario: jest.fn(),
  claseEnVivo: jest.fn(),
  misNotificaciones: jest.fn(),
  todasLasEvaluaciones: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import Inicio from "./Inicio.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

function conDatos(extra: Partial<Record<string, unknown>> = {}) {
  mock.misAsignaturas.mockResolvedValue([RAMO, RAMO_2] as never);
  mock.misTareas.mockResolvedValue([TAREA_PENDIENTE, TAREA_ATRASADA, TAREA_ENTREGADA] as never);
  mock.miHorario.mockResolvedValue([BLOQUE] as never);
  mock.claseEnVivo.mockResolvedValue(CLASE_VIVA as never);
  mock.misNotificaciones.mockResolvedValue([NOTIFICACION] as never);
  mock.todasLasEvaluaciones.mockResolvedValue(
    new Map([[RAMO.id, EVALUACIONES], [RAMO_2.id, EVALUACIONES]]) as never,
  );
  Object.assign(mock, extra);
}

beforeEach(() => jest.clearAllMocks());

describe("Inicio", () => {
  test("muestra el saludo, las asignaturas y sus notas", async () => {
    conDatos();
    const t = await renderPantalla(Inicio);
    // El ramo aparece dos veces: en el bloque de hoy y en su tarjeta.
    await waitFor(() => expect(t.getAllByText("Cálculo I").length).toBeGreaterThan(0));
    expect(t.getByText("Hola")).toBeTruthy();
    expect(t.getByText("Física I")).toBeTruthy();
    // 30% con 6,2 y el resto sin rendir → la nota parcial es 6,2.
    expect(t.getAllByText("Nota 6,2").length).toBe(2);
  });

  test("anuncia la clase en vivo y lleva a su asignatura", async () => {
    conDatos();
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("EN VIVO AHORA")).toBeTruthy());
    fireEvent.press(t.getByText("EN VIVO AHORA"));
    expect(t.navigation.navigate).toHaveBeenCalledWith(
      "Asignatura", expect.objectContaining({ asignaturaId: RAMO.id, seccion: "clases" }),
    );
  });

  test("la campana lleva la cuenta de las no leídas", async () => {
    conDatos();
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByLabelText("Notificaciones, 1 sin leer")).toBeTruthy());
  });

  test("sin notificaciones nuevas la campana no lleva número", async () => {
    conDatos();
    mock.misNotificaciones.mockResolvedValue([{ ...NOTIFICACION, leida: true }] as never);
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByLabelText("Notificaciones")).toBeTruthy());
  });

  test("las próximas entregas dejan fuera lo ya entregado", async () => {
    conDatos();
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("Guía 4 · Optimización")).toBeTruthy());
    expect(t.getByText("Guía 2 · Planos")).toBeTruthy();
    expect(t.queryByText("Control 2")).toBeNull();
  });

  test("una entrega lleva a su detalle", async () => {
    conDatos();
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("Guía 2 · Planos")).toBeTruthy());
    fireEvent.press(t.getByText("Guía 2 · Planos"));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Tarea", { tareaId: TAREA_ATRASADA.id });
  });

  test("sin clase en vivo no aparece la barra roja", async () => {
    conDatos();
    mock.claseEnVivo.mockResolvedValue(null as never);
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getAllByText("Cálculo I").length).toBeGreaterThan(0));
    expect(t.queryByText("EN VIVO AHORA")).toBeNull();
  });

  test("si una consulta falla, lo dice y ofrece reintentar", async () => {
    conDatos();
    mock.misAsignaturas.mockRejectedValue(new Error("No pude cargar tus asignaturas"));
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("No pude cargar tus asignaturas")).toBeTruthy());
    expect(t.getByText("Reintentar")).toBeTruthy();
  });

  test("sin nada por entregar lo dice en vez de dejar el hueco", async () => {
    conDatos();
    mock.misTareas.mockResolvedValue([TAREA_ENTREGADA] as never);
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("Estás al día. Nada por entregar.")).toBeTruthy());
  });
});
