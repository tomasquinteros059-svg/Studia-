import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error, Fila, Pantalla, Punto } from "../ui/componentes.tsx";
import { FILETE, cifras, color, colorDeRamo, espacio, tipo } from "../ui/tema.ts";
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

  // Sin ningún ramo, la pantalla mostraba el promedio en blanco, la escala de
  // 1,0 a 7,0 y una lista vacía. Explicar cómo se pondera antes de que exista
  // una sola nota es hablarle a nadie.
  if (datos.asignaturas.length === 0) {
    return (
      <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
        <View style={e.sinRamos}>
          <Text style={tipo.titulo}>Todavía no hay notas que promediar</Text>
          <Text style={e.sinRamosBajada}>
            Acá va a salir tu promedio ponderado por créditos, y el de cada
            ramo, en cuanto tengas evaluaciones rendidas.
          </Text>
          <Text style={e.sinRamosNota}>
            Si tu establecimiento usa StudIA, las notas las publica quien hace
            la clase. Si llegaste por tu cuenta, empieza cargando tus ramos
            desde Inicio.
          </Text>
        </View>
      </Pantalla>
    );
  }

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
            izquierda={<Punto tono={colorDeRamo(a.id, a.color)} />}
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
  sinRamos: { padding: espacio.l, gap: espacio.s, alignItems: "flex-start" },
  sinRamosBajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 22 },
  sinRamosNota: { ...tipo.detalle, color: color.textoSuave, lineHeight: 20, marginTop: espacio.xs },

  hero: {
    alignItems: "center", paddingVertical: espacio.xl, gap: espacio.xs,
    backgroundColor: color.papel,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  heroNota: { ...cifras, fontSize: 64, fontWeight: "700", color: color.texto, letterSpacing: -2.5 },
  nota: { ...cifras, fontSize: 19, fontWeight: "700", color: color.texto },
  notaVacia: { color: color.textoSuave, fontWeight: "400" },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
});
