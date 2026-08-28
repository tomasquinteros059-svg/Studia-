import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RAMO, TAREA_PENDIENTE, renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(), misTareas: jest.fn(),
  evaluacionesDe: jest.fn(), materiaDe: jest.fn(),
  cursoDe: jest.fn(), entregasDe: jest.fn(), notasDe: jest.fn(),
  corregir: jest.fn(), ponerNota: jest.fn(), publicarNotas: jest.fn(),
}));

const curso = [
  { id: "a1", nombre: "Eduardo Q." },
  { id: "a2", nombre: "Josefa Pérez" },
];

const entregas = [
  { id: "en1", tarea_id: "t-1", estudiante_id: "a1", estudiante: "Eduardo Q.",
    entregado_en: "2026-08-20T10:00:00Z", puntos_obtenidos: null },
  { id: "en2", tarea_id: "t-1", estudiante_id: "a2", estudiante: "Josefa Pérez",
    entregado_en: "2026-08-19T10:00:00Z", puntos_obtenidos: 18 },
];

const notas = [
  { evaluacion_id: "e-1", estudiante_id: "a1", estudiante: "Eduardo Q.", nota: 6.2, publicada: false },
  { evaluacion_id: "e-1", estudiante_id: "a2", estudiante: "Josefa Pérez", nota: 3.5, publicada: false },
];

// Quién está usando la app decide qué botones aparecen. La pantalla lo
// pregunta a `quien-soy`, que resuelve el modo demostración o la sesión
// real; acá se reemplaza esa respuesta directamente.
const quien = { valor: { id: "p-ana", nombre: "Ana Ríos", rol: "profesor", papel: "profesor" } };
jest.mock("../../lib/quien-soy.ts", () => ({
  usarQuienSoy: () => ({ yo: quien.valor, listo: true }),
}));

const anchoFalso = { valor: { width: 420, height: 900, scale: 2, fontScale: 1 } };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => anchoFalso.valor,
}));

import * as consultas from "../../lib/consultas.ts";
import RamoDocente from "./RamoDocente.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
// Las consultas del docente salen de la misma fachada que las del alumno.
const mockD = mock as unknown as {
  cursoDe: jest.Mock; entregasDe: jest.Mock; notasDe: jest.Mock;
  avanceDe: jest.Mock; corregir: jest.Mock; ponerNota: jest.Mock; publicarNotas: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  quien.valor = { id: "p-ana", nombre: "Ana Ríos", rol: "profesor", papel: "profesor" };
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.misTareas.mockResolvedValue([TAREA_PENDIENTE] as never);
  mock.evaluacionesDe.mockResolvedValue([{ id: "e-1", titulo: "Control 1", peso: 30, orden: 1, nota: null }] as never);
  mock.materiaDe.mockResolvedValue([] as never);
  mockD.cursoDe.mockResolvedValue(curso as never);
  mockD.entregasDe.mockResolvedValue(entregas as never);
  mockD.notasDe.mockResolvedValue(notas as never);
  mockD.publicarNotas.mockResolvedValue(undefined as never);
  mockD.corregir.mockResolvedValue(undefined as never);
});

const abrir = async () => {
  const t = await renderPantalla(RamoDocente, { asignaturaId: RAMO.id });
  await waitFor(() => expect(t.getByText(TAREA_PENDIENTE.titulo)).toBeTruthy());
  return t;
};

const irA = async (t: Awaited<ReturnType<typeof abrir>>, seccion: string) => {
  await act(async () => { fireEvent.press(t.getByText(seccion)); });
};

describe("el ramo desde el escritorio del docente", () => {
  test("muestra cuántos entregaron y cuántos corregidos", async () => {
    const t = await abrir();
    expect(t.getByText(/2 de 2 entregaron · 1 corregidas/)).toBeTruthy();
  });

  test("lista solo las entregas que faltan por corregir", async () => {
    const t = await abrir();
    expect(t.getByText("Eduardo Q.")).toBeTruthy();
    expect(t.queryByText("Josefa Pérez")).toBeNull();
  });

  test("corregir abre el puntaje con el máximo de la tarea", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Corregir")); });
    expect(t.getByText(`de ${TAREA_PENDIENTE.puntos}`)).toBeTruthy();
  });

  test("un puntaje sobre el máximo no se puede guardar", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Corregir")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Puntaje"), "999"); });
    expect(t.getByText(/El puntaje va entre 0 y/)).toBeTruthy();
    await act(async () => { fireEvent.press(t.getByText("Guardar")); });
    expect(mockD.corregir).not.toHaveBeenCalled();
  });

  test("un puntaje válido se guarda", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Corregir")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Puntaje"), "17"); });
    await act(async () => { fireEvent.press(t.getByText("Guardar")); });
    expect(mockD.corregir).toHaveBeenCalledWith("t-1", "en1", 17);
  });

  test("las notas muestran el promedio y cuántos aprueban", async () => {
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText(/Promedio 4,9 · aprueban 1 de 2/)).toBeTruthy());
  });

  test("la profesora puede publicar al curso", async () => {
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText("Publicar al curso")).toBeTruthy());
  });

  test("el ayudante no ve el botón de publicar, y se le dice por qué", async () => {
    // La misma regla vive en las políticas de la base: acá solo se evita
    // ofrecer un botón que el servidor va a rechazar.
    quien.valor = { id: "p-ig", nombre: "Ignacio Soto", rol: "profesor", papel: "ayudante" };
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText(/Publicar notas es del profesor/)).toBeTruthy());
    expect(t.queryByText("Publicar al curso")).toBeNull();
  });

  test("una nota fuera de escala se avisa", async () => {
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText("Josefa Pérez")).toBeTruthy());
    await act(async () => { fireEvent.press(t.getByText("Josefa Pérez")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Nota"), "9"); });
    expect(t.getByText(/La nota va entre 1,0 y 7,0/)).toBeTruthy();
  });

  test("el curso lista a todos los inscritos", async () => {
    const t = await abrir();
    await irA(t, "Curso");
    await waitFor(() => expect(t.getByText("2 inscritos")).toBeTruthy());
    expect(t.getByText("Josefa Pérez")).toBeTruthy();
  });
});
