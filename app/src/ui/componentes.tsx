import { useState, type ReactNode } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icono } from "./Icono.tsx";
import { usarDisposicion } from "../lib/pantalla.ts";
import { CUADRICULA, FILETE, color, espacio, radio, sombra, tenue, tipo } from "./tema.ts";
import { comoSeVeLaCopia } from "../dominio/planes.ts";

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

/**
 * Una tarjeta de papel sobre el fondo. Es la unidad con que se compone todo:
 * cada bloque de una pantalla es una hoja, y adentro van filas.
 */
export function Hoja({
  children, ceñida, style,
}: {
  children: ReactNode;
  /** Sin relleno interior, para hojas que solo llevan filas. */
  ceñida?: boolean;
  style?: object;
}) {
  return <View style={[e.hoja, ceñida ? null : e.hojaConAire, style]}>{children}</View>;
}

/**
 * La baldosa de un ramo: su color a plena fuerza con las iniciales encima.
 * Es lo que hace que una cuadrícula de seis ramos se lea de un vistazo.
 */
export function Baldosa({
  tono, texto, tamano = 46,
}: {
  tono: string;
  texto: string;
  tamano?: number;
}) {
  return (
    <View style={[
      e.baldosa,
      { backgroundColor: tono, width: tamano, height: tamano, borderRadius: tamano * 0.3 },
    ]}>
      <Text style={[e.baldosaTexto, { fontSize: tamano * 0.36 }]}>{texto}</Text>
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
        pressed && !deshabilitado && (suave ? e.botonSuavePresionado : e.botonPresionado),
        deshabilitado && { opacity: 0.4 },
      ]}
    >
      <Text style={[e.botonTexto, suave && { color: color.texto }]}>{texto}</Text>
    </Pressable>
  );
}

export function Campo(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={color.textoTenue} {...props} style={[e.campo, props.style]} />;
}

export function Pastilla({ texto, tono }: { texto: string; tono: "pendiente" | "ok" | "atrasada" | "vivo" }) {
  const tonos = {
    pendiente: color.ambar, ok: color.ok, atrasada: color.vivo, vivo: color.vivo,
  } as const;
  const t = tonos[tono];
  return (
    <View style={[e.pastilla, { backgroundColor: tenue(t), borderColor: t }]}>
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
      style={({ pressed }) => pressed && { opacity: 0.6 }}>
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

/**
 * La cinta que avisa que lo que se ve es una copia guardada.
 *
 * Va en la pantalla y no en un ajuste escondido: mostrar datos de otro día
 * como si fueran de ahora es dejar que alguien decida con información vieja
 * sin darle la oportunidad de notarlo. Devuelve nada cuando los datos vienen
 * de la red, que es lo normal.
 */
export function Copia({ de }: { de: number | null }) {
  if (de === null) return null;
  return (
    <View style={e.copia} accessibilityRole="alert">
      <Icono nombre="aviso" tamano={15} tono={color.textoSuave} />
      <Text style={e.copiaTexto}>{comoSeVeLaCopia(de, Date.now())}</Text>
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


/**
 * La cuadrícula del papel, dibujada con rayas y no con una imagen.
 *
 * Se ve nítida en cualquier pantalla y no hay archivo que cargar. Va detrás
 * de todo y no captura toques: es fondo, no interfaz. Y es apenas visible a
 * propósito —si se nota, compite con lo que está escrito encima, que es lo
 * que la persona vino a leer.
 */
export function Cuadricula({ ancho, alto }: { ancho: number; alto: number }) {
  const columnas = Math.ceil(ancho / CUADRICULA);
  const filas = Math.ceil(alto / CUADRICULA);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      {Array.from({ length: columnas }, (_, i) => (
        <View key={`v${i}`} style={[e.raya, { left: i * CUADRICULA, top: 0, bottom: 0, width: 1 }]} />
      ))}
      {Array.from({ length: filas }, (_, i) => (
        <View key={`h${i}`} style={[e.raya, { top: i * CUADRICULA, left: 0, right: 0, height: 1 }]} />
      ))}
    </View>
  );
}

export function Pantalla({
  children, alRefrescar, refrescando, sinLimite,
}: {
  children: ReactNode;
  alRefrescar?: () => void;
  refrescando?: boolean;
  /** Para pantallas que administran su propio ancho, como el tablero. */
  sinLimite?: boolean;
}) {
  const { anchoContenido, ancho } = usarDisposicion();
  // Android dibuja de borde a borde: sin esto, lo último de la pantalla queda
  // debajo de la barra de gestos del sistema y no se puede tocar.
  const margenes = useSafeAreaInsets();
  const [alto, setAlto] = useState(0);

  return (
    <View style={e.papelDeFondo} onLayout={(ev) => setAlto(ev.nativeEvent.layout.height)}>
    <Cuadricula ancho={ancho} alto={alto} />
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
    </View>
  );
}

/**
 * Un modal a pantalla completa que respeta las barras del sistema.
 *
 * Hace falta porque un `Modal` de React Native se dibuja fuera de la
 * jerarquía normal y no hereda nada de lo que hace la navegación: sin esto
 * su barra de arriba queda debajo del reloj, y el botón del final debajo de
 * la barra de gestos.
 */
export function HojaModal({
  abierto, cerrar, titulo, children, derecha,
}: {
  abierto: boolean;
  cerrar: () => void;
  titulo: string;
  children: ReactNode;
  derecha?: ReactNode;
}) {
  const margenes = useSafeAreaInsets();

  return (
    <Modal visible={abierto} animationType="slide" onRequestClose={cerrar} statusBarTranslucent>
      <View testID="modal" style={[e.modalFondo, { paddingTop: margenes.top }]}>
        <View style={e.modalBarra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={cerrar} hitSlop={12}>
            <Icono nombre="cerrar" tamano={23} tono={color.texto} />
          </Pressable>
          <Text style={e.modalTitulo}>{titulo}</Text>
          <View style={{ minWidth: 23, alignItems: "flex-end" }}>{derecha}</View>
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
  // Transparente: el fondo lo pinta el envoltorio, que es el que lleva la
  // cuadrícula. Si lo pintara la lista, la taparía entera.
  papelDeFondo: { flex: 1, backgroundColor: color.fondo },
  pantalla: { flex: 1, backgroundColor: "transparent" },
  raya: { position: "absolute", backgroundColor: color.borde, opacity: 0.55 },
  titulo: { ...tipo.titulo },
  etiqueta: { ...tipo.etiqueta },
  encabezado: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.s,
  },

  hoja: {
    backgroundColor: color.papel,
    borderRadius: radio.tarjeta,
    borderWidth: FILETE,
    borderColor: color.bordeFuerte,
    marginHorizontal: espacio.m,
    overflow: "hidden",
    boxShadow: sombra(3),
  },
  hojaConAire: { padding: espacio.m, gap: espacio.s },

  baldosa: { alignItems: "center", justifyContent: "center" },
  baldosaTexto: {
    color: "#FFFFFF", fontWeight: "800", letterSpacing: -0.5,
    // El color de ramo es fuerte; el texto encima necesita algo de sombra
    // para no vibrar sobre los tonos más claros de la paleta.
    textShadowColor: "rgba(0,0,0,0.18)", textShadowRadius: 2,
  },

  // La sombra corrida y el hundido al apretar: el botón se comporta como una
  // tecla, que es lo que hace que se vea tocable sin decirlo con palabras.
  boton: {
    borderRadius: radio.boton, paddingVertical: 14, paddingHorizontal: espacio.m,
    alignItems: "center", justifyContent: "center",
    borderWidth: FILETE, borderColor: color.bordeFuerte,
    boxShadow: sombra(3),
  },
  botonPrimario: { backgroundColor: color.marca },
  botonPresionado: {
    backgroundColor: color.marcaOscura,
    transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: sombra(0),
  },
  botonSuave: { backgroundColor: color.papel },
  botonSuavePresionado: {
    backgroundColor: color.elemento,
    transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: sombra(0),
  },
  botonTexto: { fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2, color: color.sobreMarca },

  campo: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.campo,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, backgroundColor: color.papel, color: color.texto,
  },

  pastilla: {
    borderRadius: radio.pastilla, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1.5,
  },
  pastillaTexto: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },

  // Las filas son papel sobre el fondo, y el filete va arriba: así la
  // primera marca dónde empieza la lista y la última no deja una raya
  // suelta contra el fondo.
  fila: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 15,
    backgroundColor: color.papel,
    borderTopWidth: 1, borderTopColor: color.borde,
  },
  filaTitulo: { ...tipo.fila, lineHeight: 21 },
  filaDetalle: { ...tipo.detalle, marginTop: 2 },

  punto: { width: 9, height: 9, borderRadius: 5 },

  centro: { flex: 1, padding: espacio.xl, alignItems: "center", justifyContent: "center", gap: espacio.m },
  vacioTexto: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 22 },

  copia: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: color.elemento,
    paddingHorizontal: espacio.m, paddingVertical: 9,
  },
  copiaTexto: { ...tipo.detalle, color: color.textoSuave, flex: 1 },

  modalFondo: { flex: 1, backgroundColor: color.fondo },
  modalBarra: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingVertical: 14,
    backgroundColor: color.papel,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  modalTitulo: { ...tipo.subtitulo },
  // En una tablet, un campo de texto de treinta centímetros de ancho es
  // incómodo de llenar y no se ve como un formulario: se ve como un error.
  // La columna se limita igual que en el resto de las pantallas.
  modalHoja: {
    padding: espacio.l, gap: espacio.m,
    width: "100%", maxWidth: 620, alignSelf: "center",
  },
});
