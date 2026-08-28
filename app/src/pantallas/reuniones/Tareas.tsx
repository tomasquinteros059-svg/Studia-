import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cargando, Error, Hoja, Pantalla } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { FILETE, cifras, color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import { marcarTarea, misTareasDeTodas, quienSoy } from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import {
  cuandoVence, estadoDeTarea, huecos, misTareas, ordenarTareas,
} from "../../dominio/acta.ts";
import type { TareaConReunion } from "../../lib/tipos-reunion.ts";
import type { PropsPestana } from "../../lib/rutas.ts";

type Props = PropsPestana<"Tareas">;

const FILTROS = [
  { id: "mias", texto: "Mías" },
  { id: "todas", texto: "Todas" },
  { id: "aire", texto: "En el aire" },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

/**
 * Todas las tareas de todas las reuniones, en un solo lugar.
 *
 * "En el aire" es su propio filtro y no un detalle: son los compromisos que
 * quedaron sin dueño o sin fecha. Es la lista que hay que revisar antes de
 * que la reunión se enfríe, porque en dos semanas ya nadie se acuerda de
 * quién había dicho que lo hacía.
 */
export default function Tareas({ navigation }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("mias");

  const traer = useCallback(async () => {
    const [tareas, yo] = await Promise.all([misTareasDeTodas(), quienSoy()]);
    return { tareas, yo };
  }, []);

  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const { tareas, yo } = datos;
  const enElAire = new Set(huecos(tareas).sinNada.map((t) => t.id));

  const mostradas: TareaConReunion[] =
    filtro === "mias" ? (misTareas(tareas, yo) as TareaConReunion[])
    : filtro === "aire" ? ordenarTareas(tareas.filter((t) => enElAire.has(t.id))) as TareaConReunion[]
    : ordenarTareas(tareas) as TareaConReunion[];

  const marcar = async (t: TareaConReunion) => {
    await marcarTarea(t.id, !t.lista).catch(() => {});
    recargar();
  };

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={e.encabezado}>
        <Text style={e.titulo}>Tareas</Text>
      </View>

      {/* Un control segmentado y no fichas sueltas: son tres vistas de lo
          mismo, y un segmentado dice justamente eso. */}
      <View style={e.filtros}>
        {FILTROS.map((f) => {
          const activo = f.id === filtro;
          const cuantas = f.id === "mias" ? misTareas(tareas, yo).length
            : f.id === "aire" ? enElAire.size
            : tareas.filter((t) => !t.lista).length;
          return (
            <Pressable key={f.id} accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`${f.texto}, ${cuantas}`}
              onPress={() => setFiltro(f.id)}
              style={[e.chip, activo ? e.chipActivo : null]}>
              <Text style={[e.chipTexto, activo ? e.chipTextoActivo : null]}>
                {f.texto} {cuantas > 0 ? `· ${cuantas}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtro === "aire" ? (
        <Text style={e.pista}>
          Compromisos que quedaron sin nadie a cargo y sin fecha. Es lo que se
          pierde entre una reunión y la siguiente.
        </Text>
      ) : null}

      {mostradas.length === 0 ? (
        <Hoja>
          <Text style={e.vacio}>
            {filtro === "mias" ? "No tienes nada pendiente a tu nombre."
              : filtro === "aire" ? "Ningún compromiso quedó en el aire."
              : "No hay tareas todavía."}
          </Text>
        </Hoja>
      ) : (
        <Hoja ceñida>
        {mostradas.map((t, i) => {
          const estado = estadoDeTarea(t);
          return (
            <View key={t.id} style={[e.fila, i > 0 ? e.conFilete : null]}>
              <Pressable accessibilityRole="checkbox"
                accessibilityState={{ checked: t.lista }}
                accessibilityLabel={t.lista ? `Desmarcar ${t.que}` : `Marcar ${t.que} como hecha`}
                onPress={() => void marcar(t)} hitSlop={12}>
                <View style={[
                  e.casilla,
                  t.lista ? { backgroundColor: color.ok, borderColor: color.ok } : null,
                  !t.lista && estado === "vencida" ? { borderColor: color.vivo } : null,
                ]}>
                  {t.lista ? <Icono nombre="listo" tamano={13} tono={color.sobreMarca} /> : null}
                </View>
              </Pressable>
              <Pressable style={{ flex: 1, gap: 2 }} accessibilityRole="button"
                accessibilityLabel={`Ir a ${t.reunion}`}
                onPress={() => navigation.navigate("Reunion", { reunionId: t.reunion_id })}>
                <Text style={[e.filaTexto, t.lista ? e.tachada : null]}>{t.que}</Text>
                <Text style={tipo.detalle} numberOfLines={1}>{t.reunion}</Text>
                <Text style={[
                  tipo.detalle, cifras,
                  estado === "vencida" ? { color: color.vivo, fontWeight: "700" } : null,
                ]}>
                  {t.responsable ?? "sin responsable"} · {cuandoVence(t)}
                </Text>
              </Pressable>
            </View>
          );
        })}
        </Hoja>
      )}
      <View style={{ height: espacio.xl }} />
    </Pantalla>
  );
}

const e = StyleSheet.create({
  encabezado: { padding: espacio.m, paddingTop: espacio.l },
  titulo: { ...tipo.portada },

  filtros: {
    flexDirection: "row", marginHorizontal: espacio.m, padding: 3,
    backgroundColor: color.elemento, borderRadius: radio.boton,
  },
  chip: { flex: 1, borderRadius: radio.boton - 3, paddingVertical: 8, alignItems: "center" },
  chipActivo: { backgroundColor: color.papel },
  chipTexto: { ...cifras, fontSize: 13, color: color.textoSuave, fontWeight: "600" },
  chipTextoActivo: { color: color.texto, fontWeight: "700" },

  pista: { ...tipo.detalle, paddingHorizontal: espacio.m, paddingTop: espacio.m, lineHeight: 19 },
  vacio: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21 },

  conFilete: { borderTopWidth: FILETE, borderTopColor: color.borde },
  fila: {
    flexDirection: "row", alignItems: "flex-start", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 13,
  },
  casilla: {
    width: 21, height: 21, borderRadius: 6, marginTop: 1,
    borderWidth: 1.4, borderColor: color.bordeFuerte,
    alignItems: "center", justifyContent: "center",
  },
  filaTexto: { ...tipo.cuerpo, fontSize: 15 },
  tachada: { textDecorationLine: "line-through", color: color.textoTenue },
});
