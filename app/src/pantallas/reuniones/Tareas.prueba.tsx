import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  REUNION, TAREAS, TAREA_AJENA, TAREA_EN_EL_AIRE, TAREA_MIA, TAREA_VENCIDA, YO,
  renderPantalla, tocar,
} from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misTareasDeTodas: jest.fn(),
  quienSoy: jest.fn(),
  marcarTarea: jest.fn(),
}));

import * as consultas from "../../lib/consultas.ts";
import Tareas from "./Tareas.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const conDatos = () => {
  mock.misTareasDeTodas.mockResolvedValue(TAREAS as never);
  mock.quienSoy.mockResolvedValue(YO as never);
  mock.marcarTarea.mockResolvedValue(undefined as never);
};

beforeEach(() => jest.clearAllMocks());

describe("todas las tareas", () => {
  test("empieza por las mías, que es lo que uno viene a ver", async () => {
    conDatos();
    const t = await renderPantalla(Tareas);
    await waitFor(() => expect(t.getByText(TAREA_MIA.que)).toBeTruthy());
    expect(t.queryByText(TAREA_AJENA.que)).toBeNull();
  });

  test("en Todas aparecen también las de otros", async () => {
    conDatos();
    const t = await renderPantalla(Tareas);
    await waitFor(() => expect(t.getByText(TAREA_MIA.que)).toBeTruthy());
    await tocar(() => fireEvent.press(t.getByLabelText(/^Todas/)));
    expect(t.getByText(TAREA_AJENA.que)).toBeTruthy();
  });

  test("En el aire son solo las que quedaron sin dueño y sin fecha", async () => {
    conDatos();
    const t = await renderPantalla(Tareas);
    await tocar(() => fireEvent.press(t.getByLabelText(/^En el aire/)));

    expect(t.getByText(TAREA_EN_EL_AIRE.que)).toBeTruthy();
    expect(t.queryByText(TAREA_MIA.que)).toBeNull();
    expect(t.getByText(/se pierde entre una reunión y la siguiente/)).toBeTruthy();
  });

  test("cada tarea dice de qué reunión salió y lleva a ella", async () => {
    conDatos();
    const t = await renderPantalla(Tareas);
    await waitFor(() => expect(t.getAllByText(REUNION.titulo).length).toBeGreaterThan(0));

    fireEvent.press(t.getAllByLabelText(`Ir a ${REUNION.titulo}`)[0]!);
    expect(t.navigation.navigate).toHaveBeenCalledWith("Reunion", { reunionId: REUNION.id });
  });

  test("marcar una tarea la guarda", async () => {
    conDatos();
    const t = await renderPantalla(Tareas);
    await waitFor(() => expect(t.getByLabelText(`Marcar ${TAREA_MIA.que} como hecha`)).toBeTruthy());

    await tocar(() => fireEvent.press(t.getByLabelText(`Marcar ${TAREA_MIA.que} como hecha`)));
    await waitFor(() => expect(mock.marcarTarea).toHaveBeenCalledWith(TAREA_MIA.id, true));
  });

  test("lo vencido se dice con todas sus letras", async () => {
    conDatos();
    const t = await renderPantalla(Tareas);
    await waitFor(() => expect(t.getByText(TAREA_VENCIDA.que)).toBeTruthy());
    expect(t.getByText(/venció hace 3 días/)).toBeTruthy();
  });

  test("sin nada mío lo dice, en vez de dejar la pantalla en blanco", async () => {
    conDatos();
    mock.misTareasDeTodas.mockResolvedValue([TAREA_AJENA] as never);
    const t = await renderPantalla(Tareas);
    await waitFor(() =>
      expect(t.getByText("No tienes nada pendiente a tu nombre.")).toBeTruthy());
  });
});
