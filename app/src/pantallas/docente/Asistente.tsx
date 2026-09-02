import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Campo } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { ReportarIA } from "../../ui/ReportarIA.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import {
  avanceDe, cursoDe, entregasDeVarias, evaluacionesDe, misAsignaturas, misTareas, notasDeVarias,
} from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { agrupadasPor } from "../../dominio/curso.ts";
import type { PropsPestanaDocente } from "../../lib/rutas.ts";
import { usarDisposicion } from "../../lib/pantalla.ts";
import { usarQuienSoy } from "../../lib/quien-soy.ts";
import { MODO_DEMO } from "../../lib/config.ts";
import { SUGERENCIAS, type CursoParaElAsistente } from "../../dominio/asistente-demo.ts";
import { preguntarAlAsistente, type Turno } from "../../lib/asistente.ts";

type Burbuja = { mia: boolean; texto: string; filas?: string[]; falla?: boolean };

/**
 * El asistente del docente. Es el reverso del tutor del alumno: a un
 * estudiante nunca se le da la respuesta, porque el objetivo es que la
 * encuentre; a un docente se le da derecho, porque su problema no es aprender
 * sino no perder media hora cruzando planillas.
 */
export default function Asistente({ route }: PropsPestanaDocente<"Asistente">) {
  // Se puede llegar acá con una pregunta ya escrita —desde el plan del mes,
  // por ejemplo—. Va al borrador y no se manda sola: quien pregunta tiene que
  // poder leerla y corregirla antes, sobre todo cuando trae un plan entero
  // adentro.
  const traida = route.params?.pregunta;
  const { yo } = usarQuienSoy();
  const { anchoContenido } = usarDisposicion();
  const dicta = yo?.dicta ?? [];

  // Conectado, los datos los busca la función con el token de quien pregunta.
  // Traerlos igual acá serían decenas de consultas —el curso, las tareas, las
  // entregas de cada tarea, las notas de cada evaluación, de cada ramo— para
  // dejarlas sin usar. Se piden solo cuando contesta el aparato.
  const traer = useCallback(async (): Promise<CursoParaElAsistente[]> => {
    if (!MODO_DEMO) return [];
    const asignaturas = await misAsignaturas();
    const mios = asignaturas.filter((a) => dicta.includes(a.id));

    return Promise.all(mios.map(async (ramo) => {
      // El curso primero: lo demás lo necesita y así se pide una sola vez.
      const inscritos = await cursoDe(ramo.id);
      const [tareas, evaluaciones, avance] = await Promise.all([
        misTareas(ramo.id), evaluacionesDe(ramo.id), avanceDe(ramo.id, inscritos),
      ]);
      // Todo junto y repartido acá. Esta pantalla era la peor de las tres:
      // pedía las entregas de cada tarea y las notas de cada evaluación de
      // cada ramo, así que el número de viajes al servidor era el total de
      // tareas y evaluaciones del semestre entero.
      const [entregas, notas] = await Promise.all([
        entregasDeVarias(tareas.map((t) => t.id), inscritos),
        notasDeVarias(evaluaciones.map((ev) => ev.id), inscritos),
      ]);
      const porTarea = agrupadasPor(entregas, (e) => e.tarea_id, tareas.map((t) => t.id));
      const porEvaluacion = agrupadasPor(notas, (n) => n.evaluacion_id, evaluaciones.map((e) => e.id));

      return {
        codigo: ramo.codigo,
        nombre: ramo.nombre,
        inscritos,
        avance,
        tareas: tareas.map((t) => ({
          id: t.id, titulo: t.titulo, puntos: t.puntos, vence_en: t.vence_en,
          entregas: porTarea.get(t.id) ?? [],
        })),
        evaluaciones: evaluaciones.map((ev) => ({
          id: ev.id, titulo: ev.titulo, peso: ev.peso, notas: porEvaluacion.get(ev.id) ?? [],
        })),
      };
    }));
  }, [dicta.join(",")]);

  const { datos, cargando } = usarCarga(traer, [dicta.join(",")]);

  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [borrador, setBorrador] = useState(traida ?? "");
  const [pensando, setPensando] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const preguntar = useCallback((texto: string) => {
    const pregunta = texto.trim();
    if (!pregunta || pensando) return;

    // La conversación que ya está en pantalla es la que viaja como contexto,
    // y se arma antes de agregar la pregunta nueva: el servidor la agrega él.
    const turnos: Turno[] = burbujas.map((b) => ({
      role: b.mia ? "user" : "assistant", content: b.texto,
    }));

    setBorrador("");
    setBurbujas((b) => [...b, { mia: true, texto: pregunta }]);
    setPensando(true);

    const alFinal = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);

    preguntarAlAsistente({ pregunta, turnos, cursos: datos ?? [] })
      .then((r) => {
        setBurbujas((b) => [...b, { mia: false, texto: r.texto, filas: r.filas }]);
      })
      .catch((e: unknown) => {
        // El error se dice en la conversación y no en una alerta: la pregunta
        // sigue ahí arriba, y así se ve a cuál de ellas no se pudo contestar.
        setBurbujas((b) => [...b, {
          mia: false,
          texto: e instanceof Error ? e.message : "El asistente no está disponible en este momento.",
          falla: true,
        }]);
      })
      .finally(() => {
        setPensando(false);
        alFinal();
      });
  }, [burbujas, datos, pensando]);

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
          <View key={i} style={[e.burbuja, b.mia ? e.mia : e.suya, b.falla ? e.rota : null]}>
            <Text style={[e.texto, b.mia ? e.textoMio : null, b.falla ? e.textoRoto : null]}>{b.texto}</Text>
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
            {/* Solo lo que contestó la IA. Ni las preguntas propias ni los
                avisos de que algo falló. */}
            {!b.mia && !b.falla
              ? <ReportarIA origen="asistente" contenido={b.texto} />
              : null}
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
  rota: { backgroundColor: tenue(color.vivo), borderColor: color.vivo },
  textoRoto: { color: color.vivo },
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
