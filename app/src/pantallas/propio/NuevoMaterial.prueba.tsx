import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

// El selector de archivos y el almacenamiento se sustituyen enteros: acá se
// prueba qué hace la pantalla, no si el aparato sabe abrir un explorador.
jest.mock("../../lib/archivos.ts", () => ({
  sePuedeElegirArchivo: true,
  HAY_ALMACENAMIENTO: false,
  AVISO_SIN_ALMACENAMIENTO: "Todavía no hay almacenamiento conectado.",
  elegirArchivo: jest.fn(),
  subir: jest.fn(),
}));

import * as archivos from "../../lib/archivos.ts";
import NuevoMaterial from "./NuevoMaterial.tsx";

const mock = archivos as jest.Mocked<typeof archivos>;

// `render` de esta versión devuelve una promesa: sin el await, lo que llega
// es el thenable y ninguna consulta existe.
const abrir = async (guardar = jest.fn().mockResolvedValue(undefined)) => {
  const vista = await render(
    <NuevoMaterial abierto cerrar={jest.fn()} guardar={guardar} />,
  );
  return Object.assign(vista, { guardar });
};

/** Los manejadores son asíncronos: sin esto, el estado cambia fuera de `act`. */
const tocar = async (hacer: () => void) => {
  await act(async () => { hacer(); await Promise.resolve(); });
};

beforeEach(() => jest.clearAllMocks());

describe("Agregar material a un ramo propio", () => {
  test("sin título no se puede guardar", async () => {
    const t = await abrir();
    await tocar(() =>
      fireEvent.changeText(t.getByLabelText("Texto del material"), "Algo que estudiar."));
    expect(t.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  test("un texto escrito se guarda como lectura, con los minutos que dura", async () => {
    const t = await abrir();
    await tocar(() =>
      fireEvent.changeText(t.getByLabelText("Título del material"), "  Phrasal verbs  "));
    await tocar(() =>
      fireEvent.changeText(t.getByLabelText("Texto del material"), "Look up. ".repeat(200)));

    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Guardar" })));
    await waitFor(() => expect(t.guardar).toHaveBeenCalled());

    const material = t.guardar.mock.calls[0][0];
    expect(material.titulo).toBe("Phrasal verbs");
    expect(material.tipo).toBe("documento");
    expect(material.detalle).toMatch(/^Lectura · \d+ min$/);
    expect(material.url).toBeNull();
  });

  test("elegir un archivo avisa de inmediato que todavía no se puede guardar", async () => {
    mock.elegirArchivo.mockResolvedValue({
      nombre: "apunte-de-limites.pdf", mime: "application/pdf",
      tamano: 2_500_000, uri: "file:///x.pdf",
    });
    const t = await abrir();

    await tocar(() => fireEvent.press(t.getByLabelText("Adjuntar un archivo")));
    expect(t.getByText("Todavía no hay almacenamiento conectado.")).toBeTruthy();

    // Y propone el título a partir del nombre, para no escribirlo de nuevo.
    expect(t.getByLabelText("Título del material").props.value).toBe("Apunte de limites");
    expect(t.getByText("PDF · 2,4 MB")).toBeTruthy();
    // No se intenta subir nada: no hay dónde.
    expect(mock.subir).not.toHaveBeenCalled();
  });

  test("un archivo que no se entiende se rechaza al elegirlo, no al guardar", async () => {
    mock.elegirArchivo.mockResolvedValue({
      nombre: "cosa.exe", mime: "", tamano: 1000, uri: "file:///cosa.exe",
    });
    const t = await abrir();

    await tocar(() => fireEvent.press(t.getByLabelText("Adjuntar un archivo")));
    expect(t.getByText(/No sé qué hacer con un archivo \.exe/)).toBeTruthy();
    expect(t.queryByText("cosa.exe")).toBeNull();
  });

  test("un archivo demasiado pesado dice cuánto pesa y cuánto se admite", async () => {
    mock.elegirArchivo.mockResolvedValue({
      nombre: "clase.mp4", mime: "video/mp4", tamano: 60 * 1024 * 1024, uri: "file:///c.mp4",
    });
    const t = await abrir();

    await tocar(() => fireEvent.press(t.getByLabelText("Adjuntar un archivo")));
    expect(t.getByText(/Pesa 60,0 MB y el máximo son 20,0 MB/)).toBeTruthy();
  });

  test("quitar el archivo lo saca del todo", async () => {
    mock.elegirArchivo.mockResolvedValue({
      nombre: "guia.pdf", mime: "application/pdf", tamano: 1000, uri: "file:///g.pdf",
    });
    const t = await abrir();

    await tocar(() => fireEvent.press(t.getByLabelText("Adjuntar un archivo")));
    expect(t.getByText("guia.pdf")).toBeTruthy();

    await tocar(() => fireEvent.press(t.getByLabelText("Quitar el archivo")));
    expect(t.getByText("Adjuntar un archivo")).toBeTruthy();
  });
});
