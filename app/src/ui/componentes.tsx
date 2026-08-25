import type { ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { color, espacio, radio, tenue, tipo } from "./tema.ts";

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={e.titulo}>{children}</Text>;
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={e.etiqueta}>{children}</Text>;
}

export function Encabezado({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <View style={e.encabezado}>
      <Etiqueta>{texto}</Etiqueta>
      {accion}
    </View>
  );
}

export function Boton({
  texto, onPress, variante = "primario", deshabilitado,
}: {
  texto: string;
  onPress: () => void;
  variante?: "primario" | "suave";
  deshabilitado?: boolean;
}) {
  const suave = variante === "suave";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        e.boton,
        suave ? e.botonSuave : e.botonPrimario,
        (pressed || deshabilitado) && { opacity: 0.6 },
      ]}
    >
      <Text style={[e.botonTexto, suave && { color: color.textoSuave }]}>{texto}</Text>
    </Pressable>
  );
}

export function Campo(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor="#9AA0A6" {...props} style={[e.campo, props.style]} />;
}

export function Pastilla({ texto, tono }: { texto: string; tono: "pendiente" | "ok" | "atrasada" | "vivo" }) {
  const tonos = {
    pendiente: { bg: tenue(color.ambar), fg: color.ambar },
    ok: { bg: tenue(color.ok), fg: color.ok },
    atrasada: { bg: tenue(color.vivo), fg: color.vivo },
    vivo: { bg: tenue(color.vivo), fg: color.vivo },
  } as const;
  const t = tonos[tono];
  return (
    <View style={[e.pastilla, { backgroundColor: t.bg }]}>
      <Text style={[e.pastillaTexto, { color: t.fg }]}>{texto}</Text>
    </View>
  );
}

export function Fila({
  titulo, detalle, izquierda, derecha, onPress,
}: {
  titulo: string;
  detalle?: string;
  izquierda?: ReactNode;
  derecha?: ReactNode;
  onPress?: () => void;
}) {
  const contenido = (
    <View style={e.fila}>
      {izquierda}
      <View style={{ flex: 1 }}>
        <Text style={e.filaTitulo}>{titulo}</Text>
        {detalle ? <Text style={e.filaDetalle}>{detalle}</Text> : null}
      </View>
      {derecha}
    </View>
  );
  if (!onPress) return contenido;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => pressed && { backgroundColor: color.elemento }}>
      {contenido}
    </Pressable>
  );
}

export function Punto({ tono }: { tono: string }) {
  return <View style={[e.punto, { backgroundColor: tono }]} />;
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <View style={e.centro}>
      <ActivityIndicator color={color.marca} />
      <Text style={e.vacioTexto}>{texto}</Text>
    </View>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <View style={e.centro}>
      <Text style={e.vacioTexto}>{texto}</Text>
    </View>
  );
}

export function Error({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <View style={e.centro}>
      <Text style={[e.vacioTexto, { color: color.vivo }]}>{mensaje}</Text>
      {reintentar ? <Boton texto="Reintentar" variante="suave" onPress={reintentar} /> : null}
    </View>
  );
}

export function Pantalla({ children }: { children: ReactNode }) {
  return <ScrollView style={e.pantalla} contentContainerStyle={{ paddingBottom: espacio.xl }}>{children}</ScrollView>;
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  titulo: { ...tipo.titulo, color: color.texto },
  etiqueta: { ...tipo.etiqueta },
  encabezado: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.s,
  },
  boton: { borderRadius: radio.boton, paddingVertical: espacio.m, alignItems: "center" },
  botonPrimario: { backgroundColor: color.marca },
  botonSuave: { borderWidth: 1, borderColor: color.borde },
  botonTexto: { fontSize: 15, fontWeight: "600", color: color.sobreMarca },
  campo: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.campo,
    padding: 13, fontSize: 15, backgroundColor: "#F7F8FA", color: color.texto,
  },
  pastilla: { borderRadius: radio.pastilla, paddingHorizontal: 8, paddingVertical: 3 },
  pastillaTexto: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3 },
  fila: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingHorizontal: espacio.m, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  filaTitulo: { ...tipo.fila, color: color.texto, lineHeight: 19 },
  filaDetalle: { ...tipo.detalle, marginTop: 2 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  centro: { padding: espacio.xl, alignItems: "center", gap: espacio.m },
  vacioTexto: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 21 },
});
