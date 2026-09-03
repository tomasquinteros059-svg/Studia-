// El panel del colegio avisa cuando un profesor queda citado en dos salas a
// la misma hora. Se prueba aparte porque lo que importa acá no es la pantalla
// sino de dónde saca los datos.
//
// Durante un tiempo los sacaba de los perfiles de ejemplo del modo
// demostración. Con el servidor conectado, la revisión se hacía contra
// profesores inventados: salía siempre limpia, y no porque el horario
// estuviera bien. Un choque de horario no descubierto se descubre el primer
// día de clases.

import { waitFor } from "@testing-library/react-native";
import { renderPantalla } from "../../../pruebas/dobles.tsx";

jest.mock("../../lib/consultas.ts", () => ({
  misAsignaturas: jest.fn(),
  miHorario: jest.fn(),
  cursoDe: jest.fn(),
  cargarCatalogo: jest.fn(),
  registros: jest.fn(),
  quienDicta: jest.fn(),
  cambiarRol: jest.fn(),
}));

import * as consultas from "../../lib/consultas.ts";
import InicioAdmin from "./InicioAdmin.tsx";

const mock = consultas as jest.Mocked<typeof consultas>;

const RAMOS = [
  { id: "r-1", codigo: "MAT1610", nombre: "Cálculo I", color: "#2F45D4", creditos: 6, intro_tutor: "", propio: false },
  { id: "r-2", codigo: "MAT1203", nombre: "Álgebra", color: "#7C3AED", creditos: 6, intro_tutor: "", propio: false },
];

// Los dos, el mismo día, pisándose, en salas distintas: el único choque
// posible es el del profesor.
const HORARIO = [
  { id: "b-1", asignatura_id: "r-1", dia: 1, hora_inicio: "08:30:00", hora_fin: "10:00:00", sala: "A-201", tipo: "clase" },
  { id: "b-2", asignatura_id: "r-2", dia: 1, hora_inicio: "09:00:00", hora_fin: "10:30:00", sala: "B-105", tipo: "clase" },
];

async function abrir(dictados: unknown[]) {
  mock.misAsignaturas.mockResolvedValue(RAMOS as never);
  mock.miHorario.mockResolvedValue(HORARIO as never);
  mock.cursoDe.mockResolvedValue([] as never);
  mock.registros.mockResolvedValue([] as never);
  mock.cambiarRol.mockResolvedValue(undefined as never);
  mock.quienDicta.mockResolvedValue(dictados as never);

  const t = await renderPantalla(InicioAdmin);
  await waitFor(() => expect(t.getByText("El colegio")).toBeTruthy());
  return t;
}

beforeEach(() => jest.clearAllMocks());

test("le pregunta al servidor quién dicta cada ramo", async () => {
  await abrir([]);
  expect(mock.quienDicta).toHaveBeenCalled();
});

test("avisa cuando el mismo profesor tiene dos ramos juntos", async () => {
  const t = await abrir([
    { quien: "Ana Ríos", codigo: "MAT1610", papel: "profesor" },
    { quien: "Ana Ríos", codigo: "MAT1203", papel: "profesor" },
  ]);
  await waitFor(() =>
    expect(t.getByText(/Ana Ríos tiene MAT1610 y MAT1203 juntos/)).toBeTruthy());
});

test("con dos profesores distintos no inventa un choque", async () => {
  const t = await abrir([
    { quien: "Ana Ríos", codigo: "MAT1610", papel: "profesor" },
    { quien: "Nicolás Soto", codigo: "MAT1203", papel: "profesor" },
  ]);
  await waitFor(() => expect(t.getByText("El colegio")).toBeTruthy());
  expect(t.queryByText(/juntos el/)).toBeNull();
});

test("sin nadie dictando no hay choque de docente que reportar", async () => {
  // Es el caso de un colegio recién creado: hay horario cargado y todavía no
  // hay profesores asignados. Antes acá salían los de ejemplo.
  const t = await abrir([]);
  await waitFor(() => expect(t.getByText("El colegio")).toBeTruthy());
  expect(t.queryByText(/juntos el/)).toBeNull();
});
