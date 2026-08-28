// Datos y dobles compartidos por las pruebas de pantalla.

import type { ComponentType } from "react";
import { act, render } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Tarea } from "../src/dominio/acta.ts";
import type { Reunion, ReunionCompleta, TareaConReunion } from "../src/lib/tipos-reunion.ts";

const enDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
export const dia = (d: number) => enDias(d).slice(0, 10);

export const YO = "Marta Vega";

export const REUNION: Reunion = {
  id: "r-1",
  titulo: "Asamblea extraordinaria · Torre B",
  rubro: "edificios",
  estado: "listo",
  ocurrio_en: enDias(-2),
  duracion_seg: 4920,
  participantes: ["Marta Vega", "Luis Pinto"],
  tabla: ["Ascensores", "Gastos comunes", "Renovación del seguro"],
  mia: true,
  puedo_editar: true,
  codigo: null,
  sala_abierta: false,
  sala_abierta_en: null,
  programada_para: null,
  repite: "nunca",
};

export const REUNION_2: Reunion = {
  ...REUNION, id: "r-2", titulo: "Reunión de obra semanal",
  rubro: "obras", ocurrio_en: enDias(-1),
};

export const tarea = (p: Partial<Tarea> & { id: string }): Tarea => ({
  que: "Pedir tres cotizaciones", responsable: YO, plazo: dia(4),
  prioridad: "normal", acuerdo: 1, lista: false, ...p,
});

export const TAREA_MIA = tarea({ id: "t-1" });
export const TAREA_VENCIDA = tarea({
  id: "t-2", que: "Enviar el acta firmada", plazo: dia(-3),
});
export const TAREA_AJENA = tarea({
  id: "t-3", que: "Revisar la póliza", responsable: "Luis Pinto",
});
export const TAREA_EN_EL_AIRE = tarea({
  id: "t-4", que: "Preparar el detalle de morosidad", responsable: null, plazo: null,
});

export const COMPLETA: ReunionCompleta = {
  ...REUNION,
  sala: [],
  documento: null,
  transcripcion: null,
  resumen: "Se trató la mantención de los ascensores y se revisaron los gastos comunes.",
  acuerdos: [
    { numero: 1, texto: "Se aprueba la mantención mayor con cargo al fondo de reserva.", firme: true },
    { numero: 2, texto: "Se evaluará subir la cuota del fondo de reserva.", firme: false },
  ],
  tareas: [TAREA_MIA, TAREA_VENCIDA, TAREA_AJENA, TAREA_EN_EL_AIRE],
  pendientes: [{ texto: "Adjudicar la mantención", porque: "faltan dos cotizaciones" }],
  sinTratar: ["Renovación del seguro"],
  aportes: ["Llevar el detalle de morosidad por unidad."],
  contradicciones: ["El monto del fondo de reserva: dos cifras distintas."],
};

export const conReunion = (t: Tarea, r: Reunion = REUNION): TareaConReunion =>
  ({ ...t, reunion_id: r.id, reunion: r.titulo, rubro: r.rubro });

export const TAREAS: TareaConReunion[] = [
  conReunion(TAREA_MIA), conReunion(TAREA_VENCIDA),
  conReunion(TAREA_AJENA), conReunion(TAREA_EN_EL_AIRE),
];

/** Una navegación de mentira, con los métodos que las pantallas usan. */
export function navegacionFalsa() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    push: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
}

/**
 * Renderiza una pantalla dándole props de navegación creíbles.
 *
 * Las pantallas están tipadas contra rutas concretas; acá se les entrega una
 * navegación de mentira, así que el tipo se ensancha a propósito en un solo
 * lugar en vez de repetir el ensanche en cada prueba.
 */
export async function renderPantalla(
  Pantalla: ComponentType<never>,
  params: Record<string, unknown> = {},
) {
  const navigation = navegacionFalsa();
  const Suelta = Pantalla as ComponentType<Record<string, unknown>>;
  const vista = await render(
    <Suelta navigation={navigation} route={{ key: "k", name: "X", params }} />,
  );
  // Deja que la carga inicial de datos asiente antes de devolver la pantalla:
  // si no, React avisa por cada actualización de estado fuera de `act`.
  await act(async () => { await Promise.resolve(); });
  return Object.assign(vista, { navigation });
}

/** Los manejadores son asíncronos: sin esto, el estado cambia fuera de `act`. */
export const tocar = async (hacer: () => void) => {
  await act(async () => { hacer(); await Promise.resolve(); });
};

/**
 * Renderiza una pantalla dentro de un navegador de verdad. Hace falta cuando la
 * pantalla pone botones en la cabecera con `setOptions`: sin navegador, esa
 * cabecera no existe y el botón no se puede tocar.
 */
export async function renderConNavegador(
  Pantalla: ComponentType<never>,
  params: Record<string, unknown> = {},
) {
  const Pila = createNativeStackNavigator();
  return render(
    <NavigationContainer>
      <Pila.Navigator>
        <Pila.Screen name="Prueba" component={Pantalla as never} initialParams={params} />
      </Pila.Navigator>
    </NavigationContainer>,
  );
}
