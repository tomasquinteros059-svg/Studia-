import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error, Fila, Pantalla, Vacio } from "../ui/componentes.tsx";
import { color, diaCorto, espacio, hora, radio, tipo } from "../ui/tema.ts";
import { miHorario, misAsignaturas } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPestana } from "../lib/rutas.ts";

type Props = PropsPestana<"Horario">;
const DIAS = [1, 2, 3, 4, 5];

export default function Horario({ navigation }: Props) {
  const hoy = ((new Date().getDay() + 6) % 7) + 1;
  const [dia, setDia] = useState(DIAS.includes(hoy) ? hoy : 1);

  const traer = useCallback(async () => {
    const [bloques, asignaturas] = await Promise.all([miHorario(), misAsignaturas()]);
    return { bloques, porId: new Map(asignaturas.map((a) => [a.id, a])) };
  }, []);
  const { datos, cargando, error, recargar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const delDia = datos.bloques.filter((b) => b.dia === dia);

  return (
    <Pantalla>
      <View style={e.dias}>
        {DIAS.map((d) => {
          const activo = d === dia;
          return (
            <Pressable key={d} accessibilityRole="tab" accessibilityState={{ selected: activo }}
              onPress={() => setDia(d)} style={[e.dia, activo && { backgroundColor: color.marca }]}>
              <Text style={[e.diaTexto, activo && { color: color.sobreMarca }]}>{diaCorto(d)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Encabezado texto={dia === hoy ? "Hoy" : "Clases del día"} />
      {delDia.length === 0
        ? <Vacio texto="Día libre. Buen momento para adelantar materia." />
        : delDia.map((b) => {
            const ramo = datos.porId.get(b.asignatura_id);
            if (!ramo) return null;
            return (
              <Fila key={b.id}
                izquierda={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <View style={e.horas}>
                      <Text style={e.horaInicio}>{hora(b.hora_inicio)}</Text>
                      <Text style={tipo.detalle}>{hora(b.hora_fin)}</Text>
                    </View>
                    <View style={[e.barra, { backgroundColor: ramo.color }]} />
                  </View>
                }
                titulo={ramo.nombre}
                detalle={`${b.tipo} · ${b.sala} · ${ramo.profesor}`}
                onPress={() => navigation.navigate("Asignatura", { asignaturaId: ramo.id })}
              />
            );
          })}
    </Pantalla>
  );
}

const e = StyleSheet.create({
  dias: { flexDirection: "row", gap: 6, padding: espacio.m },
  dia: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radio.campo, backgroundColor: color.elemento },
  diaTexto: { fontSize: 13, fontWeight: "600", color: color.textoSuave, textTransform: "uppercase" },
  horas: { width: 46 },
  horaInicio: { fontSize: 13, fontWeight: "600", color: color.texto },
  barra: { width: 3, height: 34, borderRadius: 2 },
});
