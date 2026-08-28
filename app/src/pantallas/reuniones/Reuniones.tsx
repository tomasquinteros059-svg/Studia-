import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Encabezado, Error, Pantalla } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import {
  crearReunion, entrarConCodigo, misReuniones, misTareasDeTodas, quienSoy,
} from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { equipoDe } from "../../dominio/rubros.ts";
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
      <View style={e.saludo}>
        <View style={{ flex: 1 }}>
          <Text style={e.hola}>Mis reuniones</Text>
          <Text style={tipo.detalle}>
            {reuniones.length === 0
              ? "Todavía no has grabado ninguna."
              : `${reuniones.length} ${reuniones.length === 1 ? "reunión" : "reuniones"}`}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Mi perfil"
          onPress={() => navigation.navigate("Perfil")} style={{ padding: 5 }}>
          <Icono nombre="perfil" tamano={24} />
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Nueva reunión"
        onPress={() => setCreando(true)}
        style={({ pressed }) => [e.grabar, pressed ? { opacity: 0.85 } : null]}>
        <Icono nombre="grabar" tamano={22} tono={color.sobreMarca} />
        <Text style={e.grabarTexto}>Nueva reunión</Text>
      </Pressable>

      {/* Grabó otro y a mí me dictaron el código. Es la mitad de los casos:
          en una sala con treinta personas graba una sola. */}
      <Pressable accessibilityRole="button" accessibilityLabel="Entrar con un código"
        onPress={() => setEntrando(true)}
        style={({ pressed }) => [e.entrar, pressed ? { backgroundColor: color.elemento } : null]}>
        <Icono nombre="equipo" tamano={18} tono={color.marca} />
        <Text style={e.entrarTexto}>Entrar con un código</Text>
      </Pressable>

      {mias.length > 0 ? (
        <>
          <Encabezado texto="Lo que me toca" accion={
            <Pressable accessibilityRole="button" accessibilityLabel="Ver todas mis tareas"
              onPress={() => navigation.navigate("Tareas")}>
              <Text style={e.enlace}>Ver todo</Text>
            </Pressable>} />
          {vencidas.length > 0 ? (
            <View style={e.alarma}>
              <Icono nombre="aviso" tamano={18} tono={color.vivo} />
              <Text style={e.alarmaTexto}>
                {vencidas.length === 1
                  ? "Tienes una tarea con el plazo vencido."
                  : `Tienes ${vencidas.length} tareas con el plazo vencido.`}
              </Text>
            </View>
          ) : null}
          {mias.slice(0, 3).map((t) => (
            <View key={t.id} style={e.tarea}>
              <Icono nombre="tareas" tamano={17}
                tono={estadoDeTarea(t) === "vencida" ? color.vivo : color.textoSuave} />
              <View style={{ flex: 1 }}>
                <Text style={e.tareaTexto}>{t.que}</Text>
                <Text style={[tipo.detalle, estadoDeTarea(t) === "vencida" ? { color: color.vivo } : null]}>
                  {cuandoVence(t)}
                </Text>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Encabezado texto="Reuniones" />
      {reuniones.length === 0 ? (
        <Text style={e.vacio}>
          Graba una reunión y el equipo la escucha, la redacta y te dice qué
          quedó por hacer.
        </Text>
      ) : (
        reuniones.map((r) => {
          const abiertas = tareas.filter((t) => t.reunion_id === r.id && !t.lista).length;
          return (
            <Pressable key={r.id} accessibilityRole="button"
              accessibilityLabel={`Abrir ${r.titulo}`}
              onPress={() => navigation.navigate("Reunion", { reunionId: r.id })}
              style={({ pressed }) => [e.fila, pressed ? { backgroundColor: color.elemento } : null]}>
              <View style={[e.marca, { backgroundColor: tenue(color.marca) }]}>
                <Icono nombre={r.rubro} tamano={19} tono={color.marca} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={e.filaTitulo}>{r.titulo}</Text>
                <Text style={tipo.detalle}>
                  {equipoDe(r.rubro).nombre} · {fecha(r.ocurrio_en)}
                </Text>
                <Text style={tipo.detalle}>
                  {r.estado !== "listo"
                    ? ESTADO[r.estado]
                    : abiertas === 0
                      ? "Nada pendiente"
                      : `${abiertas} ${abiertas === 1 ? "tarea pendiente" : "tareas pendientes"}`}
                </Text>
              </View>
            </Pressable>
          );
        })
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

/** "lunes 1 de septiembre". */
function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL",
    { weekday: "long", day: "numeric", month: "long" });
}

const e = StyleSheet.create({
  saludo: { flexDirection: "row", alignItems: "flex-start", padding: espacio.m, paddingTop: espacio.l },
  hola: { fontSize: 22, fontWeight: "600", color: color.texto },
  grabar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: espacio.s,
    marginHorizontal: espacio.m, paddingVertical: 14,
    backgroundColor: color.marca, borderRadius: radio.boton,
  },
  grabarTexto: { color: color.sobreMarca, fontSize: 15, fontWeight: "700" },
  entrar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: espacio.s,
    marginHorizontal: espacio.m, marginTop: espacio.s, paddingVertical: 12,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton,
  },
  entrarTexto: { color: color.marca, fontSize: 14, fontWeight: "600" },
  enlace: { color: color.marca, fontWeight: "600", fontSize: 12.5 },
  alarma: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    marginHorizontal: espacio.m, padding: espacio.m,
    backgroundColor: tenue(color.vivo), borderRadius: radio.tarjeta,
  },
  alarmaTexto: { ...tipo.cuerpo, color: color.texto, flex: 1 },
  tarea: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 11,
  },
  tareaTexto: { fontSize: 14, color: color.texto },
  vacio: { ...tipo.detalle, paddingHorizontal: espacio.m, lineHeight: 20 },
  fila: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  marca: { width: 38, height: 38, borderRadius: radio.campo, alignItems: "center", justifyContent: "center" },
  filaTitulo: { fontSize: 15, fontWeight: "600", color: color.texto },
});
