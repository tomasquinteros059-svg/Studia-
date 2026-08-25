import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { Campo, Cargando, Error as ErrorUI } from "../ui/componentes.tsx";
import { color, espacio, radio, tipo } from "../ui/tema.ts";
import { misAsignaturas } from "../lib/consultas.ts";
import { preguntarAlTutor } from "../lib/tutor.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPestana } from "../lib/rutas.ts";
import type { Asignatura } from "../lib/tipos.ts";

type Props = PropsPestana<"Tutor">;
type Burbuja = { rol: "estudiante" | "tutor"; texto: string };

export default function Tutor({ route }: Props) {
  const { datos: asignaturas, cargando, error, recargar } = usarCarga(misAsignaturas, []);
  const [elegida, setElegida] = useState<Asignatura | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const contexto = route.params?.contexto ?? null;
  const pedida = route.params?.asignaturaId;

  // Al entrar (o al cambiar de ramo) la conversación arranca de nuevo, con la
  // pregunta de apertura del ramo.
  const abrir = useCallback((a: Asignatura) => {
    setElegida(a);
    setConversacionId(null);
    setBurbujas([{ rol: "tutor", texto: a.intro_tutor }]);
    setFallo(null);
  }, []);

  useEffect(() => {
    if (!asignaturas?.length || elegida) return;
    abrir(asignaturas.find((a) => a.id === pedida) ?? asignaturas[0]!);
  }, [asignaturas, elegida, pedida, abrir]);

  async function enviar() {
    const texto = borrador.trim();
    if (!texto || !elegida || pensando) return;

    setBorrador("");
    setFallo(null);
    setBurbujas((b) => [...b, { rol: "estudiante", texto }]);
    setPensando(true);

    try {
      const r = await preguntarAlTutor({
        asignaturaId: elegida.id,
        mensaje: texto,
        conversacionId,
        contexto,
      });
      setConversacionId(r.conversacionId);
      setBurbujas((b) => [...b, { rol: "tutor", texto: r.respuesta }]);
    } catch (e) {
      setFallo(e instanceof globalThis.Error ? e.message : "El tutor no respondió.");
    } finally {
      setPensando(false);
    }
  }

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;

  return (
    <KeyboardAvoidingView
      style={e.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.chips}
        contentContainerStyle={{ gap: 7, paddingHorizontal: espacio.m, paddingVertical: 11 }}>
        {(asignaturas ?? []).map((a) => {
          const activa = a.id === elegida?.id;
          return (
            <Pressable key={a.id} accessibilityRole="tab" accessibilityState={{ selected: activa }}
              onPress={() => abrir(a)}
              style={[e.chip, activa && { backgroundColor: color.marca }]}>
              <Text style={[e.chipTexto, activa && { color: color.sobreMarca, fontWeight: "600" }]}>
                {a.nombre}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView ref={scroll} style={{ flex: 1 }}
        contentContainerStyle={{ padding: espacio.m, gap: 9 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {contexto ? <Text style={e.contexto}>{contexto}</Text> : null}
        {burbujas.map((b, i) => (
          <View key={i} style={[e.burbuja, b.rol === "estudiante" ? e.mia : e.suya]}>
            <Text style={[e.burbujaTexto, b.rol === "estudiante" && { color: color.sobreMarca }]}>
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
        <Campo
          style={{ flex: 1 }}
          placeholder="Escribe tu duda…"
          accessibilityLabel="Tu mensaje"
          value={borrador}
          onChangeText={setBorrador}
          onSubmitEditing={enviar}
          returnKeyType="send"
          multiline
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar"
          onPress={enviar} disabled={pensando || !borrador.trim()}
          style={({ pressed }) => [e.enviar, (pressed || pensando || !borrador.trim()) && { opacity: 0.5 }]}>
          <Text style={e.enviarTexto}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  chips: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde },
  chip: { borderRadius: radio.pastilla, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: color.elemento },
  chipTexto: { fontSize: 13, color: color.textoSuave },
  contexto: {
    alignSelf: "center", ...tipo.detalle, backgroundColor: color.elemento,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: radio.pastilla, overflow: "hidden",
  },
  burbuja: { maxWidth: "84%", padding: 11, borderRadius: radio.burbuja },
  mia: { alignSelf: "flex-end", backgroundColor: color.marca, borderBottomRightRadius: 5 },
  suya: { alignSelf: "flex-start", backgroundColor: color.elemento, borderBottomLeftRadius: 5 },
  burbujaTexto: { fontSize: 14, lineHeight: 21, color: color.texto },
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
