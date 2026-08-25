import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error, Pantalla, Vacio } from "../ui/componentes.tsx";
import { color, espacio, radio, tipo } from "../ui/tema.ts";
import {
  materiaDe, misApuntes, misAsignaturas, misTareas, todasLasEvaluaciones,
} from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { consejosDeEstudio, type Consejo } from "../dominio/habitos.ts";
import { notaDelRamo } from "../dominio/notas.ts";

export default function Consejos() {
  const traer = useCallback(async () => {
    const [asignaturas, tareas, evaluaciones, apuntes] = await Promise.all([
      misAsignaturas(), misTareas(), todasLasEvaluaciones(), misApuntes(),
    ]);

    // El progreso sale del material efectivamente completado, ramo por ramo.
    const materias = await Promise.all(asignaturas.map((a) => materiaDe(a.id)));

    const ramos = asignaturas.map((a, i) => {
      const modulos = materias[i] ?? [];
      const items = modulos.flatMap((m) => m.materiales);
      const hechos = items.filter((x) => x.completado).length;
      return {
        id: a.id,
        nombre: a.nombre,
        progreso: items.length ? (hechos / items.length) * 100 : 0,
        nota: notaDelRamo(evaluaciones.get(a.id) ?? []).nota,
        apuntes: apuntes.filter((x) => x.asignatura_id === a.id).length,
      };
    });

    const porId = new Map(asignaturas.map((a) => [a.id, a.nombre]));
    const paraHabitos = tareas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      ramo: porId.get(t.asignatura_id) ?? "",
      vence_en: t.vence_en,
      entregada_en: t.entregada_en,
    }));

    return consejosDeEstudio(paraHabitos, ramos);
  }, []);

  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;

  const consejos = datos ?? [];

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={e.intro}>
        <Text style={e.titulo}>Cómo vas estudiando</Text>
        <Text style={tipo.detalle}>
          Esto sale de tus propios datos: tus entregas, tu avance y tus apuntes.
          No es una opinión del tutor.
        </Text>
      </View>

      <Encabezado texto={consejos.length === 1 ? "1 observación" : `${consejos.length} observaciones`} />
      {consejos.length === 0
        ? <Vacio texto="Todavía no hay suficientes datos. Vuelve cuando lleves algunas entregas." />
        : consejos.map((c) => <Tarjeta key={c.clave} consejo={c} />)}
    </Pantalla>
  );
}

function Tarjeta({ consejo }: { consejo: Consejo }) {
  const tonos = {
    alerta: color.vivo,
    aviso: color.ambar,
    bueno: color.ok,
  } as const;
  const tono = tonos[consejo.tono];

  return (
    <View style={[e.tarjeta, { borderLeftColor: tono }]}>
      <Text style={e.tarjetaTitulo}>{consejo.titulo}</Text>
      <Text style={e.tarjetaDetalle}>{consejo.detalle}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  intro: { padding: espacio.m, gap: 6 },
  titulo: { fontSize: 22, fontWeight: "600", color: color.texto },
  tarjeta: {
    marginHorizontal: espacio.m, marginBottom: 10, padding: espacio.m,
    borderRadius: radio.tarjeta, borderWidth: 1, borderColor: color.borde,
    borderLeftWidth: 3,
  },
  tarjetaTitulo: { fontSize: 15, fontWeight: "600", color: color.texto },
  tarjetaDetalle: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21, marginTop: 5 },
});
