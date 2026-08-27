import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Campo } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import { evaluacionesDe, materiaDe, misAsignaturas, misTareas } from "../../lib/consultas.ts";
import { avanceDe, cursoDe, entregasDe, notasDe } from "../../lib/datos-docente.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { usarDisposicion } from "../../lib/pantalla.ts";
import { usarPerfilDemo } from "../../lib/perfiles-demo.ts";
import { MODO_DEMO } from "../../lib/config.ts";
import {
  SUGERENCIAS, responder, type CursoParaElAsistente, type Respuesta,
} from "../../dominio/asistente-demo.ts";

type Burbuja = { mia: boolean; texto: string; filas?: string[] };

/**
 * El asistente del docente. Es el reverso del tutor del alumno: a un
 * estudiante nunca se le da la respuesta, porque el objetivo es que la
 * encuentre; a un docente se le da derecho, porque su problema no es aprender
 * sino no perder media hora cruzando planillas.
 */
export default function Asistente() {
  const { perfil } = usarPerfilDemo();
  const { anchoContenido } = usarDisposicion();
  const dicta = perfil?.dicta ?? [];

  const traer = useCallback(async (): Promise<CursoParaElAsistente[]> => {
    const asignaturas = await misAsignaturas();
    const mios = asignaturas.filter((a) => dicta.includes(a.id));

    return Promise.all(mios.map(async (ramo) => {
      const [inscritos, tareas, evaluaciones, avance] = await Promise.all([
        cursoDe(ramo.id), misTareas(ramo.id), evaluacionesDe(ramo.id), avanceDe(ramo.id),
      ]);
      await materiaDe(ramo.id);
      return {
        codigo: ramo.codigo,
        nombre: ramo.nombre,
        inscritos,
        avance,
        tareas: await Promise.all(tareas.map(async (t) => ({
          id: t.id, titulo: t.titulo, puntos: t.puntos, vence_en: t.vence_en,
          entregas: await entregasDe(t.id),
        }))),
        evaluaciones: await Promise.all(evaluaciones.map(async (ev) => ({
          id: ev.id, titulo: ev.titulo, peso: ev.peso, notas: await notasDe(ev.id),
        }))),
      };
    }));
  }, [dicta.join(",")]);

  const { datos, cargando } = usarCarga(traer, [dicta.join(",")]);

  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const preguntar = useCallback((texto: string) => {
    const pregunta = texto.trim();
    if (!pregunta || pensando || !datos) return;

    setBorrador("");
    setBurbujas((b) => [...b, { mia: true, texto: pregunta }]);
    setPensando(true);

    // En demostración la respuesta se calcula acá mismo. Con el servidor
    // conectado esta llamada va a la función `asistente`, que le pregunta a
    // Claude y además puede buscar en internet.
    setTimeout(() => {
      const r: Respuesta = responder(pregunta, datos);
      setBurbujas((b) => [...b, { mia: false, texto: r.texto, filas: r.filas }]);
      setPensando(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    }, 350);
  }, [datos, pensando]);

  if (cargando) {
    return (
      <View style={e.centrado}><ActivityIndicator color={color.marca} /></View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={[e.hilo, { maxWidth: Math.max(anchoContenido, 560) }]}
      >
        {burbujas.length === 0 ? (
          <View style={e.bienvenida}>
            <View style={e.marca}>
              <Icono nombre="tutor" tamano={22} tono={color.marca} />
            </View>
            <Text style={e.titulo}>Pregúntame por tu curso</Text>
            <Text style={e.bajada}>
              Te digo quién no ha entregado, quién viene quedándose atrás y qué
              te queda por corregir, sin que tengas que cruzar planillas.
            </Text>

            {SUGERENCIAS.map((s) => (
              <Pressable key={s} accessibilityRole="button" onPress={() => preguntar(s)}
                style={({ pressed }) => [e.sugerencia, pressed ? e.apretada : null]}>
                <Text style={e.sugerenciaTexto}>{s}</Text>
              </Pressable>
            ))}

            {MODO_DEMO ? (
              <Text style={e.aviso}>
                Sin servidor respondo con los datos que están en este aparato.
                Conectado, la pregunta va a Claude, que además puede buscar en
                internet.
              </Text>
            ) : null}
          </View>
        ) : null}

        {burbujas.map((b, i) => (
          <View key={i} style={[e.burbuja, b.mia ? e.mia : e.suya]}>
            <Text style={[e.texto, b.mia ? e.textoMio : null]}>{b.texto}</Text>
            {b.filas && b.filas.length > 0 ? (
              <View style={e.filas}>
                {b.filas.map((f, j) => (
                  <View key={j} style={e.fila}>
                    <Text style={e.vinneta}>·</Text>
                    <Text style={e.filaTexto}>{f}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {pensando ? (
          <View style={[e.burbuja, e.suya]}>
            <ActivityIndicator color={color.textoSuave} />
          </View>
        ) : null}
      </ScrollView>

      <View style={e.barra}>
        <Campo
          style={{ flex: 1 }}
          value={borrador}
          onChangeText={setBorrador}
          placeholder="¿Quién no ha entregado?"
          onSubmitEditing={() => preguntar(borrador)}
          returnKeyType="send"
          accessibilityLabel="Pregunta al asistente"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Preguntar"
          onPress={() => preguntar(borrador)}
          disabled={!borrador.trim() || pensando}
          style={[e.enviar, !borrador.trim() || pensando ? e.enviarApagado : null]}>
          <Icono nombre="adelante15" tamano={18} tono={color.sobreMarca} />
        </Pressable>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.fondo },
  hilo: { padding: espacio.m, gap: espacio.s, width: "100%", alignSelf: "center" },

  bienvenida: { alignItems: "flex-start", gap: espacio.s, paddingVertical: espacio.l },
  marca: {
    width: 44, height: 44, borderRadius: radio.pastilla, backgroundColor: tenue(color.marca),
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  titulo: { fontSize: 21, fontWeight: "600", color: color.texto },
  bajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 20, marginBottom: espacio.s },
  sugerencia: {
    alignSelf: "flex-start",
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.pastilla,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  apretada: { backgroundColor: color.elemento },
  sugerenciaTexto: { fontSize: 14, color: color.marca, fontWeight: "600" },
  aviso: {
    ...tipo.detalle, lineHeight: 18, marginTop: espacio.m,
    padding: espacio.m, backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },

  burbuja: { maxWidth: "88%", padding: espacio.m, borderRadius: radio.burbuja },
  mia: { alignSelf: "flex-end", backgroundColor: color.marca },
  suya: { alignSelf: "flex-start", backgroundColor: color.elemento },
  texto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20 },
  textoMio: { color: color.sobreMarca },

  filas: { marginTop: espacio.s, gap: 3 },
  fila: { flexDirection: "row", gap: 7 },
  vinneta: { color: color.textoSuave, fontSize: 14 },
  filaTexto: { flex: 1, ...tipo.cuerpo, color: color.texto, lineHeight: 19 },

  barra: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    padding: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.borde,
  },
  enviar: {
    width: 40, height: 40, borderRadius: radio.pastilla, backgroundColor: color.marca,
    alignItems: "center", justifyContent: "center",
  },
  enviarApagado: { opacity: 0.4 },
});
