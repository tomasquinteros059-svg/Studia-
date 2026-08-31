import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(), materiaDe: jest.fn(),
}));

const quien = { valor: { id: "p-ana", nombre: "Ana Ríos", rol: "profesor", papel: "profesor", dicta: ["cal", "alg"] } };
jest.mock("../../lib/quien-soy.ts", () => ({
  usarQuienSoy: () => ({ yo: quien.valor, listo: true }),
}));

import * as consultas from "../../lib/consultas.ts";
import MaterialDocente from "./MaterialDocente.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const RAMOS = [
  { id: "cal", nombre: "Cálculo I", codigo: "MAT1610", color: null },
  { id: "alg", nombre: "Álgebra Lineal", codigo: "MAT1203", color: null },
  { id: "fis", nombre: "Física I", codigo: "FIS1503", color: null },
];

const MATERIA: Record<string, unknown[]> = {
  cal: [{
    id: "u1", titulo: "Límites", orden: 1,
    materiales: [
      { id: "m1", titulo: "Idea de límite", detalle: "14 min", tipo: "video", orden: 1, completado: false, leible: false },
      { id: "m2", titulo: "Guía de límites", detalle: "12 ítems", tipo: "ejercicios", orden: 2, completado: false, leible: false },
    ],
  }],
  alg: [{
    id: "u2", titulo: "Bases", orden: 1,
    materiales: [
      { id: "m3", titulo: "Apunte de bases", detalle: "4 min", tipo: "documento", orden: 1, completado: false, leible: true },
    ],
  }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mock.misAsignaturas.mockResolvedValue(RAMOS as never);
  mock.materiaDe.mockImplementation((id: string) => Promise.resolve(MATERIA[id] ?? []) as never);
});

const abrir = async () => {
  const t = await renderPantalla(MaterialDocente, undefined);
  await waitFor(() => expect(t.getByText("Idea de límite")).toBeTruthy());
  return t;
};

describe("el material del profesor, todo junto", () => {
  test("trae el de todos sus ramos, no el de uno", async () => {
    const t = await abrir();
    expect(t.getByText("Idea de límite")).toBeTruthy();
    expect(t.getByText("Apunte de bases")).toBeTruthy();
  });

  test("no trae el de ramos que no dicta", async () => {
    await abrir();
    // Física I está en la lista de asignaturas pero no en las que dicta.
    expect(mock.materiaDe).not.toHaveBeenCalledWith("fis");
  });

  test("dice de qué ramo y de qué unidad es cada cosa", async () => {
    // Una lista plana de sesenta títulos no dice nada.
    const t = await abrir();
    expect(t.getByText("Cálculo I · Límites")).toBeTruthy();
    expect(t.getByText("Álgebra Lineal · Bases")).toBeTruthy();
  });

  test("buscar filtra por título", async () => {
    const t = await abrir();
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Buscar material"), "bases");
    });
    expect(t.getByText("Apunte de bases")).toBeTruthy();
    expect(t.queryByText("Idea de límite")).toBeNull();
  });

  test("y busca también por ramo, que es otra manera de acordarse", async () => {
    const t = await abrir();
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Buscar material"), "calculo");
    });
    expect(t.getByText("Idea de límite")).toBeTruthy();
    expect(t.queryByText("Apunte de bases")).toBeNull();
  });

  test("una búsqueda sin resultados lo dice con lo que se buscó", async () => {
    const t = await abrir();
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Buscar material"), "termodinámica");
    });
    expect(t.getByText(/«termodinámica»/)).toBeTruthy();
  });

  test("se puede mirar un solo ramo", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Solo Álgebra Lineal")); });

    expect(t.getByText("Apunte de bases")).toBeTruthy();
    expect(t.queryByText("Idea de límite")).toBeNull();
  });

  test("resume lo que hay, en singular cuando es uno", async () => {
    const t = await abrir();
    expect(t.getByText(/1 video · 1 lectura · 1 guía/)).toBeTruthy();
  });

  test("tocar una pieza lleva al ramo donde se edita", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Apunte de bases")); });
    expect(t.navigation.navigate).toHaveBeenCalledWith("RamoDocente", { asignaturaId: "alg" });
  });

  test("sin material lo dice, en vez de una pantalla en blanco", async () => {
    mock.materiaDe.mockResolvedValue([] as never);
    const t = await renderPantalla(MaterialDocente, undefined);
    await waitFor(() => expect(t.getByText(/Todavía no has subido material/)).toBeTruthy());
  });
});
