import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RAMO, TAREA_PENDIENTE, renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(), misTareas: jest.fn(),
  evaluacionesDe: jest.fn(), materiaDe: jest.fn(),
  cursoDe: jest.fn(), entregasDe: jest.fn(), notasDe: jest.fn(), avanceDe: jest.fn(),
  entregasDeVarias: jest.fn(), notasDeVarias: jest.fn(),
}));

// La pantalla pregunta quién soy, no de dónde salió.
jest.mock("../../lib/quien-soy.ts", () => ({
  usarQuienSoy: () => ({
    yo: { nombre: "Ana Ríos", correo: "ana@studia.cl", rol: "profesor",
          papel: "profesor", dicta: ["r-cal"] },
    listo: true,
  }),
}));

// El andamio de pruebas simula tener Supabase configurado, así que el modo
// demostración hay que pedirlo a propósito para probar su aviso.
const modo = { demo: true };
jest.mock("../../lib/config.ts", () => ({
  get MODO_DEMO() { return modo.demo; },
  hayBackend: true,
  URL_SUPABASE: "", CLAVE_ANON: "", AVISO_DEMO: "",
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 420, height: 900, scale: 2, fontScale: 1 }),
}));

import * as consultas from "../../lib/consultas.ts";
import Asistente from "./Asistente.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
// Las consultas del docente salen de la misma fachada que las del alumno.
const mockD = mock as unknown as {
  cursoDe: jest.Mock; entregasDe: jest.Mock; notasDe: jest.Mock;
  entregasDeVarias: jest.Mock; notasDeVarias: jest.Mock;
  avanceDe: jest.Mock; corregir: jest.Mock; ponerNota: jest.Mock; publicarNotas: jest.Mock;
};

const curso = [
  { id: "a1", nombre: "Eduardo Q." },
  { id: "a2", nombre: "Josefa Pérez" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.misTareas.mockResolvedValue([TAREA_PENDIENTE] as never);
  mock.evaluacionesDe.mockResolvedValue([] as never);
  mock.materiaDe.mockResolvedValue([] as never);
  mockD.cursoDe.mockResolvedValue(curso as never);
  // El asistente pide todo junto: una consulta por ramo.
  mockD.notasDeVarias.mockResolvedValue([] as never);
  // Solo Eduardo entregó.
  mockD.entregasDeVarias.mockResolvedValue([
    { id: "en1", tarea_id: TAREA_PENDIENTE.id, estudiante_id: "a1", estudiante: "Eduardo Q.",
      entregado_en: "2026-08-20T10:00:00Z", puntos_obtenidos: null },
  ] as never);
  mockD.avanceDe.mockResolvedValue([
    { estudiante_id: "a1", estudiante: "Eduardo Q.", hechos: 9, totales: 9,
      ultimo_acceso: new Date().toISOString() },
    { estudiante_id: "a2", estudiante: "Josefa Pérez", hechos: 1, totales: 9, ultimo_acceso: null },
  ] as never);
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
  await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
};

describe("el asistente del docente", () => {
  test("abre ofreciendo lo que sabe responder", async () => {
    const t = await abrir();
    expect(t.getByText("¿Quién no ha entregado?")).toBeTruthy();
    expect(t.getByText("¿Qué me queda por corregir?")).toBeTruthy();
  });

  test("dice que sin servidor responde con los datos del aparato", async () => {
    const t = await abrir();
    expect(t.getByText(/Sin servidor respondo con los datos/)).toBeTruthy();
  });

  test("con servidor conectado ese aviso no aparece", async () => {
    modo.demo = false;
    const t = await abrir();
    expect(t.queryByText(/Sin servidor respondo con los datos/)).toBeNull();
    modo.demo = true;
  });

  test("tocar una sugerencia la pregunta", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("¿Quién no ha entregado?")); });
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    await waitFor(() => expect(t.getByText("Josefa Pérez")).toBeTruthy());
  });

  test("nombra a quien no entregó", async () => {
    const t = await abrir();
    await preguntar(t, "¿quién no ha entregado?");
    await waitFor(() => expect(t.getByText(/faltan 1 persona de 2/)).toBeTruthy());
    expect(t.getByText("Josefa Pérez")).toBeTruthy();
  });

  test("responde por el avance del curso", async () => {
    const t = await abrir();
    await preguntar(t, "¿quién no ha estudiado?");
    await waitFor(() => expect(t.getByText(/Josefa Pérez · 1 de 9 materiales/)).toBeTruthy());
  });

  test("una pregunta que no entiende no se inventa una respuesta", async () => {
    const t = await abrir();
    await preguntar(t, "¿cuál es la capital de Francia?");
    await waitFor(() =>
      expect(t.getByText(/Todavía no sé responder eso sin servidor/)).toBeTruthy());
  });

  test("la pregunta queda escrita en el hilo", async () => {
    const t = await abrir();
    await preguntar(t, "¿quién no ha entregado?");
    await waitFor(() => expect(t.getByText("¿quién no ha entregado?")).toBeTruthy());
  });

  test("no manda una pregunta vacía", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Preguntar")); });
    expect(t.getByText("Pregúntame por tu curso")).toBeTruthy();
  });
});
