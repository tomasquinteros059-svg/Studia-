import { useState } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { Boton, Campo } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tipo } from "../../ui/tema.ts";

/**
 * Los colores con que se distinguen los ramos en la lista. Son los mismos
 * que usan los ramos de la institución, para que la pantalla se vea de una
 * sola pieza y no como dos aplicaciones pegadas.
 */
export const COLORES: readonly [string, ...string[]] = [
  "#208AEF", "#7A4FD6", "#C9701C", "#1E8E5A", "#D93B6B", "#0C447C",
];

/** Va rotando, para que dos ramos seguidos no salgan del mismo color. */
export const colorSugerido = (cuantosHay: number): string =>
  COLORES[Math.abs(cuantosHay) % COLORES.length] ?? COLORES[0];

export default function NuevoRamo({
  abierto, cerrar, crear, colorInicial,
}: {
  abierto: boolean;
  cerrar: () => void;
  crear: (nombre: string, color: string) => Promise<void>;
  colorInicial: string;
}) {
  const [nombre, setNombre] = useState("");
  const [elegido, setElegido] = useState(colorInicial);
  const [ocupado, setOcupado] = useState(false);

  const sePuede = nombre.trim().length > 0 && !ocupado;

  const enviar = async () => {
    setOcupado(true);
    try {
      await crear(nombre.trim(), elegido);
      setNombre("");
      cerrar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal visible={abierto} animationType="slide" onRequestClose={cerrar}>
      <KeyboardAvoidingView style={e.pantalla}
        behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={e.barra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={cerrar} hitSlop={10}>
            <Icono nombre="cerrar" tamano={22} tono={color.marca} />
          </Pressable>
          <Text style={e.barraTitulo}>Nuevo ramo</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={e.hoja}>
          <Text style={e.bajada}>
            Un ramo tuyo, que armas con lo que quieras estudiar. Nadie más lo
            ve: no tiene curso, ni foro, ni notas.
          </Text>

          <Campo placeholder="¿Qué vas a estudiar?" value={nombre} onChangeText={setNombre}
            autoCapitalize="sentences" accessibilityLabel="Nombre del ramo" />

          <Text style={tipo.etiqueta}>Color</Text>
          <View style={e.colores}>
            {COLORES.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Color ${c}`}
                accessibilityState={{ selected: elegido === c }}
                onPress={() => setElegido(c)}
                style={[e.color, { backgroundColor: c }, elegido === c ? e.colorElegido : null]}
              />
            ))}
          </View>

          <Boton
            texto={ocupado ? "Creando…" : "Crear ramo"}
            onPress={() => void enviar()}
            deshabilitado={!sePuede}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  barra: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  barraTitulo: { fontSize: 16, fontWeight: "600", color: color.texto },
  hoja: { padding: espacio.l, gap: espacio.m },
  bajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21 },
  colores: { flexDirection: "row", flexWrap: "wrap", gap: espacio.m },
  color: { width: 38, height: 38, borderRadius: radio.campo },
  colorElegido: { borderWidth: 3, borderColor: color.texto },
});
