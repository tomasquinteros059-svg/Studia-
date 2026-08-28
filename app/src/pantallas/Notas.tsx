import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error, Fila, Pantalla, Punto } from "../ui/componentes.tsx";
import { color, espacio, tipo } from "../ui/tema.ts";
import { misAsignaturas, todasLasEvaluaciones } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { formatearNota, notaDelRamo, promedioPonderado } from "../dominio/notas.ts";
import type { PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Notas">;

export default function Notas({ navigation }: Props) {
  const traer = useCallback(async () => {
    const [asignaturas, evaluaciones] = await Promise.all([misAsignaturas(), todasLasEvaluaciones()]);
    return { asignaturas, evaluaciones };
  }, []);
  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const promedio = promedioPonderado(
    datos.asignaturas.map((a) => ({
      creditos: a.creditos,
      evaluaciones: datos.evaluaciones.get(a.id) ?? [],
    })),
  );

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={e.hero}>
        <Text style={tipo.etiqueta}>Promedio ponderado</Text>
        <Text style={e.heroNota}>{formatearNota(promedio)}</Text>
        <Text style={tipo.detalle}>
          {promedio === null
            ? "Sin evaluaciones rendidas"
            : `Ponderado por créditos · ${datos.asignaturas.length} asignaturas`}
        </Text>
      </View>

      <Encabezado texto="Por asignatura" />
      {datos.asignaturas.map((a) => {
        const { nota, rendido } = notaDelRamo(datos.evaluaciones.get(a.id) ?? []);
        return (
          <Fila key={a.id}
            izquierda={<Punto tono={a.color} />}
            titulo={a.nombre}
            detalle={`${rendido}% del curso evaluado · ${a.creditos} créditos`}
            derecha={
              <Text style={[e.nota, nota === null ? e.notaVacia : nota < 4 && { color: color.vivo }]}>
                {formatearNota(nota)}
              </Text>
            }
            onPress={() => navigation.navigate("Asignatura", { asignaturaId: a.id, seccion: "notas" })}
          />
        );
      })}

      <Text style={e.pie}>
        Escala de 1,0 a 7,0. Se aprueba con 4,0.{"\n"}
        Las notas parciales se ponderan solo entre las evaluaciones ya rendidas.
      </Text>
    </Pantalla>
  );
}

const e = StyleSheet.create({
  hero: {
    alignItems: "center", paddingVertical: espacio.l, gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  heroNota: { fontSize: 44, fontWeight: "600", color: color.texto, letterSpacing: -1 },
  nota: { fontSize: 17, fontWeight: "600", color: color.texto },
  notaVacia: { color: color.textoSuave, fontWeight: "400" },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
});
