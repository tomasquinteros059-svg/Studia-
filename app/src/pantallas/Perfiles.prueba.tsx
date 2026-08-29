import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ConMargenes } from "../../pruebas/dobles.tsx";

import Perfiles from "./Perfiles.tsx";
import { perfilActual, salir } from "../lib/perfiles-demo.ts";

const abrir = async () =>
  await render(<ConMargenes><Perfiles /></ConMargenes>);

const escribir = async (t: Awaited<ReturnType<typeof abrir>>, correo: string) => {
  await act(async () => { fireEvent.changeText(t.getByLabelText("Correo"), correo); });
};

beforeEach(() => salir());
afterAll(() => salir());

describe("la puerta sin servidor", () => {
  test("sin correo no hay por dónde entrar: ni botón ni perfiles de ejemplo", async () => {
    const t = await abrir();

    expect(t.queryByLabelText(/^Entrar como/)).toBeNull();
    expect(t.getByRole("button", { name: "Entrar" }).props.accessibilityState.disabled)
      .toBe(true);
  });

  test("un correo mal escrito tampoco abre nada, y se dice qué pasa", async () => {
    const t = await abrir();
    await escribir(t, "tomas@uc");

    expect(t.getByText(/Eso no parece un correo/)).toBeTruthy();
    expect(t.queryByLabelText(/^Entrar como/)).toBeNull();
  });

  test("con el correo puesto se puede entrar, y recién ahí aparecen los ejemplos", async () => {
    const t = await abrir();
    await escribir(t, "tomas.q@uc.cl");

    expect(t.getByText(/Pontificia Universidad Católica/)).toBeTruthy();
    expect(t.getByLabelText("Entrar como Ana Ríos, Profesora")).toBeTruthy();

    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Entrar" })); });

    await waitFor(() => expect(perfilActual()?.correo).toBe("tomas.q@uc.cl"));
    expect(perfilActual()?.nombre).toBe("Tomas Q");
    expect(perfilActual()?.rol).toBe("estudiante");
  });

  test("el nombre escrito se respeta tal cual", async () => {
    const t = await abrir();
    await escribir(t, "tomas@gmail.com");
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Tu nombre"), "Tomás Quinteros");
    });
    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Entrar" })); });

    await waitFor(() => expect(perfilActual()?.nombre).toBe("Tomás Quinteros"));
  });

  test("los perfiles de ejemplo siguen sirviendo para recorrer las otras vistas", async () => {
    const t = await abrir();
    await escribir(t, "tomas@gmail.com");

    await act(async () => {
      fireEvent.press(t.getByLabelText("Entrar como Secretaría Académica, Administración"));
    });

    await waitFor(() => expect(perfilActual()?.rol).toBe("administrador"));
  });
});
