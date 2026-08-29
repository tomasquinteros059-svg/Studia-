import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  miHorario: jest.fn(),
  cursoDe: jest.fn(),
  cargarCatalogo: jest.fn(),
  registros: jest.fn(),
  cambiarRol: jest.fn(),
}));

import * as consultas from "../../lib/consultas.ts";
import InicioAdmin from "./InicioAdmin.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const RAMO = {
  id: "a-1", codigo: "MAT1610", nombre: "Cálculo I", profesor: "Ana Ríos",
  ayudante: null, color: "#2563C9", creditos: 10, descripcion: null,
  requisitos: null, bibliografia: [], intro_tutor: "¿?", propio: false,
};

const RAMOS = `codigo,nombre,profesor,ayudante,color,creditos,descripcion,requisitos,bibliografia,intro_tutor
MAT1610,Cálculo I,Ana Ríos,,#2563C9,10,,,,¿En qué estás?
FIS1503,Física I,Carla Núñez,,#C25A18,10,,,,¿En qué estás?`;

const HORARIO = `codigo,dia,hora_inicio,hora_fin,sala,tipo
MAT1610,lunes,08:30,10:00,B-104,Cátedra
FIS1503,martes,14:00,16:00,Lab,Laboratorio`;

const conDatos = () => {
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.miHorario.mockResolvedValue([] as never);
  mock.cursoDe.mockResolvedValue([] as never);
  mock.cargarCatalogo.mockResolvedValue({ ramos: 2, bloques: 2 } as never);
  mock.registros.mockResolvedValue([] as never);
};

const abrirCarga = async () => {
  const t = await renderPantalla(InicioAdmin);
  await waitFor(() => expect(t.getByLabelText("Cargar el semestre")).toBeTruthy());
  await act(async () => { fireEvent.press(t.getByLabelText("Cargar el semestre")); });
  return t;
};

beforeEach(() => jest.clearAllMocks());

describe("cargar el semestre desde el panel", () => {
  test("dice qué va a pasar antes de tocar nada", async () => {
    conDatos();
    const t = await abrirCarga();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de ramos"), RAMOS);
    });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de horario"), HORARIO);
    });

    // MAT1610 ya estaba: se actualiza. FIS1503 es nuevo.
    expect(t.getByText("ramos nuevos")).toBeTruthy();
    expect(t.getByText("ramos que se actualizan")).toBeTruthy();
    expect(t.getByText("bloques de horario")).toBeTruthy();
    // Y todavía no se escribió nada.
    expect(mock.cargarCatalogo).not.toHaveBeenCalled();
  });

  test("aplicar manda las dos planillas ya revisadas", async () => {
    conDatos();
    const t = await abrirCarga();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de ramos"), RAMOS);
    });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de horario"), HORARIO);
    });
    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Aplicar la carga" }));
      await Promise.resolve();
    });

    await waitFor(() => expect(mock.cargarCatalogo).toHaveBeenCalled());
    const enviado = mock.cargarCatalogo.mock.calls[0]![0] as {
      asignaturas: { codigo: string }[];
      horario: { codigo: string; dia: number }[];
    };
    expect(enviado.asignaturas.map((a) => a.codigo)).toEqual(["MAT1610", "FIS1503"]);
    expect(enviado.horario).toHaveLength(2);
    // El día viaja como número, no como la palabra que traía la planilla.
    expect(enviado.horario[0]!.dia).toBe(1);
  });

  test("con un error en la planilla no se aplica nada, y se dice dónde está", async () => {
    conDatos();
    const t = await abrirCarga();

    await act(async () => {
      fireEvent.changeText(
        t.getByLabelText("Planilla de ramos"),
        `codigo,nombre,profesor,ayudante,color,creditos,descripcion,requisitos,bibliografia,intro_tutor
MAT1610,Cálculo I,Ana Ríos,,azulito,10,,,,¿En qué estás?`,
      );
    });

    expect(t.getByText("Hay un problema que corregir")).toBeTruthy();
    // Con archivo, línea y qué se esperaba: "error de validación" no sirve.
    expect(t.getByText(/asignaturas\.csv · línea 2/)).toBeTruthy();
    expect(t.getByText(/va en formato #RRGGBB/)).toBeTruthy();
    expect(t.queryByText("ramos nuevos")).toBeNull();

    // Y el botón no deja aplicar.
    fireEvent.press(t.getByRole("button", { name: "Aplicar la carga" }));
    expect(mock.cargarCatalogo).not.toHaveBeenCalled();
  });

  test("un horario que nombra un ramo que no viene se detiene acá, no en la base", async () => {
    conDatos();
    const t = await abrirCarga();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de ramos"), RAMOS);
    });
    await act(async () => {
      fireEvent.changeText(
        t.getByLabelText("Planilla de horario"),
        `codigo,dia,hora_inicio,hora_fin,sala,tipo
NO-EXISTE,lunes,08:30,10:00,B-104,Cátedra`,
      );
    });

    expect(t.getByText(/horario\.csv · línea 2/)).toBeTruthy();
    expect(t.getByText(/El ramo NO-EXISTE no está en asignaturas\.csv/)).toBeTruthy();
    expect(mock.cargarCatalogo).not.toHaveBeenCalled();
  });
});
