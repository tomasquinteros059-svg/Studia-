import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Boton, Campo, Cargando, Encabezado, Error, Pantalla, Vacio,
} from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import { agregarTarea, marcarTarea, quienSoy, reunionPorId } from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { equipoDe } from "../../dominio/rubros.ts";
import {
  balanceDe, comoQuedo, cuandoVence, estadoDeTarea, huecos, loPrimero,
  ordenarTareas, type Tarea,
} from "../../dominio/acta.ts";
import type { PropsPila } from "../../lib/rutas.ts";

type Props = PropsPila<"Reunion">;

export default function Reunion({ route, navigation }: Props) {
  const { reunionId } = route.params;
  const [agregando, setAgregando] = useState("");

  const traer = useCallback(async () => {
    const [reunion, yo] = await Promise.all([reunionPorId(reunionId), quienSoy()]);
    return { reunion, yo };
  }, [reunionId]);

  const { datos, cargando, error, recargar } = usarCarga(traer, [reunionId]);

  useEffect(() => {
    navigation.setOptions({ title: datos?.reunion?.titulo ?? "Reunión" });
  }, [navigation, datos?.reunion?.titulo]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos?.reunion) return <Vacio texto="No encontré esa reunión." />;

  const r = datos.reunion;
  const equipo = equipoDe(r.rubro);

  if (r.estado !== "listo") {
    return (
      <Pantalla>
        <View style={e.esperando}>
          <Icono nombre="equipo" tamano={30} tono={color.marca} />
          <Text style={e.esperandoTitulo}>
            {r.estado === "analizando"
              ? "El equipo está trabajando"
              : r.estado === "falló"
                ? "No pude analizar esta reunión"
                : "Esta reunión todavía no se graba"}
          </Text>
          <Text style={e.esperandoTexto}>
            {r.estado === "analizando"
              ? `${equipo.agentes[0].nombre} escucha, ${equipo.agentes[1].nombre} redacta y ${equipo.agentes[2].nombre} saca la conclusión. Toma un momento.`
              : r.estado === "falló"
                ? "La transcripción quedó guardada. Puedes volver a intentarlo."
                : "Cuando la grabes o pegues lo que se dijo, el equipo la toma."}
          </Text>
          {r.estado !== "analizando" ? (
            <Boton texto="Ir a grabar" onPress={() => navigation.navigate("Grabar", { reunionId })} />
          ) : null}
        </View>
      </Pantalla>
    );
  }

  const balance = balanceDe(r);
  const avisos = loPrimero(r);
  const h = huecos(r.tareas);
  const sinDuenoNiFecha = new Set(h.sinNada.map((t) => t.id));

  const marcar = async (t: Tarea) => {
    await marcarTarea(t.id, !t.lista).catch(() => {});
    recargar();
  };

  return (
    <Pantalla>
      <View style={e.cabecera}>
        <View style={[e.marca, { backgroundColor: tenue(color.marca) }]}>
          <Icono nombre={r.rubro} tamano={19} tono={color.marca} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={tipo.detalle}>{equipo.nombre}</Text>
          <Text style={e.cabeceraDato}>{comoQuedo(balance)}</Text>
        </View>
      </View>

      {avisos.length > 0 ? (
        <View style={e.avisos}>
          {avisos.map((a) => (
            <View key={a} style={e.aviso}>
              <Icono nombre="aviso" tamano={17} tono={color.vivo} />
              <Text style={e.avisoTexto}>{a}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Encabezado texto="Qué se hizo" />
      <Text style={e.parrafo}>{r.resumen}</Text>

      {r.tareas.length > 0 ? (
        <>
          <Encabezado texto="Qué hay que hacer" />
          {ordenarTareas(r.tareas).map((t) => {
            const estado = estadoDeTarea(t);
            return (
              <Pressable key={t.id} accessibilityRole="checkbox"
                accessibilityState={{ checked: t.lista }}
                accessibilityLabel={t.lista ? `Desmarcar ${t.que}` : `Marcar ${t.que} como hecha`}
                disabled={!r.puedo_editar}
                onPress={() => void marcar(t)}
                style={({ pressed }) => [e.tarea, pressed ? { backgroundColor: color.elemento } : null]}>
                <Icono nombre={t.lista ? "listo" : "tareas"} tamano={19}
                  tono={t.lista ? color.ok : estado === "vencida" ? color.vivo : color.textoSuave} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[e.tareaTexto, t.lista ? e.tachada : null]}>{t.que}</Text>
                  <Text style={[
                    tipo.detalle,
                    estado === "vencida" ? { color: color.vivo } : null,
                  ]}>
                    {t.responsable ?? "sin responsable"} · {cuandoVence(t)}
                  </Text>
                </View>
                {sinDuenoNiFecha.has(t.id) ? (
                  <View style={e.pastillaHueco}>
                    <Text style={e.pastillaHuecoTexto}>EN EL AIRE</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </>
      ) : null}

      {r.puedo_editar ? (
        <View style={e.agregar}>
          <Campo placeholder="Agregar algo que quedó fuera" value={agregando}
            onChangeText={setAgregando} accessibilityLabel="Nueva tarea" />
          <Boton texto="Agregar" variante="suave"
            deshabilitado={agregando.trim().length === 0}
            onPress={() => {
              const que = agregando.trim();
              if (!que) return;
              setAgregando("");
              void agregarTarea(reunionId, que).then(recargar).catch(() => {});
            }} />
        </View>
      ) : null}

      {r.pendientes.length > 0 ? (
        <>
          <Encabezado texto="Qué quedó sin cerrar" />
          {r.pendientes.map((p) => (
            <View key={p.texto} style={e.punto}>
              <Icono nombre="pendiente" tamano={17} tono={color.ambar} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={e.puntoTexto}>{p.texto}</Text>
                {p.porque ? <Text style={tipo.detalle}>{p.porque}</Text> : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {r.sinTratar.length > 0 ? (
        <>
          <Encabezado texto="Qué no se alcanzó a tratar" />
          {r.sinTratar.map((s) => (
            <View key={s} style={e.punto}>
              <Icono nombre="reloj" tamano={17} tono={color.ambar} />
              <Text style={[e.puntoTexto, { flex: 1 }]}>{s}</Text>
            </View>
          ))}
        </>
      ) : null}

      {r.contradicciones.length > 0 ? (
        <>
          <Encabezado texto="Dónde no entendieron lo mismo" />
          {r.contradicciones.map((c) => (
            <View key={c} style={e.punto}>
              <Icono nombre="chocan" tamano={17} tono={color.vivo} />
              <Text style={[e.puntoTexto, { flex: 1 }]}>{c}</Text>
            </View>
          ))}
        </>
      ) : null}

      {r.aportes.length > 0 ? (
        <>
          <Encabezado texto="Qué llevar la próxima vez" />
          {r.aportes.map((a) => (
            <View key={a} style={e.punto}>
              <Icono nombre="idea" tamano={17} tono={color.marca} />
              <Text style={[e.puntoTexto, { flex: 1 }]}>{a}</Text>
            </View>
          ))}
        </>
      ) : null}

      {r.acuerdos.length > 0 ? (
        <>
          <Encabezado texto="Lo que se acordó" />
          {r.acuerdos.map((a) => (
            <View key={a.numero} style={e.acuerdo}>
              <Text style={e.acuerdoNumero}>{a.numero}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={e.puntoTexto}>{a.texto}</Text>
                {a.firme ? null : (
                  <View style={e.pastillaBlanda}>
                    <Text style={e.pastillaBlandaTexto}>SOLO PROPUESTO</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {r.participantes.length > 0 ? (
        <>
          <Encabezado texto="Quiénes estuvieron" />
          <Text style={e.parrafo}>{r.participantes.join(" · ")}</Text>
        </>
      ) : null}

      <View style={{ height: espacio.xl }} />
    </Pantalla>
  );
}

const e = StyleSheet.create({
  cabecera: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    padding: espacio.m, paddingTop: espacio.l,
  },
  marca: { width: 38, height: 38, borderRadius: radio.campo, alignItems: "center", justifyContent: "center" },
  cabeceraDato: { fontSize: 14, fontWeight: "600", color: color.texto },

  avisos: { marginHorizontal: espacio.m, gap: espacio.s },
  aviso: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    padding: espacio.m, backgroundColor: tenue(color.vivo), borderRadius: radio.tarjeta,
  },
  avisoTexto: { ...tipo.cuerpo, color: color.texto, flex: 1 },

  parrafo: {
    ...tipo.cuerpo, color: color.texto, lineHeight: 21,
    paddingHorizontal: espacio.m,
  },

  tarea: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  tareaTexto: { fontSize: 14.5, color: color.texto },
  tachada: { textDecorationLine: "line-through", color: color.textoSuave },
  pastillaHueco: {
    backgroundColor: tenue(color.ambar), borderRadius: radio.pastilla,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pastillaHuecoTexto: { fontSize: 9.5, fontWeight: "700", color: color.ambar, letterSpacing: 0.5 },

  agregar: { paddingHorizontal: espacio.m, paddingTop: espacio.m, gap: espacio.s },

  punto: {
    flexDirection: "row", alignItems: "flex-start", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 10,
  },
  puntoTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20 },

  acuerdo: {
    flexDirection: "row", alignItems: "flex-start", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 10,
  },
  acuerdoNumero: {
    width: 22, textAlign: "center", fontSize: 13, fontWeight: "700",
    color: color.marca, paddingTop: 1,
  },
  pastillaBlanda: {
    alignSelf: "flex-start", backgroundColor: color.elemento,
    borderRadius: radio.pastilla, paddingHorizontal: 8, paddingVertical: 3,
  },
  pastillaBlandaTexto: { fontSize: 9.5, fontWeight: "700", color: color.textoSuave, letterSpacing: 0.5 },

  esperando: { padding: espacio.xl, gap: espacio.m, alignItems: "center" },
  esperandoTitulo: { fontSize: 17, fontWeight: "600", color: color.texto, textAlign: "center" },
  esperandoTexto: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 21 },
});
