import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  miHorario: jest.fn(),
  cursoDe: jest.fn(),
  cargarCatalogo: jest.fn(),
  registros: jest.fn(),
  quienDicta: jest.fn(),
  cambiarRol: jest.fn(),
  cambiarPlan: jest.fn(),
  miInstitucion: jest.fn(),
}));

import * as consultas from "../../lib/consultas.ts";
import InicioAdmin from "./InicioAdmin.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const GENTE = [
  { id: "p-1", nombre: "José Pérez", correo: "jose@colegio.cl", rol: "estudiante", plan: "gratis", creado_en: "2026-03-04T10:00:00Z" },
  { id: "p-2", nombre: "Ana Ríos", correo: "ana@colegio.cl", rol: "profesor", plan: "gratis", creado_en: "2026-03-01T10:00:00Z" },
  { id: "p-3", nombre: "Secretaría", correo: "secre@colegio.cl", rol: "administrador", plan: "gratis", creado_en: "2026-02-20T10:00:00Z" },
];

const CONTRATO = {
  id: "i-1", nombre: "Colegio San Marcos",
  cupos: 10, ocupados: 1, esperando: 0, vence_en: null,
};

const abrirRegistro = async (gente = GENTE, contrato: unknown = CONTRATO) => {
  mock.misAsignaturas.mockResolvedValue([] as never);
  mock.miHorario.mockResolvedValue([] as never);
  mock.quienDicta.mockResolvedValue([] as never);
  mock.cursoDe.mockResolvedValue([] as never);
  mock.registros.mockResolvedValue(gente as never);
  mock.cambiarRol.mockResolvedValue(undefined as never);
  mock.miInstitucion.mockResolvedValue(contrato as never);

  const t = await renderPantalla(InicioAdmin);
  await waitFor(() => expect(t.getByText("Personas")).toBeTruthy());
  await act(async () => { fireEvent.press(t.getByText("Personas")); });
  return t;
};

beforeEach(() => jest.clearAllMocks());

describe("el registro de personas", () => {
  test("muestra quién está registrado, con su correo y desde cuándo", async () => {
    const t = await abrirRegistro();

    expect(t.getByText("José Pérez")).toBeTruthy();
    expect(t.getByText(/jose@colegio\.cl · desde/)).toBeTruthy();
  });

  test("cuenta cuántos hay de cada rol, que es lo que se mira primero", async () => {
    const t = await abrirRegistro();
    expect(t.getByText("1 estudiantes · 1 docentes · 1 de administración")).toBeTruthy();
  });

  test("buscar sin tilde igual encuentra a José", async () => {
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Buscar en el registro"), "jose");
    });

    expect(t.getByText("José Pérez")).toBeTruthy();
    expect(t.queryByText("Ana Ríos")).toBeNull();
  });

  test("una búsqueda sin resultados lo dice, no muestra la lista entera", async () => {
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Buscar en el registro"), "nadie");
    });

    expect(t.getByText(/Nadie calza con/)).toBeTruthy();
    expect(t.queryByText("José Pérez")).toBeNull();
  });

  test("cambiar el rol de alguien lo manda a la base y recarga", async () => {
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.press(t.getByLabelText("Docente para José Pérez"));
    });

    await waitFor(() => expect(mock.cambiarRol).toHaveBeenCalledWith("p-1", "profesor"));
    // Se vuelve a preguntar: el rol cambió y la lista tiene que reflejarlo.
    expect(mock.registros).toHaveBeenCalledTimes(2);
  });

  test("el rol que ya tiene no se puede volver a apretar", async () => {
    const t = await abrirRegistro();

    fireEvent.press(t.getByLabelText("Estudiante para José Pérez"));
    expect(mock.cambiarRol).not.toHaveBeenCalled();
  });

  test("si la base lo rechaza, se dice y no se inventa que resultó", async () => {
    const aviso = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const t = await abrirRegistro();
    // Después de abrir: el ayudante deja `cambiarRol` resolviendo bien.
    mock.cambiarRol.mockRejectedValue(new Error("No puedes cambiar tu propio rol.") as never);

    await act(async () => {
      fireEvent.press(t.getByLabelText("Docente para José Pérez"));
    });

    await waitFor(() => expect(aviso).toHaveBeenCalledWith(
      "No pude cambiar el rol", "No puedes cambiar tu propio rol."));
    aviso.mockRestore();
  });

  test("sin registro que mostrar se explica por qué, en vez de una lista vacía", async () => {
    const t = await abrirRegistro([]);
    expect(t.getByText(/solo lo ve quien administra/)).toBeTruthy();
  });
});

// ── El cupo de la institución ───────────────────────────────────────────
//
// StudIA se cobra de dos maneras y ninguna pasa por una pasarela propia. A las
// personas, por Google Play. A las instituciones, por contrato: se firman N
// cupos y la nómina los ocupa. Antes esta pantalla ofrecía los tres planes
// como si fueran un menú, y nada decía cuántos se habían contratado: la
// administración de un colegio podía repartir «Institución» sin límite.

describe("el cupo de la institución", () => {
  test("el encabezado dice cómo va el contrato", async () => {
    const t = await abrirRegistro();
    expect(t.getByText(/Colegio San Marcos · 1 de 10 cupos · quedan 9/)).toBeTruthy();
  });

  // Es el aviso que llega a tiempo: se ve antes de que esa gente se registre
  // y se quede afuera sin que nadie se entere.
  test("avisa cuando la nómina no cabe en lo contratado", async () => {
    const t = await abrirRegistro(GENTE, { ...CONTRATO, cupos: 10, ocupados: 8, esperando: 5 });
    expect(t.getByText(/faltan 3/)).toBeTruthy();
  });

  test("quien tiene el cupo se ve distinto de quien no", async () => {
    const t = await abrirRegistro([
      { ...GENTE[0]!, plan: "institucion" },
      { ...GENTE[1]!, plan: "gratis" },
    ]);
    expect(t.getByLabelText("Quitarle el cupo de la institución a José Pérez")).toBeTruthy();
    expect(t.getByLabelText("Darle un cupo de la institución a Ana Ríos")).toBeTruthy();
  });

  test("darle el cupo a alguien lo manda al servidor", async () => {
    mock.cambiarPlan.mockResolvedValue(undefined as never);
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.press(t.getByLabelText("Darle un cupo de la institución a José Pérez"));
    });
    expect(mock.cambiarPlan).toHaveBeenCalledWith("p-1", "institucion");
  });

  test("quitárselo devuelve el cupo a la bolsa", async () => {
    mock.cambiarPlan.mockResolvedValue(undefined as never);
    const t = await abrirRegistro([{ ...GENTE[0]!, plan: "institucion" }]);

    await act(async () => {
      fireEvent.press(t.getByLabelText("Quitarle el cupo de la institución a José Pérez"));
    });
    expect(mock.cambiarPlan).toHaveBeenCalledWith("p-1", "gratis");
  });

  // Sin cupos el botón no se apaga: se toca y se dice por qué. Un botón gris
  // no distingue «se acabaron» de «esta persona ya pagó», y se arreglan de
  // maneras distintas.
  test("sin cupos libres no se manda nada y se explica", async () => {
    const alerta = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const t = await abrirRegistro(GENTE, { ...CONTRATO, cupos: 3, ocupados: 3 });

    await act(async () => {
      fireEvent.press(t.getByLabelText("Darle un cupo de la institución a José Pérez"));
    });

    expect(mock.cambiarPlan).not.toHaveBeenCalled();
    expect(alerta).toHaveBeenCalledWith("No pude dar el cupo", expect.stringMatching(/No quedan cupos/));
    alerta.mockRestore();
  });

  test("con el contrato vencido tampoco se entregan cupos", async () => {
    const alerta = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const t = await abrirRegistro(GENTE, { ...CONTRATO, vence_en: "2020-01-01T00:00:00Z" });

    await act(async () => {
      fireEvent.press(t.getByLabelText("Darle un cupo de la institución a José Pérez"));
    });

    expect(mock.cambiarPlan).not.toHaveBeenCalled();
    expect(alerta).toHaveBeenCalledWith("No pude dar el cupo", expect.stringMatching(/vencido/));
    alerta.mockRestore();
  });

  // Lo pagó en Google Play. Quitárselo desde acá no le devuelve el dinero y le
  // corta lo que compró; darle un cupo encima sería gastarlo en alguien que ya
  // tiene todo.
  test("a quien paga por Google Play no se le toca el plan", async () => {
    const alerta = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const t = await abrirRegistro([{ ...GENTE[0]!, plan: "personal" }]);

    await act(async () => {
      fireEvent.press(t.getByLabelText("José Pérez paga el plan Personal por Google Play"));
    });

    expect(mock.cambiarPlan).not.toHaveBeenCalled();
    expect(alerta).toHaveBeenCalledWith("No pude dar el cupo", expect.stringMatching(/Google Play/));
    alerta.mockRestore();
  });

  test("si el servidor lo rechaza, se dice y no se calla", async () => {
    const alerta = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mock.cambiarPlan.mockRejectedValue(new Error("Esa persona no es de tu institución.") as never);
    const t = await abrirRegistro();

    await act(async () => {
      fireEvent.press(t.getByLabelText("Darle un cupo de la institución a José Pérez"));
    });
    expect(alerta).toHaveBeenCalledWith("No pude cambiar el cupo", "Esa persona no es de tu institución.");
    alerta.mockRestore();
  });

  // Una cuenta de administración sin institución no administra ninguna. No es
  // un error: es lo que ve alguien a quien se le puso el rol y todavía no
  // pertenece a ningún contrato.
  test("sin institución no se ofrece ningún cupo", async () => {
    const t = await abrirRegistro(GENTE, null);
    expect(t.queryByLabelText("Darle un cupo de la institución a José Pérez")).toBeNull();
    expect(t.queryByText(/cupos/)).toBeNull();
  });

  test("se explica de dónde sale cada plan, para no bajárselo a quien pagó", async () => {
    const t = await abrirRegistro();
    expect(t.getByText(/pagó su plan en Google Play/)).toBeTruthy();
  });
});
