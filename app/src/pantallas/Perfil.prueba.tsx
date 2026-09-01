import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  miPerfil: jest.fn(),
  cambiarNombre: jest.fn(),
}));
jest.mock("../lib/cuenta.ts", () => ({
  PALABRA_PARA_BORRAR: "BORRAR",
  borrarMiCuenta: jest.fn(),
}));
jest.mock("../lib/supabase.ts", () => ({ supabase: { auth: { signOut: jest.fn() } } }));
jest.mock("../lib/avisos.ts", () => ({
  sePuedeAvisar: true,
  avisosEncendidos: jest.fn(),
  encenderAvisos: jest.fn(),
  apagarAvisos: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import * as cuenta from "../lib/cuenta.ts";
import * as avisos from "../lib/avisos.ts";
import Perfil from "./Perfil.tsx";

const mockC = consultas as jest.Mocked<typeof consultas>;
const mockCuenta = cuenta as jest.Mocked<typeof cuenta>;
const mockAvisos = avisos as jest.Mocked<typeof avisos>;

beforeEach(() => {
  jest.clearAllMocks();
  mockC.miPerfil.mockResolvedValue({
    nombre: "Eduardo Soto", correo: "eduardo@alumnos.uc.cl",
  } as never);
  mockCuenta.borrarMiCuenta.mockResolvedValue(undefined as never);
  mockAvisos.avisosEncendidos.mockResolvedValue(false as never);
  mockAvisos.encenderAvisos.mockResolvedValue({ ok: true } as never);
  mockAvisos.apagarAvisos.mockResolvedValue({ ok: true } as never);
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

const abrir = async () => await renderPantalla(Perfil as never, undefined);

const desplegar = async (t: Awaited<ReturnType<typeof abrir>>) => {
  await act(async () => { fireEvent.press(t.getByRole("button", { name: "Borrar mi cuenta" })); });
};

describe("borrar la cuenta", () => {
  // Es requisito de Play Store desde 2024 y lo promete la política de
  // privacidad: sin un camino dentro de la app, la aplicación se rechaza.
  test("el camino existe y está en el perfil", async () => {
    const t = await abrir();
    expect(t.getByRole("button", { name: "Borrar mi cuenta" })).toBeTruthy();
  });

  test("no se borra de un solo toque: hay que escribir la palabra", async () => {
    const t = await abrir();
    await desplegar(t);

    // Desplegarlo no borra nada, y el botón final nace apagado.
    expect(mockCuenta.borrarMiCuenta).not.toHaveBeenCalled();
    const definitivo = t.getByText("Borrar mi cuenta para siempre");
    await act(async () => { fireEvent.press(definitivo); });
    expect(mockCuenta.borrarMiCuenta).not.toHaveBeenCalled();
  });

  test("una palabra que no es la palabra tampoco alcanza", async () => {
    const t = await abrir();
    await desplegar(t);
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Escribe BORRAR para confirmar"), "borrarr");
    });
    await act(async () => { fireEvent.press(t.getByText("Borrar mi cuenta para siempre")); });
    expect(mockCuenta.borrarMiCuenta).not.toHaveBeenCalled();
  });

  test("escrita la palabra, se borra", async () => {
    const t = await abrir();
    await desplegar(t);
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Escribe BORRAR para confirmar"), "BORRAR");
    });
    await act(async () => { fireEvent.press(t.getByText("Borrar mi cuenta para siempre")); });

    await waitFor(() => expect(mockCuenta.borrarMiCuenta).toHaveBeenCalledWith("BORRAR"));
  });

  // Escribirla en minúsculas es lo que hace medio mundo, y rechazarlo por eso
  // sería una traba sin ninguna ganancia: la pausa ya la hizo.
  test("da lo mismo en minúsculas o con espacios", async () => {
    const t = await abrir();
    await desplegar(t);
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Escribe BORRAR para confirmar"), " borrar ");
    });
    await act(async () => { fireEvent.press(t.getByText("Borrar mi cuenta para siempre")); });

    await waitFor(() => expect(mockCuenta.borrarMiCuenta).toHaveBeenCalled());
  });

  test("se dice qué se borra y qué se queda antes de pedir la confirmación", async () => {
    const t = await abrir();
    await desplegar(t);
    expect(t.getByText(/no se puede deshacer/)).toBeTruthy();
    expect(t.getByText(/deja de llevar\s+tu nombre/)).toBeTruthy();
  });

  test("arrepentirse lo cierra sin borrar nada", async () => {
    const t = await abrir();
    await desplegar(t);
    await act(async () => { fireEvent.press(t.getByText("Mejor no")); });

    expect(t.queryByText("Borrar mi cuenta para siempre")).toBeNull();
    expect(mockCuenta.borrarMiCuenta).not.toHaveBeenCalled();
  });

  test("si el servidor falla se dice en palabras, no se queda en silencio", async () => {
    mockCuenta.borrarMiCuenta.mockRejectedValue(new Error("No pude conectar. Revisa tu internet."));
    const t = await abrir();
    await desplegar(t);
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Escribe BORRAR para confirmar"), "BORRAR");
    });
    await act(async () => { fireEvent.press(t.getByText("Borrar mi cuenta para siempre")); });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      "No pude borrarla", "No pude conectar. Revisa tu internet."));
  });
});

describe("los avisos al teléfono", () => {
  const interruptor = (t: Awaited<ReturnType<typeof abrir>>) =>
    t.getByLabelText("Avisarme en el teléfono");

  test("se pueden encender desde el perfil", async () => {
    const t = await abrir();
    await act(async () => { fireEvent(interruptor(t), "valueChange", true); });

    await waitFor(() => expect(mockAvisos.encenderAvisos).toHaveBeenCalled());
    expect(interruptor(t).props.value).toBe(true);
  });

  test("y apagar, que es lo que de verdad tiene que funcionar", async () => {
    mockAvisos.avisosEncendidos.mockResolvedValue(true as never);
    const t = await abrir();
    await waitFor(() => expect(interruptor(t).props.value).toBe(true));

    await act(async () => { fireEvent(interruptor(t), "valueChange", false); });
    await waitFor(() => expect(mockAvisos.apagarAvisos).toHaveBeenCalled());
    expect(interruptor(t).props.value).toBe(false);
  });

  // Si el permiso se negó una vez, el sistema no lo vuelve a preguntar. Sin
  // decirlo, el interruptor se queda en «no» y parece que la app está rota.
  test("si el permiso está negado se explica, y el interruptor no miente", async () => {
    mockAvisos.encenderAvisos.mockResolvedValue({
      ok: false, motivo: "No diste permiso para avisarte.",
    } as never);
    const t = await abrir();
    await act(async () => { fireEvent(interruptor(t), "valueChange", true); });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      "Los avisos quedaron como estaban", "No diste permiso para avisarte."));
    expect(interruptor(t).props.value).toBe(false);
  });

  test("se dice qué avisa y qué no, para que nadie los apague por ruidosos", async () => {
    const t = await abrir();
    expect(t.getByText(/Los anuncios del profesor no suenan/)).toBeTruthy();
  });
});
