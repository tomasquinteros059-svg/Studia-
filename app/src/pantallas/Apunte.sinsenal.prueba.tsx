import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { APUNTE, RAMO, renderPantalla } from "../../pruebas/dobles.tsx";

// En su propio archivo, por lo mismo que el de escribir a mano: acá se espera
// el guardado automático de verdad, que tarda segundo y medio, y detrás de las
// otras pruebas eso falla por promesas ajenas y no por este código.

jest.mock("../lib/consultas.ts", () => ({
  apuntePorId: jest.fn(), misAsignaturas: jest.fn(),
  resumenDe: jest.fn(), guardarApunte: jest.fn(),
}));
jest.mock("../lib/resumen.ts", () => ({ pedirResumen: jest.fn() }));
jest.mock("../lib/preferencias.ts", () => ({
  leerTutorALaVista: jest.fn(), guardarTutorALaVista: jest.fn(),
}));
jest.mock("../lib/borradores.ts", () => ({
  guardarBorrador: jest.fn(), leerBorrador: jest.fn(), olvidarBorrador: jest.fn(),
}));

import * as consultas from "../lib/consultas.ts";
import * as prefs from "../lib/preferencias.ts";
import * as borradores from "../lib/borradores.ts";
import Apunte from "./Apunte.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockPrefs = prefs as jest.Mocked<typeof prefs>;
const mockB = borradores as jest.Mocked<typeof borradores>;

beforeEach(() => {
  jest.clearAllMocks();
  mock.apuntePorId.mockResolvedValue(APUNTE as never);
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.resumenDe.mockResolvedValue(null as never);
  mock.guardarApunte.mockResolvedValue(undefined as never);
  mockPrefs.leerTutorALaVista.mockResolvedValue(false as never);
  mockPrefs.guardarTutorALaVista.mockResolvedValue(undefined as never);
  mockB.leerBorrador.mockResolvedValue(null as never);
  mockB.guardarBorrador.mockResolvedValue(undefined as never);
  mockB.olvidarBorrador.mockResolvedValue(undefined as never);
});

const abrir = async () => await renderPantalla(Apunte as never, { apunteId: APUNTE.id });

describe("apuntes sin señal", () => {
  // Es la peor falla que tenía la aplicación: cuarenta minutos de clase
  // escritos, el guardado falla porque la sala no tiene cobertura, la pantalla
  // dice «Sin guardar» en letra chica y al salir no queda nada.
  test("si el guardado falla, lo escrito queda en el teléfono", async () => {
    mock.guardarApunte.mockRejectedValue(new Error("Network request failed"));
    const t = await abrir();

    fireEvent.changeText(t.getByLabelText("Apuntes de la clase"), "Lo que dijo en clase");

    await waitFor(() => expect(mockB.guardarBorrador).toHaveBeenCalledWith(
      expect.objectContaining({ apunteId: APUNTE.id, contenido: "Lo que dijo en clase" })),
      { timeout: 4000 });
  });

  test("y se dice que está a salvo, no que se perdió", async () => {
    mock.guardarApunte.mockRejectedValue(new Error("Network request failed"));
    const t = await abrir();
    fireEvent.changeText(t.getByLabelText("Apuntes de la clase"), "Lo que dijo en clase");

    await waitFor(() => expect(t.getByText(/Guardado en el teléfono/)).toBeTruthy(),
      { timeout: 4000 });
    expect(t.queryByText("Sin guardar")).toBeNull();
  });

  // El otro extremo: sin esto la copia local existiría y no serviría de nada.
  test("al volver a abrirlo se recupera lo que nunca subió", async () => {
    mockB.leerBorrador.mockResolvedValue({
      apunteId: APUNTE.id, contenido: "Lo que escribí sin señal", trazos: null,
      escritoEn: Date.parse(APUNTE.actualizado_en) + 60_000,
    } as never);

    const t = await abrir();
    await waitFor(() => expect(t.getByLabelText("Apuntes de la clase").props.value)
      .toBe("Lo que escribí sin señal"));
    // Y se reintenta subirlo, porque ahora puede que sí haya señal.
    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalledWith(
      APUNTE.id, { contenido: "Lo que escribí sin señal", trazos: null }));
  });

  // Si el borrador ganara en empate, cada apertura resucitaría texto viejo.
  test("un borrador más viejo que el servidor se descarta, no pisa lo nuevo", async () => {
    mockB.leerBorrador.mockResolvedValue({
      apunteId: APUNTE.id, contenido: "Versión vieja", trazos: null,
      escritoEn: Date.parse(APUNTE.actualizado_en) - 60_000,
    } as never);

    const t = await abrir();
    await act(async () => { await Promise.resolve(); });

    expect(t.getByLabelText("Apuntes de la clase").props.value).toBe(APUNTE.contenido);
    expect(mockB.olvidarBorrador).toHaveBeenCalledWith(APUNTE.id);
  });

  test("cuando sí sube, la copia local se borra", async () => {
    const t = await abrir();
    fireEvent.changeText(t.getByLabelText("Apuntes de la clase"), "Con señal");

    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalled(), { timeout: 4000 });
    expect(mockB.olvidarBorrador).toHaveBeenCalledWith(APUNTE.id);
    expect(mockB.guardarBorrador).not.toHaveBeenCalled();
  });

  // Un apunte que se abrió y se cerró no es un borrador: guardarlo pisaría
  // con vacío lo que hubiera en el servidor.
  test("un apunte vacío no se guarda como borrador aunque falle la red", async () => {
    mock.guardarApunte.mockRejectedValue(new Error("Network request failed"));
    const t = await abrir();
    fireEvent.changeText(t.getByLabelText("Apuntes de la clase"), "");

    await waitFor(() => expect(mock.guardarApunte).toHaveBeenCalled(), { timeout: 4000 });
    expect(mockB.guardarBorrador).not.toHaveBeenCalled();
  });
});
