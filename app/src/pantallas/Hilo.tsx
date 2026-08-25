import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Campo, Cargando, Error, Pantalla, Vacio } from "../ui/componentes.tsx";
import { color, espacio, radio, tipo } from "../ui/tema.ts";
import { hiloPorId, responderHilo, respuestasDe } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Hilo">;

export default function Hilo({ route }: Props) {
  const { hiloId } = route.params;
  const traer = useCallback(async () => {
    const [hilo, respuestas] = await Promise.all([hiloPorId(hiloId), respuestasDe(hiloId)]);
    return { hilo, respuestas };
  }, [hiloId]);
  const { datos, cargando, error, recargar } = usarCarga(traer, [hiloId]);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function responder() {
    const texto = borrador.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    setFallo(null);
    try {
      await responderHilo(hiloId, texto);
      setBorrador("");
      recargar();
    } catch (e) {
      setFallo(e instanceof globalThis.Error ? e.message : "No pude publicar tu respuesta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Pantalla>
        {cargando ? <Cargando /> : null}
        {error ? <Error mensaje={error} reintentar={recargar} /> : null}
        {datos?.hilo ? (
          <View style={[e.mensaje, e.original]}>
            <Text style={e.tituloHilo}>{datos.hilo.titulo}</Text>
            <View style={e.autor}>
              <View style={[e.avatar, datos.hilo.autor_rol !== "Estudiante" && { backgroundColor: color.marca }]}>
                <Text style={[e.iniciales, datos.hilo.autor_rol !== "Estudiante" && { color: color.sobreMarca }]}>
                  {iniciales(datos.hilo.autor_nombre)}
                </Text>
              </View>
              <View>
                <Text style={e.nombre}>{datos.hilo.autor_nombre}</Text>
                <Text style={tipo.detalle}>{datos.hilo.autor_rol}</Text>
              </View>
            </View>
            <Text style={e.cuerpo}>{datos.hilo.cuerpo}</Text>
          </View>
        ) : null}

        {!cargando && !error && (datos?.respuestas ?? []).length === 0
          ? <Vacio texto="Nadie ha respondido todavía. Parte tú." />
          : null}
        {(datos?.respuestas ?? []).map((r) => {
          const docente = r.autor_rol !== "Estudiante";
          return (
            <View key={r.id} style={e.mensaje}>
              <View style={e.autor}>
                <View style={[e.avatar, docente && { backgroundColor: color.marca }]}>
                  <Text style={[e.iniciales, docente && { color: color.sobreMarca }]}>
                    {iniciales(r.autor_nombre)}
                  </Text>
                </View>
                <View>
                  <Text style={e.nombre}>{r.autor_nombre}</Text>
                  <Text style={tipo.detalle}>{r.autor_rol}</Text>
                </View>
              </View>
              <Text style={e.cuerpo}>{r.cuerpo}</Text>
            </View>
          );
        })}
        {fallo ? <Text style={[tipo.detalle, { color: color.vivo, textAlign: "center" }]}>{fallo}</Text> : null}
      </Pantalla>

      <View style={e.compositor}>
        <Campo style={{ flex: 1 }} placeholder="Responder al hilo…" accessibilityLabel="Tu respuesta"
          value={borrador} onChangeText={setBorrador} multiline />
        <Pressable accessibilityRole="button" onPress={responder} disabled={enviando || !borrador.trim()}
          style={({ pressed }) => [e.enviar, (pressed || enviando || !borrador.trim()) && { opacity: 0.5 }]}>
          <Text style={e.enviarTexto}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.replace(/\./g, "").split(" ").filter(Boolean);
  return `${partes[0]?.[0] ?? ""}${partes[1]?.[0] ?? ""}`.toUpperCase();
}

const e = StyleSheet.create({
  original: { backgroundColor: color.elemento },
  tituloHilo: { fontSize: 16, fontWeight: "600", color: color.texto, lineHeight: 21, marginBottom: 9 },
  mensaje: {
    padding: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  autor: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: color.elemento,
    alignItems: "center", justifyContent: "center",
  },
  iniciales: { fontSize: 11, fontWeight: "700", color: color.textoSuave },
  nombre: { fontSize: 13, fontWeight: "600", color: color.texto },
  cuerpo: { ...tipo.cuerpo, color: color.texto, lineHeight: 21, marginTop: 8 },
  compositor: {
    flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.borde,
    backgroundColor: color.fondo,
  },
  enviar: {
    backgroundColor: color.marca, borderRadius: radio.campo,
    paddingHorizontal: 15, height: 44, justifyContent: "center",
  },
  enviarTexto: { color: color.sobreMarca, fontWeight: "600", fontSize: 14 },
});
