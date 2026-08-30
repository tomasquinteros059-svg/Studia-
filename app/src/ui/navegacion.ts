import { StyleSheet } from "react-native";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import type { Theme } from "@react-navigation/native";
import { FILETE, color, letra } from "./tema.ts";

/**
 * El marco de la aplicación: la barra de arriba y la de abajo.
 *
 * Está acá y no repartido por App.tsx porque son tres navegadores —el del
 * estudiante, el del profesor y el de la pila— y con las opciones copiadas
 * tres veces siempre terminaba habiendo una barra distinta de las otras.
 *
 * Lo que ordena el aspecto es lo mismo que ordena el resto: el color es de
 * los ramos, así que el marco no lleva ninguno. Papel, trazo de tinta y nada
 * más. Las dos barras cierran la hoja por arriba y por abajo, y por eso su
 * raya es de tinta y de dos píxeles, no un gris de uno: es el borde del
 * cuaderno, no una separación tímida.
 */
export const TEMA_NAVEGACION: Theme = {
  dark: false,
  colors: {
    primary: color.marca,
    background: color.fondo,
    card: color.papel,
    text: color.texto,
    border: color.bordeFuerte,
    notification: color.vivo,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "600" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "800" },
  },
};

/** La barra de abajo. Las etiquetas se leen; los íconos solos no bastan. */
export const OPCIONES_PESTANAS: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: color.marca,
  tabBarInactiveTintColor: color.textoTenue,
  tabBarStyle: {
    backgroundColor: color.papel,
    borderTopWidth: FILETE,
    borderTopColor: color.bordeFuerte,
    // Sin esto Android le pinta una sombra que compite con el filete.
    elevation: 0,
    shadowOpacity: 0,
  },
  // La barra mide 48 px y ahí adentro tienen que caber el ícono y la
  // etiqueta: con 11,5 la etiqueta se cortaba por la mitad.
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: -0.1 },
};

/** La barra de arriba de las pantallas que se abren encima. */
export const OPCIONES_PILA: NativeStackNavigationOptions = {
  headerTintColor: color.marca,
  // La separación con el contenido queda a cargo de la navegación, que la
  // dibuja con `colors.border` del tema —ahora tinta—. No se puede poner un
  // borde en `headerStyle`: la pila nativa solo acepta el color de fondo.
  headerShadowVisible: true,
  headerStyle: { backgroundColor: color.papel },
  headerTitleStyle: {
    color: color.texto, fontSize: 17.5, fontWeight: "700", fontFamily: letra.titulo,
  },
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: color.fondo },
};

/** El filete que separa la cabecera del contenido en las pantallas propias. */
export const filete = StyleSheet.create({
  abajo: { borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte },
});
