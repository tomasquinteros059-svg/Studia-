import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error, Fila, Pantalla, Vacio } from "../ui/componentes.tsx";
import {
  FILETE, cifras, color, colorDeRamo, diaCorto, espacio, hora, radio, tipo,
} from "../ui/tema.ts";
import { miHorario, misAsignaturas } from "../lib/consultas.ts";
import { porHora } from "../dominio/horario.ts";
import { unir } from "../dominio/horario-escrito.ts";
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
  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const delDia = porHora(datos.bloques.filter((b) => b.dia === dia));

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
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
                      <Text style={[tipo.detalle, cifras]}>{hora(b.hora_fin)}</Text>
                    </View>
                    <View style={[e.barra, { backgroundColor: colorDeRamo(ramo.id, ramo.color) }]} />
                  </View>
                }
                titulo={ramo.nombre}
                // En un ramo propio el "profesor" es "Por tu cuenta", que en
                // el horario no agrega nada que no se sepa ya.
                detalle={unir([b.tipo, b.sala, ramo.propio ? "" : ramo.profesor])}
                onPress={() => navigation.navigate("Asignatura", { asignaturaId: ramo.id })}
              />
            );
          })}
    </Pantalla>
  );
}

const e = StyleSheet.create({
  dias: { flexDirection: "row", gap: espacio.s, padding: espacio.m },
  dia: {
    flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: radio.campo,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.borde,
  },
  diaTexto: {
    fontSize: 14, fontWeight: "700", color: color.textoSuave,
    textTransform: "uppercase", letterSpacing: 0.3,
  },
  horas: { width: 52 },
  horaInicio: { ...cifras, fontSize: 16, fontWeight: "700", color: color.texto, letterSpacing: -0.3 },
  barra: { width: 3, height: 38, borderRadius: 2 },
});
