import { act, fireEvent, render as renderCrudo, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import { ConMargenes } from "../../pruebas/dobles.tsx";
import type { ReactElement } from "react";

jest.mock("../lib/proveedores.ts", () => ({ entrarCon: jest.fn() }));

import * as proveedores from "../lib/proveedores.ts";
import Portada from "./Portada.tsx";
import { SALTOS } from "../dominio/fichas.ts";

const mock = proveedores as jest.Mocked<typeof proveedores>;

// La portada mide los márgenes del sistema, así que necesita el proveedor.
const render = async (elemento: ReactElement) =>
  await renderCrudo(<ConMargenes>{elemento}</ConMargenes>);

const dondeEstamos = Platform.OS;
/** Para probar las dos caras: en el navegador hay precios, en el teléfono no. */
const comoSiFuera = (donde: string) => { (Platform as { OS: string }).OS = donde; };

beforeEach(() => jest.clearAllMocks());
afterEach(() => comoSiFuera(dondeEstamos));

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
    for (const nombre of ["Qué hace", "El repaso", "Los agentes"]) {
      const enlace = t.getByRole("link", { name: nombre });
      await act(async () => { fireEvent.press(enlace); });
    }
  });

  test("muestra el quiz, que es lo que distingue esto de un drive ordenado", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    expect(t.getByText(/antes de la prueba/)).toBeTruthy();
    expect(t.getByText(/^¿Qué pasa con f\(x\)/)).toBeTruthy();
    // Las cuatro opciones, con su letra: es una pregunta de verdad y no un
    // dibujo de una.
    for (const letra of ["A", "B", "C", "D"]) expect(t.getByText(letra)).toBeTruthy();
  });

  test("la pregunta de muestra está contestada, y contestada mal", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    // Es el momento que hay que mostrar: una respuesta correcta marcada en
    // verde no dice nada que no diga cualquier formulario. Lo que distingue a
    // este quiz es que el error y la explicación llegan juntos.
    expect(t.getByText("La correcta era otra. ")).toBeTruthy();
    expect(t.getByText(/tiende a 2/)).toBeTruthy();
  });

  test("dice que el quiz sale del material del ramo y que no lo ve nadie", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    expect(t.getByText("Sale de tu material")).toBeTruthy();
    expect(t.getByText("Corrige al momento")).toBeTruthy();
    expect(t.getByText("Lo que fallas vuelve")).toBeTruthy();
    expect(t.getByText(/no lo ve nadie más/)).toBeTruthy();
  });

  test("los plazos de las fichas son los que usa la aplicación de verdad", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    // Prometer en la portada un espaciado distinto del que hace el código es
    // la clase de mentira que nadie revisa hasta que un alumno la nota.
    const dicho = t.getByText(/1, 3, 7, 16 y 35 días/);
    expect(dicho).toBeTruthy();
    expect(SALTOS).toEqual([1, 3, 7, 16, 35]);
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
    comoSiFuera("web");
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
    comoSiFuera("web");
    const entrar = jest.fn();
    const t = await render(<Portada entrar={entrar} />);

    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Crear cuenta gratis" })); });
    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Empezar con Personal" })); });
    expect(entrar).toHaveBeenCalledTimes(2);
  });

  test("mientras no haya cobro, se dice; no se calla", async () => {
    comoSiFuera("web");
    const t = await render(<Portada entrar={jest.fn()} />);
    expect(t.getByText(/Todavía no hay cobro conectado/)).toBeTruthy();
  });

  // ── En el teléfono, la política de Google Play ────────────────────────
  //
  // Una aplicación que vende contenido digital tiene que cobrarlo con el
  // sistema de Play. Mostrar precios que llevan a pagar por fuera es motivo
  // de rechazo, y después de suspensión.

  test("en el teléfono no se muestra ningún precio", async () => {
    comoSiFuera("android");
    const t = await render(<Portada entrar={jest.fn()} />);

    expect(t.queryByText("$14.990")).toBeNull();
    expect(t.queryByText("US$16")).toBeNull();
    expect(t.queryByText(/equivale a/)).toBeNull();
    // Ni el selector de monedas, que existe solo para mirar precios.
    expect(t.queryByLabelText("Ver los precios en Peso chileno")).toBeNull();
  });

  test("en el teléfono el plan Personal no ofrece un botón que no cobra", async () => {
    comoSiFuera("android");
    const t = await render(<Portada entrar={jest.fn()} />);

    expect(t.queryByRole("button", { name: "Empezar con Personal" })).toBeNull();
    // Pero el plan se sigue mostrando: lo que se saca es el precio y el
    // botón, no lo que StudIA hace.
    expect(t.getByText("Personal")).toBeTruthy();
    expect(t.getByText("Ramos ilimitados")).toBeTruthy();
  });

  test("en el teléfono la cuenta gratis sí se puede crear", async () => {
    comoSiFuera("android");
    const entrar = jest.fn();
    const t = await render(<Portada entrar={entrar} />);

    await act(async () => {
      fireEvent.press(t.getByRole("button", { name: "Crear cuenta gratis" }));
    });
    expect(entrar).toHaveBeenCalledTimes(1);
  });

  test("y el colegio puede escribir: un contrato no es una compra en la app", async () => {
    comoSiFuera("android");
    const t = await render(<Portada entrar={jest.fn()} />);
    expect(t.getByRole("button", { name: "Escríbenos" })).toBeTruthy();
    expect(t.getByText("Conversemos")).toBeTruthy();
  });

  test("en el teléfono se dice que el Personal todavía no se contrata acá", async () => {
    comoSiFuera("android");
    const t = await render(<Portada entrar={jest.fn()} />);
    expect(t.getByText(/todavía no se puede contratar desde la aplicación/)).toBeTruthy();
  });

  test("dice qué se acepta al entrar, y el texto se puede leer ahí mismo", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    // El aviso va junto a la puerta y no escondido en un ajuste: quien crea la
    // cuenta tiene que poder leer qué acepta antes de aceptarlo.
    expect(t.getByText(/Al entrar aceptas/)).toBeTruthy();

    const enlace = t.getByRole("link", { name: "Términos de uso" });
    await act(async () => { fireEvent.press(enlace); });

    // Se abre el documento completo, no un enlace a una web que en la sala sin
    // señal no carga.
    await waitFor(() => expect(t.getByText("1. Qué es esto")).toBeTruthy());
  });

  test("el pie reclama la propiedad y lleva a los tres documentos", async () => {
    const t = await render(<Portada entrar={jest.fn()} />);

    expect(t.getByText(/Todos los derechos reservados/)).toBeTruthy();
    for (const nombre of ["Términos", "Privacidad", "Licencias"]) {
      expect(t.getByRole("link", { name: nombre })).toBeTruthy();
    }
  });
});
