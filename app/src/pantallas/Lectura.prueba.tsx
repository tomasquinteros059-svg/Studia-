import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { LECTURA, RAMO, renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  lecturaPorId: jest.fn(), marcarMaterial: jest.fn(),
  misApuntes: jest.fn(), crearApunte: jest.fn(), guardarApunte: jest.fn(),
}));

// La voz es nativa: acá se reemplaza por un doble que registra qué se dijo y
// deja disparar el "terminé" a mano, que es lo que encadena las frases.
type Llamada = { texto: string; alTerminar: () => void; velocidad: number };
const voz = {
  hay: true,
  dichas: [] as Llamada[],
  callados: 0,
};
jest.mock("../lib/voz.ts", () => ({
  get hayVoz() { return voz.hay; },
  IDIOMA: "es-CL",
  hablar: (texto: string, op: { alTerminar: () => void; velocidad: number }) => {
    voz.dichas.push({ texto, alTerminar: op.alTerminar, velocidad: op.velocidad });
  },
  callar: () => { voz.callados += 1; },
  hayVozEnEspanol: () => Promise.resolve(true),
  AVISO_SIN_ESPANOL: "Sin voces en español",
  AVISO_SIN_VOZ: "Sin voz",
}));

const almacen: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => Promise.resolve(almacen[k] ?? null),
    setItem: (k: string, v: string) => { almacen[k] = v; return Promise.resolve(); },
  },
}));

const anchoFalso = { valor: { width: 420, height: 900, scale: 2, fontScale: 1 } };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => anchoFalso.valor,
}));

import * as consultas from "../lib/consultas.ts";
import Lectura from "./Lectura.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

beforeEach(() => {
  jest.clearAllMocks();
  voz.hay = true;
  voz.dichas = [];
  voz.callados = 0;
  for (const k of Object.keys(almacen)) delete almacen[k];
  anchoFalso.valor = { width: 420, height: 900, scale: 2, fontScale: 1 };

  mock.lecturaPorId.mockResolvedValue(LECTURA as never);
  mock.misApuntes.mockResolvedValue([] as never);
  mock.marcarMaterial.mockResolvedValue(undefined as never);
  mock.guardarApunte.mockResolvedValue(undefined as never);
  mock.crearApunte.mockResolvedValue({ id: "a-nuevo" } as never);
});

const abrir = async () => {
  const t = await renderPantalla(Lectura, { materialId: LECTURA.id });
  await waitFor(() => expect(t.getByText(RAMO.nombre)).toBeTruthy());
  return t;
};

const tocar = async (t: Awaited<ReturnType<typeof abrir>>, etiqueta: string) => {
  await act(async () => { fireEvent.press(t.getByLabelText(etiqueta)); });
};

/** Lo que se le mandó decir al sintetizador en el turno n. */
const dicha = (n: number): Llamada => {
  const d = n < 0 ? voz.dichas[voz.dichas.length + n] : voz.dichas[n];
  if (!d) throw new Error(`no se dijo nada en el turno ${n}`);
  return d;
};

/** Simula que el sintetizador terminó de decir lo último que se le mandó. */
const terminarFrase = async () => {
  const ultima = dicha(-1);
  await act(async () => { ultima.alTerminar(); });
};

describe("lector inmersivo", () => {
  test("muestra el texto cortado en frases", async () => {
    const t = await abrir();
    expect(t.getByText(/Un límite lateral se acerca por un lado\./)).toBeTruthy();
    expect(t.getByText(/El escalón no tiene límite en cero\./)).toBeTruthy();
  });

  test("no dice nada hasta que se lo piden", async () => {
    await abrir();
    expect(voz.dichas).toHaveLength(0);
  });

  test("al tocar escuchar dice la primera frase", async () => {
    const t = await abrir();
    await tocar(t, "Escuchar");
    expect(voz.dichas.map((d) => d.texto)).toEqual(["Un límite lateral se acerca por un lado."]);
  });

  test("encadena la frase siguiente sola", async () => {
    const t = await abrir();
    await tocar(t, "Escuchar");
    await terminarFrase();
    expect(dicha(1).texto).toBe("La regla es simple.");
  });

  test("al llegar al final se detiene y ofrece volver a empezar", async () => {
    const t = await abrir();
    await tocar(t, "Escuchar");
    await terminarFrase();
    await terminarFrase();
    expect(voz.dichas).toHaveLength(3);

    await terminarFrase();
    expect(voz.dichas).toHaveLength(3);
    expect(t.getByLabelText("Volver a empezar")).toBeTruthy();
    expect(t.getByText("Listo")).toBeTruthy();
  });

  test("terminar la lectura la marca como vista", async () => {
    const t = await abrir();
    await tocar(t, "Escuchar");
    await terminarFrase();
    await terminarFrase();
    await terminarFrase();
    expect(mock.marcarMaterial).toHaveBeenCalledWith(LECTURA.id, true);
  });

  test("pausar calla la voz", async () => {
    const t = await abrir();
    await tocar(t, "Escuchar");
    await tocar(t, "Pausar");
    expect(voz.callados).toBeGreaterThan(0);
    expect(t.getByLabelText("Escuchar")).toBeTruthy();
  });

  test("tocar un párrafo empieza a leer desde su primera frase", async () => {
    const t = await abrir();
    await tocar(t, "Leer desde: El escalón no tiene límite en cero.");
    await tocar(t, "Escuchar");
    expect(dicha(0).texto).toBe("El escalón no tiene límite en cero.");
  });

  test("la frase anterior no retrocede más allá de la primera", async () => {
    const t = await abrir();
    await tocar(t, "Frase anterior");
    await tocar(t, "Escuchar");
    expect(dicha(0).texto).toBe("Un límite lateral se acerca por un lado.");
  });

  test("adelantar frases sin estar sonando no habla", async () => {
    const t = await abrir();
    await tocar(t, "Frase siguiente");
    expect(voz.dichas).toHaveLength(0);
  });

  test("cambiar la velocidad no adelanta la frase", async () => {
    const t = await abrir();
    await tocar(t, "Escuchar");
    await tocar(t, "Ajustes de lectura");
    await act(async () => { fireEvent.press(t.getByText("1.35×")); });

    // La misma frase otra vez, ahora más rápido, y no la siguiente.
    const ultima = dicha(-1);
    expect(ultima.texto).toBe("Un límite lateral se acerca por un lado.");
    expect(ultima.velocidad).toBe(1.35);
  });

  test("guarda dónde quedó para retomar después", async () => {
    const t = await abrir();
    await tocar(t, "Escuchar");
    await terminarFrase();
    await waitFor(() => expect(almacen[`studia.lectura.posicion.${LECTURA.id}`]).toBe("1"));
  });

  test("al volver a abrir retoma donde quedó", async () => {
    almacen[`studia.lectura.posicion.${LECTURA.id}`] = "1";
    const t = await abrir();
    await tocar(t, "Escuchar");
    expect(dicha(0).texto).toBe("La regla es simple.");
  });

  test("recuerda los ajustes entre lecturas", async () => {
    const t = await abrir();
    await tocar(t, "Ajustes de lectura");
    await act(async () => { fireEvent.press(t.getByText("Sepia")); });
    await waitFor(() =>
      expect(JSON.parse(almacen["studia.lectura.preferencias"] ?? "{}").fondo).toBe("sepia"));
  });

  test("sin voz nativa el texto igual se puede leer y lo dice", async () => {
    voz.hay = false;
    const t = await abrir();
    expect(t.getByText(/no trae la voz/)).toBeTruthy();
    expect(t.getByText(/Un límite lateral/)).toBeTruthy();
  });

  test("se calla al salir de la pantalla", async () => {
    const t = await abrir();
    expect(t.navigation.addListener).toHaveBeenCalledWith("blur", expect.any(Function));
  });
});

describe("apuntes mientras se escucha", () => {
  test("en teléfono los apuntes están escondidos hasta que se piden", async () => {
    const t = await abrir();
    expect(t.queryByLabelText("Apuntes de la lectura")).toBeNull();
    await tocar(t, "Mis apuntes");
    expect(t.getByLabelText("Apuntes de la lectura")).toBeTruthy();
  });

  test("en tablet los apuntes van al lado, siempre a la vista", async () => {
    anchoFalso.valor = { width: 1194, height: 834, scale: 2, fontScale: 1 };
    const t = await abrir();
    expect(t.getByLabelText("Apuntes de la lectura")).toBeTruthy();
    expect(t.queryByText("Mis apuntes")).toBeTruthy();
  });

  test("anotar la frase la copia entrecomillada", async () => {
    anchoFalso.valor = { width: 1194, height: 834, scale: 2, fontScale: 1 };
    const t = await abrir();
    await tocar(t, "Anotar esta frase");
    expect(t.getByLabelText("Apuntes de la lectura").props.value)
      .toBe("«Un límite lateral se acerca por un lado.»");
  });

  test("anotar dos frases las deja una debajo de la otra", async () => {
    anchoFalso.valor = { width: 1194, height: 834, scale: 2, fontScale: 1 };
    const t = await abrir();
    await tocar(t, "Anotar esta frase");
    await tocar(t, "Frase siguiente");
    await tocar(t, "Anotar esta frase");
    expect(t.getByLabelText("Apuntes de la lectura").props.value)
      .toBe("«Un límite lateral se acerca por un lado.»\n\n«La regla es simple.»");
  });

  test("retoma el apunte que ya existía de esta lectura", async () => {
    anchoFalso.valor = { width: 1194, height: 834, scale: 2, fontScale: 1 };
    mock.misApuntes.mockResolvedValue([
      { id: "a-previo", titulo: `Lectura · ${LECTURA.titulo}`, contenido: "Lo de ayer." },
    ] as never);
    const t = await abrir();
    await waitFor(() =>
      expect(t.getByLabelText("Apuntes de la lectura").props.value).toBe("Lo de ayer."));
  });
});
