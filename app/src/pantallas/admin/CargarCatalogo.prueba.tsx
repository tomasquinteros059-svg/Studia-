import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  miHorario: jest.fn(),
  cursoDe: jest.fn(),
  cargarCatalogo: jest.fn(),
  cargarNomina: jest.fn(),
  registros: jest.fn(),
  quienDicta: jest.fn(),
  cambiarRol: jest.fn(),
  cambiarPlan: jest.fn(),
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
  mock.quienDicta.mockResolvedValue([] as never);
  mock.cursoDe.mockResolvedValue([] as never);
  mock.cargarCatalogo.mockResolvedValue({ ramos: 2, bloques: 2 } as never);
  mock.cargarNomina.mockResolvedValue({ filas: 0, aplicadas: 0, esperando: 0 } as never);
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

// ── La nómina de la institución ─────────────────────────────────────────
//
// Es lo que hace que contratar StudIA sirva de algo el primer día: la
// universidad entrega su planilla, y sus alumnos entran a una aplicación que
// ya sabe quiénes son. Casi nadie de esa lista tiene cuenta cuando se carga,
// así que lo que se manda son matrículas a nombre de un correo.

const PERSONAS = `correo,nombre,rol
ana.rios@u.cl,Ana Ríos,profesor
juan.perez@u.cl,Juan Pérez,estudiante`;

const DICTADOS = `correo,codigo,papel
ana.rios@u.cl,MAT1610,profesor`;

const INSCRIPCIONES = `correo,codigo
juan.perez@u.cl,MAT1610`;

describe("cargar la nómina de la institución", () => {
  test("las tres planillas de gente viajan como matrículas", async () => {
    conDatos();
    const t = await abrirCarga();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de ramos"), RAMOS);
      fireEvent.changeText(t.getByLabelText("Planilla de horario"), HORARIO);
      fireEvent.changeText(t.getByLabelText("Planilla de personas"), PERSONAS);
      fireEvent.changeText(t.getByLabelText("Planilla de quién dicta"), DICTADOS);
      fireEvent.changeText(t.getByLabelText("Planilla de inscripciones"), INSCRIPCIONES);
    });
    await act(async () => { fireEvent.press(t.getByText("Aplicar la carga")); });

    await waitFor(() => expect(mock.cargarNomina).toHaveBeenCalled());
    const filas = mock.cargarNomina.mock.calls[0]![0] as {
      correo: string; rol: string; codigo: string | null; papel: string | null;
    }[];

    // Las dos personas, más su ramo cada una.
    expect(filas).toContainEqual({ correo: "ana.rios@u.cl", rol: "profesor", codigo: null, papel: null });
    expect(filas).toContainEqual({ correo: "ana.rios@u.cl", rol: "profesor", codigo: "MAT1610", papel: "profesor" });
    expect(filas).toContainEqual({ correo: "juan.perez@u.cl", rol: "estudiante", codigo: "MAT1610", papel: null });
  });

  test("los ramos se cargan antes que la nómina", async () => {
    // Una inscripción a un ramo que todavía no existe no se puede convertir
    // en nada.
    conDatos();
    const t = await abrirCarga();
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de ramos"), RAMOS);
      fireEvent.changeText(t.getByLabelText("Planilla de personas"), PERSONAS);
      fireEvent.changeText(t.getByLabelText("Planilla de inscripciones"), INSCRIPCIONES);
    });
    await act(async () => { fireEvent.press(t.getByText("Aplicar la carga")); });

    await waitFor(() => expect(mock.cargarNomina).toHaveBeenCalled());
    const orden = mock.cargarCatalogo.mock.invocationCallOrder[0]!;
    expect(orden).toBeLessThan(mock.cargarNomina.mock.invocationCallOrder[0]!);
  });

  test("se puede cargar solo la nómina, sin tocar los ramos", async () => {
    // Un semestre ya cargado al que llega gente nueva a mitad de camino.
    conDatos();
    const t = await abrirCarga();
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de personas"), PERSONAS);
    });
    await act(async () => { fireEvent.press(t.getByText("Aplicar la carga")); });

    await waitFor(() => expect(mock.cargarNomina).toHaveBeenCalled());
    expect(mock.cargarCatalogo).not.toHaveBeenCalled();
  });

  test("dice cuánta gente entra antes de aplicar", async () => {
    conDatos();
    const t = await abrirCarga();
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Planilla de ramos"), RAMOS);
      fireEvent.changeText(t.getByLabelText("Planilla de personas"), PERSONAS);
      fireEvent.changeText(t.getByLabelText("Planilla de inscripciones"), INSCRIPCIONES);
    });
    expect(t.getByText("personas en la nómina")).toBeTruthy();
    expect(t.getByText("inscripciones")).toBeTruthy();
  });

  test("explica que no hace falta que tengan cuenta todavía", async () => {
    conDatos();
    const t = await abrirCarga();
    expect(t.getByText(/queda esperando a nombre de su correo/)).toBeTruthy();
  });
});
