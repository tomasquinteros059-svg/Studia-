import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Error, Fila, Pantalla, Pastilla, Punto, Vacio } from "../ui/componentes.tsx";
import { color, espacio, fechaYHora, radio, tipo } from "../ui/tema.ts";
import { entregarTarea, misAsignaturas, misTareas } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { cuandoVence, estadoDeTarea, ordenarTareas } from "../dominio/tareas.ts";
import { alTutor, type PropsPestana } from "../lib/rutas.ts";

type Props = PropsPestana<"Tareas">;
const FILTROS = [
  { id: "pendientes", texto: "Pendientes" },
  { id: "entregadas", texto: "Entregadas" },
  { id: "todas", texto: "Todas" },
] as const;

export default function Tareas({ navigation }: Props) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("pendientes");

  const traer = useCallback(async () => {
    const [tareas, asignaturas] = await Promise.all([misTareas(), misAsignaturas()]);
    return { tareas, porId: new Map(asignaturas.map((a) => [a.id, a])) };
  }, []);
  const { datos, cargando, error, recargar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const lista = ordenarTareas(datos.tareas).filter((t) => {
    const estado = estadoDeTarea(t);
    if (filtro === "pendientes") return estado !== "entregada";
    if (filtro === "entregadas") return estado === "entregada";
    return true;
  });

  async function entregar(id: string, titulo: string) {
    Alert.alert("Entregar tarea", `¿Entregar «${titulo}»?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Entregar",
        onPress: async () => {
          try { await entregarTarea(id); recargar(); }
          catch (e) { Alert.alert("No pude entregarla", e instanceof globalThis.Error ? e.message : ""); }
        },
      },
    ]);
  }

  return (
    <Pantalla>
      <View style={e.filtros}>
        {FILTROS.map((f) => {
          const activo = f.id === filtro;
          return (
            <Pressable key={f.id} accessibilityRole="tab" accessibilityState={{ selected: activo }}
              onPress={() => setFiltro(f.id)} style={[e.filtro, activo && { backgroundColor: color.marca }]}>
              <Text style={[e.filtroTexto, activo && { color: color.sobreMarca, fontWeight: "600" }]}>
                {f.texto}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {lista.length === 0 ? <Vacio texto="Nada por acá." /> : lista.map((t) => {
        const ramo = datos.porId.get(t.asignatura_id);
        const estado = estadoDeTarea(t);
        return (
          <Fila key={t.id}
            izquierda={<Punto tono={ramo?.color ?? color.marca} />}
            titulo={t.titulo}
            detalle={`${ramo?.nombre ?? ""} · ${fechaYHora(t.vence_en)} · ${t.puntos} pts`}
            derecha={
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                <Pastilla
                  texto={estado === "entregada" ? "ENTREGADA" : estado === "atrasada" ? "ATRASADA" : "PENDIENTE"}
                  tono={estado === "entregada" ? "ok" : estado === "atrasada" ? "atrasada" : "pendiente"} />
                <Text style={tipo.detalle}>{cuandoVence(t)}</Text>
              </View>
            }
            onPress={() => {
              if (estado === "entregada") {
                navigation.navigate(...alTutor(t.asignatura_id, `Estoy con «${t.titulo}».`));
              } else {
                entregar(t.id, t.titulo);
              }
            }}
          />
        );
      })}
      <Text style={e.pie}>
        Toca una tarea pendiente para entregarla. El tutor no la resuelve por ti:
        te ayuda a encontrar el camino.
      </Text>
    </Pantalla>
  );
}

const e = StyleSheet.create({
  filtros: { flexDirection: "row", gap: 6, padding: espacio.m },
  filtro: { borderRadius: radio.pastilla, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: color.elemento },
  filtroTexto: { fontSize: 12.5, color: color.textoSuave },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
});
