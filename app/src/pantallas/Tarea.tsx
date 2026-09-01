import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Boton, Cargando, Error, Pantalla, Pastilla } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { color, espacio, fechaYHora, radio, tipo } from "../ui/tema.ts";
import { entregarTarea, tareaPorId } from "../lib/consultas.ts";
import {
  AVISO_SIN_ALMACENAMIENTO, HAY_ALMACENAMIENTO, direccionFirmada, elegirArchivo,
  sePuedeElegirArchivo, subir, type AdjuntoElegido,
} from "../lib/archivos.ts";
import { detalleDe, revisar } from "../dominio/adjuntos.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { cuandoVence, estadoDeTarea } from "../dominio/tareas.ts";
import { alTutor, type PropsPila } from "../lib/rutas.ts";

export default function Tarea({ route, navigation }: PropsPila<"Tarea">) {
  const { tareaId } = route.params;
  const [entregando, setEntregando] = useState(false);
  const [adjunto, setAdjunto] = useState<AdjuntoElegido | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const traer = useCallback(() => tareaPorId(tareaId), [tareaId]);

  const { datos: tarea, cargando, error, recargar } = usarCarga(traer, [tareaId]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!tarea) return <Error mensaje="No encontré esa tarea." />;

  const estado = estadoDeTarea(tarea);
  const entregada = estado === "entregada";

  /** Elegir qué se entrega. El archivo se sube recién al entregar. */
  async function elegir() {
    setAviso(null);
    const elegido = await elegirArchivo();
    if (!elegido) return;

    const revision = revisar(elegido);
    if (!revision.ok) { setAviso(revision.motivo); setAdjunto(null); return; }

    setAdjunto(elegido);
    // Se dice de inmediato y no al tocar Entregar: descubrir que no se podía
    // después de haber elegido el archivo es la peor manera de enterarse.
    if (!HAY_ALMACENAMIENTO) setAviso(AVISO_SIN_ALMACENAMIENTO);
  }

  function entregar() {
    if (!tarea) return;
    const conArchivo = adjunto !== null && HAY_ALMACENAMIENTO;
    Alert.alert(
      "Entregar tarea",
      conArchivo
        ? `¿Entregar «${tarea.titulo}» con ${adjunto!.nombre}?`
        : `¿Entregar «${tarea.titulo}» sin adjuntar nada?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Entregar",
          onPress: async () => {
            setEntregando(true);
            setAviso(null);
            try {
              let ruta: string | undefined;
              if (conArchivo) {
                // A la carpeta de la tarea, no al espacio propio. Una entrega
                // existe para que la lea quien corrige, y en «yo/» solo la
                // vería quien la subió. Tampoco va a la del ramo: lo que uno
                // entrega no es material de clase y el curso no lo ve.
                const r = await subir(adjunto!, { tipo: "entrega", tareaId: tarea.id });
                // Si el archivo no subió, la entrega no se registra: dejarla
                // como entregada sin lo que se entregaba es peor que no
                // entregarla, porque nadie se entera hasta la corrección.
                if (!r.ok) { setAviso(r.motivo); return; }
                ruta = r.url;
              }
              await entregarTarea(tarea.id, ruta);
              setAdjunto(null);
              recargar();
            } catch (err) {
              Alert.alert("No pude entregarla", err instanceof globalThis.Error ? err.message : "");
            } finally {
              setEntregando(false);
            }
          },
        },
      ],
    );
  }

  async function abrirLoEntregado() {
    const donde = await direccionFirmada(tarea?.entregado ?? null);
    if (!donde) {
      Alert.alert("No pude abrirlo", "El archivo ya no está disponible.");
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(donde);
    } catch {
      Alert.alert("No pude abrirlo", "Tu teléfono no encontró con qué abrirlo.");
    }
  }

  return (
    <Pantalla>
      <View style={e.cabecera}>
        <Text style={e.titulo}>{tarea.titulo}</Text>
        <View style={e.estado}>
          <Pastilla
            texto={entregada ? "ENTREGADA" : estado === "atrasada" ? "ATRASADA" : "PENDIENTE"}
            tono={entregada ? "ok" : estado === "atrasada" ? "atrasada" : "pendiente"} />
          <Text style={tipo.detalle}>{cuandoVence(tarea)}</Text>
        </View>
      </View>

      <View style={e.datos}>
        <Dato etiqueta="Entrega" valor={fechaYHora(tarea.vence_en)} />
        <Dato etiqueta="Puntos" valor={`${tarea.puntos}`} />
        {tarea.puntos_obtenidos !== null ? (
          <Dato etiqueta="Obtenido" valor={`${tarea.puntos_obtenidos} / ${tarea.puntos}`} />
        ) : null}
      </View>

      <Text style={e.enunciado}>{tarea.enunciado}</Text>

      {tarea.criterios.length > 0 ? (
        <View style={e.criterios}>
          <Text style={tipo.etiqueta}>Se evalúa</Text>
          {tarea.criterios.map((c, i) => (
            <View key={i} style={e.criterio}>
              <Text style={e.vinneta}>·</Text>
              <Text style={e.criterioTexto}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={e.acciones}>
        {!entregada ? (
          <>
            {sePuedeElegirArchivo ? (
              <Pressable accessibilityRole="button" style={e.adjuntar} onPress={() => void elegir()}
                accessibilityLabel="Adjuntar un archivo a la entrega">
                <Icono nombre="documento" tamano={18} tono={color.textoSuave} />
                <Text style={e.adjuntarTexto} numberOfLines={1}>
                  {adjunto ? adjunto.nombre : "Adjuntar un archivo"}
                </Text>
                {adjunto ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Quitar el archivo"
                    hitSlop={10} onPress={() => { setAdjunto(null); setAviso(null); }}>
                    <Icono nombre="cerrar" tamano={17} tono={color.textoSuave} />
                  </Pressable>
                ) : null}
              </Pressable>
            ) : null}
            {adjunto ? <Text style={tipo.detalle}>{detalleDe(adjunto)}</Text> : null}
            {aviso ? <Text style={e.aviso}>{aviso}</Text> : null}

            <Boton
              texto={entregando ? "Entregando…" : "Entregar tarea"}
              onPress={entregar}
              deshabilitado={entregando}
            />
          </>
        ) : tarea.entregado ? (
          <Pressable accessibilityRole="button" style={e.adjuntar} onPress={() => void abrirLoEntregado()}
            accessibilityLabel="Ver lo que entregué">
            <Icono nombre="documento" tamano={18} tono={color.marca} />
            <Text style={[e.adjuntarTexto, { color: color.marca }]}>Ver lo que entregué</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" style={e.tutor}
          onPress={() => navigation.navigate(...alTutor(tarea.asignatura_id, `Estoy con «${tarea.titulo}».`))}>
          <Text style={e.tutorTexto}>Pedir guía al tutor</Text>
        </Pressable>
        <Text style={e.nota}>
          El tutor no la resuelve por ti: te ayuda a encontrar el camino.
        </Text>
      </View>
    </Pantalla>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={tipo.etiqueta}>{etiqueta}</Text>
      <Text style={e.datoValor}>{valor}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  cabecera: {
    padding: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  titulo: { fontSize: 19, fontWeight: "600", color: color.texto, lineHeight: 25 },
  estado: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: espacio.s },
  datos: {
    flexDirection: "row", gap: 10, padding: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  datoValor: { fontSize: 14, fontWeight: "600", color: color.texto, marginTop: 3 },
  enunciado: { ...tipo.cuerpo, color: color.texto, lineHeight: 22, padding: espacio.m },
  criterios: { paddingHorizontal: espacio.m, paddingBottom: espacio.m, gap: 6 },
  criterio: { flexDirection: "row", gap: 8 },
  vinneta: { color: color.textoSuave, fontSize: 14 },
  criterioTexto: { flex: 1, ...tipo.cuerpo, color: color.texto, lineHeight: 21 },
  acciones: { padding: espacio.m, gap: 9 },
  adjuntar: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton,
    paddingVertical: espacio.m, paddingHorizontal: espacio.m,
  },
  adjuntarTexto: { flex: 1, fontSize: 15, fontWeight: "600", color: color.textoSuave },
  aviso: { ...tipo.detalle, color: color.texto, lineHeight: 19 },
  tutor: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton,
    paddingVertical: espacio.m, alignItems: "center",
  },
  tutorTexto: { fontSize: 15, fontWeight: "600", color: color.textoSuave },
  nota: { ...tipo.detalle, textAlign: "center", lineHeight: 19 },
});
