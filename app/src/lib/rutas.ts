import type { NavigatorScreenParams, CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

/** Las cuatro pestañas de abajo. */
export type RutasPestanas = {
  Inicio: undefined;
  Horario: undefined;
  Tareas: undefined;
  Apuntes: undefined;
  Tutor: { asignaturaId?: string; contexto?: string } | undefined;
};

/** Lo que se apila encima de las pestañas. */
export type RutasPila = {
  Principal: NavigatorScreenParams<RutasPestanas> | undefined;
  Asignatura: { asignaturaId: string; seccion?: string };
  Notas: undefined;
  Notificaciones: undefined;
  Hilo: { hiloId: string; titulo: string };
  NuevoHilo: { asignaturaId: string };
  Tarea: { tareaId: string };
  Perfil: undefined;
  Apunte: { apunteId: string };
  Lectura: { materialId: string };
  Consejos: undefined;
  /** Los términos, la privacidad o las licencias de terceros. */
  Legal: { que: "terminos" | "privacidad" | "terceros" } | undefined;
  /** El tono es el del ramo: la pantalla lo recibe hecho para no volver a pedirlo. */
  Quiz: { quizId: string; tono?: string };
  Fichas: { asignaturaId: string; tema: string; tono?: string };
  /** El modo escucha de una clase presencial. */
  Escucha: { claseId: string; titulo: string; asignaturaId: string };
  ClaseEnVivo: {
    titulo: string;
    asignatura: string;
    codigo: string;
    profesor: string;
    desdeSegundos: number;
  };
  Grabacion: {
    claseId: string;
    asignaturaId: string;
    titulo: string;
    fecha: string | null;
    duracionSeg: number | null;
    audioUrl: string | null;
  };
};

/* ------------------------------------------------------------- docente */
/** Lo que ve quien dicta un ramo. Es otra aplicación sobre los mismos datos. */
export type RutasPestanasDocente = {
  Cursos: undefined;
  Material: undefined;
  /** Se puede llegar con una pregunta ya escrita, desde otra pantalla. */
  Asistente: { pregunta?: string } | undefined;
  Horario: undefined;
  Perfil: undefined;
};

export type RutasPilaDocente = {
  PrincipalDocente: NavigatorScreenParams<RutasPestanasDocente> | undefined;
  RamoDocente: { asignaturaId: string };
  /** La misma pantalla de escucha que usa el curso: la clase es una sola. */
  Escucha: { claseId: string; titulo: string; asignaturaId: string };
  /** Los mismos textos legales que ve el curso: el acuerdo es uno solo. */
  Legal: { que: "terminos" | "privacidad" | "terceros" } | undefined;
};

export type PropsPestanaDocente<T extends keyof RutasPestanasDocente> = CompositeScreenProps<
  BottomTabScreenProps<RutasPestanasDocente, T>,
  NativeStackScreenProps<RutasPilaDocente>
>;

export type PropsPilaDocente<T extends keyof RutasPilaDocente> =
  NativeStackScreenProps<RutasPilaDocente, T>;

/** Una pestaña también puede navegar a la pila que la contiene. */
export type PropsPestana<T extends keyof RutasPestanas> = CompositeScreenProps<
  BottomTabScreenProps<RutasPestanas, T>,
  NativeStackScreenProps<RutasPila>
>;

export type PropsPila<T extends keyof RutasPila> = NativeStackScreenProps<RutasPila, T>;

/** Ir al tutor desde cualquier parte, con el ramo y el contexto de dónde venías. */
export const alTutor = (asignaturaId: string, contexto?: string) =>
  ["Principal", { screen: "Tutor" as const, params: { asignaturaId, contexto } }] as const;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RutasPila {}
  }
}
