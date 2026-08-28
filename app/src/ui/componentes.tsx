import type { ReactNode } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icono } from "./Icono.tsx";
import { usarDisposicion } from "../lib/pantalla.ts";
import { FILETE, color, espacio, radio, tenue, tipo } from "./tema.ts";

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={e.titulo}>{children}</Text>;
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={tipo.etiqueta}>{children}</Text>;
}

export function Encabezado({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <View style={e.encabezado}>
      <Etiqueta>{texto}</Etiqueta>
      {accion}
    </View>
  );
}

/**
 * Una hoja: fondo de papel sobre el fondo de la pantalla, con filete.
 *
 * Es la unidad de composición de toda la aplicación. Un acta se lee por
 * bloques —quiénes, qué se acordó, qué falta— y cada bloque es una hoja.
 * Sin sombras: un documento no flota, está apoyado.
 */
export function Hoja({
  children, ceñida, style,
}: {
  children: ReactNode;
  /** Sin relleno interior, para hojas que solo contienen filas. */
  ceñida?: boolean;
  style?: object;
}) {
  return (
    <View style={[e.hoja, ceñida ? null : e.hojaConAire, style]}>{children}</View>
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
        pressed && !deshabilitado && (suave ? e.botonSuavePresionado : e.botonPresionado),
        deshabilitado && { opacity: 0.42 },
      ]}
    >
      <Text style={[e.botonTexto, suave && { color: color.marca }]}>{texto}</Text>
    </Pressable>
  );
}

export function Campo(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={color.textoTenue} {...props} style={[e.campo, props.style]} />;
}

export function Pastilla({ texto, tono }: { texto: string; tono: "pendiente" | "ok" | "atrasada" | "vivo" }) {
  const tonos = {
    pendiente: color.ambar,
    ok: color.ok,
    atrasada: color.vivo,
    vivo: color.vivo,
  } as const;
  const t = tonos[tono];
  return (
    <View style={[e.pastilla, { backgroundColor: tenue(t) }]}>
      <Text style={[e.pastillaTexto, { color: t }]}>{texto}</Text>
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
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={tipo.fila}>{titulo}</Text>
        {detalle ? <Text style={tipo.detalle}>{detalle}</Text> : null}
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

export function Pantalla({
  children, alRefrescar, refrescando, sinLimite,
}: {
  children: ReactNode;
  alRefrescar?: () => void;
  refrescando?: boolean;
  /** Para pantallas que administran su propio ancho. */
  sinLimite?: boolean;
}) {
  const { anchoContenido } = usarDisposicion();
  // Android dibuja de borde a borde: sin esto, lo último de la pantalla queda
  // debajo de la barra de gestos del sistema y no se puede tocar.
  const margenes = useSafeAreaInsets();

  return (
    <ScrollView
      testID="pantalla"
      style={e.pantalla}
      contentContainerStyle={[
        { paddingBottom: espacio.xl + margenes.bottom },
        // En una tablet, un texto que cruza toda la pantalla es incómodo de
        // leer: la columna se limita y se centra. En un teléfono no cambia nada.
        !sinLimite && { width: "100%", maxWidth: anchoContenido, alignSelf: "center" },
      ]}
      refreshControl={
        alRefrescar
          ? <RefreshControl refreshing={refrescando ?? false} onRefresh={alRefrescar} tintColor={color.marca} />
          : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/**
 * Un modal a pantalla completa, con los márgenes del sistema respetados.
 *
 * Existe porque un `Modal` de React Native se dibuja fuera de la jerarquía
 * normal y no hereda nada de lo que hace la navegación: sin esto, la barra de
 * arriba queda bajo el reloj y el botón de abajo bajo la barra de gestos.
 * Era exactamente el error que impedía escribir en la pantalla del tutor.
 */
export function HojaModal({
  abierto, cerrar, titulo, children, derecha,
}: {
  abierto: boolean;
  cerrar: () => void;
  titulo: string;
  children: ReactNode;
  /** Algo a la derecha de la barra, si hace falta. */
  derecha?: ReactNode;
}) {
  const margenes = useSafeAreaInsets();

  return (
    <Modal visible={abierto} animationType="slide" onRequestClose={cerrar}
      statusBarTranslucent presentationStyle="overFullScreen" transparent={false}>
      <View testID="modal" style={[e.modalFondo, { paddingTop: margenes.top }]}>
        <View style={e.modalBarra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={cerrar} hitSlop={12}>
            <Icono nombre="cerrar" tamano={22} tono={color.marca} />
          </Pressable>
          <Text style={e.modalTitulo}>{titulo}</Text>
          <View style={{ minWidth: 22, alignItems: "flex-end" }}>{derecha}</View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={margenes.top}>
          <ScrollView
            testID="modal-hoja"
            contentContainerStyle={[e.modalHoja, { paddingBottom: espacio.xl + margenes.bottom }]}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  titulo: { ...tipo.titulo },

  encabezado: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.s,
  },

  hoja: {
    backgroundColor: color.papel,
    borderRadius: radio.tarjeta,
    borderWidth: FILETE,
    borderColor: color.borde,
    marginHorizontal: espacio.m,
    overflow: "hidden",
  },
  hojaConAire: { padding: espacio.m, gap: espacio.s },

  boton: {
    borderRadius: radio.boton, paddingVertical: 14, paddingHorizontal: espacio.m,
    alignItems: "center", justifyContent: "center",
  },
  botonPrimario: { backgroundColor: color.marca },
  botonPresionado: { backgroundColor: color.marcaOscura },
  botonSuave: { borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel },
  botonSuavePresionado: { backgroundColor: color.elemento },
  botonTexto: { fontSize: 15, fontWeight: "700", letterSpacing: -0.1, color: color.sobreMarca },

  campo: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.campo,
    paddingHorizontal: 13, paddingVertical: 12,
    fontSize: 15.5, backgroundColor: color.papel, color: color.texto,
  },

  pastilla: { borderRadius: radio.pastilla, paddingHorizontal: 9, paddingVertical: 3 },
  pastillaTexto: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },

  fila: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 13,
  },

  punto: { width: 8, height: 8, borderRadius: 4 },

  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: espacio.xl, gap: espacio.m },
  vacioTexto: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 21 },

  modalFondo: { flex: 1, backgroundColor: color.fondo },
  modalBarra: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingVertical: 13,
    backgroundColor: color.papel,
    borderBottomWidth: FILETE, borderBottomColor: color.borde,
  },
  modalTitulo: { ...tipo.subtitulo },
  modalHoja: { padding: espacio.l, gap: espacio.m },
});
