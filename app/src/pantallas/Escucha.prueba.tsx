import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { RAMO, renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  empezarAEscuchar: jest.fn(), subirTramos: jest.fn(), cuantosEscuchan: jest.fn(),
  tramosDeLaClase: jest.fn(), armarLaClase: jest.fn(),
}));
jest.mock("../lib/audio.ts", () => ({
  permisoDeMicrofono: jest.fn(), pedirMicrofono: jest.fn(),
}));
jest.mock("../../modules/voz/index.ts", () => ({
  disponible: jest.fn(), escuchar: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import * as audio from "../lib/audio.ts";
import * as voz from "../../modules/voz/index.ts";
import Escucha from "./Escucha.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockAudio = audio as jest.Mocked<typeof audio>;
const mockVoz = voz as jest.Mocked<typeof voz>;

const PARAMS = { claseId: "c-viva", titulo: "Teorema del valor medio", asignaturaId: RAMO.id };

/** Lo que le pasamos al módulo de voz, para poder «hablar» desde la prueba. */
let oyentes: Parameters<typeof voz.escuchar>[0] | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  oyentes = null;
  mockVoz.disponible.mockReturnValue(true);
  mockVoz.escuchar.mockImplementation((o) => { oyentes = o; return jest.fn(); });
  mockAudio.permisoDeMicrofono.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  mockAudio.pedirMicrofono.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  mock.empezarAEscuchar.mockResolvedValue("esc-1" as never);
  mock.subirTramos.mockResolvedValue(undefined as never);
  mock.cuantosEscuchan.mockResolvedValue(4 as never);
  mock.tramosDeLaClase.mockResolvedValue([] as never);
  mock.armarLaClase.mockResolvedValue(undefined as never);
});

const abrir = async () => await renderPantalla(Escucha, PARAMS);

const empezar = async (t: Awaited<ReturnType<typeof abrir>>) => {
  await act(async () => { fireEvent.press(t.getByText("Escuchar esta clase")); });
  await waitFor(() => expect(mockVoz.escuchar).toHaveBeenCalled());
};

const decir = async (texto: string, confianza = 0.8) => {
  await act(async () => { oyentes!.alTexto(texto, confianza); });
};

describe("el modo escucha", () => {
  test("antes de empezar dice que el sonido no sale del teléfono", async () => {
    const t = await abrir();
    // Es lo primero que alguien quiere saber cuando le piden prender el
    // micrófono en una sala con treinta personas.
    expect(t.getByText(/aquí adentro/)).toBeTruthy();
    expect(t.getByText(/el sonido no se guarda ni sale del aparato/)).toBeTruthy();
  });

  test("pide el micrófono antes de oír nada", async () => {
    const t = await abrir();
    mockAudio.permisoDeMicrofono.mockResolvedValue({ granted: false, canAskAgain: true } as never);
    mockAudio.pedirMicrofono.mockResolvedValue({ granted: false, canAskAgain: true } as never);

    await act(async () => { fireEvent.press(t.getByText("Escuchar esta clase")); });

    await waitFor(() => expect(t.getByText(/Sin permiso del micrófono/)).toBeTruthy());
    expect(mockVoz.escuchar).not.toHaveBeenCalled();
  });

  test("donde no hay reconocimiento se dice, en vez de un botón que no hace nada", async () => {
    mockVoz.disponible.mockReturnValue(false);
    const t = await abrir();

    await act(async () => { fireEvent.press(t.getByText("Escuchar esta clase")); });

    expect(t.getByText(/no puede transcribir/)).toBeTruthy();
    expect(mockAudio.pedirMicrofono).not.toHaveBeenCalled();
  });

  test("mientras oye se ve que está oyendo, y cuántos más", async () => {
    // Nadie debería quedar grabado sin que la sala lo sepa.
    const t = await abrir();
    await empezar(t);

    expect(t.getByText("Escuchando la clase")).toBeTruthy();
    await waitFor(() => expect(t.getByText(/y 3 más del curso/)).toBeTruthy());
  });

  test("lo que se va oyendo aparece con su minuto", async () => {
    const t = await abrir();
    await empezar(t);
    await decir("el teorema del valor medio");

    expect(t.getByText("el teorema del valor medio")).toBeTruthy();
  });

  test("lo que todavía no confirma se ve aparte de lo confirmado", async () => {
    const t = await abrir();
    await empezar(t);
    await act(async () => { oyentes!.alParcial!("el teorema del va"); });

    // Mostrarlo igual que lo firme haría creer que ya quedó guardado algo que
    // el reconocedor todavía puede cambiar entero.
    const enElAire = t.getByText("el teorema del va");
    expect(enElAire.props.style.flat().some((s: { fontStyle?: string }) => s?.fontStyle === "italic"))
      .toBe(true);
  });

  test("al terminar cruza lo de todos y deja una sola clase", async () => {
    mock.tramosDeLaClase.mockResolvedValue([
      { aparato: "a", segundo: 10, texto: "el problema del valor medio", confianza: 0.3 },
      { aparato: "b", segundo: 11, texto: "el teorema del valor medio", confianza: 0.9 },
      { aparato: "c", segundo: 12, texto: "el teorema del valor medio", confianza: 0.8 },
    ] as never);

    const t = await abrir();
    await empezar(t);
    await act(async () => { fireEvent.press(t.getByText("Terminar y armar la clase")); });

    await waitFor(() => expect(t.getByText("La clase quedó escrita")).toBeTruthy());
    // Gana lo que oyó la mayoría, no lo que llegó primero.
    expect(t.getByText("el teorema del valor medio")).toBeTruthy();
    expect(t.queryByText("el problema del valor medio")).toBeNull();
    expect(mock.armarLaClase).toHaveBeenCalledWith("c-viva", [
      { segundo: 10, texto: "el teorema del valor medio" },
    ]);
  });

  test("al final se dice con cuántos teléfonos quedó armada", async () => {
    mock.tramosDeLaClase.mockResolvedValue([
      { aparato: "a", segundo: 0, texto: "buenos días", confianza: 0.9 },
      { aparato: "b", segundo: 1, texto: "buenos días", confianza: 0.9 },
    ] as never);

    const t = await abrir();
    await empezar(t);
    await act(async () => { fireEvent.press(t.getByText("Terminar y armar la clase")); });

    await waitFor(() => expect(t.getByText(/4 teléfonos/)).toBeTruthy());
  });

  test("y se dice que el audio no quedó guardado", async () => {
    const t = await abrir();
    await empezar(t);
    await act(async () => { fireEvent.press(t.getByText("Terminar y armar la clase")); });

    await waitFor(() => expect(t.getByText(/El audio no se guardó en ninguna parte/)).toBeTruthy());
  });

  test("si el reconocedor falla, se dice y se deja de oír", async () => {
    const t = await abrir();
    await empezar(t);

    await act(async () => {
      oyentes!.alError!({ codigo: "SIN_RED", mensaje: "Se cortó la conexión." });
    });

    expect(t.getByText("Se cortó la conexión.")).toBeTruthy();
    // Y vuelve a ofrecer empezar, en vez de quedar con un micrófono muerto.
    expect(t.getByText("Escuchar esta clase")).toBeTruthy();
  });

  test("no promete separar quién habló", async () => {
    // El reconocedor entrega una sola corriente de texto. Poner «profesora» o
    // «alumno» sería atribuirle a alguien algo que no se sabe que dijo.
    const t = await abrir();
    expect(t.getByText(/No separa quién habló/)).toBeTruthy();
  });
});
