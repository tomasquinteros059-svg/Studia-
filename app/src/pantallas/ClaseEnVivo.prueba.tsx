import { act, fireEvent } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import { renderPantalla } from "../../pruebas/dobles.tsx";
import {
  getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync,
} from "expo-audio";
import ClaseEnVivo from "./ClaseEnVivo.tsx";

const permisos = getRecordingPermissionsAsync as jest.Mock;
const pedirPermiso = requestRecordingPermissionsAsync as jest.Mock;
const modoAudio = setAudioModeAsync as jest.Mock;

const PARAMS = {
  titulo: "Teorema del valor medio", asignatura: "Cálculo I",
  codigo: "MAT1610", profesor: "Ana Ríos", desdeSegundos: 725,
};

/**
 * La pantalla lleva un cronómetro con `setInterval`: con temporizadores reales
 * Jest queda colgado esperando ese intervalo. Todo el archivo usa falsos, y por
 * eso se vacía la cola de promesas con `act` en vez de `waitFor`, que también
 * depende de temporizadores.
 */
const respirar = () => act(async () => { await Promise.resolve(); });

const abrir = async () => {
  const t = await renderPantalla(ClaseEnVivo, PARAMS);
  await respirar();
  return t;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  permisos.mockResolvedValue({ granted: false, canAskAgain: true });
  pedirPermiso.mockResolvedValue({ granted: true, canAskAgain: true });
  modoAudio.mockResolvedValue(undefined);
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => jest.useRealTimers());

describe("clase en vivo", () => {
  test("muestra el ramo, el tema y el cronómetro desde donde iba la clase", async () => {
    const t = await abrir();
    expect(t.getByText("Cálculo I · MAT1610")).toBeTruthy();
    expect(t.getByText("12:05")).toBeTruthy();
    expect(t.getByText(/Ana Ríos/)).toBeTruthy();
  });

  test("se entra en silencio, siempre", async () => {
    const t = await abrir();
    expect(t.getByText("Silenciado")).toBeTruthy();
    expect(t.getByLabelText("Activar micrófono")).toBeTruthy();
  });

  test("al entrar consulta el permiso pero no abre ningún diálogo", async () => {
    await abrir();
    expect(permisos).toHaveBeenCalled();
    expect(pedirPermiso).not.toHaveBeenCalled();
  });

  test("el permiso se pide recién al tocar el micrófono", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Activar micrófono")); });
    expect(pedirPermiso).toHaveBeenCalled();
    expect(t.getByText("Micrófono abierto")).toBeTruthy();
  });

  test("si lo conceden, el audio pasa a modo grabación", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Activar micrófono")); });
    expect(modoAudio).toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: true }));
  });

  test("si lo niegan, lo explica y no abre el micrófono", async () => {
    pedirPermiso.mockResolvedValue({ granted: false, canAskAgain: true });
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Activar micrófono")); });
    expect(Alert.alert).toHaveBeenCalledWith("Sin micrófono", expect.any(String));
    expect(t.getByText("Silenciado")).toBeTruthy();
  });

  test("si está bloqueado, ofrece Ajustes en vez de insistir", async () => {
    permisos.mockResolvedValue({ granted: false, canAskAgain: false });
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const t = await abrir();
    expect(t.getByText("Sin permiso")).toBeTruthy();

    await act(async () => { fireEvent.press(t.getByLabelText("Activar micrófono")); });
    expect(pedirPermiso).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Micrófono bloqueado", expect.any(String), expect.any(Array));
  });

  test("pedir la palabra avisa que el profesor dará el turno", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Pedir la palabra")); });
    expect(t.getByText("Pediste la palabra. El profesor te dará el turno.")).toBeTruthy();
  });

  test("el chevron sale sin colgar y el botón rojo cuelga", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByLabelText("Salir sin colgar")); });
    expect(t.navigation.goBack).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(t.getByLabelText("Salir de la clase")); });
    expect(t.navigation.goBack).toHaveBeenCalledTimes(2);
  });

  test("dice que el audio todavía no está conectado, en vez de aparentar", async () => {
    const t = await abrir();
    expect(t.getByText(/El audio en vivo todavía no está conectado/)).toBeTruthy();
  });
});
