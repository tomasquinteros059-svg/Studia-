import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { APUNTE, RAMO, renderPantalla } from "../../pruebas/dobles.tsx";

// Va en su propio archivo y no dentro de Apunte.prueba.tsx a propósito. Estas
// pruebas dibujan de verdad —bajan, mueven y levantan el puntero— y esperan el
// guardado, que tarda segundo y medio. Dentro del otro archivo quedaban detrás
// de trece pruebas que dejan promesas a medio resolver, y fallaban todas por
// eso y no por el código que prueban. Cada archivo de Jest corre en su propio
// entorno, así que acá empiezan limpias.

jest.mock("../lib/consultas.ts", () => ({
  apuntePorId: jest.fn(), misAsignaturas: jest.fn(),
  resumenDe: jest.fn(), guardarApunte: jest.fn(),
}));
jest.mock("../lib/resumen.ts", () => ({ pedirResumen: jest.fn() }));
jest.mock("../lib/preferencias.ts", () => ({
  leerTutorALaVista: jest.fn(), guardarTutorALaVista: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import * as prefs from "../lib/preferencias.ts";
import Apunte from "./Apunte.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockPrefs = prefs as jest.Mocked<typeof prefs>;

function conDatos() {
  mock.apuntePorId.mockResolvedValue(APUNTE as never);
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.resumenDe.mockResolvedValue(null as never);
  mock.guardarApunte.mockResolvedValue(undefined as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` deja las funciones devolviendo undefined, y la pantalla
  // les hace `.then`.
  mockPrefs.leerTutorALaVista.mockResolvedValue(false as never);
  mockPrefs.guardarTutorALaVista.mockResolvedValue(undefined as never);
});

describe("escribir a mano", () => {
  // Los eventos de puntero traen qué tocó la pantalla: un lápiz llega como
  // "pen" y un dedo —o la palma apoyada— como "touch". Es lo que hace posible
  // el rechazo de palma, así que las pruebas los mandan tal cual.
  const toque = (x: number, y: number, tipo: "pen" | "touch", id = 1) => ({
    nativeEvent: { pointerId: id, pointerType: tipo, offsetX: x, offsetY: y, pressure: 0.5 },
  });

  const escribir = async (
    t: Awaited<ReturnType<typeof renderPantalla>>,
    puntos: [number, number][],
    tipo: "pen" | "touch" = "pen",
    id = 1,
  ) => {
    const hoja = t.getByLabelText("Hoja para escribir a mano");
    await act(async () => {
      fireEvent(hoja, "pointerDown", toque(puntos[0]![0], puntos[0]![1], tipo, id));
      for (const [x, y] of puntos.slice(1)) fireEvent(hoja, "pointerMove", toque(x, y, tipo, id));
      const [ux, uy] = puntos[puntos.length - 1]!;
      fireEvent(hoja, "pointerUp", toque(ux, uy, tipo, id));
    });
  };

  const conLapiz = async () => {
    conDatos();
    const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });
    await waitFor(() => expect(t.getByLabelText("Apuntes de la clase")).toBeTruthy());
    await act(async () => { fireEvent.press(t.getByLabelText("Escribir a mano")); });
    return t;
  };

  test("el apunte parte en teclado: escribir a mano es algo que se pide", async () => {
    conDatos();
    const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });
    await waitFor(() => expect(t.getByLabelText("Apuntes de la clase")).toBeTruthy());

    // Sin útiles a la vista y con el teclado disponible: la mayoría de la
    // gente abre un apunte para escribir a máquina.
    expect(t.queryByLabelText("Destacador")).toBeNull();
    expect(t.getByLabelText("Apuntes de la clase").props.editable).not.toBe(false);
  });

  test("al pasar a mano aparecen los útiles y el texto deja de recibir toques", async () => {
    const t = await conLapiz();

    expect(t.getByLabelText("Lápiz")).toBeTruthy();
    expect(t.getByLabelText("Destacador")).toBeTruthy();
    expect(t.getByLabelText("Goma")).toBeTruthy();
    // Si el campo siguiera editable, tocar para dibujar abriría el teclado.
    expect(t.getByLabelText("Apuntes de la clase").props.editable).toBe(false);
  });

  test("un trazo se guarda, y se guarda entero", async () => {
    const t = await conLapiz();
    await escribir(t, [[10, 10], [20, 30], [40, 35]]);

    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalled(), { timeout: 4000 });
    const [, campos] = mock.guardarApunte.mock.calls.at(-1)!;
    const guardado = JSON.parse((campos as { trazos: string }).trazos);
    expect(guardado.trazos).toHaveLength(1);
    expect(guardado.trazos[0].puntos.length).toBeGreaterThan(1);
  });

  test("la palma no dibuja cuando ya se usó el lápiz", async () => {
    const t = await conLapiz();
    await escribir(t, [[10, 10], [20, 20]], "pen");
    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalled(), { timeout: 4000 });
    mock.guardarApunte.mockClear();

    // La mano apoyada llega como un toque más, mientras el lápiz escribe.
    await escribir(t, [[300, 300], [320, 320]], "touch", 2);

    // Nada nuevo que guardar: el borrón no llegó a existir.
    expect(mock.guardarApunte).not.toHaveBeenCalled();
  });

  test("sin lápiz, el dedo sí dibuja", async () => {
    // En un teléfono sin lápiz es la única forma de escribir a mano, y
    // negarla por si acaso dejaría la función inútil para la mayoría.
    const t = await conLapiz();
    await escribir(t, [[10, 10], [30, 30]], "touch");

    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalled(), { timeout: 4000 });
  });

  test("deshacer saca el último trazo y no el apunte entero", async () => {
    const t = await conLapiz();
    await escribir(t, [[10, 10], [20, 20]]);
    await escribir(t, [[50, 50], [60, 60]], "pen", 3);
    await waitFor(() => {
      const [, campos] = mock.guardarApunte.mock.calls.at(-1)!;
      expect(JSON.parse((campos as { trazos: string }).trazos).trazos).toHaveLength(2);
    }, { timeout: 4000 });

    await act(async () => { fireEvent.press(t.getByLabelText("Deshacer el último trazo")); });

    await waitFor(() => {
      const [, campos] = mock.guardarApunte.mock.calls.at(-1)!;
      expect(JSON.parse((campos as { trazos: string }).trazos).trazos).toHaveLength(1);
    }, { timeout: 4000 });
  });

  test("borrar el último trazo deja el apunte sin tinta, no con un tablero vacío", async () => {
    const t = await conLapiz();
    await escribir(t, [[10, 10], [20, 20]]);
    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalled(), { timeout: 4000 });

    await act(async () => { fireEvent.press(t.getByLabelText("Deshacer el último trazo")); });

    // Nulo y no "{v:1,trazos:[]}": la base distingue «nunca se dibujó acá» de
    // «se dibujó y se borró», y guardar el objeto vacío engordaría cada fila.
    await waitFor(() => {
      const [, campos] = mock.guardarApunte.mock.calls.at(-1)!;
      expect((campos as { trazos: string | null }).trazos).toBeNull();
    }, { timeout: 4000 });
  });

  test("los trazos que ya tenía el apunte se ven al abrirlo", async () => {
    conDatos();
    mock.apuntePorId.mockResolvedValue({
      ...APUNTE,
      trazos: JSON.stringify({ v: 1, trazos: [{
        id: "viejo", util: "lapiz", color: "#171C3F", grosor: 3,
        puntos: [{ x: 1, y: 1, t: 0 }, { x: 9, y: 9, t: 8 }],
      }] }),
    } as never);

    const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });
    await waitFor(() => expect(t.getByLabelText("Apuntes de la clase")).toBeTruthy());
    await act(async () => { fireEvent.press(t.getByLabelText("Escribir a mano")); });

    // Hay algo que deshacer, o sea que el trazo guardado llegó.
    expect(t.getByLabelText("Deshacer el último trazo").props.accessibilityState.disabled)
      .toBe(false);
  });

  test("unos trazos ilegibles no se llevan el apunte por delante", async () => {
    conDatos();
    mock.apuntePorId.mockResolvedValue({ ...APUNTE, trazos: "{roto" } as never);

    const t = await renderPantalla(Apunte, { apunteId: APUNTE.id });

    // El texto sigue estando, que es lo que de verdad importa.
    await waitFor(() => expect(t.getByLabelText("Apuntes de la clase")).toBeTruthy());
    expect(t.getByDisplayValue(/teorema dice/)).toBeTruthy();
  });
});
