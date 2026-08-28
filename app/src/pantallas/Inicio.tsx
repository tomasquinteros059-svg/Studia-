import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Baldosa, Boton, Cargando, Encabezado, Error, Hoja, Pantalla, Pastilla,
} from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  FILETE, cifras, color, colorDeRamo, espacio, hora, inicialesDeRamo,
  nombreDia, radio, tenue, tipo,
} from "../ui/tema.ts";
import { claseEnVivo, crearRamoPropio, miHorario, misAsignaturas, misNotificaciones, misTareas, todasLasEvaluaciones } from "../lib/consultas.ts";
import NuevoRamo, { colorSugerido } from "./propio/NuevoRamo.tsx";
import { usarCarga } from "../lib/usarCarga.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { SEPARACION_TARJETAS, anchoDeTarjeta } from "../dominio/disposicion.ts";
import { usarQuienSoy } from "../lib/quien-soy.ts";
import { primerNombre } from "../dominio/personas.ts";
import { formatearNota, notaDelRamo } from "../dominio/notas.ts";
import { cuandoVence, estadoDeTarea, ordenarTareas } from "../dominio/tareas.ts";
import { porHora } from "../dominio/horario.ts";
import type { PropsPestana } from "../lib/rutas.ts";

type Props = PropsPestana<"Inicio">;

export default function Inicio({ navigation }: Props) {
  const { columnas } = usarDisposicion();
  const { yo } = usarQuienSoy();
  const [creando, setCreando] = useState(false);

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
  // Los ramos de la institución y los que armó la persona se muestran
  // aparte: son dos cosas distintas y mezclarlas confunde a los dos lados.
  const delColegio = asignaturas.filter((a) => !a.propio);
  const mios = asignaturas.filter((a) => a.propio);
  const hayColegio = delColegio.length > 0;
  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  const hoy = ((new Date().getDay() + 6) % 7) + 1; // domingo = 7
  const bloquesDeHoy = porHora(horario.filter((b) => b.dia === hoy));
  const proximas = ordenarTareas(tareas).filter((t) => estadoDeTarea(t) !== "entregada").slice(0, 3);
  const ramoEnVivo = vivo ? porId.get(vivo.asignatura_id) : null;

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={e.saludo}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={tipo.etiqueta}>{nombreDia(hoy)}</Text>
          {/* Con nombre si se sabe; "Hola" a secas si todavía no llega,
              que es mejor que un saludo que parpadea al completarse. */}
          <Text style={e.hola} numberOfLines={1}>
            {yo?.nombre ? `Hola, ${primerNombre(yo.nombre)}` : "Hola"}
          </Text>
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
          <View style={e.puntoVivo} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={e.vivoEtiqueta}>En vivo ahora</Text>
            <Text style={e.vivoRamo}>{ramoEnVivo.nombre}</Text>
            <Text style={e.vivoTema}>{vivo.titulo} · {ramoEnVivo.profesor}</Text>
          </View>
          <Pastilla texto="ENTRAR" tono="vivo" />
        </Pressable>
      ) : null}

      {hayColegio ? <>
      <Encabezado texto="Hoy" accion={
        <Pressable onPress={() => navigation.navigate("Horario")}>
          <Text style={e.enlace}>Ver horario</Text>
        </Pressable>} />
      {bloquesDeHoy.length === 0 ? (
        <Hoja><Text style={e.vacio}>No tienes clases hoy.</Text></Hoja>
      ) : (
        <Hoja ceñida>
          {bloquesDeHoy.map((b, i) => {
            const ramo = porId.get(b.asignatura_id);
            if (!ramo) return null;
            const tono = colorDeRamo(ramo.id, ramo.color);
            return (
              <Pressable key={b.id} accessibilityRole="button"
                accessibilityLabel={`Abrir ${ramo.nombre}`}
                onPress={() => navigation.navigate("Asignatura", { asignaturaId: ramo.id })}
                style={({ pressed }) => [
                  e.filaHoy, i > 0 ? e.conFilete : null,
                  pressed ? { backgroundColor: color.elemento } : null,
                ]}>
                <Text style={[e.horaGrande, { color: tono }]}>{hora(b.hora_inicio)}</Text>
                <View style={[e.hilo, { backgroundColor: tono }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={tipo.fila} numberOfLines={1}>{ramo.nombre}</Text>
                  <Text style={tipo.detalle}>
                    {b.tipo} · {b.sala} · hasta {hora(b.hora_fin)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Hoja>
      )}

      <Encabezado texto="Próximas entregas" accion={
        <Pressable onPress={() => navigation.navigate("Tareas")}>
          <Text style={e.enlace}>Ver todas</Text>
        </Pressable>} />
      {proximas.length === 0 ? (
        <Hoja><Text style={e.vacio}>Estás al día. Nada por entregar.</Text></Hoja>
      ) : (
        <Hoja ceñida>
          {proximas.map((t, i) => {
            const ramo = porId.get(t.asignatura_id);
            const atrasada = estadoDeTarea(t) === "atrasada";
            return (
              <Pressable key={t.id} accessibilityRole="button"
                accessibilityLabel={`Abrir ${t.titulo}`}
                onPress={() => navigation.navigate("Tarea", { tareaId: t.id })}
                style={({ pressed }) => [
                  e.filaTarea, i > 0 ? e.conFilete : null,
                  pressed ? { backgroundColor: color.elemento } : null,
                ]}>
                <View style={[e.hilo, {
                  backgroundColor: ramo ? colorDeRamo(ramo.id, ramo.color) : color.bordeFuerte,
                }]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={tipo.fila} numberOfLines={2}>{t.titulo}</Text>
                  <Text style={[tipo.detalle, cifras, atrasada ? { color: color.vivo } : null]}>
                    {ramo?.nombre ?? ""} · {cuandoVence(t)}
                  </Text>
                </View>
                <Pastilla
                  texto={atrasada ? "ATRASADA" : "PENDIENTE"}
                  tono={atrasada ? "atrasada" : "pendiente"} />
              </Pressable>
            );
          })}
        </Hoja>
      )}


      <Encabezado texto="Mis asignaturas" accion={
        <Pressable onPress={() => navigation.navigate("Notas")}>
          <Text style={e.enlace}>Ver notas</Text>
        </Pressable>} />
      {/*
        En un teléfono los ramos van en lista y no en cuadrícula: una
        cuadrícula de una sola columna son seis tarjetas altas, seis pantallas
        de scroll para ver seis nombres. Con ancho de sobra sí valen la pena.
      */}
      {columnas <= 1 ? (
        <Hoja ceñida>
          {delColegio.map((a, i) => {
            const { nota } = notaDelRamo(evaluaciones.get(a.id) ?? []);
            const pendientes = tareas.filter(
              (t) => t.asignatura_id === a.id && estadoDeTarea(t) !== "entregada").length;
            return (
              <Pressable key={a.id} accessibilityRole="button"
                accessibilityLabel={`Abrir ${a.nombre}`}
                onPress={() => navigation.navigate("Asignatura", { asignaturaId: a.id })}
                style={({ pressed }) => [
                  e.filaRamo, i > 0 ? e.conFilete : null,
                  pressed ? { backgroundColor: color.elemento } : null,
                ]}>
                <Baldosa tono={colorDeRamo(a.id, a.color)} texto={inicialesDeRamo(a.nombre)} tamano={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={tipo.fila} numberOfLines={1}>{a.nombre}</Text>
                  <Text style={[tipo.detalle, pendientes > 0 ? { color: color.ambar, fontWeight: "600" } : null]}>
                    {pendientes === 0 ? "Al día"
                      : `${pendientes} ${pendientes === 1 ? "tarea" : "tareas"}`}
                  </Text>
                </View>
                <Text style={[e.tarjetaNota, nota !== null && nota < 4 ? { color: color.vivo } : null]}>
                  {formatearNota(nota)}
                </Text>
              </Pressable>
            );
          })}
        </Hoja>
      ) : (
        <View style={[e.rejilla, { paddingHorizontal: espacio.m }]}>
          {delColegio.map((a) => {
            const { nota } = notaDelRamo(evaluaciones.get(a.id) ?? []);
            const pendientes = tareas.filter(
              (t) => t.asignatura_id === a.id && estadoDeTarea(t) !== "entregada").length;
            return (
              <Pressable key={a.id} accessibilityRole="button"
                accessibilityLabel={`Abrir ${a.nombre}`}
                style={({ pressed }) => [
                  e.tarjeta, { width: anchoDeTarjeta(columnas) },
                  pressed ? { backgroundColor: color.elemento } : null,
                ]}
                onPress={() => navigation.navigate("Asignatura", { asignaturaId: a.id })}>
                <Baldosa tono={colorDeRamo(a.id, a.color)} texto={inicialesDeRamo(a.nombre)} tamano={44} />
                <View style={{ gap: 3, marginTop: espacio.s + 2 }}>
                  <Text style={e.tarjetaNombre} numberOfLines={2}>{a.nombre}</Text>
                  <Text style={[tipo.detalle, cifras]}>{a.codigo}</Text>
                </View>
                <View style={e.tarjetaPie}>
                  <Text style={[tipo.detalle, pendientes > 0 ? { color: color.ambar, fontWeight: "600" } : null]}>
                    {pendientes === 0 ? "Al día"
                      : `${pendientes} ${pendientes === 1 ? "tarea" : "tareas"}`}
                  </Text>
                  <Text style={[e.tarjetaNota, nota !== null && nota < 4 ? { color: color.vivo } : null]}>
                    {formatearNota(nota)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      </> : null}

      <Encabezado texto="Lo mío" accion={
        <Pressable accessibilityRole="button" accessibilityLabel="Nuevo ramo"
          onPress={() => setCreando(true)}>
          <Text style={e.enlace}>Nuevo ramo</Text>
        </Pressable>} />
      {mios.length === 0 ? (
        <Hoja>
          <Text style={e.vacio}>
            {hayColegio
              ? "Acá puedes armar tus propios ramos, con lo que quieras estudiar aparte."
              : "Todavía no tienes nada. Crea un ramo, pega o escribe el texto que quieras estudiar y escúchalo con el lector mientras tomas apuntes."}
          </Text>
          {hayColegio ? null : (
            <Boton texto="Crear mi primer ramo" onPress={() => setCreando(true)} />
          )}
        </Hoja>
      ) : (
        <Hoja ceñida>
          {mios.map((a, i) => (
            <Pressable key={a.id} accessibilityRole="button"
              accessibilityLabel={`Abrir ${a.nombre}`}
              onPress={() => navigation.navigate("Asignatura", { asignaturaId: a.id })}
              style={({ pressed }) => [
                e.filaMio, i > 0 ? e.conFilete : null,
                pressed ? { backgroundColor: color.elemento } : null,
              ]}>
              <Baldosa tono={colorDeRamo(a.id, a.color)} texto={inicialesDeRamo(a.nombre)} tamano={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={tipo.fila} numberOfLines={1}>{a.nombre}</Text>
                <Text style={[tipo.detalle, cifras]}>{a.codigo}</Text>
              </View>
            </Pressable>
          ))}
        </Hoja>
      )}

      <NuevoRamo
        abierto={creando}
        cerrar={() => setCreando(false)}
        colorInicial={colorSugerido(mios.length)}
        crear={async (nombre, tono) => {
          await crearRamoPropio(nombre, tono);
          await recargar();
        }}
      />
    </Pantalla>
  );
}

const e = StyleSheet.create({
  saludo: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.s,
  },
  hola: { ...tipo.portada },
  campana: { padding: 7 },
  globo: {
    position: "absolute", top: 1, right: 1, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: color.vivo, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 2, borderColor: color.fondo,
  },
  globoTexto: { color: "#fff", fontSize: 10, fontWeight: "800" },

  barraVivo: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    marginHorizontal: espacio.m, padding: espacio.m,
    borderRadius: radio.tarjeta,
    backgroundColor: tenue(color.vivo),
    borderWidth: FILETE, borderColor: `${color.vivo}33`,
  },
  puntoVivo: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.vivo },
  vivoEtiqueta: { ...tipo.etiqueta, color: color.vivo },
  vivoRamo: { ...tipo.fila },
  vivoTema: { ...tipo.detalle },

  conFilete: { borderTopWidth: FILETE, borderTopColor: color.borde },
  hilo: { width: 3, alignSelf: "stretch", borderRadius: 2 },

  filaHoy: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 14,
  },
  horaGrande: { ...cifras, fontSize: 15, fontWeight: "800", width: 46 },

  filaTarea: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 14,
  },
  filaMio: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 12,
  },
  filaRamo: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 12,
  },

  enlace: { color: color.texto, fontWeight: "700", fontSize: 13 },
  vacio: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 22 },

  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: `${SEPARACION_TARJETAS}%`, rowGap: espacio.m },
  tarjeta: {
    backgroundColor: color.papel,
    borderWidth: FILETE, borderColor: color.borde,
    borderRadius: radio.tarjeta,
    padding: espacio.m,
  },
  tarjetaNombre: { ...tipo.fila, lineHeight: 21 },
  tarjetaPie: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
    marginTop: espacio.m,
    borderTopWidth: FILETE, borderTopColor: color.borde, paddingTop: espacio.s,
  },
  tarjetaNota: { ...cifras, fontSize: 17, fontWeight: "800", color: color.texto },
});
