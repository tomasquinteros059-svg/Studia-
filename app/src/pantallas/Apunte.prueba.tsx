import { fireEvent, waitFor } from "@testing-library/react-native";
import { APUNTE, RAMO, renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  apuntePorId: jest.fn(), misAsignaturas: jest.fn(),
  resumenDe: jest.fn(), guardarApunte: jest.fn(),
}));
jest.mock("../lib/resumen.ts", () => ({ pedirResumen: jest.fn() }));

const anchoFalso = { valor: { width: 420, height: 900, scale: 2, fontScale: 1 } };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => anchoFalso.valor,
}));

import * as consultas from "../lib/consultas.ts";
import * as resumenLib from "../lib/resumen.ts";
import Apunte from "./Apunte.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockResumen = resumenLib as jest.Mocked<typeof resumenLib>;

function conDatos() {
  mock.apuntePorId.mockResolvedValue(APUNTE as never);
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.resumenDe.mockResolvedValue(null as never);
  mock.guardarApunte.mockResolvedValue(undefined as never);
  mockResumen.pedirResumen.mockResolvedValue({
    cuerpo: "Anotaste el teorema y sus hipótesis.",
    vacios: ["La interpretación geométrica"],
    consejos: ["Repasa primero las hipótesis"],
    conTranscripcion: false,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  anchoFalso.valor = { width: 420, height: 900, scale: 2, fontScale: 1 };
});

const abrir = async () => {
  conDatos();
  const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });
  await waitFor(() => expect(t.getByLabelText("Apuntes de la clase")).toBeTruthy());
  return t;
};

describe("editor de apuntes", () => {
  test("carga el contenido que ya había", async () => {
    const t = await abrir();
    expect(t.getByLabelText("Apuntes de la clase").props.value).toContain("El teorema dice");
    expect(t.getByText("Cálculo I")).toBeTruthy();
  });

  test("terminar la clase guarda y pide el resumen", async () => {
    const t = await abrir();
    fireEvent.press(t.getByText("Terminar clase y resumir"));
    await waitFor(() => expect(mockResumen.pedirResumen).toHaveBeenCalledWith(APUNTE.id));
    await waitFor(() => expect(t.getByText("Anotaste el teorema y sus hipótesis.")).toBeTruthy());
    expect(t.getByText("La interpretación geométrica")).toBeTruthy();
    expect(t.getByText("Repasa primero las hipótesis")).toBeTruthy();
  });

  test("sin transcripción el resumen lo dice, en vez de aparentar que oyó la clase", async () => {
    const t = await abrir();
    fireEvent.press(t.getByText("Terminar clase y resumir"));
    await waitFor(() => expect(t.getByText(/Hecho solo con tus apuntes/)).toBeTruthy());
  });

  test("con transcripción no aparece ese aviso", async () => {
    conDatos();
    mockResumen.pedirResumen.mockResolvedValue({
      cuerpo: "Resumen cruzado.", vacios: [], consejos: [], conTranscripcion: true,
    } as never);
    const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });
    await waitFor(() => expect(t.getByText("Terminar clase y resumir")).toBeTruthy());
    fireEvent.press(t.getByText("Terminar clase y resumir"));
    await waitFor(() => expect(t.getByText("Resumen cruzado.")).toBeTruthy());
    expect(t.queryByText(/Hecho solo con tus apuntes/)).toBeNull();
  });

  test("se puede volver del resumen a los apuntes", async () => {
    const t = await abrir();
    fireEvent.press(t.getByText("Terminar clase y resumir"));
    await waitFor(() => expect(t.getByText("Volver a los apuntes")).toBeTruthy());
    fireEvent.press(t.getByText("Volver a los apuntes"));
    await waitFor(() => expect(t.getByLabelText("Apuntes de la clase")).toBeTruthy());
  });

  test("en teléfono el tutor está tras un botón, no al lado", async () => {
    const t = await abrir();
    expect(t.queryByText("Tutor")).toBeTruthy();
    // El panel con su propio compositor solo existe en dos columnas.
    expect(t.queryByLabelText("Tu mensaje")).toBeNull();
  });

  test("en tablet horizontal aparecen las dos columnas", async () => {
    anchoFalso.valor = { width: 1180, height: 820, scale: 2, fontScale: 1 };
    conDatos();
    const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });
    await waitFor(() => expect(t.getByLabelText("Apuntes de la clase")).toBeTruthy());
    // Los apuntes y el tutor conviven: el compositor del tutor está presente.
    expect(t.getByLabelText("Tu mensaje")).toBeTruthy();
    expect(t.getByText("Tutor")).toBeTruthy();
  });

  test("un resumen ya guardado se muestra al abrir", async () => {
    conDatos();
    mock.resumenDe.mockResolvedValue({
      cuerpo: "Resumen de ayer.", vacios: [], consejos: [], creado_en: "2026-08-24T10:00:00Z",
    } as never);
    const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });
    await waitFor(() => expect(t.getByText("Resumen de ayer.")).toBeTruthy());
  });
});

/**
 * El guardado automático se prueba con tiempo real. Con temporizadores falsos
 * hay que congelarlos después de renderizar, y las llamadas a `act` terminan
 * superponiéndose: no vale la pena por ahorrar segundo y medio.
 */
describe("guardado automático de apuntes", () => {
  beforeEach(() => jest.clearAllMocks());

  test("escribir marca «Sin guardar» y guarda solo al rato", async () => {
    const t = await abrir();
    fireEvent.changeText(t.getByLabelText("Apuntes de la clase"), "Texto nuevo de la clase");

    // Todavía no salió nada a la red: el guardado espera a que dejes de escribir.
    expect(mock.guardarApunte).not.toHaveBeenCalled();
    await waitFor(() => expect(t.getByText("Sin guardar")).toBeTruthy());

    await waitFor(
      () => expect(mock.guardarApunte).toHaveBeenCalledWith(
        APUNTE.id, { contenido: "Texto nuevo de la clase" }),
      { timeout: 4000 },
    );
    await waitFor(() => expect(t.getByText("Guardado")).toBeTruthy());
  });

  test("escribir seguido no dispara un guardado por tecla", async () => {
    const t = await abrir();
    const campo = t.getByLabelText("Apuntes de la clase");

    fireEvent.changeText(campo, "a");
    fireEvent.changeText(campo, "ab");
    fireEvent.changeText(campo, "abc");

    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalled(), { timeout: 4000 });
    expect(mock.guardarApunte).toHaveBeenCalledTimes(1);
    expect(mock.guardarApunte).toHaveBeenCalledWith(APUNTE.id, { contenido: "abc" });
  });
});
