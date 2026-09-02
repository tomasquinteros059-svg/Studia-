// El botón de reportar una respuesta de la IA.
//
// Existe porque Google Play lo exige, y por eso se prueba con cuidado: si
// deja de funcionar, no se cae ninguna pantalla —nadie lo va a notar— y la
// aplicación queda incumpliendo una política sin que nada avise.

import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ConMargenes } from "../../pruebas/dobles.tsx";

jest.mock("../lib/reportes.ts", () => ({ reportar: jest.fn() }));

import * as envio from "../lib/reportes.ts";
import { ReportarIA } from "./ReportarIA.tsx";

const mandar = envio as jest.Mocked<typeof envio>;

async function montar(contenido = "La capital de Chile es Valparaíso.") {
  return await render(
    <ConMargenes>
      <ReportarIA origen="tutor" contenido={contenido} />
    </ConMargenes>,
  );
}

async function abrir(contenido?: string) {
  const t = await montar(contenido);
  await act(async () => { fireEvent.press(t.getByLabelText("Reportar esta respuesta")); });
  return t;
}

beforeEach(() => {
  jest.clearAllMocks();
  mandar.reportar.mockResolvedValue(undefined as never);
});

test("la bandera está sin que haya que ir a buscarla", async () => {
  const t = await montar("algo");
  expect(t.getByLabelText("Reportar esta respuesta")).toBeTruthy();
});

test("se ve la respuesta que se está reportando", async () => {
  const t = await abrir();
  expect(t.getByText("La capital de Chile es Valparaíso.")).toBeTruthy();
});

test("sin elegir motivo no se manda", async () => {
  const t = await abrir();
  await act(async () => { fireEvent.press(t.getByText("Mandar el reporte")); });

  expect(mandar.reportar).not.toHaveBeenCalled();
  expect(t.getByText("Elige qué pasó con esta respuesta.")).toBeTruthy();
});

test("eligiendo un motivo se manda y se agradece", async () => {
  const t = await abrir();
  await act(async () => { fireEvent.press(t.getByLabelText("Está equivocado")); });
  await act(async () => { fireEvent.press(t.getByText("Mandar el reporte")); });

  await waitFor(() => expect(mandar.reportar).toHaveBeenCalledWith({
    origen: "tutor",
    motivo: "falso",
    contenido: "La capital de Chile es Valparaíso.",
  }));
  await waitFor(() =>
    expect(t.getByText(/Alguien de tu establecimiento lo va a mirar/)).toBeTruthy());
});

test("el detalle viaja cuando se escribe", async () => {
  const t = await abrir();
  await act(async () => { fireEvent.press(t.getByLabelText("Me trató mal o dijo algo hiriente")); });
  await act(async () => { fireEvent.changeText(t.getByLabelText("Detalle del reporte"), "se burló de mi pregunta"); });
  await act(async () => { fireEvent.press(t.getByText("Mandar el reporte")); });

  await waitFor(() => expect(mandar.reportar).toHaveBeenCalledWith(
    expect.objectContaining({ detalle: "se burló de mi pregunta" }),
  ));
});

test("si el envío falla se dice, y no se agradece por algo que no llegó", async () => {
  mandar.reportar.mockRejectedValue(new Error("No pude mandar el reporte. Inténtalo de nuevo.") as never);
  const t = await abrir();
  await act(async () => { fireEvent.press(t.getByLabelText("Está equivocado")); });
  await act(async () => { fireEvent.press(t.getByText("Mandar el reporte")); });

  await waitFor(() =>
    expect(t.getByText("No pude mandar el reporte. Inténtalo de nuevo.")).toBeTruthy());
  expect(t.queryByText(/Alguien de tu establecimiento/)).toBeNull();
});

test("después de fallar se puede volver a intentar", async () => {
  mandar.reportar.mockRejectedValueOnce(new Error("No pude mandar el reporte.") as never);
  const t = await abrir();
  await act(async () => { fireEvent.press(t.getByLabelText("Está equivocado")); });
  await act(async () => { fireEvent.press(t.getByText("Mandar el reporte")); });
  await waitFor(() => expect(t.getByText("No pude mandar el reporte.")).toBeTruthy());

  await act(async () => { fireEvent.press(t.getByText("Mandar el reporte")); });
  await waitFor(() =>
    expect(t.getByText(/Alguien de tu establecimiento lo va a mirar/)).toBeTruthy());
});
