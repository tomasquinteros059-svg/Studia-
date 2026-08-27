import type { NavigatorScreenParams, CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

/** Las pestañas de abajo. */
export type RutasPestanas = {
  Reuniones: undefined;
  Tareas: undefined;
};

/** Lo que se apila encima de las pestañas. */
export type RutasPila = {
  Principal: NavigatorScreenParams<RutasPestanas> | undefined;
  Reunion: { reunionId: string };
  Grabar: { reunionId: string };
  Perfil: undefined;
};

/** Una pestaña también puede navegar a la pila que la contiene. */
export type PropsPestana<T extends keyof RutasPestanas> = CompositeScreenProps<
  BottomTabScreenProps<RutasPestanas, T>,
  NativeStackScreenProps<RutasPila>
>;

export type PropsPila<T extends keyof RutasPila> = NativeStackScreenProps<RutasPila, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RutasPila {}
  }
}
