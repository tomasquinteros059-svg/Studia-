// Datos y dobles compartidos por las pruebas de pantalla.

import type { ComponentType, ReactNode } from "react";
import { act, render } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const RAMO = {
  id: "r-cal", codigo: "MAT1610", nombre: "Cálculo I", profesor: "Ana Ríos",
  ayudante: "Ignacio Soto", color: "#208AEF", creditos: 10,
  descripcion: "Cálculo diferencial en una variable.",
  requisitos: "Álgebra de enseñanza media",
  bibliografia: ["Stewart, J. — Cálculo"],
  intro_tutor: "Cuéntame en qué problema estás.",
  propio: false,
};

export const RAMO_2 = {
  ...RAMO, id: "r-fis", codigo: "FIS1503", nombre: "Física I",
  profesor: "Carla Núñez", color: "#C9701C", creditos: 10,
  intro_tutor: "Partamos por el diagrama de cuerpo libre.",
};

const enDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

export const TAREA_PENDIENTE = {
  id: "t-1", asignatura_id: RAMO.id, titulo: "Guía 4 · Optimización",
  enunciado: "Resuelve los 9 problemas.", criterios: ["El diagrama", "La función objetivo"],
  puntos: 20, vence_en: enDias(3), entregada_en: null, puntos_obtenidos: null,
};

export const TAREA_ATRASADA = {
  ...TAREA_PENDIENTE, id: "t-2", titulo: "Guía 2 · Planos", vence_en: enDias(-2),
};

export const TAREA_ENTREGADA = {
  ...TAREA_PENDIENTE, id: "t-3", titulo: "Control 2", vence_en: enDias(-10),
  entregada_en: enDias(-11), puntos_obtenidos: 27,
};

export const BLOQUE = {
  id: "b-1", asignatura_id: RAMO.id, dia: ((new Date().getDay() + 6) % 7) + 1,
  hora_inicio: "08:30:00", hora_fin: "10:00:00", sala: "A-201", tipo: "Cátedra",
};

/** Un segundo bloque del mismo día, más temprano que BLOQUE. */
export const BLOQUE_TEMPRANO = {
  id: "b-0", asignatura_id: RAMO_2.id, dia: ((new Date().getDay() + 6) % 7) + 1,
  hora_inicio: "07:00:00", hora_fin: "08:20:00", sala: "B-104", tipo: "Laboratorio",
};

export const CLASE_VIVA = {
  id: "c-viva", asignatura_id: RAMO.id, titulo: "Teorema del valor medio",
  estado: "en_vivo" as const, inicia_en: new Date(Date.now() - 720_000).toISOString(),
  duracion_seg: null, audio_url: null,
};

export const CLASE_GRABADA = {
  id: "c-grab", asignatura_id: RAMO.id, titulo: "Clase 12 · L'Hôpital",
  estado: "grabada" as const, inicia_en: enDias(-5), duracion_seg: 3840, audio_url: null,
};

export const MODULO = {
  id: "m-1", titulo: "1 · Límites", orden: 1,
  materiales: [
    { id: "mat-1", tipo: "video" as const, titulo: "Idea de límite", detalle: "Video · 14 min", orden: 1, completado: true, leible: false },
    { id: "mat-2", tipo: "documento" as const, titulo: "Apunte de límites", detalle: "Lectura · 4 min", orden: 2, completado: false, leible: true },
  ],
};

/** Un ramo que armó la propia persona: no tiene curso, ni foro, ni notas. */
export const RAMO_PROPIO = {
  ...RAMO, id: "r-mio", codigo: "MIS-INGLES", nombre: "Inglés",
  profesor: "Por tu cuenta", ayudante: null, creditos: 1,
  descripcion: null, requisitos: null, bibliografia: [],
  intro_tutor: "¿En qué parte de Inglés estás? Cuéntame qué intentaste.",
  propio: true,
};

export const EVALUACIONES = [
  { id: "e-1", titulo: "Control 1", peso: 30, orden: 1, nota: 6.2 },
  { id: "e-2", titulo: "Examen", peso: 70, orden: 2, nota: null },
];

export const HILO = {
  id: "h-1", asignatura_id: RAMO.id, autor_nombre: "Ana Ríos", autor_rol: "Profesora",
  titulo: "Sala del control", cuerpo: "Se rinde en la A-301.", fijado: true,
  creado_en: enDias(-1), respuestas: 2,
};

export const NOTIFICACION = {
  id: "n-1", tipo: "tarea" as const, titulo: "Guía 2 vence mañana",
  detalle: "Independencia lineal", asignatura_id: RAMO.id,
  ref_tipo: "tarea" as const, ref_id: TAREA_PENDIENTE.id, leida: false, creado_en: enDias(0),
};

export const APUNTE = {
  id: "a-1", asignatura_id: RAMO.id, clase_id: null, titulo: "Clase del valor medio",
  contenido: "El teorema dice que existe un c en (a,b) tal que la derivada es la pendiente media.",
  trazos: null, fijado: false, actualizado_en: enDias(-1),
};

export const LECTURA = {
  id: "mat-2", titulo: "Apunte de límites", asignatura_id: RAMO.id,
  asignatura_nombre: RAMO.nombre,
  texto: "Un límite lateral se acerca por un lado. La regla es simple.\n\nEl escalón no tiene límite en cero.",
};

/** Navegación de mentira: registra a dónde se quiso ir. */
export function navegacionFalsa() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
    push: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
}

/**
 * Los márgenes del sistema con que se prueban las pantallas.
 *
 * Con valores de verdad y no en cero: la aplicación dibuja de borde a borde
 * en Android, y una prueba con márgenes en cero no vería nunca el error de
 * un botón que queda debajo de la barra de gestos.
 */
export const MARGENES = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** El envoltorio que la aplicación pone arriba de todo. */
export function ConMargenes({ children }: { children: ReactNode }) {
  return <SafeAreaProvider initialMetrics={MARGENES}>{children}</SafeAreaProvider>;
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
  const elemento = (
    <ConMargenes>
      <Suelta navigation={navigation} route={{ key: "k", name: "X", params }} />
    </ConMargenes>
  );
  const vista = await render(elemento);
  // Deja que la carga inicial de datos asiente antes de devolver la pantalla:
  // si no, React avisa por cada actualización de estado fuera de `act`.
  await act(async () => { await Promise.resolve(); });
  return { ...vista, navigation };
}

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
    <ConMargenes>
      <NavigationContainer>
        <Pila.Navigator>
          <Pila.Screen name="Prueba" component={Pantalla as never} initialParams={params} />
        </Pila.Navigator>
      </NavigationContainer>
    </ConMargenes>,
  );
}
