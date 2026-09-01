import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  tareaPorId: jest.fn(),
  entregarTarea: jest.fn(),
}));
jest.mock("../lib/archivos.ts", () => ({
  sePuedeElegirArchivo: true,
  HAY_ALMACENAMIENTO: true,
  AVISO_SIN_ALMACENAMIENTO: "Guardar archivos necesita el servidor conectado.",
  elegirArchivo: jest.fn(),
  subir: jest.fn(),
  miEspacio: jest.fn(),
  direccionFirmada: jest.fn(),
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: "opened" })),
}));

import * as consultas from "../lib/consultas.ts";
import * as archivos from "../lib/archivos.ts";
import * as WebBrowser from "expo-web-browser";
import Tarea from "./Tarea.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockA = archivos as jest.Mocked<typeof archivos>;
const mockNav = WebBrowser as jest.Mocked<typeof WebBrowser>;

const TAREA = {
  id: "t1", asignatura_id: "r-cal", titulo: "Guía 4 · Optimización",
  enunciado: "Resuelve los 9 problemas.", criterios: ["El diagrama"],
  puntos: 20, vence_en: new Date(Date.now() + 86_400_000).toISOString(),
  entregada_en: null as string | null, puntos_obtenidos: null as number | null,
  entregado: null as string | null,
};

const ARCHIVO = { nombre: "guia-4.pdf", mime: "application/pdf", tamano: 120_000, uri: "file:///guia-4.pdf" };

/** Aprieta el botón que la alerta de confirmación ofrece. */
const confirmar = async () => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as
    { text: string; onPress?: () => void }[];
  const entregar = botones.find((b) => b.text === "Entregar");
  await act(async () => { await entregar?.onPress?.(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mock.tareaPorId.mockResolvedValue(TAREA as never);
  mock.entregarTarea.mockResolvedValue(undefined as never);
  mockA.elegirArchivo.mockResolvedValue(ARCHIVO as never);
  mockA.miEspacio.mockResolvedValue({ tipo: "yo", personaId: "p-1" } as never);
  mockA.subir.mockResolvedValue({ ok: true, url: "yo/p-1/uuu-guia-4.pdf" } as never);
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

const abrir = async () => await renderPantalla(Tarea as never, { tareaId: "t1" });

describe("entregar una tarea", () => {
  test("se puede entregar sin adjuntar nada, como antes", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Entregar tarea")); });
    await confirmar();

    await waitFor(() => expect(mock.entregarTarea).toHaveBeenCalledWith("t1", undefined));
    expect(mockA.subir).not.toHaveBeenCalled();
  });

  test("con un archivo, se sube y la entrega queda apuntando a él", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Adjuntar un archivo a la entrega")); });
    await waitFor(() => expect(t.getByText("guia-4.pdf")).toBeTruthy());

    await act(async () => { fireEvent.press(t.getByText("Entregar tarea")); });
    await confirmar();

    // A la carpeta de la tarea y no al espacio propio: en «yo/» solo la vería
    // quien la subió, y una entrega existe para que la lea quien corrige.
    await waitFor(() => expect(mockA.subir).toHaveBeenCalledWith(
      ARCHIVO, { tipo: "entrega", tareaId: "t1" }));
    expect(mock.entregarTarea).toHaveBeenCalledWith("t1", "yo/p-1/uuu-guia-4.pdf");
  });

  // Dejarla como entregada sin lo que se entregaba es peor que no entregarla:
  // nadie se entera hasta la corrección, cuando ya no se puede arreglar.
  test("si el archivo no sube, la entrega no se registra", async () => {
    mockA.subir.mockResolvedValue({ ok: false, motivo: "No pude guardar el archivo." } as never);
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Adjuntar un archivo a la entrega")); });
    await act(async () => { fireEvent.press(t.getByText("Entregar tarea")); });
    await confirmar();

    expect(mock.entregarTarea).not.toHaveBeenCalled();
    await waitFor(() => expect(t.getByText("No pude guardar el archivo.")).toBeTruthy());
  });

  test("un archivo que no se acepta se rechaza antes de subirlo", async () => {
    mockA.elegirArchivo.mockResolvedValue({
      ...ARCHIVO, nombre: "video.exe", mime: "application/x-msdownload",
    } as never);
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Adjuntar un archivo a la entrega")); });

    expect(mockA.subir).not.toHaveBeenCalled();
    expect(t.queryByText("video.exe")).toBeNull();
  });

  test("se puede quitar el archivo elegido antes de entregar", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Adjuntar un archivo a la entrega")); });
    await waitFor(() => expect(t.getByText("guia-4.pdf")).toBeTruthy());

    await act(async () => { fireEvent.press(t.getByLabelText("Quitar el archivo")); });
    expect(t.queryByText("guia-4.pdf")).toBeNull();

    await act(async () => { fireEvent.press(t.getByText("Entregar tarea")); });
    await confirmar();
    expect(mockA.subir).not.toHaveBeenCalled();
  });
});

describe("una tarea ya entregada", () => {
  test("deja abrir lo que se entregó", async () => {
    mock.tareaPorId.mockResolvedValue({
      ...TAREA, entregada_en: new Date().toISOString(), entregado: "yo/p-1/uuu-guia-4.pdf",
    } as never);
    mockA.direccionFirmada.mockResolvedValue("https://firmada.example/guia-4.pdf" as never);

    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Ver lo que entregué")); });

    await waitFor(() => expect(mockNav.openBrowserAsync)
      .toHaveBeenCalledWith("https://firmada.example/guia-4.pdf"));
    // Y ya no ofrece entregar de nuevo.
    expect(t.queryByText("Entregar tarea")).toBeNull();
  });

  test("si se entregó sin archivo, no ofrece abrir nada", async () => {
    mock.tareaPorId.mockResolvedValue({
      ...TAREA, entregada_en: new Date().toISOString(), entregado: null,
    } as never);
    const t = await abrir();
    expect(t.queryByText("Ver lo que entregué")).toBeNull();
  });
});
