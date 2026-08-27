import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

// Los dobles se crean DENTRO de la fábrica y se recuperan después. `import`
// se eleva por encima de cualquier `const`, así que una fábrica que nombre
// una variable de afuera la encuentra sin inicializar y el módulo queda con
// `auth` indefinido: la pantalla no falla al cargar, falla al tocar el botón.
jest.mock("../lib/supabase.ts", () => ({
  supabase: { auth: { signUp: jest.fn(), signInWithPassword: jest.fn() } },
}));

import { supabase } from "../lib/supabase.ts";
import Sesion from "./Sesion.tsx";

const mockAuth = supabase.auth as unknown as {
  signUp: jest.Mock;
  signInWithPassword: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.signInWithPassword.mockResolvedValue({ error: null });
  mockAuth.signUp.mockResolvedValue({ error: null });
});

const abrir = async () => {
  const t = await render(<Sesion />);
  await act(async () => { fireEvent.press(t.getByText("Comenzar")); });
  return t;
};

const escribirCorreo = async (t: Awaited<ReturnType<typeof abrir>>, correo: string) => {
  await act(async () => { fireEvent.changeText(t.getByLabelText("Correo"), correo); });
};

describe("entrar a Acta", () => {
  test("la bienvenida no pide nada todavía", async () => {
    const t = await render(<Sesion />);
    expect(t.getByText("Acta")).toBeTruthy();
    expect(t.queryByLabelText("Contraseña")).toBeNull();
  });

  test("primero pregunta el correo, no la clave", async () => {
    const t = await abrir();
    expect(t.getByText("¿Cuál es tu correo?")).toBeTruthy();
    expect(t.queryByLabelText("Contraseña")).toBeNull();
  });

  test("un correo bien escrito no levanta ninguna alarma", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    expect(t.queryByText(/no se ve completo/)).toBeNull();
  });

  test("un correo mal escrito no deja continuar", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien");
    expect(t.getByText(/no se ve completo/)).toBeTruthy();
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

  test("una clave corta se rechaza sin llamar al servidor", async () => {
    const t = await abrir();
    await escribirCorreo(t, "alguien@gmail.com");
    await act(async () => { fireEvent.press(t.getByText("Continuar")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Contraseña"), "123"); });
    await act(async () => { fireEvent.press(t.getByText("Iniciar sesión")); });

    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(t.getByText(/al menos 6 caracteres/)).toBeTruthy();
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
});
