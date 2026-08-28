import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ConMargenes, tocar } from "../../../pruebas/dobles.tsx";
import Entrar from "./Entrar.tsx";

const montar = async (entrar = jest.fn().mockResolvedValue("r-1")) => {
  const vista = await render(
    <ConMargenes><Entrar abierto cerrar={jest.fn()} entrar={entrar} /></ConMargenes>);
  return Object.assign(vista, { entrar });
};

const escribir = async (t: Awaited<ReturnType<typeof montar>>, codigo: string) => {
  await tocar(() => fireEvent.changeText(t.getByLabelText("Código de la sala"), codigo));
};

describe("entrar con un código", () => {
  test("un código bien escrito entra", async () => {
    const t = await montar();
    await escribir(t, "KRD497");
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Entrar" })));
    await waitFor(() => expect(t.entrar).toHaveBeenCalledWith("KRD497"));
  });

  test("se acepta en minúsculas y con el guion con que se muestra", async () => {
    const t = await montar();
    await escribir(t, "krd-497");
    expect(t.getByRole("button", { name: "Entrar" })).not.toBeDisabled();
  });

  test("un código incompleto no deja entrar todavía", async () => {
    const t = await montar();
    await escribir(t, "KRD");
    expect(t.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  test("un código que no sirve lo dice sin decir por qué exactamente", async () => {
    const t = await montar(jest.fn().mockResolvedValue(null));
    await escribir(t, "KRD497");
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Entrar" })));
    await waitFor(() => expect(t.getByText(/Ese código no sirve/)).toBeTruthy());
    expect(t.getByText(/la sala ya se cerró/)).toBeTruthy();
  });

  test("si se cae la red lo dice, y no como si el código estuviera malo", async () => {
    const t = await montar(jest.fn().mockRejectedValue(new globalThis.Error("red")));
    await escribir(t, "KRD497");
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Entrar" })));
    await waitFor(() => expect(t.getByText(/No pude conectar/)).toBeTruthy());
  });

  test("corregir el código borra el aviso anterior", async () => {
    const t = await montar(jest.fn().mockResolvedValue(null));
    await escribir(t, "KRD497");
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Entrar" })));
    await waitFor(() => expect(t.getByText(/Ese código no sirve/)).toBeTruthy());

    await escribir(t, "KRD498");
    expect(t.queryByText(/Ese código no sirve/)).toBeNull();
  });
});
