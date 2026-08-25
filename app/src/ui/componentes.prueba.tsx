import { render, fireEvent } from "@testing-library/react-native";
import { Boton, Fila, Pastilla, Vacio } from "./componentes.tsx";

describe("componentes compartidos", () => {
  test("el botón muestra su texto y responde al toque", async () => {
    const alTocar = jest.fn();
    const t = await render(<Boton texto="Entregar tarea" onPress={alTocar} />);
    fireEvent.press(t.getByText("Entregar tarea"));
    expect(alTocar).toHaveBeenCalledTimes(1);
  });

  test("un botón deshabilitado no dispara nada", async () => {
    const alTocar = jest.fn();
    const t = await render(<Boton texto="Entregando…" onPress={alTocar} deshabilitado />);
    fireEvent.press(t.getByText("Entregando…"));
    expect(alTocar).not.toHaveBeenCalled();
  });

  test("la fila muestra título y detalle", async () => {
    const t = await render(<Fila titulo="Guía 4" detalle="Cálculo I · Mañana" />);
    expect(t.getByText("Guía 4")).toBeTruthy();
    expect(t.getByText("Cálculo I · Mañana")).toBeTruthy();
  });

  test("una fila sin onPress no es un botón", async () => {
    const t = await render(<Fila titulo="Solo lectura" />);
    expect(t.queryByRole("button")).toBeNull();
  });

  test("una fila con onPress sí lo es y se puede tocar", async () => {
    const alTocar = jest.fn();
    const t = await render(<Fila titulo="Tocable" onPress={alTocar} />);
    fireEvent.press(t.getByRole("button"));
    expect(alTocar).toHaveBeenCalled();
  });

  test("la pastilla dice su estado", async () => {
    const t = await render(<Pastilla texto="ATRASADA" tono="atrasada" />);
    expect(t.getByText("ATRASADA")).toBeTruthy();
  });

  test("el estado vacío explica qué pasa", async () => {
    const t = await render(<Vacio texto="Nada por acá." />);
    expect(t.getByText("Nada por acá.")).toBeTruthy();
  });
});
