import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AVISO_SIN_AUDIO, hayAudioNativo, usarEstadoDelReproductor, usarReproductor,
} from "../lib/audio.ts";
import { Encabezado, Fila, Pantalla, Vacio } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { color, duracion, espacio, fechaCorta, radio, tipo } from "../ui/tema.ts";
import { capitulosDe } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { alTutor, type PropsPila } from "../lib/rutas.ts";

const VELOCIDADES = [1, 1.25, 1.5, 2] as const;

export default function Grabacion({ route, navigation }: PropsPila<"Grabacion">) {
  const { claseId, titulo, fecha, duracionSeg, audioUrl, asignaturaId } = route.params;

  const traer = useCallback(() => capitulosDe(claseId), [claseId]);
  const { datos: capitulos } = usarCarga(traer, [claseId]);

  const reproductor = usarReproductor(audioUrl ?? null);
  const estado = usarEstadoDelReproductor(reproductor);
  const [velocidad, setVelocidad] = useState<number>(1);

  const hayAudio = Boolean(audioUrl) && hayAudioNativo;
  // Mientras el audio no ha cargado, la duración la sabemos por la base.
  const total = estado.duration > 0 ? estado.duration : duracionSeg ?? 0;
  const avance = total > 0 ? Math.min(1, estado.currentTime / total) : 0;

  function saltarA(segundo: number) {
    if (!hayAudio) return;
    void reproductor.seekTo(segundo);
  }

  return (
    <Pantalla>
      <View style={e.hero}>
        <Text style={tipo.etiqueta}>{fecha ? fechaCorta(fecha) : ""}</Text>
        <Text style={e.titulo}>{titulo}</Text>
        <Text style={tipo.detalle}>
          {duracionSeg ? duracion(duracionSeg) : ""} · audio
        </Text>
      </View>

      {!hayAudio ? (
        <View style={e.aviso}>
          <Text style={e.avisoTexto}>
            {hayAudioNativo
              ? "Esta clase todavía no tiene el audio subido. Puedes revisar los capítulos para saber qué se trató."
              : AVISO_SIN_AUDIO}
          </Text>
        </View>
      ) : null}

      <View style={e.barraExterior}>
        <View style={[e.barraInterior, { width: `${avance * 100}%` }]} />
      </View>
      <View style={e.tiempos}>
        <Text style={tipo.detalle}>{duracion(Math.floor(estado.currentTime))}</Text>
        <Text style={tipo.detalle}>{duracion(Math.floor(total))}</Text>
      </View>

      <View style={e.controles}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retroceder 15 segundos"
          disabled={!hayAudio} onPress={() => saltarA(Math.max(0, estado.currentTime - 15))}
          style={({ pressed }) => (pressed || !hayAudio) && { opacity: 0.4 }}>
          <Icono nombre="atras15" tamano={26} />
        </Pressable>

        <Pressable accessibilityRole="button"
          accessibilityLabel={estado.playing ? "Pausar" : "Reproducir"}
          disabled={!hayAudio}
          onPress={() => (estado.playing ? reproductor.pause() : reproductor.play())}
          style={({ pressed }) => [e.principal, (pressed || !hayAudio) && { opacity: 0.5 }]}>
          <Icono nombre={estado.playing ? "pausar" : "reproducir"} tamano={26} tono="#fff" />
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Avanzar 15 segundos"
          disabled={!hayAudio} onPress={() => saltarA(Math.min(total, estado.currentTime + 15))}
          style={({ pressed }) => (pressed || !hayAudio) && { opacity: 0.4 }}>
          <Icono nombre="adelante15" tamano={26} />
        </Pressable>
      </View>

      <View style={e.velocidades}>
        {VELOCIDADES.map((v) => {
          const activa = v === velocidad;
          return (
            <Pressable key={v} accessibilityRole="button" disabled={!hayAudio}
              onPress={() => { setVelocidad(v); reproductor.setPlaybackRate(v); }}
              style={[e.velocidad, activa && { backgroundColor: color.marca, borderColor: color.marca }]}>
              <Text style={[e.velocidadTexto, activa && { color: color.sobreMarca, fontWeight: "600" }]}>
                {String(v).replace(".", ",")}×
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Encabezado texto="Capítulos" />
      {(capitulos ?? []).length === 0
        ? <Vacio texto="Esta clase no tiene capítulos marcados." />
        : (capitulos ?? []).map((c) => (
            <Fila key={c.id}
              izquierda={<Icono nombre="reloj" />}
              titulo={c.titulo}
              derecha={<Text style={tipo.detalle}>{duracion(c.segundo)}</Text>}
              onPress={() => saltarA(c.segundo)}
            />
          ))}

      <View style={{ padding: espacio.m }}>
        <Pressable accessibilityRole="button" style={e.preguntar}
          onPress={() => navigation.navigate(...alTutor(asignaturaId, `Estoy viendo «${titulo}».`))}>
          <Text style={e.preguntarTexto}>Preguntar al tutor sobre esta clase</Text>
        </Pressable>
      </View>
    </Pantalla>
  );
}

const e = StyleSheet.create({
  hero: { alignItems: "center", padding: espacio.l, gap: 4 },
  titulo: { fontSize: 18, fontWeight: "600", color: color.texto, textAlign: "center" },
  aviso: {
    marginHorizontal: espacio.m, padding: 12, borderRadius: radio.tarjeta,
    backgroundColor: color.elemento,
  },
  avisoTexto: { ...tipo.detalle, lineHeight: 19 },
  barraExterior: {
    height: 5, borderRadius: 3, backgroundColor: color.elemento,
    marginHorizontal: espacio.m, marginTop: espacio.m, overflow: "hidden",
  },
  barraInterior: { height: "100%", backgroundColor: color.marca },
  tiempos: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: espacio.m, marginTop: 6 },
  controles: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 26, paddingVertical: espacio.m },
  principal: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: color.marca,
    alignItems: "center", justifyContent: "center",
  },
  velocidades: { flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: espacio.m },
  velocidad: { borderWidth: 1, borderColor: color.borde, borderRadius: radio.pastilla, paddingHorizontal: 10, paddingVertical: 4 },
  velocidadTexto: { fontSize: 11.5, color: color.textoSuave },
  preguntar: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton,
    paddingVertical: espacio.m, alignItems: "center",
  },
  preguntarTexto: { fontSize: 15, fontWeight: "600", color: color.textoSuave },
});
