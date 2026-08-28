import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  REUNION, REUNION_2, TAREAS, YO, renderPantalla, tocar,
} from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/avisos.ts", () => ({
  hayAvisos: true,
  AVISO_SIN_AVISOS: "sin avisos",
  pedirPermiso: jest.fn().mockResolvedValue("concedido"),
  programarAvisos: jest.fn().mockResolvedValue(8),
}));

jest.mock("../../lib/consultas.ts", () => ({
  misReuniones: jest.fn(),
  misTareasDeTodas: jest.fn(),
  quienSoy: jest.fn(),
  crearReunion: jest.fn(),
}));

import * as avisos from "../../lib/avisos.ts";
import * as consultas from "../../lib/consultas.ts";
import Reuniones from "./Reuniones.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockAvisos = avisos as jest.Mocked<typeof avisos>;

const conDatos = () => {
  mock.misReuniones.mockResolvedValue([REUNION_2, REUNION] as never);
  mock.misTareasDeTodas.mockResolvedValue(TAREAS as never);
  mock.quienSoy.mockResolvedValue(YO as never);
  mock.crearReunion.mockResolvedValue(REUNION as never);
};

beforeEach(() => jest.clearAllMocks());

describe("la lista de reuniones", () => {
  test("muestra las reuniones con su rubro y sus pendientes", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByText(REUNION.titulo)).toBeTruthy());
    expect(t.getByText(REUNION_2.titulo)).toBeTruthy();
    expect(t.getByText(/Administración de edificios/)).toBeTruthy();
    expect(t.getByText(/4 tareas pendientes/)).toBeTruthy();
  });

  test("avisa arriba si algo mío está vencido", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByText(/plazo vencido/)).toBeTruthy());
  });

  test("lo que me toca son mis tareas, no las de todos", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByText("Lo que me toca")).toBeTruthy());
    expect(t.queryByText("Revisar la póliza")).toBeNull();
  });

  test("abrir una reunión lleva a la reunión", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByLabelText(`Abrir ${REUNION.titulo}`)).toBeTruthy());
    fireEvent.press(t.getByLabelText(`Abrir ${REUNION.titulo}`));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Reunion", { reunionId: REUNION.id });
  });

  test("sin reuniones dice qué hace la app en vez de dejar el hueco", async () => {
    conDatos();
    mock.misReuniones.mockResolvedValue([] as never);
    mock.misTareasDeTodas.mockResolvedValue([] as never);
    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByText(/escucha, la redacta y te dice qué/)).toBeTruthy());
  });

  test("una reunión sin analizar dice en qué va", async () => {
    conDatos();
    mock.misReuniones.mockResolvedValue([{ ...REUNION, estado: "analizando" }] as never);
    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByText("El equipo está trabajando…")).toBeTruthy());
  });

  test("crear una reunión la crea y lleva derecho a grabarla", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByLabelText("Nueva reunión")).toBeTruthy());

    await tocar(() => fireEvent.press(t.getByLabelText("Nueva reunión")));
    await tocar(() => fireEvent.changeText(
      t.getByLabelText("Título de la reunión"), "Comité del jueves"));
    await tocar(() => fireEvent.press(t.getByLabelText("Ingeniería y obras")));
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Empezar" })));

    await waitFor(() => expect(mock.crearReunion).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Comité del jueves", rubro: "obras" })));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Grabar", { reunionId: REUNION.id });
  });

  test("sin elegir el rubro no se puede empezar: de eso depende el equipo", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await tocar(() => fireEvent.press(t.getByLabelText("Nueva reunión")));
    await tocar(() => fireEvent.changeText(
      t.getByLabelText("Título de la reunión"), "Comité del jueves"));

    expect(t.getByRole("button", { name: "Empezar" })).toBeDisabled();
  });

  test("al elegir el rubro se ve qué equipo queda y su advertencia", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await tocar(() => fireEvent.press(t.getByLabelText("Nueva reunión")));
    await tocar(() => fireEvent.press(t.getByLabelText("Equipos clínicos y de salud")));

    expect(t.getByText("Relator")).toBeTruthy();
    expect(t.getByText("Actuario")).toBeTruthy();
    expect(t.getByText("Analista")).toBeTruthy();
    expect(t.getByText(/no debe llevar nombres, RUT ni número de ficha/)).toBeTruthy();
  });

  test("una reunión agendada deja los avisos puestos y NO lleva a grabar ahora", async () => {
    conDatos();
    const agendada = { ...REUNION, programada_para: new Date(Date.now() + 86_400_000).toISOString(), repite: "cada_semana" as const };
    mock.crearReunion.mockResolvedValue(agendada as never);

    const t = await renderPantalla(Reuniones);
    await tocar(() => fireEvent.press(t.getByLabelText("Nueva reunión")));
    await tocar(() => fireEvent.changeText(t.getByLabelText("Título de la reunión"), "Obra semanal"));
    await tocar(() => fireEvent.press(t.getByLabelText("Ingeniería y obras")));
    await tocar(() => fireEvent.press(t.getByLabelText("Agendarla para otro día")));
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Agendar" })));

    await waitFor(() => expect(mockAvisos.programarAvisos).toHaveBeenCalledWith(
      agendada.id, agendada.titulo,
      expect.objectContaining({ repite: "cada_semana" })));
    // El permiso se pide al agendar, que es cuando se entiende para qué.
    expect(mockAvisos.pedirPermiso).toHaveBeenCalled();
    // Y no se la lleva a grabar: agendarla es justo lo contrario.
    expect(t.navigation.navigate).not.toHaveBeenCalledWith("Grabar", expect.anything());
  });

  test("una reunión agendada dice en la lista cuándo es y cada cuánto", async () => {
    conDatos();
    mock.misReuniones.mockResolvedValue([{
      ...REUNION, estado: "borrador",
      programada_para: new Date(Date.now() + 86_400_000).toISOString(),
      repite: "cada_semana",
    }] as never);

    const t = await renderPantalla(Reuniones);
    await waitFor(() => expect(t.getByText(/Agendada mañana a las/)).toBeTruthy());
    expect(t.getByText(/cada semana/)).toBeTruthy();
  });

  test("los participantes y la tabla se mandan una por línea, sin viñetas", async () => {
    conDatos();
    const t = await renderPantalla(Reuniones);
    await tocar(() => fireEvent.press(t.getByLabelText("Nueva reunión")));
    await tocar(() => fireEvent.changeText(t.getByLabelText("Título de la reunión"), "Comité"));
    await tocar(() => fireEvent.press(t.getByLabelText("Gerencia y equipos de trabajo")));
    await tocar(() => fireEvent.changeText(
      t.getByLabelText("Participantes"), "Ana\n\n- Pedro\n  "));
    await tocar(() => fireEvent.changeText(
      t.getByLabelText("Tabla de la reunión"), "• Presupuesto\nDotación"));
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Empezar" })));

    await waitFor(() => expect(mock.crearReunion).toHaveBeenCalledWith(
      expect.objectContaining({
        participantes: ["Ana", "Pedro"],
        tabla: ["Presupuesto", "Dotación"],
      })));
  });
});
