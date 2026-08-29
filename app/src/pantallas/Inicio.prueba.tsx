import { act, fireEvent, waitFor } from "@testing-library/react-native";
import {
  BLOQUE, BLOQUE_TEMPRANO, CLASE_VIVA, EVALUACIONES, NOTIFICACION, RAMO, RAMO_2,
  RAMO_PROPIO,
  TAREA_ATRASADA, TAREA_ENTREGADA, TAREA_PENDIENTE, renderPantalla,
} from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  crearHorarioPropio: jest.fn(),
  crearMaterial: jest.fn(),
  moduloParaMaterial: jest.fn(),
  misTareas: jest.fn(),
  miHorario: jest.fn(),
  claseEnVivo: jest.fn(),
  misNotificaciones: jest.fn(),
  todasLasEvaluaciones: jest.fn(),
  crearRamoPropio: jest.fn(),
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
    expect(t.getAllByText("6,2").length).toBe(2);
  });

  test("el día se lee de la primera clase a la última, no como venga", async () => {
    conDatos();
    // La base los devuelve al revés: primero el de las 08:30.
    mock.miHorario.mockResolvedValue([BLOQUE, BLOQUE_TEMPRANO] as never);
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("07:00")).toBeTruthy());
    const horas = t.getAllByText(/^\d\d:\d\d$/).map((n) => n.props.children);
    expect(horas).toEqual(["07:00", "08:30"]);
  });

  test("anuncia la clase en vivo y lleva a su asignatura", async () => {
    conDatos();
    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("En vivo ahora")).toBeTruthy());
    fireEvent.press(t.getByText("En vivo ahora"));
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
    expect(t.queryByText("En vivo ahora")).toBeNull();
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

describe("Inicio · lo que la persona arma por su cuenta", () => {
  test("los ramos propios van en su propia sección, no mezclados con los del colegio", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([RAMO, RAMO_2, RAMO_PROPIO] as never);
    const t = await renderPantalla(Inicio);

    await waitFor(() => expect(t.getByText("Lo mío")).toBeTruthy());
    expect(t.getByText("Inglés")).toBeTruthy();
    // Y no se cuela entre las tarjetas del colegio, que llevan nota: son dos.
    expect(t.getAllByText("6,2")).toHaveLength(2);
  });

  test("quien no tiene institución no ve horario, ni entregas, ni notas", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    mock.misTareas.mockResolvedValue([] as never);
    mock.miHorario.mockResolvedValue([] as never);
    mock.claseEnVivo.mockResolvedValue(null as never);
    mock.todasLasEvaluaciones.mockResolvedValue(new Map() as never);

    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("Lo mío")).toBeTruthy());

    expect(t.queryByText("Hoy")).toBeNull();
    expect(t.queryByText("Próximas entregas")).toBeNull();
    expect(t.queryByText("Mis asignaturas")).toBeNull();
    // En vez de secciones vacías, le dice por dónde empezar y le da los tres
    // caminos, cada uno explicado en una línea.
    expect(t.getByText(/Todavía no tienes nada/)).toBeTruthy();
    expect(t.getByRole("button", { name: "Cargar mi horario" })).toBeTruthy();
    expect(t.getByRole("button", { name: "Crear un ramo" })).toBeTruthy();
    expect(t.getByRole("button", { name: "Subir material" })).toBeTruthy();
  });

  test("subir material sin tener ningún ramo crea el ramo con el material", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    mock.miHorario.mockResolvedValue([] as never);
    mock.claseEnVivo.mockResolvedValue(null as never);
    mock.crearRamoPropio.mockResolvedValue(RAMO_PROPIO as never);
    mock.moduloParaMaterial.mockResolvedValue("mod-1" as never);
    mock.crearMaterial.mockResolvedValue(undefined as never);
    const t = await renderPantalla(Inicio);

    const abrir = () => t.getByRole("button", { name: "Subir material" });
    await waitFor(() => expect(abrir()).toBeTruthy());
    await act(async () => { fireEvent.press(abrir()); });

    // Sin ramos, el ramo se escribe acá mismo: no hay que salir a crearlo.
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Ramo nuevo"), "Inglés");
    });
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
    expect(mock.crearRamoPropio).toHaveBeenCalledWith("Inglés", expect.any(String));
    expect(mock.moduloParaMaterial).toHaveBeenCalledWith(RAMO_PROPIO.id);
    expect(mock.crearMaterial).toHaveBeenCalledWith(expect.objectContaining({
      moduloId: "mod-1", titulo: "Phrasal verbs", texto: "Look up means to search.",
    }));
  });

  test("con ramos ya creados, se elige a cuál va el material", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([RAMO_PROPIO] as never);
    mock.miHorario.mockResolvedValue([] as never);
    mock.claseEnVivo.mockResolvedValue(null as never);
    mock.moduloParaMaterial.mockResolvedValue("mod-9" as never);
    mock.crearMaterial.mockResolvedValue(undefined as never);
    const t = await renderPantalla(Inicio);

    await waitFor(() => expect(t.getByLabelText("Subir material")).toBeTruthy());
    await act(async () => { fireEvent.press(t.getByLabelText("Subir material")); });

    await act(async () => { fireEvent.press(t.getByLabelText(RAMO_PROPIO.nombre)); });
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
    // El ramo ya existía: no se crea ninguno.
    expect(mock.crearRamoPropio).not.toHaveBeenCalled();
    expect(mock.moduloParaMaterial).toHaveBeenCalledWith(RAMO_PROPIO.id);
  });

  test("con horario propio sí ve su día, aunque no tenga institución", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([RAMO_PROPIO] as never);
    mock.misTareas.mockResolvedValue([] as never);
    mock.claseEnVivo.mockResolvedValue(null as never);
    mock.todasLasEvaluaciones.mockResolvedValue(new Map() as never);
    mock.miHorario.mockResolvedValue([
      { ...BLOQUE, asignatura_id: RAMO_PROPIO.id },
    ] as never);

    const t = await renderPantalla(Inicio);
    await waitFor(() => expect(t.getByText("Hoy")).toBeTruthy());
    expect(t.getByText("08:30")).toBeTruthy();
    // Sigue sin institución: nada de entregas ni de notas.
    expect(t.queryByText("Próximas entregas")).toBeNull();
    expect(t.queryByText("Mis asignaturas")).toBeNull();
  });

  test("cargar el horario crea todos los ramos de una vez", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    mock.miHorario.mockResolvedValue([] as never);
    mock.claseEnVivo.mockResolvedValue(null as never);
    mock.crearHorarioPropio.mockResolvedValue([] as never);
    const t = await renderPantalla(Inicio);

    const abrir = () => t.getByRole("button", { name: "Cargar mi horario" });
    await waitFor(() => expect(abrir()).toBeTruthy());
    await act(async () => { fireEvent.press(abrir()); });

    await act(async () => {
      fireEvent.changeText(
        t.getByLabelText("Tu horario"),
        "Cálculo I\nlunes 8:30 a 10:00\nFísica I, martes 14:00-16:00",
      );
    });

    // Antes de crear nada muestra lo que va a crear.
    expect(t.getByText("Se van a crear 2 ramos · 2 bloques")).toBeTruthy();

    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Crear mis ramos" }));
    });

    expect(mock.crearHorarioPropio).toHaveBeenCalledWith([
      { nombre: "Cálculo I", bloques: [
        { dia: 1, inicio: "08:30", fin: "10:00", sala: "", tipo: "Clase" }] },
      { nombre: "Física I", bloques: [
        { dia: 2, inicio: "14:00", fin: "16:00", sala: "", tipo: "Clase" }] },
    ], 0);
  });

  test("una línea que no se entiende se avisa y no impide crear el resto", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    mock.miHorario.mockResolvedValue([] as never);
    mock.claseEnVivo.mockResolvedValue(null as never);
    const t = await renderPantalla(Inicio);

    const abrir = () => t.getByRole("button", { name: "Cargar mi horario" });
    await waitFor(() => expect(abrir()).toBeTruthy());
    await act(async () => { fireEvent.press(abrir()); });
    await act(async () => {
      fireEvent.changeText(
        t.getByLabelText("Tu horario"),
        "Cálculo I\nlunes 8:30 a 10:00\nlunes 14:00 a 10:00",
      );
    });

    expect(t.getByText("Hay una línea que no entendí")).toBeTruthy();
    expect(t.getByText(/Línea 3/)).toBeTruthy();
    // El ramo bueno sigue en pie y el botón sigue habilitado.
    expect(t.getByText("Se va a crear · 1 bloque")).toBeTruthy();
  });

  test("crear un ramo lo guarda y vuelve a cargar la lista", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    mock.crearRamoPropio.mockResolvedValue(RAMO_PROPIO as never);
    const t = await renderPantalla(Inicio);

    // Sin ramos todavía, el acceso está en la tarjeta vacía, no en la cabecera.
    const abrir = () => t.getByRole("button", { name: "Crear un ramo" });
    await waitFor(() => expect(abrir()).toBeTruthy());
    await act(async () => { fireEvent.press(abrir()); });

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Nombre del ramo"), "Inglés");
    });
    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Crear ramo" }));
      await Promise.resolve();
    });

    await waitFor(() => expect(mock.crearRamoPropio).toHaveBeenCalledWith("Inglés", expect.any(String)));
    // Y no se queda con la lista vieja: la pantalla vuelve a preguntar.
    expect(mock.misAsignaturas.mock.calls.length).toBeGreaterThan(1);
  });

  test("sin nombre no deja crear el ramo", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    const t = await renderPantalla(Inicio);

    // Sin ramos todavía, el acceso está en la tarjeta vacía, no en la cabecera.
    const abrir = () => t.getByRole("button", { name: "Crear un ramo" });
    await waitFor(() => expect(abrir()).toBeTruthy());
    await act(async () => { fireEvent.press(abrir()); });

    expect(t.getByRole("button", { name: "Crear ramo" })).toBeDisabled();
  });
});
