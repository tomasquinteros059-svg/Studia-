import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

// Los dobles se crean DENTRO de la fábrica y se recuperan después. `import`
// se eleva por encima de cualquier `const`, así que una fábrica que nombre
// una variable de afuera la encuentra sin inicializar y el módulo queda con
// `auth` indefinido: la pantalla no falla al cargar, falla al tocar el botón.
// La pantalla arma la dirección de vuelta del correo con el esquema de la app.
// Fuera de un teléfono no hay esquema que resolver.
jest.mock("expo-linking", () => ({ createURL: (r: string) => `studia://${r}` }));

jest.mock("../lib/supabase.ts", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

import { supabase } from "../lib/supabase.ts";
import Sesion from "./Sesion.tsx";

const mockAuth = supabase.auth as unknown as {
  signUp: jest.Mock;
  signInWithPassword: jest.Mock;
  resetPasswordForEmail: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.signInWithPassword.mockResolvedValue({ error: null });
  // Con la confirmación por correo apagada, `signUp` devuelve sesión al tiro.
  mockAuth.signUp.mockResolvedValue({ data: { session: { user: {} } }, error: null });
  mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
});

// Ya no hay una bienvenida que saltar: quien llega acá viene de la portada.
const abrir = async () => await render(<Sesion />);

const escribirCorreo = async (t: Awaited<ReturnType<typeof abrir>>, correo: string) => {
  await act(async () => { fireEvent.changeText(t.getByLabelText("Correo"), correo); });
};

describe("entrar a StudIA", () => {
  test("primero pregunta el correo, no la clave", async () => {
    const t = await abrir();
    expect(t.getByText("¿Cuál es tu correo?")).toBeTruthy();
    expect(t.queryByLabelText("Contraseña")).toBeNull();
  });

  test("a un correo cualquiera le explica que entra por su cuenta", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    expect(t.getByText(/armas tus propios ramos/)).toBeTruthy();
  });

  test("a un correo institucional lo reconoce por su nombre", async () => {
    const t = await abrir();
    await escribirCorreo(t, "eduardo@alumnos.uc.cl");
    expect(t.getByText(/Pontificia Universidad Católica/)).toBeTruthy();
  });

  test("un correo mal escrito no deja continuar", async () => {
    const t = await abrir();
    await escribirCorreo(t, "eduardo");
    expect(t.getByText(/no parece un correo/)).toBeTruthy();
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    // Sigue en el mismo paso: no llegó a pedir la clave.
    expect(t.getByText("¿Cuál es tu correo?")).toBeTruthy();
  });

  test("con el correo bueno pasa a la clave y lo muestra ya elegido", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    expect(t.getByLabelText("Contraseña")).toBeTruthy();
    expect(t.getByText("alguien@gmail.com")).toBeTruthy();
  });

  test("se puede volver a cambiar el correo", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.press(t.getByText("Cambiar")); });
    expect(t.getByText("¿Cuál es tu correo?")).toBeTruthy();
  });

  test("inicia sesión con el correo que se eligió", async () => {
    const t = await abrir();
    await escribirCorreo(t, "  Alguien@Gmail.com  ");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Contraseña"), "clave-demo"); });
    await act(async () => { fireEvent.press(t.getByText("Iniciar sesión")); });

    await waitFor(() => expect(mockAuth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: "Alguien@Gmail.com", password: "clave-demo" })));
  });

  // Al entrar no se exige largo, y es a propósito: quien ya tiene una cuenta
  // con una clave corta tiene derecho a entrar con ella. La regla dura vale
  // para la clave que se está creando, que es cuando todavía se puede elegir.
  test("entrar con la clave vacía no llama al servidor", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.press(t.getByText("Iniciar sesión")); });

    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(t.getByText(/Escribe tu correo y tu clave/)).toBeTruthy();
  });

  test("una clave corta sí se rechaza al crear la cuenta", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.press(t.getByText(/Crear cuenta/)); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Contraseña"), "corta1"); });
    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Crear cuenta" })); });

    expect(mockAuth.signUp).not.toHaveBeenCalled();
    expect(t.getByText(/al menos 8 caracteres/)).toBeTruthy();
  });

  test("el error del servidor se muestra en español", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Contraseña"), "clave-mala"); });
    await act(async () => { fireEvent.press(t.getByText("Iniciar sesión")); });

    await waitFor(() =>
      expect(t.getByText("El correo o la contraseña no coinciden.")).toBeTruthy());
  });

  test("crear cuenta pide el nombre", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.press(t.getByText(/Crear cuenta/)); });
    expect(t.getByLabelText("Tu nombre")).toBeTruthy();
  });

  // Con la confirmación por correo activada —lo que Supabase trae por
  // omisión— `signUp` no devuelve error ni sesión. Antes la pantalla se
  // quedaba igual, en silencio, y la persona apretaba el botón tres veces.
  test("si hay que confirmar por correo, se dice; no se queda muda", async () => {
    mockAuth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.press(t.getByText(/Crear cuenta/)); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Contraseña"), "integrales2026"); });
    await act(async () => { fireEvent.press(t.getByRole("button", { name: "Crear cuenta" })); });

    await waitFor(() => expect(t.getByText(/Te mandamos un correo a alguien@gmail.com/)).toBeTruthy());
    // Y queda en «entrar», que es lo que va a hacer después de confirmar.
    expect(t.getByText("Iniciar sesión")).toBeTruthy();
  });

  test("se puede pedir un enlace para recuperar la clave", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.press(t.getByText("Olvidé mi clave")); });

    await waitFor(() => expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
      "alguien@gmail.com", expect.objectContaining({ redirectTo: expect.any(String) })));
    expect(t.getByText(/tiene cuenta, le llega un enlace/)).toBeTruthy();
  });

  // Contestar distinto según haya cuenta o no sería una manera cómoda de
  // averiguar qué correos están registrados en StudIA.
  test("dice lo mismo exista la cuenta o no", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });
    const t = await abrir();
    await escribirCorreo(t, "nadie@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.press(t.getByText("Olvidé mi clave")); });

    await waitFor(() => expect(t.getByText(/tiene cuenta, le llega un enlace/)).toBeTruthy());
    expect(t.queryByText(/no existe/i)).toBeNull();
  });

  test("a quien está creando la cuenta no se le ofrece recuperar una clave que no tiene", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    expect(t.getByText("Olvidé mi clave")).toBeTruthy();
    await act(async () => { fireEvent.press(t.getByText(/¿No tienes cuenta\?/)); });
    expect(t.queryByText("Olvidé mi clave")).toBeNull();
  });
});
