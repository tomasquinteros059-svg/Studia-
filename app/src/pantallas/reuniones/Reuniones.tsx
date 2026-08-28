import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error, Hoja, Pantalla } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { FILETE, cifras, color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import {
  crearReunion, entrarConCodigo, misReuniones, misTareasDeTodas, quienSoy,
} from "../../lib/consultas.ts";
import { pedirPermiso, programarAvisos } from "../../lib/avisos.ts";
import { comoAgenda } from "../../lib/tipos-reunion.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { equipoDe } from "../../dominio/rubros.ts";
import { cuandoEs, comoSeRepite, estaAgendada } from "../../dominio/agenda.ts";
import { cuandoVence, estadoDeTarea, misTareas, ordenarTareas } from "../../dominio/acta.ts";
import type { PropsPestana } from "../../lib/rutas.ts";
import NuevaReunion from "./NuevaReunion.tsx";
import Entrar from "./Entrar.tsx";

type Props = PropsPestana<"Reuniones">;

export default function Reuniones({ navigation }: Props) {
  const [creando, setCreando] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const traer = useCallback(async () => {
    const [reuniones, tareas, yo] = await Promise.all([
      misReuniones(), misTareasDeTodas(), quienSoy(),
    ]);
    return { reuniones, tareas, yo };
  }, []);

  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const { reuniones, tareas, yo } = datos;
  const mias = ordenarTareas(misTareas(tareas, yo));
  const vencidas = mias.filter((t) => estadoDeTarea(t) === "vencida");

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      {/* La cabecera de un documento: primero de qué es, después el título. */}
      <View style={e.masthead}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={tipo.etiqueta}>{hoy()}</Text>
          <Text style={tipo.portada}>Mis reuniones</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Mi perfil"
          onPress={() => navigation.navigate("Perfil")} style={e.avatar}>
          <Icono nombre="perfil" tamano={22} tono={color.marca} />
        </Pressable>
      </View>

      <View style={e.acciones}>
        <Pressable accessibilityRole="button" accessibilityLabel="Nueva reunión"
          onPress={() => setCreando(true)}
          style={({ pressed }) => [e.grabar, pressed ? { backgroundColor: color.marcaOscura } : null]}>
          <Icono nombre="grabar" tamano={19} tono={color.sobreMarca} />
          <Text style={e.grabarTexto}>Nueva reunión</Text>
        </Pressable>

        {/* Grabó otro y a mí me dictaron el código. Es la mitad de los casos:
            en una sala con treinta personas graba una sola. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Entrar con un código"
          onPress={() => setEntrando(true)}
          style={({ pressed }) => [e.entrar, pressed ? { backgroundColor: color.elemento } : null]}>
          <Text style={e.entrarTexto}>Tengo un código</Text>
        </Pressable>
      </View>

      {mias.length > 0 ? (
        <>
          <Encabezado texto="Lo que me toca" accion={
            <Pressable accessibilityRole="button" accessibilityLabel="Ver todas mis tareas"
              onPress={() => navigation.navigate("Tareas")} hitSlop={8}>
              <Text style={e.enlace}>Ver todo</Text>
            </Pressable>} />

          <Hoja ceñida>
            {vencidas.length > 0 ? (
              <View style={e.alarma}>
                <View style={[e.marcaEstado, { backgroundColor: color.vivo }]} />
                <Text style={e.alarmaTexto}>
                  {vencidas.length === 1
                    ? "Tienes una tarea con el plazo vencido."
                    : `Tienes ${vencidas.length} tareas con el plazo vencido.`}
                </Text>
              </View>
            ) : null}
            {mias.slice(0, 3).map((t, i) => {
              const estado = estadoDeTarea(t);
              return (
                <View key={t.id} style={[e.tarea, i > 0 || vencidas.length > 0 ? e.conFilete : null]}>
                  <View style={[e.punto, {
                    backgroundColor: estado === "vencida" ? color.vivo
                      : estado === "hoy" ? color.ambar : color.bordeFuerte,
                  }]} />
                  <Text style={e.tareaTexto} numberOfLines={2}>{t.que}</Text>
                  <Text style={[e.plazo, estado === "vencida" ? { color: color.vivo, fontWeight: "700" } : null]}>
                    {cuandoVence(t)}
                  </Text>
                </View>
              );
            })}
          </Hoja>
        </>
      ) : null}

      <Encabezado texto={reuniones.length === 0 ? "Reuniones" : `Reuniones · ${reuniones.length}`} />

      {reuniones.length === 0 ? (
        <Hoja>
          <Text style={e.vacio}>
            Graba una reunión y el equipo la escucha, la redacta y te dice qué
            quedó por hacer.
          </Text>
        </Hoja>
      ) : (
        <Hoja ceñida>
          {reuniones.map((r, i) => {
            const abiertas = tareas.filter((t) => t.reunion_id === r.id && !t.lista).length;
            const agendada = r.estado === "borrador" && estaAgendada(comoAgenda(r));
            return (
              <Pressable key={r.id} accessibilityRole="button"
                accessibilityLabel={`Abrir ${r.titulo}`}
                onPress={() => navigation.navigate("Reunion", { reunionId: r.id })}
                style={({ pressed }) => [
                  e.fila, i > 0 ? e.conFilete : null,
                  pressed ? { backgroundColor: color.elemento } : null,
                ]}>
                <View style={e.baldosa}>
                  <Icono nombre={r.rubro} tamano={18} tono={color.marca} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={tipo.fila} numberOfLines={2}>{r.titulo}</Text>
                  <Text style={tipo.detalle} numberOfLines={1}>
                    {equipoDe(r.rubro).nombre}
                  </Text>
                  <Text style={[e.pie, agendada ? { color: color.marca } : null]}>
                    {agendada
                      ? `Agendada ${cuandoEs(comoAgenda(r))}${r.repite === "nunca" ? "" : ` · ${comoSeRepite(r.repite)}`}`
                      : r.estado !== "listo"
                        ? ESTADO[r.estado]
                        : abiertas === 0
                          ? `Nada pendiente · ${fecha(r.ocurrio_en)}`
                          : `${abiertas} ${abiertas === 1 ? "tarea pendiente" : "tareas pendientes"} · ${fecha(r.ocurrio_en)}`}
                  </Text>
                </View>
                {r.estado === "listo" && abiertas > 0 ? (
                  <View style={e.cuenta}>
                    <Text style={e.cuentaTexto}>{abiertas}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Hoja>
      )}

      <Entrar
        abierto={entrando}
        cerrar={() => setEntrando(false)}
        entrar={async (codigo) => {
          const id = await entrarConCodigo(codigo);
          if (id !== null) {
            await recargar();
            navigation.navigate("Reunion", { reunionId: id });
          }
          return id;
        }}
      />

      <NuevaReunion
        abierta={creando}
        cerrar={() => setCreando(false)}
        crear={async (nueva) => {
          const r = await crearReunion(nueva);
          if (r.programada_para !== null) {
            // Agendada: se dejan los avisos puestos y se vuelve a la lista.
            // Llevarla a grabar ahora sería justo lo contrario de agendarla.
            await pedirPermiso();
            await programarAvisos(r.id, r.titulo, comoAgenda(r));
            await recargar();
            return;
          }
          await recargar();
          navigation.navigate("Grabar", { reunionId: r.id });
        }}
      />
    </Pantalla>
  );
}

const ESTADO = {
  borrador: "Sin grabar todavía",
  grabando: "Grabando",
  analizando: "El equipo está trabajando…",
  listo: "Listo",
  falló: "No se pudo analizar",
} as const;

/** "jueves 28 de agosto" */
function hoy(): string {
  return new Date().toLocaleDateString("es-CL",
    { weekday: "long", day: "numeric", month: "long" });
}

/** "28 ago" */
function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

const e = StyleSheet.create({
  masthead: {
    flexDirection: "row", alignItems: "flex-start", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.m,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    backgroundColor: tenue(color.marca),
  },

  acciones: { flexDirection: "row", gap: espacio.s, paddingHorizontal: espacio.m },
  grabar: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: espacio.s,
    paddingVertical: 14, backgroundColor: color.marca, borderRadius: radio.boton,
  },
  grabarTexto: { color: color.sobreMarca, fontSize: 15, fontWeight: "700", letterSpacing: -0.1 },
  entrar: {
    justifyContent: "center", paddingHorizontal: espacio.m, paddingVertical: 14,
    borderWidth: FILETE, borderColor: color.bordeFuerte,
    borderRadius: radio.boton, backgroundColor: color.papel,
  },
  entrarTexto: { color: color.marca, fontSize: 14, fontWeight: "600" },

  enlace: { color: color.marca, fontWeight: "700", fontSize: 12.5 },

  conFilete: { borderTopWidth: FILETE, borderTopColor: color.borde },

  alarma: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingVertical: 11,
    backgroundColor: tenue(color.vivo),
  },
  marcaEstado: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  alarmaTexto: { ...tipo.cuerpo, flex: 1, fontWeight: "600" },

  tarea: {
    flexDirection: "row", alignItems: "center", gap: espacio.s + 2,
    paddingHorizontal: espacio.m, paddingVertical: 12,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
  tareaTexto: { ...tipo.cuerpo, flex: 1 },
  plazo: { ...tipo.detalle, ...cifras, color: color.textoTenue },

  vacio: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21 },

  fila: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 14,
  },
  baldosa: {
    width: 40, height: 40, borderRadius: radio.campo,
    alignItems: "center", justifyContent: "center",
    backgroundColor: tenue(color.marca),
  },
  pie: { ...tipo.detalle, ...cifras },
  cuenta: {
    minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6,
    alignItems: "center", justifyContent: "center",
    backgroundColor: color.elemento,
  },
  cuentaTexto: { ...cifras, fontSize: 12.5, fontWeight: "700", color: color.textoSuave },
});
