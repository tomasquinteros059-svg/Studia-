import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  miHorario: jest.fn(),
  cursoDe: jest.fn(),
  cargarCatalogo: jest.fn(),
  registros: jest.fn(),
  quienDicta: jest.fn(),
  cambiarRol: jest.fn(),
}));

import * as consultas from "../../lib/consultas.ts";
import InicioAdmin from "./InicioAdmin.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const GENTE = [
  { id: "p-1", nombre: "José Pérez", correo: "jose@colegio.cl", rol: "estudiante", creado_en: "2026-03-04T10:00:00Z" },
  { id: "p-2", nombre: "Ana Ríos", correo: "ana@colegio.cl", rol: "profesor", creado_en: "2026-03-01T10:00:00Z" },
  { id: "p-3", nombre: "Secretaría", correo: "secre@colegio.cl", rol: "administrador", creado_en: "2026-02-20T10:00:00Z" },
];

const abrirRegistro = async (gente = GENTE) => {
  mock.misAsignaturas.mockResolvedValue([] as never);
  mock.miHorario.mockResolvedValue([] as never);
  mock.quienDicta.mockResolvedValue([] as never);
  mock.cursoDe.mockResolvedValue([] as never);
  mock.registros.mockResolvedValue(gente as never);
  mock.cambiarRol.mockResolvedValue(undefined as never);

  const t = await renderPantalla(InicioAdmin);
  await waitFor(() => expect(t.getByText("Personas")).toBeTruthy());
  await act(async () => { fireEvent.press(t.getByText("Personas")); });
  return t;
};

beforeEach(() => jest.clearAllMocks());

describe("el registro de personas", () => {
  test("muestra quién está registrado, con su correo y desde cuándo", async () => {
    const t = await abrirRegistro();

    expect(t.getByText("José Pérez")).toBeTruthy();
    expect(t.getByText(/jose@colegio\.cl · desde/)).toBeTruthy();
  });

  test("cuenta cuántos hay de cada rol, que es lo que se mira primero", async () => {
    const t = await abrirRegistro();
    expect(t.getByText("1 estudiantes · 1 docentes · 1 de administración")).toBeTruthy();
  });

  test("buscar sin tilde igual encuentra a José", async () => {
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Buscar en el registro"), "jose");
    });

    expect(t.getByText("José Pérez")).toBeTruthy();
    expect(t.queryByText("Ana Ríos")).toBeNull();
  });

  test("una búsqueda sin resultados lo dice, no muestra la lista entera", async () => {
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Buscar en el registro"), "nadie");
    });

    expect(t.getByText(/Nadie calza con/)).toBeTruthy();
    expect(t.queryByText("José Pérez")).toBeNull();
  });

  test("cambiar el rol de alguien lo manda a la base y recarga", async () => {
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.press(t.getByLabelText("Docente para José Pérez"));
    });

    await waitFor(() => expect(mock.cambiarRol).toHaveBeenCalledWith("p-1", "profesor"));
    // Se vuelve a preguntar: el rol cambió y la lista tiene que reflejarlo.
    expect(mock.registros).toHaveBeenCalledTimes(2);
  });

  test("el rol que ya tiene no se puede volver a apretar", async () => {
    const t = await abrirRegistro();

    fireEvent.press(t.getByLabelText("Estudiante para José Pérez"));
    expect(mock.cambiarRol).not.toHaveBeenCalled();
  });

  test("si la base lo rechaza, se dice y no se inventa que resultó", async () => {
    const aviso = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const t = await abrirRegistro();
    // Después de abrir: el ayudante deja `cambiarRol` resolviendo bien.
    mock.cambiarRol.mockRejectedValue(new Error("No puedes cambiar tu propio rol.") as never);

    await act(async () => {
      fireEvent.press(t.getByLabelText("Docente para José Pérez"));
    });

    await waitFor(() => expect(aviso).toHaveBeenCalledWith(
      "No pude cambiar el rol", "No puedes cambiar tu propio rol."));
    aviso.mockRestore();
  });

  test("sin registro que mostrar se explica por qué, en vez de una lista vacía", async () => {
    const t = await abrirRegistro([]);
    expect(t.getByText(/solo lo ve quien administra/)).toBeTruthy();
  });
});
