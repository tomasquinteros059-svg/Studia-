import { Component, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Boton } from "./componentes.tsx";
import { color, espacio, tipo } from "./tema.ts";
import { QUE_SE_LE_DICE } from "../dominio/errores.ts";
import { anotarCaida } from "../lib/errores.ts";

/**
 * Lo que se ve cuando una pantalla se cae.
 *
 * Sin esto, un error dibujando deja la aplicación en blanco: no un mensaje,
 * no una pantalla rota, blanco. La persona cree que se le trabó el teléfono y
 * cierra la app, y nadie se entera nunca de que pasó.
 *
 * Tiene que ser una clase: `componentDidCatch` no existe como hook, y no hay
 * otra forma de atrapar un error de dibujo en React.
 */
export class Barrera extends Component<{ children: ReactNode }, { cayo: boolean }> {
  state = { cayo: false };

  static getDerivedStateFromError() {
    return { cayo: true };
  }

  componentDidCatch(error: unknown) {
    void anotarCaida(error, "pantalla");
  }

  render() {
    if (!this.state.cayo) return this.props.children;

    return (
      <View style={e.pantalla}>
        <Text style={e.titulo}>{QUE_SE_LE_DICE.titulo}</Text>
        <Text style={e.cuerpo}>{QUE_SE_LE_DICE.cuerpo}</Text>
        <View style={{ alignSelf: "stretch" }}>
          <Boton texto={QUE_SE_LE_DICE.boton} onPress={() => this.setState({ cayo: false })} />
        </View>
      </View>
    );
  }
}

const e = StyleSheet.create({
  pantalla: {
    flex: 1, backgroundColor: color.fondo,
    alignItems: "center", justifyContent: "center",
    padding: espacio.xl, gap: espacio.m,
  },
  titulo: { ...tipo.titulo, textAlign: "center" },
  cuerpo: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 22 },
});
