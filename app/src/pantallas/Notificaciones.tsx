import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Error, Fila, Pantalla, Vacio } from "../ui/componentes.tsx";
import { color, espacio, tenue } from "../ui/tema.ts";
import { marcarLeida, marcarTodasLeidas, misNotificaciones } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Notificaciones">;

const ICONO = { clase: "🎙", anuncio: "📣", tarea: "📋", nota: "⭐" } as const;

export default function Notificaciones({ navigation }: Props) {
  const { datos, cargando, error, recargar } = usarCarga(misNotificaciones, []);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;

  const lista = datos ?? [];

  async function abrir(n: (typeof lista)[number]) {
    if (!n.leida) { await marcarLeida(n.id).catch(() => {}); }
    if (!n.asignatura_id) { recargar(); return; }

    // Cada notificación lleva al lugar exacto, nunca de vuelta al inicio.
    if (n.ref_tipo === "hilo" && n.ref_id) {
      navigation.navigate("Hilo", { hiloId: n.ref_id, titulo: n.detalle });
    } else if (n.ref_tipo === "tarea") {
      navigation.navigate("Principal", { screen: "Tareas" });
    } else if (n.ref_tipo === "clase") {
      navigation.navigate("Asignatura", { asignaturaId: n.asignatura_id, seccion: "clases" });
    } else {
      navigation.navigate("Asignatura", { asignaturaId: n.asignatura_id, seccion: "notas" });
    }
  }

  return (
    <Pantalla>
      {lista.some((n) => !n.leida) ? (
        <Pressable style={e.marcarTodas}
          onPress={async () => { await marcarTodasLeidas().catch(() => {}); recargar(); }}>
          <Text style={e.enlace}>Marcar todas como leídas</Text>
        </Pressable>
      ) : null}

      {lista.length === 0 ? <Vacio texto="No tienes notificaciones." /> : lista.map((n) => (
        <View key={n.id} style={!n.leida && { backgroundColor: tenue(color.marca) }}>
          <Fila
            izquierda={<Text style={{ fontSize: 20 }}>{ICONO[n.tipo]}</Text>}
            titulo={n.leida ? n.titulo : `${n.titulo} •`}
            detalle={n.detalle}
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
});
