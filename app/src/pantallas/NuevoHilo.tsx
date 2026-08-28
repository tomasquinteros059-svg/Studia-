import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Boton, Campo } from "../ui/componentes.tsx";
import { color, espacio, tipo } from "../ui/tema.ts";
import { crearHilo } from "../lib/consultas.ts";
import type { PropsPila } from "../lib/rutas.ts";

export default function NuevoHilo({ route, navigation }: PropsPila<"NuevoHilo">) {
  const { asignaturaId } = route.params;
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publicar() {
    const t = titulo.trim();
    const c = cuerpo.trim();
    if (t.length < 5) { setError("Ponle un título que diga de qué se trata."); return; }
    if (c.length < 10) { setError("Cuenta un poco más: qué intentaste y dónde te trabaste."); return; }

    setPublicando(true);
    setError(null);
    try {
      const id = await crearHilo(asignaturaId, t, c);
      navigation.replace("Hilo", { hiloId: id, titulo: t });
    } catch (err) {
      setError(err instanceof globalThis.Error ? err.message : "No pude publicar el hilo.");
      setPublicando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={e.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={{ padding: espacio.m, gap: 11 }}>
        <Campo placeholder="¿Sobre qué es tu pregunta?" value={titulo} onChangeText={setTitulo}
          accessibilityLabel="Título del hilo" />
        <Campo placeholder="Cuenta qué intentaste y dónde te trabaste…"
          value={cuerpo} onChangeText={setCuerpo} multiline
          style={{ minHeight: 140, textAlignVertical: "top" }}
          accessibilityLabel="Tu pregunta" />

        {error ? <Text style={e.error}>{error}</Text> : null}

        <Boton texto={publicando ? "Publicando…" : "Publicar en el foro"}
          onPress={publicar} deshabilitado={publicando} />

        <Text style={e.nota}>
          Esto lo ven tus compañeros y el profesor. Si prefieres pensarlo a
          solas, el tutor está en la pestaña de al lado.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  error: { color: color.vivo, fontSize: 13.5 },
  nota: { ...tipo.detalle, textAlign: "center", lineHeight: 19, marginTop: espacio.xs },
});
