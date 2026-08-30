import { fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { APUNTE, RAMO, RAMO_2, renderPantalla } from "../../pruebas/dobles.tsx";

jest.mock("../lib/consultas.ts", () => ({
  misApuntes: jest.fn(), misAsignaturas: jest.fn(),
  crearApunte: jest.fn(), fijarApunte: jest.fn(), crearRamoPropio: jest.fn(),
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1024, height: 768, scale: 2, fontScale: 1 }),
}));

import * as consultas from "../lib/consultas.ts";
import MisApuntes from "./MisApuntes.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const OTRO = {
  ...APUNTE, id: "a-2", titulo: "Diagramas de cuerpo libre",
  contenido: "Toda fuerza sobre el bloque.", asignatura_id: RAMO_2.id,
  fijado: true, actualizado_en: new Date(Date.now() - 864_000_000).toISOString(),
};

function conDatos() {
  mock.misApuntes.mockResolvedValue([APUNTE, OTRO] as never);
  mock.misAsignaturas.mockResolvedValue([RAMO, RAMO_2] as never);
  mock.fijarApunte.mockResolvedValue(undefined as never);
  mock.crearApunte.mockResolvedValue({ ...APUNTE, id: "a-nuevo" } as never);
}

beforeEach(() => jest.clearAllMocks());

describe("tablero de apuntes", () => {
  test("muestra las tarjetas con su ramo", async () => {
    conDatos();
    const t = await renderPantalla(MisApuntes);
    await waitFor(() => expect(t.getByText("Clase del valor medio")).toBeTruthy());
    expect(t.getByText("Diagramas de cuerpo libre")).toBeTruthy();
    expect(t.getByText("Cálculo I")).toBeTruthy();
    expect(t.getByText("Física I")).toBeTruthy();
  });

  test("buscar filtra sin importar acentos", async () => {
    conDatos();
    const t = await renderPantalla(MisApuntes);
    await waitFor(() => expect(t.getByText("Clase del valor medio")).toBeTruthy());
    fireEvent.changeText(t.getByLabelText("Buscar en tus apuntes"), "diagramas");
    await waitFor(() => expect(t.queryByText("Clase del valor medio")).toBeNull());
    expect(t.getByText("Diagramas de cuerpo libre")).toBeTruthy();
  });

  test("una búsqueda sin resultados lo dice", async () => {
    conDatos();
    const t = await renderPantalla(MisApuntes);
    await waitFor(() => expect(t.getByText("Clase del valor medio")).toBeTruthy());
    fireEvent.changeText(t.getByLabelText("Buscar en tus apuntes"), "zzzz");
    await waitFor(() =>
      expect(t.getByText("Ningún apunte coincide con esa búsqueda.")).toBeTruthy());
  });

  test("fijar un apunte lo guarda", async () => {
    conDatos();
    const t = await renderPantalla(MisApuntes);
    await waitFor(() => expect(t.getByText("Clase del valor medio")).toBeTruthy());
    fireEvent.press(t.getAllByLabelText("Fijar apunte")[0]!);
    await waitFor(() => expect(mock.fijarApunte).toHaveBeenCalledWith(APUNTE.id, true));
  });

  test("el que ya está fijado ofrece dejar de estarlo", async () => {
    conDatos();
    const t = await renderPantalla(MisApuntes);
    await waitFor(() => expect(t.getByLabelText("Dejar de fijar")).toBeTruthy());
  });

  test("crear un apunte pide elegir el ramo y abre el editor", async () => {
    conDatos();
    const t = await renderPantalla(MisApuntes);
    await waitFor(() => expect(t.getByLabelText("Nuevo apunte")).toBeTruthy());
    fireEvent.press(t.getByLabelText("Nuevo apunte"));
    await waitFor(() => expect(t.getByText("Apuntar en")).toBeTruthy());
    fireEvent.press(t.getAllByText("Física I")[1]!);
    await waitFor(() => expect(mock.crearApunte).toHaveBeenCalled());
    expect(t.navigation.navigate).toHaveBeenCalledWith("Apunte", { apunteId: "a-nuevo" });
  });

  test("sin ningún ramo igual se puede escribir: no se abre una hoja vacía", async () => {
    // Este es el caso que dejaba a alguien sin poder apuntar nunca: la hoja
    // subía con el título y ni una opción abajo, o sea pidiendo elegir entre
    // nada. Ahora se crea el cuaderno y se entra derecho a escribir.
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    mock.crearRamoPropio.mockResolvedValue({ ...RAMO, id: "r-propio", nombre: "Mis apuntes" } as never);

    const t = await renderPantalla(MisApuntes);
    await waitFor(() => expect(t.getByLabelText("Nuevo apunte")).toBeTruthy());
    fireEvent.press(t.getByLabelText("Nuevo apunte"));

    await waitFor(() => expect(mock.crearRamoPropio).toHaveBeenCalledWith("Mis apuntes", expect.any(String)));
    await waitFor(() => expect(mock.crearApunte).toHaveBeenCalledWith("r-propio", expect.any(String)));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Apunte", { apunteId: "a-nuevo" });
    // Y no se llegó a mostrar la hoja de elegir.
    expect(t.queryByText("Apuntar en")).toBeNull();
  });

  test("con ramos sí se pregunta en cuál, y cada uno es alcanzable", async () => {
    conDatos();
    const t = await renderPantalla(MisApuntes);
    fireEvent.press(t.getByLabelText("Nuevo apunte"));

    await waitFor(() => expect(t.getByText("Apuntar en")).toBeTruthy());
    for (const ramo of [RAMO, RAMO_2]) {
      expect(t.getByLabelText(`Apuntar en ${ramo.nombre}`)).toBeTruthy();
    }
  });

  test("si no se puede crear el cuaderno, se dice y no se queda pensando", async () => {
    conDatos();
    mock.misAsignaturas.mockResolvedValue([] as never);
    mock.crearRamoPropio.mockRejectedValue(new Error("Sin conexión.") as never);
    const aviso = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const t = await renderPantalla(MisApuntes);
    fireEvent.press(t.getByLabelText("Nuevo apunte"));

    await waitFor(() => expect(aviso).toHaveBeenCalledWith("No pude crear el apunte", "Sin conexión."));
    // El botón vuelve a estar disponible en vez de quedarse en «Abriendo…».
    await waitFor(() => expect(t.getByText("Nuevo apunte")).toBeTruthy());
    aviso.mockRestore();
  });

  test("sin apuntes invita a escribir el primero", async () => {
    conDatos();
    mock.misApuntes.mockResolvedValue([] as never);
    const t = await renderPantalla(MisApuntes);
    await waitFor(() =>
      expect(t.getByText(/Todavía no tienes apuntes/)).toBeTruthy());
  });
});
