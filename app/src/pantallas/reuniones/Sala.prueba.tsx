import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { COMPLETA, tocar } from "../../../pruebas/dobles.tsx";
import type { ReunionCompleta } from "../../lib/tipos-reunion.ts";
import Sala from "./Sala.tsx";

const abierta = (p: Partial<ReunionCompleta> = {}): ReunionCompleta => ({
  ...COMPLETA,
  codigo: "KRD497",
  sala_abierta: true,
  sala_abierta_en: new Date().toISOString(),
  sala: [
    { id: "p-1", nombre: "Luis Pinto", puede_editar: false },
    { id: "p-2", nombre: "Sonia Cerda", puede_editar: false },
  ],
  ...p,
});

const montar = async (r: ReunionCompleta) => {
  const abrir = jest.fn().mockResolvedValue(undefined);
  const cerrar = jest.fn().mockResolvedValue(undefined);
  const vista = await render(<Sala reunion={r} abrir={abrir} cerrar={cerrar} />);
  return Object.assign(vista, { abrir, cerrar });
};

describe("la sala", () => {
  test("con la sala abierta muestra el código partido, para dictarlo", async () => {
    const t = await montar(abierta());
    expect(t.getByText("KRD-497")).toBeTruthy();
  });

  test("el lector de pantalla lo escucha letra por letra", async () => {
    const t = await montar(abierta());
    expect(t.getByLabelText("Código de la sala: K R D 4 9 7")).toBeTruthy();
  });

  test("dice cuánta gente entró y por cuánto sirve", async () => {
    const t = await montar(abierta());
    expect(t.getByText(/2 personas entraron/)).toBeTruthy();
    expect(t.getByText(/Sirve por 12 horas/)).toBeTruthy();
    expect(t.getByText("Luis Pinto · Sonia Cerda")).toBeTruthy();
  });

  test("sin sala abierta ofrece abrirla y explica para qué", async () => {
    const t = await montar(COMPLETA);
    expect(t.getByText(/sin que tengas que buscarlos uno por uno/)).toBeTruthy();
    await tocar(() => fireEvent.press(t.getByRole("button", { name: "Abrir la sala" })));
    await waitFor(() => expect(t.abrir).toHaveBeenCalled());
  });

  test("una sala abierta ayer ya no muestra el código: caducó", async () => {
    const ayer = new Date(Date.now() - 13 * 3_600_000).toISOString();
    const t = await montar(abierta({ sala_abierta_en: ayer }));
    expect(t.queryByText("KRD-497")).toBeNull();
    expect(t.getByRole("button", { name: "Abrir la sala" })).toBeTruthy();
  });

  test("se puede cerrar la sala antes de tiempo", async () => {
    const t = await montar(abierta());
    await tocar(() => fireEvent.press(t.getByLabelText("Cerrar la sala")));
    await waitFor(() => expect(t.cerrar).toHaveBeenCalled());
  });

  test("quien entró por la sala no ve el código: no reparte la reunión", async () => {
    const t = await montar(abierta({ mia: false, codigo: null }));
    expect(t.queryByText("KRD-497")).toBeNull();
    expect(t.queryByRole("button", { name: "Abrir la sala" })).toBeNull();
    // Pero sí ve con quién la comparte.
    expect(t.getByText("Luis Pinto · Sonia Cerda")).toBeTruthy();
  });

  test("en una reunión ajena y sin nadie más, la sala no ocupa lugar", async () => {
    const t = await montar(abierta({ mia: false, codigo: null, sala: [] }));
    expect(t.toJSON()).toBeNull();
  });
});
