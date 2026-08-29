import { act, fireEvent, waitFor } from "@testing-library/react-native";
import {
  CLASE_GRABADA, CLASE_VIVA, EVALUACIONES, HILO, MODULO, RAMO, RAMO_PROPIO,
  TAREA_PENDIENTE, APUNTE, BLOQUE, renderConNavegador, renderPantalla,
} from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(), materiaDe: jest.fn(), clasesDe: jest.fn(),
  misTareas: jest.fn(), foroDe: jest.fn(), evaluacionesDe: jest.fn(),
  miHorario: jest.fn(), companerosDe: jest.fn(), misApuntes: jest.fn(),
  marcarMaterial: jest.fn(), crearApunte: jest.fn(),
  crearModulo: jest.fn(), crearMaterial: jest.fn(), moduloParaMaterial: jest.fn(),
}));

jest.mock("../lib/archivos.ts", () => ({
  sePuedeElegirArchivo: false,
  HAY_ALMACENAMIENTO: false,
  AVISO_SIN_ALMACENAMIENTO: "Todavía no hay almacenamiento conectado.",
  elegirArchivo: jest.fn(),
  subir: jest.fn(),
}));

const anchoFalso = { valor: { width: 750, height: 1334, scale: 2, fontScale: 1 } };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => anchoFalso.valor,
}));

import * as consultas from "../lib/consultas.ts";
import Asignatura from "./Asignatura.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

function conDatos() {
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.materiaDe.mockResolvedValue([MODULO] as never);
  mock.clasesDe.mockResolvedValue([CLASE_VIVA, CLASE_GRABADA] as never);
  mock.misTareas.mockResolvedValue([TAREA_PENDIENTE] as never);
  mock.foroDe.mockResolvedValue([HILO] as never);
  mock.evaluacionesDe.mockResolvedValue(EVALUACIONES as never);
  mock.miHorario.mockResolvedValue([BLOQUE] as never);
  mock.companerosDe.mockResolvedValue([{ id: "p-1", nombre: "Josefa Pérez" }] as never);
  mock.misApuntes.mockResolvedValue([APUNTE] as never);
  mock.marcarMaterial.mockResolvedValue(undefined as never);
}

const abrir = async (seccion?: string) => {
  conDatos();
  const t = await renderPantalla(Asignatura, { asignaturaId: RAMO.id, seccion });
  await waitFor(() => expect(t.getAllByText("Cálculo I").length).toBeGreaterThan(0));
  return t;
};

/** El botón de los tres puntitos vive en la cabecera: hace falta un navegador. */
async function abrirConCabecera() {
  conDatos();
  const t = await renderConNavegador(Asignatura, { asignaturaId: RAMO.id });
  await waitFor(() => expect(t.getAllByText("Cálculo I").length).toBeGreaterThan(0));
  return t;
}

beforeEach(() => {
  jest.clearAllMocks();
  anchoFalso.valor = { width: 750, height: 1334, scale: 2, fontScale: 1 };
});

describe("Asignatura", () => {
  test("abre en Materia y muestra el módulo con su avance", async () => {
    const t = await abrir();
    expect(t.getByText("1 · Límites")).toBeTruthy();
    expect(t.getByText("1/2")).toBeTruthy();
    expect(t.getByText("Idea de límite")).toBeTruthy();
  });

  test("la fila de secciones no obliga a arrastrar", async () => {
    const t = await abrir();
    // Solo tres chips visibles; el resto vive en el menú.
    expect(t.getByText("Materia")).toBeTruthy();
    expect(t.getByText("Clases")).toBeTruthy();
    expect(t.getByText("Tareas")).toBeTruthy();
    expect(t.queryByText("Compañeros")).toBeNull();
  });

  test("el menú ofrece las nueve secciones", async () => {
    const t = await abrirConCabecera();
    fireEvent.press(t.getByLabelText("Todas las secciones"));
    await waitFor(() => expect(t.getByText("Programa del curso")).toBeTruthy());
    for (const s of ["Materia", "Clases", "Tareas", "Foro", "Mis apuntes",
                     "Notas", "Horario", "Programa del curso", "Compañeros", "Archivos"]) {
      expect(t.getAllByText(s).length).toBeGreaterThan(0);
    }
  });

  test("tocar un material sin texto marca el avance", async () => {
    const t = await abrir();
    fireEvent.press(t.getByText("Idea de límite"));
    await waitFor(() => expect(mock.marcarMaterial).toHaveBeenCalledWith("mat-1", false));
  });

  test("tocar un material con texto abre el lector", async () => {
    const t = await abrir();
    fireEvent.press(t.getByText("Apunte de límites"));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Lectura", { materialId: "mat-2" });
    // Abrir para leer no es lo mismo que darlo por visto.
    expect(mock.marcarMaterial).not.toHaveBeenCalled();
  });

  test("en un material con texto la marca es su propio botón", async () => {
    const t = await abrir();
    fireEvent.press(t.getByLabelText("Marcar Apunte de límites como visto"));
    await waitFor(() => expect(mock.marcarMaterial).toHaveBeenCalledWith("mat-2", true));
    expect(t.navigation.navigate).not.toHaveBeenCalled();
  });

  test("Clases muestra la que está en vivo y las grabadas", async () => {
    const t = await abrir("clases");
    await waitFor(() => expect(t.getByText("EN VIVO AHORA")).toBeTruthy());
    expect(t.getByText("Teorema del valor medio")).toBeTruthy();
    expect(t.getByText("Clase 12 · L'Hôpital")).toBeTruthy();
  });

  test("entrar a la clase en vivo lleva a su pantalla con el cronómetro corriendo", async () => {
    const t = await abrir("clases");
    await waitFor(() => expect(t.getByText("EN VIVO AHORA")).toBeTruthy());
    fireEvent.press(t.getByText("EN VIVO AHORA"));
    expect(t.navigation.navigate).toHaveBeenCalledWith("ClaseEnVivo", expect.objectContaining({
      titulo: "Teorema del valor medio", asignatura: "Cálculo I",
      desdeSegundos: expect.any(Number),
    }));
  });

  test("una grabada abre el reproductor con su duración", async () => {
    const t = await abrir("clases");
    await waitFor(() => expect(t.getByText("Clase 12 · L'Hôpital")).toBeTruthy());
    fireEvent.press(t.getByText("Clase 12 · L'Hôpital"));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Grabacion", expect.objectContaining({
      claseId: CLASE_GRABADA.id, duracionSeg: 3840,
    }));
  });

  test("Notas muestra la nota parcial y qué se necesita para aprobar", async () => {
    const t = await abrir("notas");
    await waitFor(() => expect(t.getByText("Nota actual")).toBeTruthy());
    // Aparece dos veces: como nota grande del ramo y en la fila del control.
    expect(t.getAllByText("6,2").length).toBe(2);
    expect(t.getByText("Con el 30% del curso evaluado")).toBeTruthy();
    expect(t.getByText("Para aprobar con 4,0")).toBeTruthy();
  });

  test("Foro fija arriba el aviso del profesor y deja abrir un hilo", async () => {
    const t = await abrir("foro");
    await waitFor(() => expect(t.getByText("Sala del control")).toBeTruthy());
    expect(t.getByText("Abrir un hilo nuevo")).toBeTruthy();
    fireEvent.press(t.getByText("Sala del control"));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Hilo", expect.objectContaining({ hiloId: HILO.id }));
  });

  test("Compañeros muestra el equipo docente y a los inscritos", async () => {
    const t = await abrir("companeros");
    await waitFor(() => expect(t.getByText("Josefa Pérez")).toBeTruthy());
    // En la cabecera del ramo y en la fila del equipo docente.
    expect(t.getAllByText("Ana Ríos").length).toBe(2);
    expect(t.getByText("Ignacio Soto")).toBeTruthy();
    expect(t.getByText("Ayudantía")).toBeTruthy();
  });

  test("Archivos reúne los documentos de todos los módulos", async () => {
    const t = await abrir("archivos");
    await waitFor(() => expect(t.getByText("Apunte de límites")).toBeTruthy());
    // El video no es un archivo descargable.
    expect(t.queryByText("Idea de límite")).toBeNull();
  });

  test("la sección elegida en el menú queda primera entre los chips", async () => {
    const t = await abrirConCabecera();
    fireEvent.press(t.getByLabelText("Todas las secciones"));
    await waitFor(() => expect(t.getByText("Compañeros")).toBeTruthy());
    fireEvent.press(t.getByText("Compañeros"));
    await waitFor(() => expect(t.getByText("Equipo docente")).toBeTruthy());
    // La activa se antepone, no reemplaza a las demás.
    expect(t.getByText("Materia")).toBeTruthy();
    expect(t.getAllByText("Curso").length).toBeGreaterThan(0);
  });

  test("Mis apuntes lista los del ramo y deja crear uno", async () => {
    const t = await abrir("apuntes");
    await waitFor(() => expect(t.getByText("Clase del valor medio")).toBeTruthy());
    expect(t.getByText("Nuevo apunte")).toBeTruthy();
    fireEvent.press(t.getByText("Clase del valor medio"));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Apunte", { apunteId: APUNTE.id });
  });
});

/** En una tablet en horizontal las nueve secciones caben a la vista. */
describe("Asignatura en pantalla amplia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    anchoFalso.valor = { width: 1194, height: 834, scale: 2, fontScale: 1 };
  });

  const abrirAncha = async () => {
    conDatos();
    const t = await renderConNavegador(Asignatura, { asignaturaId: RAMO.id });
    await waitFor(() => expect(t.getAllByText("Cálculo I").length).toBeGreaterThan(0));
    return t;
  };

  test("las nueve secciones se ven sin abrir ningún menú", async () => {
    const t = await abrirAncha();
    for (const s of ["Materia", "Clases", "Tareas", "Foro", "Mis apuntes", "Notas",
                     "Horario", "Programa del curso", "Compañeros", "Archivos"]) {
      expect(t.getAllByText(s).length).toBeGreaterThan(0);
    }
  });

  test("el botón de los tres puntitos desaparece: ya no hace falta", async () => {
    const t = await abrirAncha();
    expect(t.queryByLabelText("Todas las secciones")).toBeNull();
  });

  test("se cambia de sección desde la barra lateral", async () => {
    const t = await abrirAncha();
    fireEvent.press(t.getByText("Compañeros"));
    await waitFor(() => expect(t.getByText("Equipo docente")).toBeTruthy());
    expect(t.getByText("Josefa Pérez")).toBeTruthy();
  });

  test("en teléfono sí aparece el menú, porque las secciones no caben", async () => {
    anchoFalso.valor = { width: 390, height: 844, scale: 2, fontScale: 1 };
    conDatos();
    const t = await renderConNavegador(Asignatura, { asignaturaId: RAMO.id });
    await waitFor(() => expect(t.getAllByText("Cálculo I").length).toBeGreaterThan(0));
    expect(t.getByLabelText("Todas las secciones")).toBeTruthy();
    expect(t.queryByText("Programa del curso")).toBeNull();
  });
});

describe("Asignatura · un ramo propio", () => {
  const abrirPropio = async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([RAMO_PROPIO] as never);
    mock.materiaDe.mockResolvedValue([] as never);
    mock.moduloParaMaterial.mockResolvedValue("mod-1" as never);
    mock.crearMaterial.mockResolvedValue(undefined as never);
    const t = await renderPantalla(Asignatura, { asignaturaId: RAMO_PROPIO.id });
    await waitFor(() => expect(t.getAllByText("Inglés").length).toBeGreaterThan(0));
    return t;
  };

  test("no ofrece foro, ni notas, ni compañeros: no hay curso detrás", async () => {
    // En una tablet ancha se ven todas las secciones a la vez, así que si
    // alguna sobra se nota de inmediato.
    anchoFalso.valor = { width: 1194, height: 834, scale: 2, fontScale: 1 };
    const t = await abrirPropio();
    expect(t.queryByText("Foro")).toBeNull();
    expect(t.queryByText("Notas")).toBeNull();
    expect(t.queryByText("Compañeros")).toBeNull();
    expect(t.queryByText("Clases")).toBeNull();
    expect(t.getByText("Materia")).toBeTruthy();
    expect(t.getByText("Mis apuntes")).toBeTruthy();
  });

  test("un ramo propio vacío invita a agregar, no dice que no publicaron nada", async () => {
    anchoFalso.valor = { width: 390, height: 844, scale: 2, fontScale: 1 };
    const t = await abrirPropio();
    expect(t.getByText(/el lector te lo lee en voz alta/)).toBeTruthy();
    expect(t.getByRole("button", { name: "Agregar material" })).toBeTruthy();
  });

  test("no se pide inventar una unidad: la elige la capa de datos", async () => {
    const t = await abrirPropio();
    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Agregar material" })); });

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Título del material"), "Phrasal verbs");
    });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Texto del material"), "Look up means to search.");
    });
    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Guardar" }));
      await Promise.resolve();
    });

    await waitFor(() => expect(mock.crearMaterial).toHaveBeenCalled());
    expect(mock.moduloParaMaterial).toHaveBeenCalledWith(RAMO_PROPIO.id);
    expect(mock.crearMaterial).toHaveBeenCalledWith(expect.objectContaining({
      moduloId: "mod-1", titulo: "Phrasal verbs", tipo: "documento",
      texto: "Look up means to search.",
    }));
  });

  test("el material va a la unidad que dijo la capa de datos, sin inventar otra", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([RAMO_PROPIO] as never);
    mock.materiaDe.mockResolvedValue([{ ...MODULO, materiales: [] }] as never);
    mock.crearMaterial.mockResolvedValue(undefined as never);
    mock.moduloParaMaterial.mockResolvedValue(MODULO.id as never);
    const t = await renderPantalla(Asignatura, { asignaturaId: RAMO_PROPIO.id });
    await waitFor(() => expect(t.getAllByText("Inglés").length).toBeGreaterThan(0));

    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Agregar material" })); });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Título del material"), "Otro");
    });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Texto del material"), "Algo.");
    });
    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Guardar" }));
      await Promise.resolve();
    });

    await waitFor(() => expect(mock.crearMaterial).toHaveBeenCalled());
    // La pantalla no decide unidades: no crea ninguna por su cuenta.
    expect(mock.crearModulo).not.toHaveBeenCalled();
    expect(mock.crearMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ moduloId: MODULO.id }));
  });

  test("un ramo del colegio no ofrece agregar material desde acá", async () => {
    const t = await abrir();
    expect(t.queryByText("Agregar material")).toBeNull();
  });
});
