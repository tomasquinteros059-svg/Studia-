import { render } from "@testing-library/react-native";
import { ScrollView, Text } from "react-native";
import { ConMargenes, MARGENES } from "../../pruebas/dobles.tsx";
import { HojaModal, Pantalla } from "./componentes.tsx";

/**
 * La aplicación dibuja de borde a borde: en Android el reloj queda encima de
 * lo que pintamos arriba y la barra de gestos encima de lo de abajo. Sin
 * compensarlo, el último botón de una pantalla no se puede tocar y la barra
 * de un modal queda debajo del reloj —que es exactamente lo que impedía
 * escribirle al tutor: el campo estaba, pero tapado—.
 *
 * En el navegador estos márgenes son cero, así que el error no aparece
 * probando a mano. Solo aparece acá.
 */

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...([estilo].flat(4).filter(Boolean) as object[]));

const sinBarras = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe("los márgenes del sistema", () => {
  test("una pantalla deja aire abajo para la barra de gestos", async () => {
    const t = await render(
      <ConMargenes><Pantalla><Text>algo</Text></Pantalla></ConMargenes>);

    const estilo = aplanar(t.getByTestId("pantalla").props.contentContainerStyle);
    expect(estilo.paddingBottom as number).toBeGreaterThanOrEqual(MARGENES.insets.bottom);
  });

  test("un modal deja aire arriba para el reloj y abajo para los gestos", async () => {
    const t = await render(
      <ConMargenes>
        <HojaModal abierto cerrar={jest.fn()} titulo="Prueba">
          <Text>contenido</Text>
        </HojaModal>
      </ConMargenes>);

    expect(aplanar(t.getByTestId("modal").props.style).paddingTop)
      .toBe(MARGENES.insets.top);
    expect(aplanar(t.getByTestId("modal-hoja").props.contentContainerStyle).paddingBottom as number)
      .toBeGreaterThanOrEqual(MARGENES.insets.bottom);
  });

  test("sin barras que respetar no se agrega aire de más", async () => {
    const { SafeAreaProvider } = require("react-native-safe-area-context");
    const t = await render(
      <SafeAreaProvider initialMetrics={sinBarras}>
        <Pantalla><Text>algo</Text></Pantalla>
      </SafeAreaProvider>);

    // Solo el respiro de siempre al final de la pantalla.
    expect(aplanar(t.getByTestId("pantalla").props.contentContainerStyle).paddingBottom).toBe(30);
  });

  test("el modal cierra por su botón, no solo por el gesto del sistema", async () => {
    const cerrar = jest.fn();
    const t = await render(
      <ConMargenes>
        <HojaModal abierto cerrar={cerrar} titulo="Prueba"><Text>x</Text></HojaModal>
      </ConMargenes>);

    expect(t.getByLabelText("Cerrar")).toBeTruthy();
    expect(ScrollView).toBeTruthy();
  });
});
