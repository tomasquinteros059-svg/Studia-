import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ConMargenes, MARGENES } from "../../pruebas/dobles.tsx";
import { HojaModal, Pantalla } from "./componentes.tsx";

/**
 * La aplicación dibuja de borde a borde: en Android el reloj queda encima de
 * lo que pintamos arriba, y la barra de gestos encima de lo de abajo. Sin
 * compensarlo, el último botón de una pantalla no se puede tocar y la barra
 * de un modal queda debajo del reloj —que fue exactamente el error que
 * impedía escribirle al tutor—.
 *
 * En el navegador estos márgenes son cero, así que el error no se ve
 * probando a mano: solo se ve acá.
 */

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...[estilo].flat(4).filter(Boolean) as object[]);

describe("los márgenes del sistema", () => {
  test("una pantalla deja aire abajo para la barra de gestos", async () => {
    const t = await render(
      <ConMargenes><Pantalla><Text>algo</Text></Pantalla></ConMargenes>);

    const estilo = aplanar(t.getByTestId("pantalla").props.contentContainerStyle);
    expect(estilo.paddingBottom as number).toBeGreaterThanOrEqual(MARGENES.insets.bottom);
  });

  test("un modal deja aire arriba para el reloj y la batería", async () => {
    const t = await render(
      <ConMargenes>
        <HojaModal abierto cerrar={jest.fn()} titulo="Prueba">
          <Text>contenido</Text>
        </HojaModal>
      </ConMargenes>);

    // Arriba, para que la barra no quede debajo del reloj.
    const fuera = aplanar(t.getByTestId("modal").props.style);
    expect(fuera.paddingTop).toBe(MARGENES.insets.top);

    // Y abajo, para que el botón de guardar se pueda tocar.
    const dentro = aplanar(t.getByTestId("modal-hoja").props.contentContainerStyle);
    expect(dentro.paddingBottom as number).toBeGreaterThanOrEqual(MARGENES.insets.bottom);
  });

  test("sin márgenes que respetar, no se agrega aire de más", async () => {
    const sinBarras = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    };
    const { SafeAreaProvider } = require("react-native-safe-area-context");
    const t = await render(
      <SafeAreaProvider initialMetrics={sinBarras}>
        <Pantalla><Text>algo</Text></Pantalla>
      </SafeAreaProvider>);

    const estilo = aplanar(t.getByTestId("pantalla").props.contentContainerStyle);
    // Solo el respiro de siempre al final de la pantalla.
    expect(estilo.paddingBottom).toBe(26);
  });
});
