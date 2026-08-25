import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync,
} from "expo-audio";
import { Icono } from "../ui/Icono.tsx";
import { color, espacio, radio } from "../ui/tema.ts";
import {
  accionAlTocarMicrofono, AVISO_BLOQUEADO, AVISO_DENEGADO, estadoDesdePermiso,
  etiquetaMicrofono, type EstadoMicrofono,
} from "../dominio/microfono.ts";
import type { PropsPila } from "../lib/rutas.ts";

/** El ecualizador indica quién habla. Es decorativo: no analiza el audio. */
function Barra({ retraso, alto }: { retraso: number; alto: number }) {
  const escala = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(escala, { toValue: 1, duration: 500, delay: retraso, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(escala, { toValue: 0.35, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [escala, retraso]);

  return <Animated.View style={[e.barra, { height: alto, transform: [{ scaleY: escala }] }]} />;
}

export default function ClaseEnVivo({ route, navigation }: PropsPila<"ClaseEnVivo">) {
  const { titulo, asignatura, codigo, profesor, desdeSegundos } = route.params;

  const [segundos, setSegundos] = useState(desdeSegundos ?? 0);
  const [microAbierto, setMicroAbierto] = useState(false);   // se entra en silencio, siempre
  const [manoArriba, setManoArriba] = useState(false);
  const [permiso, setPermiso] = useState<EstadoMicrofono>("sin_preguntar");

  useEffect(() => {
    const reloj = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, []);

  // Escuchar la clase no necesita permiso; hablar sí. Al entrar solo se
  // consulta el estado, sin abrir ningún diálogo.
  useEffect(() => {
    let vigente = true;
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" });
    getRecordingPermissionsAsync()
      .then((p) => { if (vigente) setPermiso(estadoDesdePermiso(p)); })
      .catch(() => {});
    return () => { vigente = false; };
  }, []);

  // Al salir, se devuelve el audio a su estado normal.
  useEffect(() => () => {
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, []);

  const alternarMicrofono = useCallback(async () => {
    if (microAbierto) {
      setMicroAbierto(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      return;
    }

    const accion = accionAlTocarMicrofono(permiso);

    if (accion === "ir_a_ajustes") {
      Alert.alert("Micrófono bloqueado", AVISO_BLOQUEADO, [
        { text: "Ahora no", style: "cancel" },
        { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
      ]);
      return;
    }

    if (accion === "pedir") {
      const respuesta = await requestRecordingPermissionsAsync().catch(() => null);
      const nuevo = respuesta ? estadoDesdePermiso(respuesta) : "denegado";
      setPermiso(nuevo);
      if (nuevo !== "concedido") {
        Alert.alert("Sin micrófono", nuevo === "bloqueado" ? AVISO_BLOQUEADO : AVISO_DENEGADO);
        return;
      }
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
    setMicroAbierto(true);
  }, [microAbierto, permiso]);

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <View style={e.pantalla}>
      <View style={e.superior}>
        <Pressable accessibilityRole="button" accessibilityLabel="Salir sin colgar"
          onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={e.chevron}>⌄</Text>
        </Pressable>
        <Text style={e.tituloBarra}>Clase en vivo</Text>
        <View style={e.insignia}>
          <View style={e.puntoVivo} />
          <Text style={e.insigniaTexto}>EN VIVO</Text>
        </View>
      </View>

      <View style={e.centro}>
        <Text style={e.ramo}>{asignatura} · {codigo}</Text>
        <Text style={e.tema}>{titulo}</Text>
        <Text style={e.reloj}>{mm}:{ss}</Text>

        <View style={e.ecualizador} accessible={false}>
          {[18, 34, 50, 30, 42, 22, 36].map((alto, i) => (
            <Barra key={i} alto={alto} retraso={i * 120} />
          ))}
        </View>

        <Text style={e.habla}>Habla <Text style={{ fontWeight: "600" }}>{profesor}</Text></Text>

        <View style={e.avisoConexion}>
          <Text style={e.avisoTexto}>
            El audio en vivo todavía no está conectado. El micrófono y sus
            permisos ya funcionan; falta el transporte que lleve tu voz a la sala.
          </Text>
        </View>

        <Text style={e.mano}>
          {manoArriba ? "Pediste la palabra. El profesor te dará el turno." : " "}
        </Text>
      </View>

      <View style={e.controles}>
        <Control
          etiqueta={etiquetaMicrofono(permiso, microAbierto)}
          icono={microAbierto ? "micro" : "microApagado"}
          activo={!microAbierto}
          accesible={microAbierto ? "Silenciar micrófono" : "Activar micrófono"}
          presionado={microAbierto}
          onPress={() => void alternarMicrofono()}
        />
        <Control
          etiqueta="Pedir palabra"
          icono="mano"
          resaltado={manoArriba}
          accesible="Pedir la palabra"
          presionado={manoArriba}
          onPress={() => setManoArriba((m) => !m)}
        />
        <Control
          etiqueta="Salir"
          icono="colgar"
          peligro
          accesible="Salir de la clase"
          onPress={() => navigation.goBack()}
        />
      </View>
    </View>
  );
}

function Control({
  etiqueta, icono, onPress, activo, resaltado, peligro, accesible, presionado,
}: {
  etiqueta: string;
  icono: "micro" | "microApagado" | "mano" | "colgar";
  onPress: () => void;
  activo?: boolean;
  resaltado?: boolean;
  peligro?: boolean;
  accesible: string;
  presionado?: boolean;
}) {
  return (
    <View style={e.control}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accesible}
        accessibilityState={presionado === undefined ? undefined : { selected: presionado }}
        onPress={onPress}
        style={({ pressed }) => [
          e.boton,
          activo && e.botonClaro,
          resaltado && e.botonResaltado,
          peligro && e.botonPeligro,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Icono nombre={icono} tamano={22}
          tono={activo || resaltado ? color.nocturno : "#fff"} />
      </Pressable>
      <Text style={e.controlTexto}>{etiqueta}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.nocturno },
  superior: { flexDirection: "row", alignItems: "center", padding: espacio.m, gap: espacio.s },
  chevron: { color: "#fff", fontSize: 26, lineHeight: 26 },
  tituloBarra: { flex: 1, textAlign: "center", color: "#fff", fontSize: 13, fontWeight: "600", opacity: 0.9 },
  insignia: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(217,59,59,0.2)", paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radio.pastilla,
  },
  puntoVivo: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF8A8A" },
  insigniaTexto: { color: "#FF8A8A", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: espacio.xl, gap: 12 },
  ramo: { color: "#fff", opacity: 0.6, fontSize: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
  tema: { color: "#fff", fontSize: 21, fontWeight: "600", textAlign: "center", lineHeight: 27 },
  reloj: { color: "#fff", opacity: 0.55, fontSize: 13, fontVariant: ["tabular-nums"] },
  ecualizador: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 52, marginVertical: 4 },
  barra: { width: 6, borderRadius: 3, backgroundColor: color.marca },
  habla: { color: "#fff", opacity: 0.85, fontSize: 13.5 },
  avisoConexion: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radio.tarjeta,
    padding: 12, marginTop: espacio.s,
  },
  avisoTexto: { color: "#fff", opacity: 0.75, fontSize: 12.5, lineHeight: 19, textAlign: "center" },
  mano: { color: "#FFD08A", fontSize: 12.5, minHeight: 18, textAlign: "center" },
  controles: { flexDirection: "row", justifyContent: "center", gap: 22, paddingBottom: espacio.xl, paddingTop: espacio.m },
  control: { alignItems: "center", gap: 6 },
  boton: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  botonClaro: { backgroundColor: "#fff" },
  botonResaltado: { backgroundColor: "#FFD08A" },
  botonPeligro: { backgroundColor: color.vivo },
  controlTexto: { color: "#fff", opacity: 0.75, fontSize: 10.5 },
});
