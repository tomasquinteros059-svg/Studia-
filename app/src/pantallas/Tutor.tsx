import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Campo, Cargando, Error as ErrorUI } from "../ui/componentes.tsx";
import {
  FILETE, color, colorDeRamo, espacio, inicialesDeRamo, radio, tipo,
} from "../ui/tema.ts";
import { misAsignaturas } from "../lib/consultas.ts";
import { preguntarAlTutor } from "../lib/tutor.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPestana } from "../lib/rutas.ts";
import type { Asignatura } from "../lib/tipos.ts";

type Props = PropsPestana<"Tutor">;
type Burbuja = { rol: "estudiante" | "tutor"; texto: string };

export default function Tutor({ route }: Props) {
  const margenes = useSafeAreaInsets();
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
  // El tutor no tiene color propio: toma el del ramo del que se está
  // hablando, para que se note de qué se está hablando sin leer nada.
  const tono = elegida ? colorDeRamo(elegida.id, elegida.color) : color.marca;

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
      keyboardVerticalOffset={margenes.top + 44}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.chips}
        contentContainerStyle={{ gap: espacio.s, paddingHorizontal: espacio.m, paddingVertical: espacio.m }}>
        {(asignaturas ?? []).map((a) => {
          const activa = a.id === elegida?.id;
          const suyo = colorDeRamo(a.id, a.color);
          return (
            <Pressable key={a.id} accessibilityRole="tab" accessibilityState={{ selected: activa }}
              onPress={() => abrir(a)}
              style={[e.chip, activa && { backgroundColor: suyo, borderColor: suyo }]}>
              <View style={[e.puntoRamo, { backgroundColor: activa ? "rgba(255,255,255,0.55)" : suyo }]} />
              <Text style={[e.chipTexto, activa && { color: color.sobreMarca, fontWeight: "700" }]}
                numberOfLines={1}>
                {a.nombre}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView ref={scroll} style={{ flex: 1 }}
        contentContainerStyle={{ padding: espacio.m, gap: espacio.s }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {elegida ? (
          <View style={e.presentacion}>
            <View style={[e.sello, { backgroundColor: tono }]}>
              <Text style={e.selloTexto}>{inicialesDeRamo(elegida.nombre)}</Text>
            </View>
            <Text style={e.presentacionRamo} numberOfLines={2}>{elegida.nombre}</Text>
            <Text style={e.presentacionBajada}>
              Pregúntale lo que quieras de este ramo. Lo que hablen acá se queda acá.
            </Text>
          </View>
        ) : null}

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
          <ActivityIndicator size="small" color={tono} />
          <Text style={tipo.detalle}>El tutor está pensando…</Text>
        </View>
      ) : null}

      {/* El margen de abajo es lo que impedía escribirle al tutor: la app
          dibuja de borde a borde y la barra de gestos del sistema tapaba el
          campo entero. */}
      <View style={[e.compositor, { paddingBottom: espacio.s + margenes.bottom }]}>
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
          style={({ pressed }) => [
            e.enviar, { backgroundColor: tono },
            (pressed || pensando || !borrador.trim()) && { opacity: 0.45 },
          ]}>
          <Text style={e.enviarTexto}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  chips: {
    flexGrow: 0, backgroundColor: color.papel,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: espacio.s, maxWidth: 230,
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 9,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  puntoRamo: { width: 8, height: 8, borderRadius: 4 },
  chipTexto: { fontSize: 14, fontWeight: "600", color: color.textoSuave, flexShrink: 1 },

  // Antes de la primera pregunta la pantalla estaba en blanco. Presentarse
  // cuesta cuatro líneas y evita la duda de qué se puede preguntar.
  presentacion: { alignItems: "center", gap: espacio.s, paddingVertical: espacio.l },
  sello: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  selloTexto: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  presentacionRamo: { ...tipo.subtitulo, textAlign: "center" },
  presentacionBajada: {
    ...tipo.detalle, textAlign: "center", lineHeight: 20, maxWidth: 300,
  },

  contexto: {
    alignSelf: "center", ...tipo.detalle, backgroundColor: color.elemento,
    paddingHorizontal: espacio.m, paddingVertical: 6,
    borderRadius: radio.pastilla, overflow: "hidden",
  },
  burbuja: { maxWidth: "84%", paddingHorizontal: espacio.m, paddingVertical: 11, borderRadius: radio.burbuja },
  mia: { alignSelf: "flex-end", backgroundColor: color.marca, borderBottomRightRadius: 6 },
  suya: {
    alignSelf: "flex-start", backgroundColor: color.papel, borderBottomLeftRadius: 6,
    borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  burbujaTexto: { fontSize: 15.5, lineHeight: 23, color: color.texto },
  fallo: { ...tipo.detalle, color: color.vivo, textAlign: "center" },
  pensando: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingBottom: espacio.s,
  },
  compositor: {
    flexDirection: "row", alignItems: "flex-end", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingTop: espacio.s,
    backgroundColor: color.papel,
    borderTopWidth: FILETE, borderTopColor: color.bordeFuerte,
  },
  enviar: {
    borderRadius: radio.campo, paddingHorizontal: 18, height: 48, justifyContent: "center",
  },
  enviarTexto: { color: color.sobreMarca, fontWeight: "700", fontSize: 15 },
});
