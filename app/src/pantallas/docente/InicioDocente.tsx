import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error as ErrorUI, Vacio } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, diaCorto, espacio, hora, radio, tenue, tipo } from "../../ui/tema.ts";
import {
  claseEnVivo, clasesDe, cursoDe, entregasDe, evaluacionesDe, miHorario, misAsignaturas, misTareas, notasDe,
} from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { usarDisposicion } from "../../lib/pantalla.ts";
import { usarQuienSoy } from "../../lib/quien-soy.ts";
import { estadoDeTarea, porRevisar, sinPublicar } from "../../dominio/curso.ts";
import type { PropsPestanaDocente } from "../../lib/rutas.ts";

export default function InicioDocente({ navigation }: PropsPestanaDocente<"Cursos">) {
  const { yo } = usarQuienSoy();
  const { columnas } = usarDisposicion();
  const dicta = yo?.dicta ?? [];

  const traer = useCallback(async () => {
    const [asignaturas, horario, viva] = await Promise.all([
      misAsignaturas(), miHorario(), claseEnVivo(),
    ]);
    const mios = asignaturas.filter((a) => dicta.includes(a.id));

    const ramos = await Promise.all(mios.map(async (ramo) => {
      const curso = await cursoDe(ramo.id);
      const [tareas, evaluaciones, clases] = await Promise.all([
        misTareas(ramo.id), evaluacionesDe(ramo.id), clasesDe(ramo.id),
      ]);
      const conEntregas = await Promise.all(
        tareas.map(async (t) => ({ tarea: t, entregas: await entregasDe(t.id, curso) })),
      );
      const notas = await Promise.all(
        evaluaciones.map(async (ev) => ({ ev, filas: await notasDe(ev.id, curso) })),
      );
      return {
        ramo, clases, curso,
        tareas: conEntregas.map(({ tarea, entregas }) => ({
          tarea, entregas, estado: estadoDeTarea(entregas, curso.length),
        })),
        porPublicar: notas.reduce((n, x) => n + sinPublicar(x.filas), 0),
      };
    }));

    return { ramos, horario, viva };
  }, [dicta.join(",")]);

  const { datos, cargando, error, recargar } = usarCarga(traer, [dicta.join(",")]);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos || datos.ramos.length === 0) {
    return <Vacio texto="Todavía no tienes ramos asignados. El colegio los asigna desde su planilla." />;
  }

  const hoy = ((new Date().getDay() + 6) % 7) + 1;
  const bloquesHoy = datos.horario.filter((b) => b.dia === hoy && dicta.includes(b.asignatura_id));
  const totalPorRevisar = datos.ramos.reduce(
    (n, r) => n + r.tareas.reduce((m, t) => m + porRevisar(t.entregas).length, 0), 0);
  const totalPorPublicar = datos.ramos.reduce((n, r) => n + r.porPublicar, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.fondo }}
      contentContainerStyle={{ paddingBottom: espacio.xl }}>

      <View style={e.saludo}>
        <Text style={e.hola}>Hola, {yo?.nombre.split(" ")[0]}</Text>
        <Text style={tipo.detalle}>
          {yo?.papel === "ayudante" ? "Ayudante" : "Profesora o profesor"}
          {" · "}{datos.ramos.length === 1 ? "1 ramo" : `${datos.ramos.length} ramos`}
        </Text>
      </View>

      {/* Lo que espera trabajo, antes que nada: es a lo que se entra. */}
      <View style={e.pendientes}>
        <Pendiente
          n={totalPorRevisar}
          texto={totalPorRevisar === 1 ? "entrega por revisar" : "entregas por revisar"}
          tono={color.ambar}
        />
        <Pendiente
          n={totalPorPublicar}
          texto={totalPorPublicar === 1 ? "nota sin publicar" : "notas sin publicar"}
          tono={color.marca}
        />
      </View>

      {datos.viva && dicta.includes(datos.viva.asignatura_id) ? (
        <View style={e.viva}>
          <View style={e.puntoVivo} />
          <View style={{ flex: 1 }}>
            <Text style={e.vivaTitulo}>Tu clase está en vivo</Text>
            <Text style={e.vivaDetalle}>{datos.viva.titulo}</Text>
          </View>
        </View>
      ) : null}

      {bloquesHoy.length > 0 ? (
        <>
          <Encabezado texto="Hoy" />
          {bloquesHoy.map((b) => {
            const ramo = datos.ramos.find((r) => r.ramo.id === b.asignatura_id)?.ramo;
            return (
              <View key={b.id} style={e.bloque}>
                <Text style={e.bloqueHora}>{hora(b.hora_inicio)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={e.bloqueRamo}>{ramo?.nombre}</Text>
                  <Text style={tipo.detalle}>{b.tipo} · {b.sala} · {diaCorto(b.dia)}</Text>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      <Encabezado texto="Mis cursos" />
      <View style={columnas > 1 ? e.grilla : undefined}>
        {datos.ramos.map(({ ramo, curso, tareas, porPublicar }) => {
          const revisar = tareas.reduce((m, t) => m + porRevisar(t.entregas).length, 0);
          return (
            <Pressable key={ramo.id} accessibilityRole="button"
              accessibilityLabel={`Abrir ${ramo.nombre}`}
              onPress={() => navigation.navigate("RamoDocente", { asignaturaId: ramo.id })}
              style={({ pressed }) => [
                e.tarjeta, columnas > 1 ? e.tarjetaAncha : null,
                pressed ? { backgroundColor: color.elemento } : null,
              ]}>
              <View style={[e.franja, { backgroundColor: ramo.color }]} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={e.codigo}>{ramo.codigo}</Text>
                <Text style={e.nombre}>{ramo.nombre}</Text>
                <Text style={tipo.detalle}>
                  {curso.length} inscritos · {tareas.length} {tareas.length === 1 ? "tarea" : "tareas"}
                </Text>
                {revisar > 0 || porPublicar > 0 ? (
                  <View style={e.avisos}>
                    {revisar > 0 ? (
                      <Text style={[e.aviso, { color: color.ambar }]}>{revisar} por revisar</Text>
                    ) : null}
                    {porPublicar > 0 ? (
                      <Text style={[e.aviso, { color: color.marca }]}>{porPublicar} sin publicar</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={[e.aviso, { color: color.ok }]}>Al día</Text>
                )}
              </View>
              <Icono nombre="mas" tamano={16} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Pendiente({ n, texto, tono }: { n: number; texto: string; tono: string }) {
  return (
    <View style={[e.pendiente, { backgroundColor: tenue(tono) }]}>
      <Text style={[e.pendienteN, { color: tono }]}>{n}</Text>
      <Text style={e.pendienteTexto}>{texto}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  saludo: { paddingHorizontal: espacio.l, paddingTop: espacio.l, paddingBottom: espacio.s },
  hola: { ...tipo.titulo, color: color.texto },

  pendientes: { flexDirection: "row", gap: espacio.s, paddingHorizontal: espacio.l, paddingVertical: espacio.s },
  pendiente: { flex: 1, borderRadius: radio.tarjeta, padding: espacio.m, gap: 2 },
  pendienteN: { fontSize: 26, fontWeight: "700" },
  pendienteTexto: { ...tipo.detalle, color: color.texto, lineHeight: 16 },

  viva: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    marginHorizontal: espacio.l, marginTop: espacio.s,
    padding: espacio.m, borderRadius: radio.tarjeta, backgroundColor: tenue(color.vivo),
  },
  puntoVivo: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.vivo },
  vivaTitulo: { fontSize: 13, fontWeight: "700", color: color.vivo },
  vivaDetalle: { ...tipo.cuerpo, color: color.texto },

  bloque: {
    flexDirection: "row", gap: espacio.m, alignItems: "center",
    paddingHorizontal: espacio.l, paddingVertical: 11,
  },
  bloqueHora: { ...tipo.fila, color: color.texto, width: 48, fontVariant: ["tabular-nums"] },
  bloqueRamo: { ...tipo.fila, color: color.texto },

  grilla: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: espacio.l, gap: espacio.s },
  tarjeta: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    marginHorizontal: espacio.l, marginBottom: espacio.s,
    padding: espacio.m, borderWidth: 1, borderColor: color.borde, borderRadius: radio.tarjeta,
  },
  tarjetaAncha: { flexBasis: "47%", flexGrow: 1, marginHorizontal: 0 },
  franja: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  codigo: { ...tipo.detalle, fontWeight: "600", letterSpacing: 0.4 },
  nombre: { fontSize: 16, fontWeight: "600", color: color.texto },
  avisos: { flexDirection: "row", gap: espacio.m, flexWrap: "wrap" },
  aviso: { fontSize: 12, fontWeight: "600" },
});
