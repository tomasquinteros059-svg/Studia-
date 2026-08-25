import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Campo } from "./componentes.tsx";
import { color, espacio, radio, tipo } from "./tema.ts";
import { preguntarAlTutor } from "../lib/tutor.ts";
import type { Asignatura } from "../lib/tipos.ts";

export type Burbuja = { rol: "estudiante" | "tutor"; texto: string };

/**
 * El chat con el tutor, sin barra de navegación ni chips. Se usa entero en la
 * pestaña Tutor y como columna derecha junto a los apuntes en tablet.
 */
export function PanelTutor({
  asignatura, contexto, compacto,
}: {
  asignatura: Asignatura | null;
  contexto?: string | null;
  compacto?: boolean;
}) {
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Cambiar de ramo reinicia la conversación con su pregunta de apertura.
  useEffect(() => {
    setConversacionId(null);
    setFallo(null);
    setBurbujas(asignatura ? [{ rol: "tutor", texto: asignatura.intro_tutor }] : []);
  }, [asignatura?.id, asignatura?.intro_tutor]);

  const enviar = useCallback(async () => {
    const texto = borrador.trim();
    if (!texto || !asignatura || pensando) return;

    setBorrador("");
    setFallo(null);
    setBurbujas((b) => [...b, { rol: "estudiante", texto }]);
    setPensando(true);

    try {
      const r = await preguntarAlTutor({
        asignaturaId: asignatura.id, mensaje: texto, conversacionId, contexto,
      });
      setConversacionId(r.conversacionId);
      setBurbujas((b) => [...b, { rol: "tutor", texto: r.respuesta }]);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "El tutor no respondió.");
    } finally {
      setPensando(false);
    }
  }, [borrador, asignatura, pensando, conversacionId, contexto]);

  return (
    <View style={e.panel}>
      <ScrollView ref={scroll} style={{ flex: 1 }}
        contentContainerStyle={{ padding: espacio.m, gap: 9 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {contexto ? <Text style={e.contexto}>{contexto}</Text> : null}
        {burbujas.map((b, i) => (
          <View key={i} style={[e.burbuja, b.rol === "estudiante" ? e.mia : e.suya]}>
            <Text style={[e.texto, b.rol === "estudiante" && { color: color.sobreMarca }]}>
              {b.texto}
            </Text>
          </View>
        ))}
        {fallo ? <Text style={e.fallo}>{fallo}</Text> : null}
      </ScrollView>

      {pensando ? (
        <View style={e.pensando}>
          <ActivityIndicator size="small" color={color.marca} />
          <Text style={tipo.detalle}>El tutor está pensando…</Text>
        </View>
      ) : null}

      <View style={e.compositor}>
        <Campo style={{ flex: 1 }} placeholder={compacto ? "Pregunta…" : "Escribe tu duda…"}
          accessibilityLabel="Tu mensaje" value={borrador} onChangeText={setBorrador}
          onSubmitEditing={() => void enviar()} returnKeyType="send" multiline />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar"
          onPress={() => void enviar()} disabled={pensando || !borrador.trim()}
          style={({ pressed }) => [e.enviar, (pressed || pensando || !borrador.trim()) && { opacity: 0.5 }]}>
          <Text style={e.enviarTexto}>{compacto ? "→" : "Enviar"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  panel: { flex: 1, backgroundColor: color.fondo },
  contexto: {
    alignSelf: "center", ...tipo.detalle, backgroundColor: color.elemento,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: radio.pastilla, overflow: "hidden",
  },
  burbuja: { maxWidth: "88%", padding: 11, borderRadius: radio.burbuja },
  mia: { alignSelf: "flex-end", backgroundColor: color.marca, borderBottomRightRadius: 5 },
  suya: { alignSelf: "flex-start", backgroundColor: color.elemento, borderBottomLeftRadius: 5 },
  texto: { fontSize: 14, lineHeight: 21, color: color.texto },
  fallo: { ...tipo.detalle, color: color.vivo, textAlign: "center" },
  pensando: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: espacio.m, paddingBottom: espacio.s },
  compositor: {
    flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.borde,
  },
  enviar: {
    backgroundColor: color.marca, borderRadius: radio.campo,
    paddingHorizontal: 15, height: 44, justifyContent: "center",
  },
  enviarTexto: { color: color.sobreMarca, fontWeight: "600", fontSize: 14 },
});
