import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Boton, Campo, Cargando, Encabezado, Error, Hoja, Pantalla, Vacio,
} from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { FILETE, cifras, color, espacio, radio, tenue, tipo, velado } from "../../ui/tema.ts";
import {
  abrirSala, agregarTarea, cerrarSala, marcarTarea, quienSoy, reunionPorId,
} from "../../lib/consultas.ts";
import Sala from "./Sala.tsx";
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
          <View style={e.selloEquipo}>
            <Icono nombre="equipo" tamano={26} tono={color.marca} />
          </View>
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
            <View style={{ alignSelf: "stretch" }}>
              <Boton texto="Ir a grabar" onPress={() => navigation.navigate("Grabar", { reunionId })} />
            </View>
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
      {/* El encabezado del acta: de qué es, y cómo quedó en una línea. */}
      <View style={e.encabezadoActa}>
        <View style={e.baldosa}>
          <Icono nombre={r.rubro} tamano={19} tono={color.marca} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={tipo.etiqueta} numberOfLines={1}>{equipo.nombre}</Text>
          <Text style={e.balance}>{comoQuedo(balance)}</Text>
        </View>
      </View>

      {/* Un solo bloque, no tres cuadros rojos apilados: lo que exige
          moverse hoy se lee de una pasada o no se lee. */}
      {avisos.length > 0 ? (
        <Hoja ceñida style={e.hojaAvisos}>
          {avisos.map((a, i) => (
            <View key={a} style={[e.aviso, i > 0 ? e.conFilete : null]}>
              <View style={e.puntoAviso} />
              <Text style={e.avisoTexto}>{a}</Text>
            </View>
          ))}
        </Hoja>
      ) : null}

      <Encabezado texto="Qué se hizo" />
      <Hoja>
        <Text style={e.parrafo}>{r.resumen}</Text>
      </Hoja>

      {r.tareas.length > 0 ? (
        <>
          <Encabezado texto="Qué hay que hacer" />
          <Hoja ceñida>
            {ordenarTareas(r.tareas).map((t, i) => {
              const estado = estadoDeTarea(t);
              return (
                <Pressable key={t.id} accessibilityRole="checkbox"
                  accessibilityState={{ checked: t.lista }}
                  accessibilityLabel={t.lista ? `Desmarcar ${t.que}` : `Marcar ${t.que} como hecha`}
                  disabled={!r.puedo_editar}
                  onPress={() => void marcar(t)}
                  style={({ pressed }) => [
                    e.tarea, i > 0 ? e.conFilete : null,
                    pressed ? { backgroundColor: color.elemento } : null,
                  ]}>
                  <View style={[
                    e.casilla,
                    t.lista ? { backgroundColor: color.ok, borderColor: color.ok } : null,
                    !t.lista && estado === "vencida" ? { borderColor: color.vivo } : null,
                  ]}>
                    {t.lista ? <Icono nombre="listo" tamano={13} tono={color.sobreMarca} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[e.tareaTexto, t.lista ? e.tachada : null]}>{t.que}</Text>
                    <View style={e.tareaPie}>
                      <Text style={[tipo.detalle, !t.responsable ? { color: color.ambar } : null]}>
                        {t.responsable ?? "sin responsable"}
                      </Text>
                      <Text style={e.separador}>·</Text>
                      <Text style={[
                        tipo.detalle, cifras,
                        estado === "vencida" ? { color: color.vivo, fontWeight: "700" } : null,
                      ]}>
                        {cuandoVence(t)}
                      </Text>
                    </View>
                  </View>
                  {sinDuenoNiFecha.has(t.id) ? (
                    <View style={e.pastillaHueco}>
                      <Text style={e.pastillaHuecoTexto}>EN EL AIRE</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </Hoja>
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
          <Hoja ceñida>
            {r.pendientes.map((p, i) => (
              <View key={p.texto} style={[e.punto, i > 0 ? e.conFilete : null]}>
                <Icono nombre="pendiente" tamano={17} tono={color.ambar} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={e.puntoTexto}>{p.texto}</Text>
                  {p.porque ? <Text style={tipo.detalle}>{p.porque}</Text> : null}
                </View>
              </View>
            ))}
          </Hoja>
        </>
      ) : null}

      {r.sinTratar.length > 0 ? (
        <>
          <Encabezado texto="Qué no se alcanzó a tratar" />
          <Hoja ceñida>
            {r.sinTratar.map((s, i) => (
              <View key={s} style={[e.punto, i > 0 ? e.conFilete : null]}>
                <Icono nombre="reloj" tamano={17} tono={color.ambar} />
                <Text style={[e.puntoTexto, { flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </Hoja>
        </>
      ) : null}

      {r.contradicciones.length > 0 ? (
        <>
          <Encabezado texto="Dónde no entendieron lo mismo" />
          <Hoja ceñida>
            {r.contradicciones.map((c, i) => (
              <View key={c} style={[e.punto, i > 0 ? e.conFilete : null]}>
                <Icono nombre="chocan" tamano={17} tono={color.vivo} />
                <Text style={[e.puntoTexto, { flex: 1 }]}>{c}</Text>
              </View>
            ))}
          </Hoja>
        </>
      ) : null}

      {r.aportes.length > 0 ? (
        <>
          <Encabezado texto="Qué llevar la próxima vez" />
          <Hoja ceñida>
            {r.aportes.map((a, i) => (
              <View key={a} style={[e.punto, i > 0 ? e.conFilete : null]}>
                <Icono nombre="idea" tamano={17} tono={color.marca} />
                <Text style={[e.puntoTexto, { flex: 1 }]}>{a}</Text>
              </View>
            ))}
          </Hoja>
        </>
      ) : null}

      {/* Los acuerdos con el número colgando en el margen: es como se lee un
          acta, y hace que "el acuerdo 2" se pueda buscar con la vista. */}
      {r.acuerdos.length > 0 ? (
        <>
          <Encabezado texto="Lo que se acordó" />
          <Hoja ceñida>
            {r.acuerdos.map((a, i) => (
              <View key={a.numero} style={[e.acuerdo, i > 0 ? e.conFilete : null]}>
                <Text style={e.acuerdoNumero}>{a.numero}</Text>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={e.puntoTexto}>{a.texto}</Text>
                  {a.firme ? null : (
                    <View style={e.pastillaBlanda}>
                      <Text style={e.pastillaBlandaTexto}>SOLO PROPUESTO</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Hoja>
        </>
      ) : null}

      <Sala
        reunion={r}
        abrir={async () => { await abrirSala(reunionId); recargar(); }}
        cerrar={async () => { await cerrarSala(reunionId); recargar(); }}
      />

      {r.participantes.length > 0 ? (
        <>
          <Encabezado texto="Quiénes estuvieron" />
          <Hoja>
            <Text style={e.parrafo}>{r.participantes.join(" · ")}</Text>
          </Hoja>
        </>
      ) : null}
    </Pantalla>
  );
}

const e = StyleSheet.create({
  encabezadoActa: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.m,
  },
  baldosa: {
    width: 40, height: 40, borderRadius: radio.campo,
    alignItems: "center", justifyContent: "center",
    backgroundColor: tenue(color.marca),
  },
  balance: { ...tipo.cuerpo, ...cifras, fontSize: 15, fontWeight: "600", lineHeight: 21 },

  conFilete: { borderTopWidth: FILETE, borderTopColor: color.borde },

  hojaAvisos: { borderColor: velado(color.vivo) },
  aviso: {
    flexDirection: "row", alignItems: "center", gap: espacio.s + 2,
    paddingHorizontal: espacio.m, paddingVertical: 12,
    backgroundColor: tenue(color.vivo),
  },
  puntoAviso: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.vivo },
  avisoTexto: { ...tipo.cuerpo, flex: 1, fontWeight: "600" },

  parrafo: { ...tipo.cuerpo, lineHeight: 22 },

  tarea: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 13,
  },
  casilla: {
    width: 21, height: 21, borderRadius: 6,
    borderWidth: 1.4, borderColor: color.bordeFuerte,
    alignItems: "center", justifyContent: "center",
  },
  tareaTexto: { ...tipo.cuerpo, fontSize: 15 },
  tachada: { textDecorationLine: "line-through", color: color.textoTenue },
  tareaPie: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  separador: { ...tipo.detalle, color: color.textoTenue },
  pastillaHueco: {
    backgroundColor: tenue(color.ambar), borderRadius: radio.pastilla,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pastillaHuecoTexto: { fontSize: 9, fontWeight: "800", color: color.ambar, letterSpacing: 0.6 },

  agregar: { paddingHorizontal: espacio.m, paddingTop: espacio.m, gap: espacio.s },

  punto: {
    flexDirection: "row", alignItems: "flex-start", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 12,
  },
  puntoTexto: { ...tipo.cuerpo, lineHeight: 21 },

  acuerdo: {
    flexDirection: "row", alignItems: "flex-start", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 12,
  },
  acuerdoNumero: {
    ...cifras,
    width: 20, textAlign: "right", paddingTop: 1,
    fontSize: 14, fontWeight: "800", color: color.marca,
  },
  pastillaBlanda: {
    alignSelf: "flex-start", backgroundColor: color.elemento,
    borderRadius: radio.pastilla, paddingHorizontal: 8, paddingVertical: 3,
  },
  pastillaBlandaTexto: { fontSize: 9, fontWeight: "800", color: color.textoSuave, letterSpacing: 0.6 },

  esperando: { padding: espacio.xl, gap: espacio.m, alignItems: "center" },
  selloEquipo: {
    width: 58, height: 58, borderRadius: radio.tarjeta,
    alignItems: "center", justifyContent: "center",
    backgroundColor: tenue(color.marca),
    borderWidth: 1, borderColor: tenue(color.marca), borderStyle: "dashed",
  },
  esperandoTitulo: { ...tipo.subtitulo, textAlign: "center" },
  esperandoTexto: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 22 },
});
