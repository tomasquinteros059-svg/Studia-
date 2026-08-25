import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Cargando, Encabezado, Error, Fila, Pantalla, Pastilla, Punto,
} from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { color, espacio, hora, nombreDia, radio, tipo } from "../ui/tema.ts";
import { claseEnVivo, miHorario, misAsignaturas, misNotificaciones, misTareas, todasLasEvaluaciones } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { formatearNota, notaDelRamo } from "../dominio/notas.ts";
import { cuandoVence, estadoDeTarea, ordenarTareas } from "../dominio/tareas.ts";
import type { PropsPestana } from "../lib/rutas.ts";

type Props = PropsPestana<"Inicio">;

export default function Inicio({ navigation }: Props) {
  const traer = useCallback(async () => {
    const [asignaturas, tareas, horario, vivo, notificaciones, evaluaciones] = await Promise.all([
      misAsignaturas(), misTareas(), miHorario(), claseEnVivo(),
      misNotificaciones(), todasLasEvaluaciones(),
    ]);
    return { asignaturas, tareas, horario, vivo, notificaciones, evaluaciones };
  }, []);

  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const { asignaturas, tareas, horario, vivo, notificaciones, evaluaciones } = datos;
  const porId = new Map(asignaturas.map((a) => [a.id, a]));
  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  const hoy = ((new Date().getDay() + 6) % 7) + 1; // domingo = 7
  const bloquesDeHoy = horario.filter((b) => b.dia === hoy);
  const proximas = ordenarTareas(tareas).filter((t) => estadoDeTarea(t) !== "entregada").slice(0, 3);
  const ramoEnVivo = vivo ? porId.get(vivo.asignatura_id) : null;

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={e.saludo}>
        <View style={{ flex: 1 }}>
          <Text style={e.hola}>Hola</Text>
          <Text style={e.fecha}>{nombreDia(hoy)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sinLeer ? `Notificaciones, ${sinLeer} sin leer` : "Notificaciones"}
          onPress={() => navigation.navigate("Notificaciones")}
          style={e.campana}
        >
          <Icono nombre="campana" tamano={23} />
          {sinLeer > 0 ? (
            <View style={e.globo}><Text style={e.globoTexto}>{sinLeer}</Text></View>
          ) : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Mi perfil"
          onPress={() => navigation.navigate("Perfil")} style={e.campana}>
          <Icono nombre="perfil" tamano={24} />
        </Pressable>
      </View>

      {vivo && ramoEnVivo ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Asignatura", { asignaturaId: ramoEnVivo.id, seccion: "clases" })}
          style={e.barraVivo}
        >
          <View style={[e.puntoVivo]} />
          <View style={{ flex: 1 }}>
            <Text style={e.vivoEtiqueta}>EN VIVO AHORA</Text>
            <Text style={e.vivoRamo}>{ramoEnVivo.nombre}</Text>
            <Text style={e.vivoTema}>{vivo.titulo} · {ramoEnVivo.profesor}</Text>
          </View>
          <Pastilla texto="ENTRAR" tono="vivo" />
        </Pressable>
      ) : null}

      <Encabezado texto="Hoy" accion={
        <Pressable onPress={() => navigation.navigate("Horario")}>
          <Text style={e.enlace}>Ver horario</Text>
        </Pressable>} />
      {bloquesDeHoy.length === 0
        ? <Text style={e.vacio}>No tienes clases hoy.</Text>
        : bloquesDeHoy.map((b) => {
            const ramo = porId.get(b.asignatura_id);
            if (!ramo) return null;
            return (
              <Fila key={b.id}
                izquierda={<View style={[e.barraColor, { backgroundColor: ramo.color }]} />}
                titulo={ramo.nombre}
                detalle={`${hora(b.hora_inicio)}–${hora(b.hora_fin)} · ${b.tipo} · ${b.sala}`}
                onPress={() => navigation.navigate("Asignatura", { asignaturaId: ramo.id })}
              />
            );
          })}

      <Encabezado texto="Próximas entregas" accion={
        <Pressable onPress={() => navigation.navigate("Tareas")}>
          <Text style={e.enlace}>Ver todas</Text>
        </Pressable>} />
      {proximas.length === 0
        ? <Text style={e.vacio}>Estás al día. Nada por entregar.</Text>
        : proximas.map((t) => {
            const ramo = porId.get(t.asignatura_id);
            return (
              <Fila key={t.id}
                izquierda={<Punto tono={ramo?.color ?? color.marca} />}
                titulo={t.titulo}
                detalle={`${ramo?.nombre ?? ""} · ${cuandoVence(t)}`}
                derecha={<Pastilla
                  texto={estadoDeTarea(t) === "atrasada" ? "ATRASADA" : "PENDIENTE"}
                  tono={estadoDeTarea(t) === "atrasada" ? "atrasada" : "pendiente"} />}
                onPress={() => navigation.navigate("Tarea", { tareaId: t.id })}
              />
            );
          })}

      <Encabezado texto="Cómo vas estudiando" accion={
        <Pressable onPress={() => navigation.navigate("Consejos")}>
          <Text style={e.enlace}>Ver consejos</Text>
        </Pressable>} />
      <Text style={e.pistaConsejos}>
        Salen de tus entregas, tu avance y tus apuntes.
      </Text>

      <Encabezado texto="Mis asignaturas" accion={
        <Pressable onPress={() => navigation.navigate("Notas")}>
          <Text style={e.enlace}>Ver notas</Text>
        </Pressable>} />
      <View style={{ paddingHorizontal: espacio.m, gap: 10 }}>
        {asignaturas.map((a) => {
          const { nota } = notaDelRamo(evaluaciones.get(a.id) ?? []);
          const pendientes = tareas.filter(
            (t) => t.asignatura_id === a.id && estadoDeTarea(t) !== "entregada").length;
          return (
            <Pressable key={a.id} accessibilityRole="button" style={e.tarjeta}
              onPress={() => navigation.navigate("Asignatura", { asignaturaId: a.id })}>
              <View style={[e.franja, { backgroundColor: a.color }]}>
                <Text style={e.codigo}>{a.codigo}</Text>
              </View>
              <View style={{ padding: 12 }}>
                <Text style={e.tarjetaNombre}>{a.nombre}</Text>
                <Text style={e.tarjetaProfe}>{a.profesor}</Text>
                <View style={e.tarjetaPie}>
                  <Text style={tipo.detalle}>
                    {pendientes === 0 ? "Sin pendientes"
                      : `${pendientes} ${pendientes === 1 ? "tarea pendiente" : "tareas pendientes"}`}
                  </Text>
                  <Text style={[e.tarjetaNota, nota !== null && nota < 4 && { color: color.vivo }]}>
                    Nota {formatearNota(nota)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

    </Pantalla>
  );
}

const e = StyleSheet.create({
  saludo: { flexDirection: "row", alignItems: "flex-start", padding: espacio.m, paddingTop: espacio.l },
  hola: { fontSize: 22, fontWeight: "600", color: color.texto },
  fecha: { ...tipo.detalle, marginTop: 2, textTransform: "capitalize" },
  campana: { padding: 5 },
  globo: {
    position: "absolute", top: -1, right: -1, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: color.vivo, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 2, borderColor: color.fondo,
  },
  globoTexto: { color: "#fff", fontSize: 10, fontWeight: "700" },
  barraVivo: {
    flexDirection: "row", alignItems: "center", gap: 11,
    marginHorizontal: espacio.m, padding: 13, borderRadius: radio.tarjeta,
    borderWidth: 1, borderColor: "rgba(217,59,59,0.28)", backgroundColor: "rgba(217,59,59,0.06)",
  },
  puntoVivo: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.vivo },
  vivoEtiqueta: { fontSize: 11, fontWeight: "700", color: color.vivo, letterSpacing: 0.6 },
  vivoRamo: { fontSize: 14, fontWeight: "600", color: color.texto, marginTop: 1 },
  vivoTema: { ...tipo.detalle, marginTop: 1 },
  barraColor: { width: 3, height: 34, borderRadius: 2 },
  enlace: { color: color.marca, fontWeight: "600", fontSize: 12.5 },
  vacio: { ...tipo.detalle, paddingHorizontal: espacio.m, paddingVertical: espacio.m },
  pistaConsejos: { ...tipo.detalle, paddingHorizontal: espacio.m, lineHeight: 19 },
  tarjeta: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.tarjeta, overflow: "hidden",
  },
  franja: { height: 34, justifyContent: "center", paddingHorizontal: 12 },
  codigo: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, opacity: 0.92 },
  tarjetaNombre: { fontSize: 15, fontWeight: "600", color: color.texto },
  tarjetaProfe: { ...tipo.detalle, marginTop: 2 },
  tarjetaPie: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 },
  tarjetaNota: { fontSize: 12, fontWeight: "600", color: color.textoSuave },
});
