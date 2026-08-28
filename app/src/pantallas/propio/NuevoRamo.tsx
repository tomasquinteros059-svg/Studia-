import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Campo, HojaModal } from "../../ui/componentes.tsx";
import { COLORES_DE_RAMO, color, espacio, radio, tipo } from "../../ui/tema.ts";

/**
 * Los colores con que se distinguen los ramos en la lista. Son los mismos
 * que usan los ramos de la institución, para que la pantalla se vea de una
 * sola pieza y no como dos aplicaciones pegadas.
 */
export const COLORES: readonly [string, ...string[]] =
  COLORES_DE_RAMO as unknown as readonly [string, ...string[]];

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
    <HojaModal abierto={abierto} cerrar={cerrar} titulo="Nuevo ramo">
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
    </HojaModal>
  );
}

const e = StyleSheet.create({
  bajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21 },
  colores: { flexDirection: "row", flexWrap: "wrap", gap: espacio.m },
  color: { width: 44, height: 44, borderRadius: radio.campo },
  colorElegido: { borderWidth: 3.5, borderColor: color.texto },
});
