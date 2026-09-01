import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("../lib/errores.ts", () => ({ anotarCaida: jest.fn() }));

import * as errores from "../lib/errores.ts";
import { Barrera } from "./Barrera.tsx";

const mock = errores as jest.Mocked<typeof errores>;

/** Un componente que revienta al dibujar, como los de verdad. */
function Revienta({ roto }: { roto: boolean }) {
  if (roto) throw new Error("reventó dibujando");
  return <Text>La pantalla</Text>;
}

// React escribe el error en la consola aunque la barrera lo atrape; sin esto
// la salida de las pruebas queda ilegible.
let silencio: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  silencio = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => silencio.mockRestore());

describe("la barrera", () => {
  test("mientras nada se cae, no se nota", async () => {
    const t = await render(<Barrera><Revienta roto={false} /></Barrera>);
    expect(t.getByText("La pantalla")).toBeTruthy();
    expect(mock.anotarCaida).not.toHaveBeenCalled();
  });

  // Sin barrera, un error dibujando deja la aplicación en blanco: no un
  // mensaje, no una pantalla rota, blanco.
  test("una pantalla que revienta muestra algo, no una pantalla en blanco", async () => {
    const t = await render(<Barrera><Revienta roto /></Barrera>);
    expect(t.getByText("Se cayó esta pantalla")).toBeTruthy();
    expect(t.queryByText("La pantalla")).toBeNull();
  });

  test("y la caída queda anotada", async () => {
    await render(<Barrera><Revienta roto /></Barrera>);
    expect(mock.anotarCaida).toHaveBeenCalledTimes(1);
    expect(mock.anotarCaida).toHaveBeenCalledWith(expect.any(Error), "pantalla");
  });

  // Culpar a la persona de algo que no hizo es la manera más rápida de que
  // deje de contar los problemas.
  test("no le echa la culpa a quien la estaba usando", async () => {
    const t = await render(<Barrera><Revienta roto /></Barrera>);
    expect(t.getByText(/No fue algo que hicieras mal/)).toBeTruthy();
    // Y no le muestra el mensaje técnico, que no le sirve de nada.
    expect(t.queryByText(/reventó dibujando/)).toBeNull();
  });

  test("se puede volver a intentar", async () => {
    const t = await render(<Barrera><Revienta roto /></Barrera>);
    await act(async () => { fireEvent.press(t.getByText("Volver a intentarlo")); });
    // Vuelve a dibujar lo de adentro; si sigue roto, la barrera vuelve a saltar.
    expect(t.getByText("Se cayó esta pantalla")).toBeTruthy();
  });
});
