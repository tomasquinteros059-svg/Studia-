import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { RAMO, TAREA_PENDIENTE, renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(), misTareas: jest.fn(),
  evaluacionesDe: jest.fn(), materiaDe: jest.fn(),
  cursoDe: jest.fn(), entregasDe: jest.fn(), notasDe: jest.fn(),
  corregir: jest.fn(), ponerNota: jest.fn(), publicarNotas: jest.fn(),
  clasesDe: jest.fn(), permitirEscucha: jest.fn(), crearEvaluacion: jest.fn(),
  planDe: jest.fn(), planificar: jest.fn(), borrarDelPlan: jest.fn(),
  crearMaterial: jest.fn(), moduloParaMaterial: jest.fn(),
}));

// El modal de material es el mismo del espacio propio, y trae el
// almacenamiento consigo.
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: "opened" })),
}));

jest.mock("../../lib/archivos.ts", () => ({
  sePuedeElegirArchivo: true,
  HAY_ALMACENAMIENTO: true,
  AVISO_SIN_ALMACENAMIENTO: "Guardar archivos necesita el servidor conectado.",
  elegirArchivo: jest.fn(),
  subir: jest.fn(),
  miEspacio: jest.fn(),
  direccionFirmada: jest.fn(),
}));

const curso = [
  { id: "a1", nombre: "Eduardo Q." },
  { id: "a2", nombre: "Josefa Pérez" },
];

const entregas = [
  { id: "en1", tarea_id: "t-1", estudiante_id: "a1", estudiante: "Eduardo Q.",
    entregado_en: "2026-08-20T10:00:00Z", puntos_obtenidos: null,
    archivo: "entrega/t-1/uuu-guia-4.pdf" },
  { id: "en2", tarea_id: "t-1", estudiante_id: "a2", estudiante: "Josefa Pérez",
    entregado_en: "2026-08-19T10:00:00Z", puntos_obtenidos: 18, archivo: null },
];

const notas = [
  { evaluacion_id: "e-1", estudiante_id: "a1", estudiante: "Eduardo Q.", nota: 6.2, publicada: false },
  { evaluacion_id: "e-1", estudiante_id: "a2", estudiante: "Josefa Pérez", nota: 3.5, publicada: false },
];

// Quién está usando la app decide qué botones aparecen. La pantalla lo
// pregunta a `quien-soy`, que resuelve el modo demostración o la sesión
// real; acá se reemplaza esa respuesta directamente.
const quien = { valor: { id: "p-ana", nombre: "Ana Ríos", rol: "profesor", papel: "profesor" } };
jest.mock("../../lib/quien-soy.ts", () => ({
  usarQuienSoy: () => ({ yo: quien.valor, listo: true }),
}));

const anchoFalso = { valor: { width: 420, height: 900, scale: 2, fontScale: 1 } };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => anchoFalso.valor,
}));

import * as consultas from "../../lib/consultas.ts";
import * as archivos from "../../lib/archivos.ts";
import * as WebBrowser from "expo-web-browser";
import RamoDocente from "./RamoDocente.tsx";
import { semanasDelMes } from "../../dominio/planificacion.ts";

const mock = consultas as jest.Mocked<typeof consultas>;
const mockA = archivos as jest.Mocked<typeof archivos>;
const mockNav = WebBrowser as jest.Mocked<typeof WebBrowser>;
const ARCHIVO = {
  nombre: "guia-4.pdf", mime: "application/pdf", tamano: 120_000, uri: "file:///guia-4.pdf",
};
// Las consultas del docente salen de la misma fachada que las del alumno.
const mockD = mock as unknown as {
  cursoDe: jest.Mock; entregasDe: jest.Mock; notasDe: jest.Mock;
  avanceDe: jest.Mock; corregir: jest.Mock; ponerNota: jest.Mock; publicarNotas: jest.Mock;
  clasesDe: jest.Mock; permitirEscucha: jest.Mock; crearEvaluacion: jest.Mock;
  planDe: jest.Mock; planificar: jest.Mock; borrarDelPlan: jest.Mock;
  crearMaterial: jest.Mock; moduloParaMaterial: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  quien.valor = { id: "p-ana", nombre: "Ana Ríos", rol: "profesor", papel: "profesor" };
  mock.misAsignaturas.mockResolvedValue([RAMO] as never);
  mock.misTareas.mockResolvedValue([TAREA_PENDIENTE] as never);
  mock.evaluacionesDe.mockResolvedValue([{ id: "e-1", titulo: "Control 1", peso: 30, orden: 1, nota: null }] as never);
  mock.materiaDe.mockResolvedValue([] as never);
  mockD.cursoDe.mockResolvedValue(curso as never);
  mockD.entregasDe.mockResolvedValue(entregas as never);
  mockD.notasDe.mockResolvedValue(notas as never);
  mockD.publicarNotas.mockResolvedValue(undefined as never);
  mockD.corregir.mockResolvedValue(undefined as never);
  mockD.clasesDe.mockResolvedValue([] as never);
  mockD.permitirEscucha.mockResolvedValue(undefined as never);
  mockD.crearEvaluacion.mockResolvedValue(undefined as never);
  mockD.planDe.mockResolvedValue([] as never);
  mockD.planificar.mockResolvedValue(undefined as never);
  mockD.borrarDelPlan.mockResolvedValue(undefined as never);
  mockD.crearMaterial.mockResolvedValue(undefined as never);
  mockD.moduloParaMaterial.mockResolvedValue("u-1" as never);
  mockA.elegirArchivo.mockResolvedValue(ARCHIVO as never);
  mockA.subir.mockResolvedValue({ ok: true, url: "ramo/r-cal/uuu-guia-4.pdf" } as never);
});

/** Una clase de este ramo ocurriendo ahora, en la sala. */
const enSala = (escucha_permitida: boolean) => {
  mockD.clasesDe.mockResolvedValue([{
    id: "c-viva", asignatura_id: RAMO.id, titulo: "Teorema del valor medio",
    estado: "en_vivo", inicia_en: new Date().toISOString(),
    duracion_seg: null, audio_url: null,
    presencial: true, escucha_permitida,
  }] as never);
};

const abrir = async () => {
  const t = await renderPantalla(RamoDocente, { asignaturaId: RAMO.id });
  await waitFor(() => expect(t.getByText(TAREA_PENDIENTE.titulo)).toBeTruthy());
  return t;
};

const irA = async (t: Awaited<ReturnType<typeof abrir>>, seccion: string) => {
  await act(async () => { fireEvent.press(t.getByText(seccion)); });
};

describe("el ramo desde el escritorio del docente", () => {
  test("muestra cuántos entregaron y cuántos corregidos", async () => {
    const t = await abrir();
    expect(t.getByText(/2 de 2 entregaron · 1 corregidas/)).toBeTruthy();
  });

  test("lista solo las entregas que faltan por corregir", async () => {
    const t = await abrir();
    expect(t.getByText("Eduardo Q.")).toBeTruthy();
    expect(t.queryByText("Josefa Pérez")).toBeNull();
  });

  test("corregir abre el puntaje con el máximo de la tarea", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Corregir")); });
    expect(t.getByText(`de ${TAREA_PENDIENTE.puntos}`)).toBeTruthy();
  });

  test("un puntaje sobre el máximo no se puede guardar", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Corregir")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Puntaje"), "999"); });
    expect(t.getByText(/El puntaje va entre 0 y/)).toBeTruthy();
    await act(async () => { fireEvent.press(t.getByText("Guardar")); });
    expect(mockD.corregir).not.toHaveBeenCalled();
  });

  test("un puntaje válido se guarda", async () => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText("Corregir")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Puntaje"), "17"); });
    await act(async () => { fireEvent.press(t.getByText("Guardar")); });
    expect(mockD.corregir).toHaveBeenCalledWith("t-1", "en1", 17);
  });

  test("las notas muestran el promedio y cuántos aprueban", async () => {
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText(/Promedio 4,9 · aprueban 1 de 2/)).toBeTruthy());
  });

  test("la profesora puede publicar al curso", async () => {
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText("Publicar al curso")).toBeTruthy());
  });

  test("el ayudante no ve el botón de publicar, y se le dice por qué", async () => {
    // La misma regla vive en las políticas de la base: acá solo se evita
    // ofrecer un botón que el servidor va a rechazar.
    quien.valor = { id: "p-ig", nombre: "Ignacio Soto", rol: "profesor", papel: "ayudante" };
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText(/Publicar notas es del profesor/)).toBeTruthy());
    expect(t.queryByText("Publicar al curso")).toBeNull();
  });

  test("una nota fuera de escala se avisa", async () => {
    const t = await abrir();
    await irA(t, "Notas");
    await waitFor(() => expect(t.getByText("Josefa Pérez")).toBeTruthy());
    await act(async () => { fireEvent.press(t.getByText("Josefa Pérez")); });
    await act(async () => { fireEvent.changeText(t.getByLabelText("Nota"), "9"); });
    expect(t.getByText(/La nota va entre 1,0 y 7,0/)).toBeTruthy();
  });

  test("el curso lista a todos los inscritos", async () => {
    const t = await abrir();
    await irA(t, "Curso");
    await waitFor(() => expect(t.getByText("2 inscritos")).toBeTruthy());
    expect(t.getByText("Josefa Pérez")).toBeTruthy();
  });
});

describe("la grabación de la clase, desde quien la dicta", () => {
  test("sin clase en la sala no aparece nada de grabar", async () => {
    const t = await abrir();
    expect(t.queryByText(/Permitir y empezar a grabar/)).toBeNull();
  });

  test("una clase por pantalla tampoco: no hay nada que oír desde el aire", async () => {
    mockD.clasesDe.mockResolvedValue([{
      id: "c-remota", asignatura_id: RAMO.id, titulo: "Clase por Meet",
      estado: "en_vivo", inicia_en: new Date().toISOString(),
      duracion_seg: null, audio_url: null,
      presencial: false, escucha_permitida: true,
    }] as never);

    const t = await abrir();
    expect(t.queryByText("Entrar a la grabación")).toBeNull();
  });

  test("mientras no lo permita, el curso no puede grabar", async () => {
    enSala(false);
    const t = await abrir();

    expect(t.getByText(/Nadie del curso puede grabar/)).toBeTruthy();
    expect(t.queryByText("Entrar a la grabación")).toBeNull();
  });

  test("permitirlo lo deja grabando y lo lleva a la clase", async () => {
    enSala(false);
    const t = await abrir();

    await act(async () => { fireEvent.press(t.getByText("Permitir y empezar a grabar")); });

    await waitFor(() => expect(mockD.permitirEscucha).toHaveBeenCalledWith("c-viva", true));
    expect(t.navigation.navigate).toHaveBeenCalledWith("Escucha", {
      claseId: "c-viva", titulo: "Teorema del valor medio", asignaturaId: RAMO.id,
    });
  });

  test("ya permitido, se entra sin volver a pedirlo, y se puede retirar", async () => {
    enSala(true);
    const t = await abrir();

    expect(t.getByText(/El curso puede oír esta clase/)).toBeTruthy();
    await act(async () => { fireEvent.press(t.getByText("Entrar a la grabación")); });
    expect(mockD.permitirEscucha).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(t.getByText("Dejar de permitirlo")); });
    await waitFor(() => expect(mockD.permitirEscucha).toHaveBeenCalledWith("c-viva", false));
  });
});

describe("el registro del curso", () => {
  const irAlRegistro = async (t: Awaited<ReturnType<typeof abrir>>) => {
    await act(async () => { fireEvent.press(t.getByText("Registro")); });
  };

  test("la tabla trae a todo el curso, tenga notas o no", async () => {
    // Quien no tiene ninguna es justamente a quien hay que mirar.
    mockD.notasDe.mockResolvedValue([notas[0]] as never);
    const t = await abrir();
    await irAlRegistro(t);

    expect(t.getByText("Eduardo Q.")).toBeTruthy();
    expect(t.getByText("Josefa Pérez")).toBeTruthy();
  });

  test("dice lo que falta antes que lo que hay", async () => {
    // Quien abre el registro viene a ver qué le queda por hacer.
    const t = await abrir();
    await irAlRegistro(t);
    expect(t.getByText(/falta repartir 70%/)).toBeTruthy();
    expect(t.getByText(/2 notas puestas que el curso no ve/)).toBeTruthy();
  });

  test("tocar una nota la abre para ajustarla antes de publicar", async () => {
    const t = await abrir();
    await irAlRegistro(t);

    await act(async () => {
      fireEvent.press(t.getByLabelText("Eduardo Q., Control 1"));
    });
    expect(t.getByDisplayValue("6.2")).toBeTruthy();
  });

  test("una ponderación que no cabe se rechaza antes de mandarla", async () => {
    // Vale más decirlo acá que dejar que el servidor lo rechace después de
    // escribir el formulario entero.
    const aviso = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const t = await abrir();
    await irAlRegistro(t);

    await act(async () => { fireEvent.press(t.getByText("Crear una evaluación")); });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Nombre de la evaluación"), "Examen");
      fireEvent.changeText(t.getByLabelText("Ponderación"), "80");
    });
    await act(async () => { fireEvent.press(t.getByText("Crear")); });

    expect(mockD.crearEvaluacion).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledWith("Esa ponderación no cabe", expect.stringContaining("70%"));
    aviso.mockRestore();
  });

  test("una que sí cabe se crea con su peso", async () => {
    const t = await abrir();
    await irAlRegistro(t);

    await act(async () => { fireEvent.press(t.getByText("Crear una evaluación")); });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Nombre de la evaluación"), "Examen");
      fireEvent.changeText(t.getByLabelText("Ponderación"), "70");
    });
    await act(async () => { fireEvent.press(t.getByText("Crear")); });

    await waitFor(() => expect(mockD.crearEvaluacion)
      .toHaveBeenCalledWith(RAMO.id, "Examen", 70));
  });

  test("explica que el ponderado es de lo rendido, no del semestre", async () => {
    const t = await abrir();
    await irAlRegistro(t);
    expect(t.getByText(/no cuenta como cero/)).toBeTruthy();
  });

  test("sin evaluaciones invita a crear la primera", async () => {
    mock.evaluacionesDe.mockResolvedValue([] as never);
    const t = await abrir();
    await irAlRegistro(t);
    expect(t.getByText(/Crea la primera evaluación/)).toBeTruthy();
  });
});

describe("el plan del mes", () => {
  const irAlPlan = async (t: Awaited<ReturnType<typeof abrir>>) => {
    await act(async () => { fireEvent.press(t.getByText("Plan")); });
  };

  const conUnidades = () => {
    mock.materiaDe.mockResolvedValue([
      { id: "u1", titulo: "Límites", orden: 1, materiales: [{ id: "m1" }] },
      { id: "u2", titulo: "La derivada", orden: 2, materiales: [{ id: "m2" }, { id: "m3" }] },
    ] as never);
  };

  test("propone repartiendo la materia que el profesor ya cargó", async () => {
    conUnidades();
    const t = await abrir();
    await irAlPlan(t);

    expect(t.getByText("Límites")).toBeTruthy();
    expect(t.getByText("La derivada")).toBeTruthy();
  });

  test("la propuesta se ofrece como propuesta, no como su plan", async () => {
    // Que salga de una cuenta no la vuelve una decisión: la decisión es suya.
    conUnidades();
    const t = await abrir();
    await irAlPlan(t);

    expect(t.getByText(/Esto es una propuesta, no tu plan/)).toBeTruthy();
    expect(t.getByText("Guardar esta propuesta")).toBeTruthy();
  });

  test("guardarla la manda con el lunes de cada semana", async () => {
    conUnidades();
    const t = await abrir();
    await irAlPlan(t);

    await act(async () => { fireEvent.press(t.getByText("Guardar esta propuesta")); });

    await waitFor(() => expect(mockD.planificar).toHaveBeenCalled());
    const [, bloques] = mockD.planificar.mock.calls.at(-1)!;
    expect(bloques).toHaveLength(2);
    for (const b of bloques as { semana: string }[]) {
      // Siempre un lunes: así dos meses nunca reclaman la misma semana.
      expect(new Date(`${b.semana}T00:00:00`).getDay()).toBe(1);
    }
  });

  test("con plan guardado ya no ofrece la propuesta", async () => {
    conUnidades();
    // El lunes de la primera semana del mes que la pantalla está mostrando.
    //
    // Antes esto era «el lunes de esta semana», y fallaba los primeros días de
    // cualquier mes que no empiece en lunes: hoy es martes 1 de septiembre, el
    // lunes de esta semana cae en agosto, y una semana pertenece al mes de su
    // lunes. El plan quedaba fuera del mes y la pantalla, con razón, no lo
    // mostraba. La prueba tiene que preguntarle al dominio en qué semanas
    // está parada la pantalla, no adivinarlas.
    const hoy = new Date();
    const primera = semanasDelMes(hoy.getFullYear(), hoy.getMonth())[0]!.empieza;
    const lunes = `${primera.getFullYear()}-${String(primera.getMonth() + 1).padStart(2, "0")}`
      + `-${String(primera.getDate()).padStart(2, "0")}`;
    mockD.planDe.mockResolvedValue([
      { id: "b1", semana: lunes, titulo: "Lo que yo decidí", detalle: "", modulo_id: null, orden: 1 },
    ] as never);

    const t = await abrir();
    await irAlPlan(t);

    expect(t.getByText("Lo que yo decidí")).toBeTruthy();
    expect(t.queryByText("Guardar esta propuesta")).toBeNull();
  });

  test("dice si el mes aprieta o si sobran semanas", async () => {
    conUnidades();
    const t = await abrir();
    await irAlPlan(t);
    expect(t.getByText(/semanas libres|calza justo|Mira si alcanza/)).toBeTruthy();
  });

  test("las semanas sin nada se dicen libres, no se esconden", async () => {
    // Que falte algo en una semana es justo lo que hay que ver.
    conUnidades();
    const t = await abrir();
    await irAlPlan(t);
    expect(t.getAllByText("Libre").length).toBeGreaterThan(0);
  });

  test("llevarlo al asistente le pasa el plan escrito, sin mandarlo solo", async () => {
    conUnidades();
    const t = await abrir();
    await irAlPlan(t);

    await act(async () => { fireEvent.press(t.getByText("Conversarlo con el asistente")); });

    expect(t.navigation.navigate).toHaveBeenCalledWith("PrincipalDocente", {
      screen: "Asistente",
      params: { pregunta: expect.stringContaining("Plan de") },
    });
  });

  test("sin unidades no inventa un plan", async () => {
    mock.materiaDe.mockResolvedValue([] as never);
    const t = await abrir();
    await irAlPlan(t);

    expect(t.getByText(/todavía no tiene unidades/)).toBeTruthy();
    expect(t.queryByText("Guardar esta propuesta")).toBeNull();
  });
});

describe("cargar material del ramo", () => {
  /** Dos unidades, para que se pueda elegir en cuál va. */
  const conUnidades = () => {
    mock.materiaDe.mockResolvedValue([
      { id: "u-1", titulo: "Límites", orden: 1, materiales: [] },
      { id: "u-2", titulo: "La derivada", orden: 2, materiales: [] },
    ] as never);
  };

  const abrirElModal = async () => {
    conUnidades();
    const t = await abrir();
    await irA(t, "Material");
    await act(async () => { fireEvent.press(t.getByText("Agregar material")); });
    return t;
  };

  test("ya no dice que hay que usar la planilla: se carga desde acá", async () => {
    conUnidades();
    const t = await abrir();
    await irA(t, "Material");
    expect(t.getByText("Agregar material")).toBeTruthy();
  });

  // El archivo va a la carpeta del ramo y no a la de quien lo sube: lo tiene
  // que poder abrir el curso entero.
  test("el archivo se guarda en la carpeta del ramo", async () => {
    const t = await abrirElModal();
    await act(async () => { fireEvent.press(t.getByLabelText("Adjuntar un archivo")); });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Título del material"), "Guía 4");
    });
    await act(async () => { fireEvent.press(t.getByText("Guardar")); });

    await waitFor(() => expect(mockA.subir).toHaveBeenCalledWith(
      ARCHIVO, { tipo: "ramo", asignaturaId: RAMO.id }));
    expect(mockA.miEspacio).not.toHaveBeenCalled();
  });

  test("se elige en qué unidad queda, y por omisión va en la primera", async () => {
    const t = await abrirElModal();
    await act(async () => { fireEvent.press(t.getByLabelText("Adjuntar un archivo")); });
    await act(async () => {
      fireEvent.changeText(t.getByLabelText("Título del material"), "Guía 4");
    });
    await act(async () => { fireEvent.press(t.getByLabelText("La derivada")); });
    await act(async () => { fireEvent.press(t.getByText("Guardar")); });

    await waitFor(() => expect(mockD.crearMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ moduloId: "u-2", url: "ramo/r-cal/uuu-guia-4.pdf" })));
    // La unidad la eligió la pantalla: no hizo falta preguntarle a los datos.
    expect(mockD.moduloParaMaterial).not.toHaveBeenCalled();
  });
});

describe("corregir una entrega", () => {
  beforeEach(() => { jest.spyOn(Alert, "alert").mockImplementation(() => undefined); });

  /**
   * Quien entregó en papel o en clase: sin corregir y sin archivo.
   *
   * Va acá y no en el doble compartido porque sumar una entrega le cambia las
   * cuentas —«17 de 20 entregaron»— a las pruebas que las revisan.
   */
  const sinArchivo = () => {
    mockD.entregasDe.mockResolvedValue([...entregas, {
      id: "en3", tarea_id: "t-1", estudiante_id: "a3", estudiante: "Diego Aravena",
      entregado_en: "2026-08-21T10:00:00Z", puntos_obtenidos: null, archivo: null,
    }] as never);
  };

  const abrirCorreccion = async (quien: string) => {
    const t = await abrir();
    await act(async () => { fireEvent.press(t.getByText(quien)); });
    return t;
  };

  // Corregir sin poder leer lo que se entregó es poner un número a ciegas.
  test("deja abrir lo que entregó el alumno", async () => {
    mockA.direccionFirmada.mockResolvedValue("https://firmada.example/guia-4.pdf" as never);
    const t = await abrirCorreccion("Eduardo Q.");

    await act(async () => { fireEvent.press(t.getByText("Ver lo que entregó")); });

    await waitFor(() => expect(mockA.direccionFirmada)
      .toHaveBeenCalledWith("entrega/t-1/uuu-guia-4.pdf"));
    await waitFor(() => expect(mockNav.openBrowserAsync)
      .toHaveBeenCalledWith("https://firmada.example/guia-4.pdf"));
  });

  test("si entregó sin adjuntar nada, lo dice en vez de ofrecer un botón muerto", async () => {
    sinArchivo();
    const t = await abrirCorreccion("Diego Aravena");
    expect(t.getByText("Entregó sin adjuntar ningún archivo.")).toBeTruthy();
    expect(t.queryByText("Ver lo que entregó")).toBeNull();
  });

  test("si el archivo ya no está, se dice", async () => {
    mockA.direccionFirmada.mockResolvedValue(null as never);
    const t = await abrirCorreccion("Eduardo Q.");
    await act(async () => { fireEvent.press(t.getByText("Ver lo que entregó")); });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      "No pude abrirlo", "El archivo ya no está disponible."));
  });
});
