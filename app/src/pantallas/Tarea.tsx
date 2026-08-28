import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Cargando, Error, Pantalla, Pastilla } from "../ui/componentes.tsx";
import { color, espacio, fechaYHora, radio, tipo } from "../ui/tema.ts";
import { entregarTarea, tareaPorId } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { cuandoVence, estadoDeTarea } from "../dominio/tareas.ts";
import { alTutor, type PropsPila } from "../lib/rutas.ts";

export default function Tarea({ route, navigation }: PropsPila<"Tarea">) {
  const { tareaId } = route.params;
  const [entregando, setEntregando] = useState(false);

  const traer = useCallback(() => tareaPorId(tareaId), [tareaId]);

  const { datos: tarea, cargando, error, recargar } = usarCarga(traer, [tareaId]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!tarea) return <Error mensaje="No encontré esa tarea." />;

  const estado = estadoDeTarea(tarea);
  const entregada = estado === "entregada";

  function entregar() {
    if (!tarea) return;
    Alert.alert("Entregar tarea", `¿Entregar «${tarea.titulo}»?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Entregar",
        onPress: async () => {
          setEntregando(true);
          try {
            await entregarTarea(tarea.id);
            recargar();
          } catch (err) {
            Alert.alert("No pude entregarla", err instanceof globalThis.Error ? err.message : "");
          } finally {
            setEntregando(false);
          }
        },
      },
    ]);
  }

  return (
    <Pantalla>
      <View style={e.cabecera}>
        <Text style={e.titulo}>{tarea.titulo}</Text>
        <View style={e.estado}>
          <Pastilla
            texto={entregada ? "ENTREGADA" : estado === "atrasada" ? "ATRASADA" : "PENDIENTE"}
            tono={entregada ? "ok" : estado === "atrasada" ? "atrasada" : "pendiente"} />
          <Text style={tipo.detalle}>{cuandoVence(tarea)}</Text>
        </View>
      </View>

      <View style={e.datos}>
        <Dato etiqueta="Entrega" valor={fechaYHora(tarea.vence_en)} />
        <Dato etiqueta="Puntos" valor={`${tarea.puntos}`} />
        {tarea.puntos_obtenidos !== null ? (
          <Dato etiqueta="Obtenido" valor={`${tarea.puntos_obtenidos} / ${tarea.puntos}`} />
        ) : null}
      </View>

      <Text style={e.enunciado}>{tarea.enunciado}</Text>

      {tarea.criterios.length > 0 ? (
        <View style={e.criterios}>
          <Text style={tipo.etiqueta}>Se evalúa</Text>
          {tarea.criterios.map((c, i) => (
            <View key={i} style={e.criterio}>
              <Text style={e.vinneta}>·</Text>
              <Text style={e.criterioTexto}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={e.acciones}>
        {!entregada ? (
          <Boton
            texto={entregando ? "Entregando…" : "Entregar tarea"}
            onPress={entregar}
            deshabilitado={entregando}
          />
        ) : null}
        <Pressable accessibilityRole="button" style={e.tutor}
          onPress={() => navigation.navigate(...alTutor(tarea.asignatura_id, `Estoy con «${tarea.titulo}».`))}>
          <Text style={e.tutorTexto}>Pedir guía al tutor</Text>
        </Pressable>
        <Text style={e.nota}>
          El tutor no la resuelve por ti: te ayuda a encontrar el camino.
        </Text>
      </View>
    </Pantalla>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={tipo.etiqueta}>{etiqueta}</Text>
      <Text style={e.datoValor}>{valor}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  cabecera: {
    padding: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  titulo: { fontSize: 19, fontWeight: "600", color: color.texto, lineHeight: 25 },
  estado: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: espacio.s },
  datos: {
    flexDirection: "row", gap: 10, padding: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  datoValor: { fontSize: 14, fontWeight: "600", color: color.texto, marginTop: 3 },
  enunciado: { ...tipo.cuerpo, color: color.texto, lineHeight: 22, padding: espacio.m },
  criterios: { paddingHorizontal: espacio.m, paddingBottom: espacio.m, gap: 6 },
  criterio: { flexDirection: "row", gap: 8 },
  vinneta: { color: color.textoSuave, fontSize: 14 },
  criterioTexto: { flex: 1, ...tipo.cuerpo, color: color.texto, lineHeight: 21 },
  acciones: { padding: espacio.m, gap: 9 },
  tutor: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton,
    paddingVertical: espacio.m, alignItems: "center",
  },
  tutorTexto: { fontSize: 15, fontWeight: "600", color: color.textoSuave },
  nota: { ...tipo.detalle, textAlign: "center", lineHeight: 19 },
});
