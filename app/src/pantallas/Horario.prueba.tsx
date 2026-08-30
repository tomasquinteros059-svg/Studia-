import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RAMO, RAMO_2, renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  miHorario: jest.fn(),
  misAsignaturas: jest.fn(),
  misTareas: jest.fn(),
  misSesiones: jest.fn(),
  crearSesion: jest.fn(),
  marcarSesion: jest.fn(),
  borrarSesion: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import Planificador from "./Horario.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

// El lunes de la semana en curso, para que las fechas caigan donde se espera
// sin depender del día en que se corran las pruebas.
const lunes = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
})();
const enLaSemana = (dia: number, h: number, m = 0) =>
  new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + dia, h, m);

const BLOQUE = {
  id: "b-1", asignatura_id: RAMO.id, dia: 2,
  hora_inicio: "10:15:00", hora_fin: "11:45:00", sala: "B-21", tipo: "catedra",
};

const SESION = {
  id: "s-1", asignatura_id: RAMO.id, titulo: "Ejercicios guía 5",
  empieza_en: enLaSemana(1, 17).toISOString(), minutos: 60, hecha_en: null,
};

const abrir = async (datos?: {
  bloques?: unknown[]; tareas?: unknown[]; sesiones?: unknown[];
}) => {
  mock.miHorario.mockResolvedValue((datos?.bloques ?? [BLOQUE]) as never);
  mock.misAsignaturas.mockResolvedValue([RAMO, RAMO_2] as never);
  mock.misTareas.mockResolvedValue((datos?.tareas ?? []) as never);
  mock.misSesiones.mockResolvedValue((datos?.sesiones ?? []) as never);
  mock.crearSesion.mockResolvedValue(SESION as never);
  mock.marcarSesion.mockResolvedValue(undefined as never);
  mock.borrarSesion.mockResolvedValue(undefined as never);

  const t = await renderPantalla(Planificador);
  await waitFor(() => expect(mock.misSesiones).toHaveBeenCalled());
  return t;
};

beforeEach(() => jest.clearAllMocks());

describe("el planificador", () => {
  test("muestra los siete días, con la clase donde el horario la puso", async () => {
    const t = await abrir();

    for (const dia of ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]) {
      expect(t.getAllByText(new RegExp(`^${dia}`)).length).toBeGreaterThan(0);
    }
    expect(t.getByText("10:15–11:45 · B-21")).toBeTruthy();
  });

  test("pide las sesiones de la semana que se está mirando, no todas", async () => {
    await abrir();
    const [desde, hasta] = mock.misSesiones.mock.calls[0] ?? [];
    expect((desde as Date).getTime()).toBe(lunes.getTime());
    // Siete días exactos, y el final excluido: si no, el lunes siguiente se
    // colaría en las dos semanas.
    expect((hasta as Date).getTime() - (desde as Date).getTime()).toBe(7 * 86_400_000);
  });

  test("cambiar de semana vuelve a preguntar por otras fechas", async () => {
    const t = await abrir();
    const primerLunes = mock.misSesiones.mock.calls[0]?.[0] as Date;

    await act(async () => { fireEvent.press(t.getByLabelText("Semana siguiente")); });
    await waitFor(() => expect(mock.misSesiones).toHaveBeenCalledTimes(2));

    const segundoLunes = mock.misSesiones.mock.calls[1]?.[0] as Date;
    expect(segundoLunes.getTime() - primerLunes.getTime()).toBe(7 * 86_400_000);
  });

  test("el botón de volver a hoy solo aparece cuando te fuiste de la semana", async () => {
    const t = await abrir();
    expect(t.queryByText("Hoy")).toBeNull();

    await act(async () => { fireEvent.press(t.getByLabelText("Semana siguiente")); });
    await waitFor(() => expect(t.getByText("Hoy")).toBeTruthy());

    await act(async () => { fireEvent.press(t.getByText("Hoy")); });
    await waitFor(() => expect(t.queryByText("Hoy")).toBeNull());
  });

  test("sin sesiones dice qué hacer, en vez de mostrar un total en cero", async () => {
    const t = await abrir();
    expect(t.getByText(/Todavía no reservaste tiempo/)).toBeTruthy();
    expect(t.queryByText(/Total/)).toBeNull();
  });

  test("con sesiones aparece cuánto se le está dando a cada ramo", async () => {
    const t = await abrir({ sesiones: [SESION] });

    expect(t.getByLabelText("Cálculo I: 1 h esta semana")).toBeTruthy();
    expect(t.getByText(/^Total/)).toBeTruthy();
  });

  test("marcar una sesión como hecha la manda a la base y recarga", async () => {
    const t = await abrir({ sesiones: [SESION] });

    await act(async () => {
      fireEvent.press(t.getByLabelText("Marcar como hecha: Ejercicios guía 5"));
    });

    await waitFor(() => expect(mock.marcarSesion).toHaveBeenCalledWith("s-1", true));
    expect(mock.misSesiones).toHaveBeenCalledTimes(2);
  });

  test("una sesión ya hecha se puede volver a dejar pendiente", async () => {
    const t = await abrir({
      sesiones: [{ ...SESION, hecha_en: new Date().toISOString() }],
    });

    await act(async () => {
      fireEvent.press(t.getByLabelText("Desmarcar: Ejercicios guía 5"));
    });
    await waitFor(() => expect(mock.marcarSesion).toHaveBeenCalledWith("s-1", false));
  });

  test("agregar una sesión la guarda en el día que se apretó", async () => {
    const t = await abrir();

    // El miércoles de esta semana.
    await act(async () => {
      fireEvent.press(t.getByLabelText(`Agregar una sesión el Mié ${enLaSemana(2, 0).getDate()}`));
    });

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Qué vas a hacer"), "Leer el capítulo 4");
    });
    await act(async () => { fireEvent.press(t.getByLabelText("1 h 30")); });
    await act(async () => { fireEvent.press(t.getByText("Reservar el tiempo")); });

    await waitFor(() => expect(mock.crearSesion).toHaveBeenCalled());
    const guardada = mock.crearSesion.mock.calls[0]?.[0];
    expect(guardada?.titulo).toBe("Leer el capítulo 4");
    expect(guardada?.minutos).toBe(90);
    // Sin elegir ramo, la sesión es de nadie: quien estudia por su cuenta
    // también planifica.
    expect(guardada?.asignaturaId).toBeNull();
    expect(guardada?.empiezaEn.getDate()).toBe(enLaSemana(2, 0).getDate());
    // La hora sugerida de un día sin nada.
    expect(guardada?.empiezaEn.getHours()).toBe(17);
  });

  test("una sesión sin nombre no se guarda, y se dice por qué", async () => {
    const t = await abrir();

    await act(async () => {
      fireEvent.press(t.getByLabelText(`Agregar una sesión el Mié ${enLaSemana(2, 0).getDate()}`));
    });
    await act(async () => { fireEvent.press(t.getByText("Reservar el tiempo")); });

    expect(t.getByText(/Ponle un nombre/)).toBeTruthy();
    expect(mock.crearSesion).not.toHaveBeenCalled();
  });

  test("una hora que no se entiende tampoco se guarda en silencio", async () => {
    const t = await abrir();

    await act(async () => {
      fireEvent.press(t.getByLabelText(`Agregar una sesión el Mié ${enLaSemana(2, 0).getDate()}`));
    });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Qué vas a hacer"), "algo");
    });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("A qué hora"), "en la tarde");
    });
    await act(async () => { fireEvent.press(t.getByText("Reservar el tiempo")); });

    expect(t.getByText(/Escríbela como 17:30/)).toBeTruthy();
    expect(mock.crearSesion).not.toHaveBeenCalled();
  });

  test("elegir un ramo lo guarda con la sesión", async () => {
    const t = await abrir();

    await act(async () => {
      fireEvent.press(t.getByLabelText(`Agregar una sesión el Mié ${enLaSemana(2, 0).getDate()}`));
    });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Qué vas a hacer"), "Guía 5");
    });
    await act(async () => { fireEvent.press(t.getByLabelText("Cálculo I")); });
    await act(async () => { fireEvent.press(t.getByText("Reservar el tiempo")); });

    await waitFor(() => expect(mock.crearSesion).toHaveBeenCalled());
    expect(mock.crearSesion.mock.calls[0]?.[0]?.asignaturaId).toBe(RAMO.id);
  });

  test("avisa de lo que vence sin tiempo reservado antes", async () => {
    const t = await abrir({
      tareas: [{
        id: "t-1", asignatura_id: RAMO.id, titulo: "Tarea 3",
        vence_en: enLaSemana(4, 23, 59).toISOString(), entregada_en: null,
      }],
    });

    expect(t.getByText(/«Tarea 3» de Cálculo I vence el viernes/)).toBeTruthy();
  });

  test("y no avisa cuando el tiempo ya está reservado", async () => {
    const t = await abrir({
      tareas: [{
        id: "t-1", asignatura_id: RAMO.id, titulo: "Tarea 3",
        vence_en: enLaSemana(4, 23, 59).toISOString(), entregada_en: null,
      }],
      sesiones: [SESION],
    });

    expect(t.queryByText(/vence el viernes/)).toBeNull();
  });

  test("lo que vence aparece en su día, con la hora", async () => {
    const t = await abrir({
      tareas: [{
        id: "t-1", asignatura_id: RAMO.id, titulo: "Tarea 3",
        vence_en: enLaSemana(4, 23, 59).toISOString(), entregada_en: null,
      }],
    });

    expect(t.getByText("Tarea 3")).toBeTruthy();
    expect(t.getByText("vence 23:59")).toBeTruthy();
  });
});
