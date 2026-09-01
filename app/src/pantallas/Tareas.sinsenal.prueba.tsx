// Que la pantalla siga sirviendo sin señal, y que diga que lo que muestra es
// una copia. Va aparte de Tareas.prueba.tsx: acá el almacenamiento es de
// mentira y el plan se cambia entre pruebas, y mezclarlo con las otras
// arrastraría ese estado.

jest.mock("@react-native-async-storage/async-storage", () => {
  const disco = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => disco.get(k) ?? null,
      setItem: async (k: string, v: string) => { disco.set(k, v); },
      removeItem: async (k: string) => { disco.delete(k); },
      getAllKeys: async () => [...disco.keys()],
      multiRemove: async (ks: string[]) => { for (const k of ks) disco.delete(k); },
      clear: async () => { disco.clear(); },
    },
  };
});

jest.mock("../lib/consultas.ts", () => ({
  misTareas: jest.fn(), misAsignaturas: jest.fn(), materiaDe: jest.fn(),
}));
jest.mock("../lib/quiz.ts", () => ({ generarQuiz: jest.fn(), generarFichas: jest.fn() }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";

import { RAMO, TAREA_PENDIENTE, renderPantalla } from "../../pruebas/dobles.tsx";
import * as consultas from "../lib/consultas.ts";
import { anotarPlan } from "../lib/copia.ts";
import { comoFalla } from "../dominio/fallas.ts";
import Tareas from "./Tareas.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const conDatos = () => {
  mock.misTareas.mockResolvedValue([TAREA_PENDIENTE] as never);
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
};

/** Lo que pasa de verdad en una sala sin cobertura. */
const sinSenal = () => {
  const caida = comoFalla("Network request failed", "No pude cargar tus tareas");
  mock.misTareas.mockRejectedValue(caida);
  mock.misAsignaturas.mockRejectedValue(caida);
};

const abrir = async () => await renderPantalla(Tareas as never, undefined);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  anotarPlan("gratis");
});

describe("estudiar sin señal", () => {
  test("con plan pagado, lo que se cargó una vez sigue estando después", async () => {
    anotarPlan("personal");
    conDatos();
    const primera = await abrir();
    await waitFor(() => expect(primera.getByText(TAREA_PENDIENTE.titulo)).toBeTruthy());

    // Se va la señal y se vuelve a abrir la pantalla.
    sinSenal();
    const segunda = await abrir();

    await waitFor(() => expect(segunda.getByText(TAREA_PENDIENTE.titulo)).toBeTruthy());
  });

  // Mostrar lo viejo como si fuera de ahora es dejar que alguien decida con
  // datos de otro día sin darle la oportunidad de notarlo.
  test("y se dice que es una copia, con su fecha", async () => {
    anotarPlan("personal");
    conDatos();
    await abrir();

    sinSenal();
    const t = await abrir();

    await waitFor(() => expect(t.getByText(/Sin conexión · guardado/)).toBeTruthy());
  });

  test("con plan gratis no hay copia: sin señal se dice que no hay internet", async () => {
    anotarPlan("gratis");
    conDatos();
    await abrir();

    sinSenal();
    const t = await abrir();

    await waitFor(() => expect(t.getByText(/no hay internet/i)).toBeTruthy());
    expect(t.queryByText(TAREA_PENDIENTE.titulo)).toBeNull();
  });

  // Con un permiso denegado o con algo que ya no existe, enseñar una copia
  // sería tapar el problema con datos que ya no corresponden.
  test("una copia no tapa un problema que no es de señal", async () => {
    anotarPlan("personal");
    conDatos();
    await abrir();

    const negado = comoFalla("permission denied for table tareas", "No pude cargar tus tareas");
    mock.misTareas.mockRejectedValue(negado);
    mock.misAsignaturas.mockRejectedValue(negado);
    const t = await abrir();

    await waitFor(() => expect(t.getByText(/permiso/i)).toBeTruthy());
    expect(t.queryByText(TAREA_PENDIENTE.titulo)).toBeNull();
  });

  test("cuando vuelve la señal, deja de decir que es una copia", async () => {
    anotarPlan("personal");
    conDatos();
    await abrir();
    sinSenal();
    const sin = await abrir();
    await waitFor(() => expect(sin.getByText(/Sin conexión/)).toBeTruthy());

    conDatos();
    const con = await abrir();
    await waitFor(() => expect(con.getByText(TAREA_PENDIENTE.titulo)).toBeTruthy());
    expect(con.queryByText(/Sin conexión/)).toBeNull();
  });
});
