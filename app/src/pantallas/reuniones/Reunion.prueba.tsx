import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  COMPLETA, TAREA_EN_EL_AIRE, TAREA_MIA, TAREA_VENCIDA, YO,
  renderPantalla, tocar,
} from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  reunionPorId: jest.fn(),
  quienSoy: jest.fn(),
  marcarTarea: jest.fn(),
  agregarTarea: jest.fn(),
}));

import * as consultas from "../../lib/consultas.ts";
import Reunion from "./Reunion.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const conDatos = (extra: Partial<typeof COMPLETA> = {}) => {
  mock.reunionPorId.mockResolvedValue({ ...COMPLETA, ...extra } as never);
  mock.quienSoy.mockResolvedValue(YO as never);
  mock.marcarTarea.mockResolvedValue(undefined as never);
  mock.agregarTarea.mockResolvedValue(undefined as never);
};

const abrir = () => renderPantalla(Reunion, { reunionId: COMPLETA.id });

beforeEach(() => jest.clearAllMocks());

describe("una reunión analizada", () => {
  test("lo primero que se ve es lo que hay que hacer algo al respecto", async () => {
    conDatos();
    const t = await abrir();
    await waitFor(() => expect(t.getByText(/plazo vencido/)).toBeTruthy());
    expect(t.getByText(/sin nadie a cargo/)).toBeTruthy();
    expect(t.getByText(/no todos entendieron lo mismo/)).toBeTruthy();
  });

  test("muestra las cuatro cosas: qué se hizo, qué hacer, qué falta y qué llevar", async () => {
    conDatos();
    const t = await abrir();
    await waitFor(() => expect(t.getByText("Qué se hizo")).toBeTruthy());
    expect(t.getByText(COMPLETA.resumen)).toBeTruthy();
    expect(t.getByText("Qué hay que hacer")).toBeTruthy();
    expect(t.getByText("Qué quedó sin cerrar")).toBeTruthy();
    expect(t.getByText("Qué no se alcanzó a tratar")).toBeTruthy();
    expect(t.getByText("Qué llevar la próxima vez")).toBeTruthy();
  });

  test("un compromiso sin dueño ni fecha se marca en vez de disimularse", async () => {
    conDatos();
    const t = await abrir();
    await waitFor(() => expect(t.getByText(TAREA_EN_EL_AIRE.que)).toBeTruthy());
    expect(t.getByText("EN EL AIRE")).toBeTruthy();
    expect(t.getByText(/sin responsable · sin plazo/)).toBeTruthy();
  });

  test("un acuerdo que solo se propuso no se muestra como acordado", async () => {
    conDatos();
    const t = await abrir();
    await waitFor(() => expect(t.getByText("Lo que se acordó")).toBeTruthy());
    expect(t.getByText("SOLO PROPUESTO")).toBeTruthy();
  });

  test("marcar una tarea la guarda y vuelve a leer la reunión", async () => {
    conDatos();
    const t = await abrir();
    await waitFor(() => expect(t.getByText(TAREA_MIA.que)).toBeTruthy());

    await tocar(() => fireEvent.press(t.getByLabelText(`Marcar ${TAREA_MIA.que} como hecha`)));
    await waitFor(() => expect(mock.marcarTarea).toHaveBeenCalledWith(TAREA_MIA.id, true));
    expect(mock.reunionPorId.mock.calls.length).toBeGreaterThan(1);
  });

  test("una tarea ya hecha se ofrece para desmarcar", async () => {
    conDatos({ tareas: [{ ...TAREA_MIA, lista: true }] });
    const t = await abrir();
    await waitFor(() => expect(t.getByLabelText(`Desmarcar ${TAREA_MIA.que}`)).toBeTruthy());
  });

  test("se puede anotar algo que la reunión dejó fuera", async () => {
    conDatos();
    const t = await abrir();
    await waitFor(() => expect(t.getByLabelText("Nueva tarea")).toBeTruthy());

    await tocar(() => fireEvent.changeText(t.getByLabelText("Nueva tarea"), "  Confirmar el quórum  "));
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Agregar" })));

    await waitFor(() => expect(mock.agregarTarea)
      .toHaveBeenCalledWith(COMPLETA.id, "Confirmar el quórum"));
  });

  test("quien solo puede leer no ve por dónde escribir", async () => {
    conDatos({ puedo_editar: false, mia: false });
    const t = await abrir();
    await waitFor(() => expect(t.getByText("Qué se hizo")).toBeTruthy());
    expect(t.queryByLabelText("Nueva tarea")).toBeNull();
  });

  test("una reunión sin sobresaltos no inventa alarmas", async () => {
    conDatos({
      tareas: [TAREA_MIA], contradicciones: [], sinTratar: [], pendientes: [],
    });
    const t = await abrir();
    await waitFor(() => expect(t.getByText("Qué se hizo")).toBeTruthy());
    expect(t.queryByText(/plazo vencido/)).toBeNull();
    expect(t.queryByText("Qué quedó sin cerrar")).toBeNull();
    expect(t.queryByText("Qué no se alcanzó a tratar")).toBeNull();
  });

  test("mientras el equipo trabaja lo dice, con los nombres de los tres", async () => {
    conDatos({ estado: "analizando" });
    const t = await abrir();
    await waitFor(() => expect(t.getByText("El equipo está trabajando")).toBeTruthy());
    expect(t.getByText(/Relator escucha, Actuario redacta y Analista/)).toBeTruthy();
  });

  test("una reunión sin grabar ofrece ir a grabarla", async () => {
    conDatos({ estado: "borrador" });
    const t = await abrir();
    await waitFor(() => expect(t.getByText("Esta reunión todavía no se graba")).toBeTruthy());

    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Ir a grabar" })));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Grabar", { reunionId: COMPLETA.id });
  });

  test("si el análisis falló lo dice sin perder la transcripción", async () => {
    conDatos({ estado: "falló" });
    const t = await abrir();
    await waitFor(() => expect(t.getByText("No pude analizar esta reunión")).toBeTruthy());
    expect(t.getByText(/La transcripción quedó guardada/)).toBeTruthy();
  });

  test("si la reunión no existe lo dice en vez de quedarse en blanco", async () => {
    mock.reunionPorId.mockResolvedValue(null as never);
    mock.quienSoy.mockResolvedValue(YO as never);
    const t = await abrir();
    await waitFor(() => expect(t.getByText("No encontré esa reunión.")).toBeTruthy());
  });

  test("si la consulta falla, lo dice y ofrece reintentar", async () => {
    mock.reunionPorId.mockRejectedValue(new globalThis.Error("No pude cargar la reunión"));
    mock.quienSoy.mockResolvedValue(YO as never);
    const t = await abrir();
    await waitFor(() => expect(t.getByText("No pude cargar la reunión")).toBeTruthy());
    expect(t.getByText("Reintentar")).toBeTruthy();
  });

  test("la tarea vencida se ve como vencida", async () => {
    conDatos();
    const t = await abrir();
    await waitFor(() => expect(t.getByText(TAREA_VENCIDA.que)).toBeTruthy());
    expect(t.getByText(/venció hace 3 días/)).toBeTruthy();
  });
});
