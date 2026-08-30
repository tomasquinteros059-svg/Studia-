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

    // El titular se arma palabra por palabra para poder pintarles el
    // destacador detrás, así que se busca así y no como una frase.
    for (const palabra of ["Estudia", "método,", "trasnoche."]) {
      expect(t.getByText(palabra)).toBeTruthy();
    }
    expect(t.getByText("Lectura en voz alta")).toBeTruthy();
    expect(t.getByText("El Tutor")).toBeTruthy();
    // Todavía no pide ni correo ni clave.
    expect(t.queryByLabelText("Correo")).toBeNull();
    expect(t.queryByLabelText("Contraseña")).toBeNull();
  });

  test("los enlaces de arriba llevan a las secciones, no a ninguna parte", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    // Existen y se pueden apretar sin que nada reviente: el desplazamiento
    // en sí lo hace el ScrollView, que en las pruebas no tiene alto.
    for (const nombre of ["Qué hace", "Los agentes"]) {
      const enlace = t.getByRole("link", { name: nombre });
      await act(async () => { fireEvent.press(enlace); });
    }
  });

  test("iniciar sesión desde la barra es la misma puerta que la de abajo", async () => {
    const entrar = jest.fn();
    const t = await render(<Portada entrar={entrar} />);

    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Iniciar sesión" }));
    });
    expect(entrar).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Entrar con mi correo" }));
    });
    expect(entrar).toHaveBeenCalledTimes(2);
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
    const t = await render(<Portada entrar={jest.fn()} sinServidor />);

    await act(async () => { fireEvent.press(t.getByLabelText("Continuar con Google")); });

    expect(mock.entrarCon).not.toHaveBeenCalled();
    expect(t.getByText(/no tiene servidor detrás/)).toBeTruthy();
  });

  test("no hay ninguna puerta que se salte el correo, ni siquiera sin servidor", async () => {
    const sinBackend = await render(<Portada entrar={jest.fn()} sinServidor />);
    expect(sinBackend.queryByRole("button", { name: /ejemplo/i })).toBeNull();
    expect(sinBackend.getByRole("button", { name: "Entrar con mi correo" })).toBeTruthy();

    const conBackend = await render(<Portada entrar={jest.fn()} />);
    expect(conBackend.queryByRole("button", { name: /ejemplo/i })).toBeNull();
  });

  test("entrar con el correo lo avisa a quien la abrió", async () => {
    const entrar = jest.fn();
    const t = await render(<Portada entrar={entrar} />);

    fireEvent.press(t.getByRole("button", { name: "Entrar con mi correo" }));
    expect(entrar).toHaveBeenCalled();
  });

  // ── Los precios ────────────────────────────────────────────────────────

  test("muestra los tres planes y solo uno destacado", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    for (const plan of ["Gratis", "Personal", "Institución"]) {
      expect(t.getByText(plan)).toBeTruthy();
    }
    expect(t.getByText("el que eligen casi todos")).toBeTruthy();
    expect(t.getByText("Conversemos")).toBeTruthy();
  });

  test("cambiar de moneda cambia el precio y la línea de referencia", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    await act(async () => {
      fireEvent.press(t.getByLabelText("Ver los precios en Peso chileno"));
    });
    expect(t.getByText("$14.990")).toBeTruthy();
    expect(t.getByText("equivale a US$16 al mes")).toBeTruthy();

    await act(async () => {
      fireEvent.press(t.getByLabelText("Ver los precios en Dólar"));
    });
    expect(t.getByText("US$16")).toBeTruthy();
    // En dólares la referencia sobra.
    expect(t.queryByText(/equivale a/)).toBeNull();
  });

  test("los dos planes de persona llevan a la misma puerta", async () => {
    const entrar = jest.fn();
    const t = await render(<Portada entrar={entrar} />);

    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Crear cuenta gratis" })); });
    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Empezar con Personal" })); });
    expect(entrar).toHaveBeenCalledTimes(2);
  });

  test("mientras no haya cobro, se dice; no se calla", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);
    expect(t.getByText(/Todavía no hay cobro conectado/)).toBeTruthy();
  });
});
