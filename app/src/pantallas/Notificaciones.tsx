import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Error, Fila, Pantalla, Vacio } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { color, espacio, tenue } from "../ui/tema.ts";
import { marcarLeida, marcarTodasLeidas, misNotificaciones } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Notificaciones">;

const ICONO = { clase: "clase", anuncio: "anuncio", tarea: "tareas", nota: "nota" } as const;

export default function Notificaciones({ navigation }: Props) {
  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(misNotificaciones, []);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;

  const lista = datos ?? [];

  async function abrir(n: (typeof lista)[number]) {
    if (!n.leida) { await marcarLeida(n.id).catch(() => {}); }
    if (!n.asignatura_id) { recargar(); return; }

    // Cada notificación lleva al lugar exacto, nunca de vuelta al inicio.
    if (n.ref_tipo === "hilo" && n.ref_id) {
      navigation.navigate("Hilo", { hiloId: n.ref_id, titulo: n.detalle });
    } else if (n.ref_tipo === "tarea" && n.ref_id) {
      navigation.navigate("Tarea", { tareaId: n.ref_id });
    } else if (n.ref_tipo === "clase") {
      navigation.navigate("Asignatura", { asignaturaId: n.asignatura_id, seccion: "clases" });
    } else {
      navigation.navigate("Asignatura", { asignaturaId: n.asignatura_id, seccion: "notas" });
    }
  }

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      {lista.some((n) => !n.leida) ? (
        <Pressable style={e.marcarTodas} accessibilityRole="button"
          onPress={async () => { await marcarTodasLeidas().catch(() => {}); recargar(); }}>
          <Text style={e.enlace}>Marcar todas como leídas</Text>
        </Pressable>
      ) : null}

      {lista.length === 0 ? <Vacio texto="No tienes notificaciones." /> : lista.map((n) => (
        <View key={n.id} style={!n.leida && { backgroundColor: tenue(color.marca) }}>
          <Fila
            izquierda={<Icono nombre={ICONO[n.tipo]} tono={color.marca} />}
            titulo={n.titulo}
            detalle={n.detalle}
            derecha={n.leida ? null : <View style={e.sinLeer} />}
            onPress={() => abrir(n)}
          />
        </View>
      ))}
    </Pantalla>
  );
}

const e = StyleSheet.create({
  marcarTodas: { alignItems: "flex-end", paddingHorizontal: espacio.m, paddingTop: espacio.m },
  enlace: { color: color.marca, fontWeight: "600", fontSize: 12.5 },
  sinLeer: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.marca },
});
