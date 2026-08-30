import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Error, Fila, Pantalla, Pastilla, Punto, Vacio } from "../ui/componentes.tsx";
import {
  FILETE, color, colorDeRamo, espacio, fechaYHora, radio, tipo,
} from "../ui/tema.ts";
import { misAsignaturas, misTareas } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { cuandoVence, estadoDeTarea, ordenarTareas } from "../dominio/tareas.ts";
import type { PropsPestana } from "../lib/rutas.ts";

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
  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const lista = ordenarTareas(datos.tareas).filter((t) => {
    const estado = estadoDeTarea(t);
    if (filtro === "pendientes") return estado !== "entregada";
    if (filtro === "entregadas") return estado === "entregada";
    return true;
  });

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
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
            izquierda={<Punto tono={ramo ? colorDeRamo(ramo.id, ramo.color) : color.bordeFuerte} />}
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
            onPress={() => navigation.navigate("Tarea", { tareaId: t.id })}
          />
        );
      })}
      <Text style={e.pie}>
        El tutor no las resuelve por ti: te ayuda a encontrar el camino.
      </Text>
    </Pantalla>
  );
}

const e = StyleSheet.create({
  filtros: { flexDirection: "row", gap: espacio.s, padding: espacio.m },
  filtro: {
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 9,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  filtroTexto: { fontSize: 14, fontWeight: "600", color: color.textoSuave },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
});
