import { act, fireEvent, render as renderCrudo, waitFor } from "@testing-library/react-native";
import { ConMargenes } from "../../pruebas/dobles.tsx";
import type { ReactElement } from "react";

jest.mock("../lib/proveedores.ts", () => ({ entrarCon: jest.fn() }));

import * as proveedores from "../lib/proveedores.ts";
import Portada from "./Portada.tsx";

const mock = proveedores as jest.Mocked<typeof proveedores>;

// La portada mide los márgenes del sistema, así que necesita el proveedor.
const render = async (elemento: ReactElement) =>
  await renderCrudo(<ConMargenes>{elemento}</ConMargenes>);

beforeEach(() => jest.clearAllMocks());

describe("la portada", () => {
  test("cuenta qué es esto antes de pedir nada", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    expect(t.getByText("StudIA")).toBeTruthy();
    expect(t.getByText("Aprende pensando, no copiando.")).toBeTruthy();
    expect(t.getByText("Un lector que lee en voz alta")).toBeTruthy();
    // Todavía no pide ni correo ni clave.
    expect(t.queryByLabelText("Correo")).toBeNull();
    expect(t.queryByLabelText("Contraseña")).toBeNull();
  });

  test("ofrece las cuentas que la persona ya tiene, además del correo", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    expect(t.getByLabelText("Continuar con Google")).toBeTruthy();
    expect(t.getByLabelText("Continuar con Microsoft")).toBeTruthy();
    expect(t.getByRole("button", { name: "Entrar con mi correo" })).toBeTruthy();
  });

  test("con servidor, tocar Google intenta entrar de verdad", async () => {
    mock.entrarCon.mockResolvedValue({ ok: true } as never);
    const t = await render(<Portada entrar={jest.fn()} />);

    await act(async () => { fireEvent.press(t.getByLabelText("Continuar con Google")); });

    expect(mock.entrarCon).toHaveBeenCalledWith("google");
  });

  test("una falla del proveedor se muestra en palabras, no en inglés", async () => {
    mock.entrarCon.mockResolvedValue(
      { ok: false, motivo: "Entrar con Google todavía no está habilitado en el servidor." } as never,
    );
    const t = await render(<Portada entrar={jest.fn()} />);

    await act(async () => { fireEvent.press(t.getByLabelText("Continuar con Google")); });

    await waitFor(() => expect(t.getByText(/no está habilitado/)).toBeTruthy());
  });

  test("sin servidor no se intenta nada: se dice por qué y adónde ir", async () => {
    const t = await render(<Portada entrar={jest.fn()} probar={jest.fn()} sinServidor />);

    await act(async () => { fireEvent.press(t.getByLabelText("Continuar con Google")); });

    expect(mock.entrarCon).not.toHaveBeenCalled();
    expect(t.getByText(/no tiene servidor detrás/)).toBeTruthy();
  });

  test("el botón de mirar con datos de ejemplo solo está cuando hay qué mirar", async () => {
    const conEjemplo = await render(<Portada entrar={jest.fn()} probar={jest.fn()} sinServidor />);
    expect(conEjemplo.getByRole("button", { name: "Mirar con datos de ejemplo" })).toBeTruthy();

    const sinEjemplo = await render(<Portada entrar={jest.fn()} />);
    expect(sinEjemplo.queryByRole("button", { name: "Mirar con datos de ejemplo" })).toBeNull();
  });

  test("entrar con el correo lo avisa a quien la abrió", async () => {
    const entrar = jest.fn();
    const t = await render(<Portada entrar={entrar} />);

    fireEvent.press(t.getByRole("button", { name: "Entrar con mi correo" }));
    expect(entrar).toHaveBeenCalled();
  });
});
