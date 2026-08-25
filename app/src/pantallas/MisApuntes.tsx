import { useCallback, useState } from "react";
import {
  Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from "react-native";
import { Campo, Cargando, Error, Vacio } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { color, espacio, fechaCorta, radio, tenue, tipo } from "../ui/tema.ts";
import { crearApunte, fijarApunte, misApuntes, misAsignaturas } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { filtrarApuntes, ordenarTablero, vistaPrevia } from "../dominio/tablero.ts";
import { columnasDelTablero } from "../dominio/tablero.ts";
import type { PropsPestana } from "../lib/rutas.ts";
import type { Apunte, Asignatura } from "../lib/tipos.ts";

export default function MisApuntes({ navigation }: PropsPestana<"Apuntes">) {
  const { width } = useWindowDimensions();
  const columnas = columnasDelTablero(width);

  const traer = useCallback(async () => {
    const [apuntes, asignaturas] = await Promise.all([misApuntes(), misAsignaturas()]);
    return { apuntes, asignaturas };
  }, []);
  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  const [busqueda, setBusqueda] = useState("");
  const [eligiendoRamo, setEligiendoRamo] = useState(false);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const porId = new Map(datos.asignaturas.map((a) => [a.id, a]));
  const visibles = ordenarTablero(filtrarApuntes(datos.apuntes, busqueda));

  async function nuevo(ramo: Asignatura) {
    setEligiendoRamo(false);
    try {
      const creado = await crearApunte(
        ramo.id,
        `Apuntes · ${new Date().toLocaleDateString("es-CL")}`,
      );
      navigation.navigate("Apunte", { apunteId: creado.id });
    } catch (e) {
      Alert.alert("No pude crear el apunte", e instanceof globalThis.Error ? e.message : "");
    }
  }

  async function alternarFijado(a: Apunte) {
    try {
      await fijarApunte(a.id, !a.fijado);
      refrescar();
    } catch {
      Alert.alert("No pude fijarlo", "Inténtalo de nuevo.");
    }
  }

  // El tablero se arma por columnas para que las tarjetas de distinto alto
  // encajen sin dejar huecos, como en un muro de notas.
  const columnasDeApuntes: Apunte[][] = Array.from({ length: columnas }, () => []);
  visibles.forEach((a, i) => columnasDeApuntes[i % columnas]!.push(a));

  return (
    <View style={e.pantalla}>
      <View style={e.buscador}>
        <Campo
          style={{ flex: 1 }}
          placeholder="Buscar en tus apuntes…"
          accessibilityLabel="Buscar en tus apuntes"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
        />
        {busqueda ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda"
            onPress={() => setBusqueda("")} hitSlop={10} style={e.limpiar}>
            <Text style={e.limpiarTexto}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={e.muro}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={color.marca} />
        }
      >
        {visibles.length === 0 ? (
          <Vacio texto={busqueda
            ? "Ningún apunte coincide con esa búsqueda."
            : "Todavía no tienes apuntes. Toca el botón para escribir el primero."} />
        ) : (
          <View style={e.columnas}>
            {columnasDeApuntes.map((columna, i) => (
              <View key={i} style={e.columna}>
                {columna.map((a) => {
                  const ramo = porId.get(a.asignatura_id);
                  return (
                    <Pressable
                      key={a.id}
                      accessibilityRole="button"
                      onPress={() => navigation.navigate("Apunte", { apunteId: a.id })}
                      style={({ pressed }) => [
                        e.tarjeta,
                        { borderTopColor: ramo?.color ?? color.marca },
                        pressed && { backgroundColor: color.elemento },
                      ]}
                    >
                      <View style={e.tarjetaCabecera}>
                        <Text style={e.tarjetaTitulo} numberOfLines={2}>{a.titulo}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={a.fijado ? "Dejar de fijar" : "Fijar apunte"}
                          accessibilityState={{ selected: a.fijado }}
                          onPress={() => void alternarFijado(a)}
                          hitSlop={10}
                        >
                          <Icono nombre="fijado" tamano={16}
                            tono={a.fijado ? color.ambar : color.borde} />
                        </Pressable>
                      </View>

                      {a.contenido.trim() ? (
                        <Text style={e.tarjetaCuerpo}>{vistaPrevia(a.contenido)}</Text>
                      ) : (
                        <Text style={e.tarjetaVacia}>Sin escribir todavía</Text>
                      )}

                      <View style={e.tarjetaPie}>
                        {ramo ? (
                          <View style={[e.etiquetaRamo, { backgroundColor: tenue(ramo.color) }]}>
                            <Text style={[e.etiquetaTexto, { color: ramo.color }]} numberOfLines={1}>
                              {ramo.nombre}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={tipo.detalle}>{fechaCorta(a.actualizado_en)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Nuevo apunte"
        style={e.flotante} onPress={() => setEligiendoRamo(true)}>
        <Icono nombre="nuevo" tamano={22} tono={color.sobreMarca} />
        <Text style={e.flotanteTexto}>Nuevo apunte</Text>
      </Pressable>

      <Modal visible={eligiendoRamo} transparent animationType="slide"
        onRequestClose={() => setEligiendoRamo(false)}>
        <Pressable style={e.fondoModal} onPress={() => setEligiendoRamo(false)}
          accessibilityLabel="Cerrar" />
        <View style={e.hoja}>
          <View style={e.asa} />
          <Text style={tipo.etiqueta}>Apuntar en</Text>
          {datos.asignaturas.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" onPress={() => void nuevo(a)}
              style={({ pressed }) => [e.opcion, pressed && { backgroundColor: color.elemento }]}>
              <View style={[e.puntoRamo, { backgroundColor: a.color }]} />
              <Text style={e.opcionTexto}>{a.nombre}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  buscador: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: espacio.m, paddingVertical: espacio.s,
  },
  limpiar: { padding: 6 },
  limpiarTexto: { color: color.textoSuave, fontSize: 15 },
  muro: { padding: espacio.s, paddingBottom: 100 },
  columnas: { flexDirection: "row", gap: espacio.s },
  columna: { flex: 1, gap: espacio.s },
  tarjeta: {
    borderWidth: 1, borderColor: color.borde, borderTopWidth: 3,
    borderRadius: radio.tarjeta, padding: 12, gap: 7,
  },
  tarjetaCabecera: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tarjetaTitulo: { flex: 1, fontSize: 14.5, fontWeight: "600", color: color.texto, lineHeight: 19 },
  tarjetaCuerpo: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 20 },
  tarjetaVacia: { ...tipo.detalle, fontStyle: "italic" },
  tarjetaPie: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  etiquetaRamo: {
    flexShrink: 1, borderRadius: radio.pastilla, paddingHorizontal: 8, paddingVertical: 3,
  },
  etiquetaTexto: { fontSize: 10.5, fontWeight: "700" },
  flotante: {
    position: "absolute", right: espacio.l, bottom: espacio.l,
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: color.marca, paddingHorizontal: 16, paddingVertical: 13,
    borderRadius: radio.pastilla,
  },
  flotanteTexto: { color: color.sobreMarca, fontWeight: "600", fontSize: 14 },
  fondoModal: { flex: 1, backgroundColor: "rgba(14,23,38,0.45)" },
  hoja: {
    backgroundColor: color.fondo, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: espacio.l, paddingBottom: espacio.xl,
  },
  asa: { width: 38, height: 4, borderRadius: 2, backgroundColor: color.borde, alignSelf: "center", marginVertical: 9 },
  opcion: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 },
  puntoRamo: { width: 10, height: 10, borderRadius: 5 },
  opcionTexto: { fontSize: 14.5, fontWeight: "600", color: color.texto },
});
