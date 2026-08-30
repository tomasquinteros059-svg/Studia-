import { useCallback, useState } from "react";
import {
  Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from "react-native";
import { Campo, Cargando, Error, Vacio } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  FILETE, color, colorDeRamo, espacio, fechaCorta, radio, tenue, tipo,
} from "../ui/tema.ts";
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
                        { borderTopColor: ramo ? colorDeRamo(ramo.id, ramo.color) : color.bordeFuerte },
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
                          <View style={[e.etiquetaRamo, {
                            backgroundColor: tenue(colorDeRamo(ramo.id, ramo.color)),
                          }]}>
                            <Text style={[e.etiquetaTexto, {
                              color: colorDeRamo(ramo.id, ramo.color),
                            }]} numberOfLines={1}>
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
              <View style={[e.puntoRamo, { backgroundColor: colorDeRamo(a.id, a.color) }]} />
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
  // El apunte es un papelito: fondo blanco y, arriba, la franja del ramo
  // al que pertenece. Es lo único que lleva color en el muro.
  tarjeta: {
    backgroundColor: color.papel,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderTopWidth: 4,
    borderRadius: radio.tarjeta, padding: espacio.m, gap: espacio.s,
  },
  tarjetaCabecera: { flexDirection: "row", alignItems: "flex-start", gap: espacio.s },
  tarjetaTitulo: { ...tipo.fila, flex: 1, lineHeight: 21 },
  tarjetaCuerpo: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21 },
  tarjetaVacia: { ...tipo.detalle, fontStyle: "italic" },
  tarjetaPie: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: espacio.s,
  },
  etiquetaRamo: {
    flexShrink: 1, borderRadius: radio.pastilla,
    paddingHorizontal: espacio.s, paddingVertical: 4,
  },
  etiquetaTexto: { fontSize: 11.5, fontWeight: "700" },
  flotante: {
    position: "absolute", right: espacio.l, bottom: espacio.l,
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    backgroundColor: color.marca, paddingHorizontal: espacio.l, paddingVertical: 15,
    borderRadius: radio.pastilla,
  },
  flotanteTexto: { color: color.sobreMarca, fontWeight: "700", fontSize: 15 },
  fondoModal: { flex: 1, backgroundColor: "rgba(25,26,31,0.4)" },
  hoja: {
    backgroundColor: color.papel,
    borderTopLeftRadius: radio.tarjeta, borderTopRightRadius: radio.tarjeta,
    paddingHorizontal: espacio.l, paddingBottom: espacio.xl,
  },
  asa: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: color.bordeFuerte,
    alignSelf: "center", marginVertical: espacio.m,
  },
  opcion: { flexDirection: "row", alignItems: "center", gap: espacio.m, paddingVertical: espacio.m },
  puntoRamo: { width: 10, height: 10, borderRadius: 5 },
  opcionTexto: { ...tipo.fila },
});
