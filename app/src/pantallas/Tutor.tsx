import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Boton, Campo, Cargando, Error as ErrorUI } from "../ui/componentes.tsx";
import { ReportarIA } from "../ui/ReportarIA.tsx";
import {
  FILETE, color, colorDeRamo, espacio, inicialesDeRamo, letra, radio, sombra, tipo,
} from "../ui/tema.ts";
import { materiaDe, misAsignaturas, misQuices, misTareas } from "../lib/consultas.ts";
import { preguntarAlTutor } from "../lib/tutor.ts";
import { fallasDelUltimoQuiz, sugerenciasDe } from "../dominio/sugerencias.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPestana } from "../lib/rutas.ts";
import type { Asignatura } from "../lib/tipos.ts";

type Props = PropsPestana<"Tutor">;
type Burbuja = { rol: "estudiante" | "tutor"; texto: string };

/**
 * El tutor: la conversación, con un ramo a la vez.
 *
 * Es el único agente de StudIA, y conviene decirlo acá porque la pantalla
 * podría dar a entender que hay varios. Hay uno, y hace una cosa: preguntar
 * de vuelta hasta que la respuesta la encuentres tú. Lo que en otras
 * aplicaciones serían más agentes, acá son pantallas: el planificador es el
 * horario, el evaluador es el quiz. Un menú de personajes que en el fondo son
 * botones sería un disfraz, y uno que se nota.
 *
 * Lo que sí cambia entre conversaciones es el ramo, y por eso el ramo es lo
 * que se elige a la izquierda: el tutor toma su color, su material y su
 * pregunta de apertura.
 */
export default function Tutor({ navigation, route }: Props) {
  const margenes = useSafeAreaInsets();
  const { ancho } = usarDisposicion();
  const [elegida, setElegida] = useState<Asignatura | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const contexto = route.params?.contexto ?? null;
  const pedida = route.params?.asignaturaId;

  const traer = useCallback(async () => {
    const [asignaturas, tareas, quices] = await Promise.all([
      misAsignaturas(), misTareas(), misQuices(),
    ]);
    return { asignaturas, tareas, quices };
  }, []);
  const { datos, cargando, error, recargar } = usarCarga(traer, []);

  // El material del ramo elegido, para poder proponer un tema concreto. Se
  // pide aparte porque cambia al cambiar de ramo y no vale la pena traerlo
  // todo de una: son seis ramos y solo se mira uno.
  const traerMateria = useCallback(
    async () => (elegida ? await materiaDe(elegida.id) : []),
    [elegida],
  );
  const { datos: modulos } = usarCarga(traerMateria, [elegida?.id]);

  // El tutor no tiene color propio: toma el del ramo del que se está
  // hablando, para que se note de qué se está hablando sin leer nada.
  const tono = elegida ? colorDeRamo(elegida.id, elegida.color) : color.marca;

  // Al entrar (o al cambiar de ramo) la conversación arranca de nuevo, con la
  // pregunta de apertura del ramo.
  const abrir = useCallback((a: Asignatura) => {
    setElegida(a);
    setConversacionId(null);
    setBurbujas([{ rol: "tutor", texto: a.intro_tutor }]);
    setFallo(null);
  }, []);

  useEffect(() => {
    const lista = datos?.asignaturas;
    if (!lista?.length || elegida) return;
    abrir(lista.find((a) => a.id === pedida) ?? lista[0]!);
  }, [datos, elegida, pedida, abrir]);

  async function enviar(texto = borrador) {
    const limpio = texto.trim();
    if (!limpio || !elegida || pensando) return;

    setBorrador("");
    setFallo(null);
    setBurbujas((b) => [...b, { rol: "estudiante", texto: limpio }]);
    setPensando(true);

    try {
      const r = await preguntarAlTutor({
        asignaturaId: elegida.id,
        mensaje: limpio,
        conversacionId,
        contexto,
      });
      setConversacionId(r.conversacionId);
      setBurbujas((b) => [...b, { rol: "tutor", texto: r.respuesta }]);
    } catch (e) {
      setFallo(e instanceof globalThis.Error ? e.message : "El tutor no respondió.");
    } finally {
      setPensando(false);
    }
  }

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;

  const asignaturas = datos?.asignaturas ?? [];
  // Recién acá cabe la lista de ramos al lado sin apretar la conversación.
  const conColumna = ancho >= 980;

  // El primer día no hay ningún ramo, y el tutor sin ramo no tiene de qué
  // hablar: no sabe qué estás estudiando ni con qué material. Sin esto la
  // pantalla quedaba con el sello «?», la conversación en blanco y un campo
  // de texto que no llevaba a ninguna parte.
  if (asignaturas.length === 0) {
    return (
      <View style={e.sinRamos}>
        <View style={[e.selloVacio, { backgroundColor: color.marca }]}>
          <Text style={e.selloTexto}>?</Text>
        </View>
        <Text style={e.tituloVacio}>El tutor necesita saber qué estás estudiando</Text>
        <Text style={e.bajadaVacia}>
          No da respuestas: te devuelve preguntas hasta que llegues tú. Para eso
          tiene que conocer tu ramo y su material.
        </Text>
        <Boton texto="Empezar por un ramo" onPress={() => navigation.navigate("Inicio")} />
        <Text style={e.notaVacia}>
          En Inicio puedes pegar tu horario completo, crear un ramo o subir el
          primer material. Con cualquiera de las tres, el tutor ya tiene de qué
          hablar.
        </Text>
      </View>
    );
  }

  // Las sugerencias salen de lo que a esta persona le pasó en este ramo. Solo
  // se muestran mientras no haya conversación: una vez que se está hablando,
  // proponer temas nuevos interrumpe.
  const sugerencias = elegida && burbujas.length <= 1
    ? sugerenciasDe({
        fallas: fallasDelUltimoQuiz(datos?.quices ?? [], elegida.id),
        pendientes: (datos?.tareas ?? []).filter(
          (t) => t.asignatura_id === elegida.id && t.entregada_en === null,
        ),
        temas: (modulos ?? [])
          .filter((m) => m.materiales.some((x) => !x.completado))
          .map((m) => ({ titulo: m.titulo })),
      })
    : [];

  const listaDeRamos = (
    <ListaDeRamos ramos={asignaturas} elegida={elegida} abrir={abrir} enColumna={conColumna} />
  );

  return (
    <KeyboardAvoidingView
      style={e.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={margenes.top + 44}
    >
      <View style={[e.marco, conColumna ? e.marcoAncho : null]}>
        {conColumna ? <View style={e.columna}>{listaDeRamos}</View> : listaDeRamos}

        <View style={[e.conversacion, conColumna ? e.conversacionAncha : null]}>
          <View style={e.cabeza}>
            <View style={[e.sello, { backgroundColor: tono }]}>
              <Text style={e.selloTexto}>
                {elegida ? inicialesDeRamo(elegida.nombre) : "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {/* El nombre primero. Con la anotación arriba se leía «te
                  pregunta / El Tutor», que es el sujeto después del verbo: la
                  frase quedaba dada vuelta. Una anotación a mano va debajo de
                  lo que anota, además, que es donde uno la escribiría. */}
              <Text style={e.nombre} numberOfLines={1}>El Tutor</Text>
              <Text style={e.papel} numberOfLines={1}>
                {conColumna ? "te pregunta de vuelta" : "te pregunta"}
              </Text>
            </View>
            {elegida ? (
              <View style={e.contextoChip}>
                <Text style={e.contextoTexto} numberOfLines={1}>
                  {elegida.nombre} · con su material
                </Text>
              </View>
            ) : null}
          </View>

          <ScrollView ref={scroll} style={{ flex: 1 }}
            contentContainerStyle={e.hilo}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            {contexto ? <Text style={e.contextoSuelto}>{contexto}</Text> : null}

            {burbujas.map((b, i) => (
              <View key={i} style={[e.burbuja, b.rol === "estudiante" ? e.mia : e.suya]}>
                {b.rol === "tutor" ? <Text style={e.quien}>Tutor:</Text> : null}
                <Text style={e.burbujaTexto}>{b.texto}</Text>
                {/* La primera burbuja es la presentación que escribió quien
                    dicta el ramo, no la escribió la IA: no hay nada que
                    reportarle. */}
                {b.rol === "tutor" && i > 0
                  ? <ReportarIA origen="tutor" contenido={b.texto} />
                  : null}
              </View>
            ))}

            {pensando ? <Text style={e.escribiendo}>escribiendo…</Text> : null}
            {fallo ? <Text style={e.fallo}>{fallo}</Text> : null}
          </ScrollView>

          {sugerencias.length > 0 ? (
            <View style={e.sugerencias}>
              {sugerencias.map((s) => (
                <Pressable key={s} accessibilityRole="button" accessibilityLabel={s}
                  onPress={() => void enviar(s)}
                  style={({ pressed }) => [
                    e.sugerencia,
                    pressed ? { borderStyle: "solid", borderColor: tono } : null,
                  ]}>
                  <Text style={e.sugerenciaTexto} numberOfLines={1}>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* El margen de abajo es lo que impedía escribirle al tutor: la app
              dibuja de borde a borde y la barra de gestos del sistema tapaba
              el campo entero. */}
          <View style={[e.compositor, { paddingBottom: espacio.s + (conColumna ? 0 : margenes.bottom) }]}>
            <Campo
              style={{ flex: 1 }}
              placeholder="Escríbele al Tutor…"
              accessibilityLabel="Tu mensaje"
              value={borrador}
              onChangeText={setBorrador}
              onSubmitEditing={() => void enviar()}
              returnKeyType="send"
              multiline
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Enviar"
              onPress={() => void enviar()} disabled={pensando || !borrador.trim()}
              style={({ pressed }) => [
                e.enviar,
                pressed ? e.enviarApretado : null,
                (pensando || !borrador.trim()) ? { opacity: 0.45 } : null,
              ]}>
              {pensando
                ? <ActivityIndicator size="small" color={color.sobreMarca} />
                : <Text style={e.enviarTexto}>Enviar</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Los ramos ─────────────────────────────────────────────────────────────

/**
 * De qué ramo se está hablando.
 *
 * En una pantalla ancha es una columna con una tarjeta por ramo, donde caben
 * el color y el código. En una angosta es la misma lista tendida, que es lo
 * único que cabe sin comerse la conversación.
 */
function ListaDeRamos({
  ramos, elegida, abrir, enColumna,
}: {
  ramos: Asignatura[];
  elegida: Asignatura | null;
  abrir: (a: Asignatura) => void;
  enColumna: boolean;
}) {
  const contenido = ramos.map((a) => {
    const activa = a.id === elegida?.id;
    const suyo = colorDeRamo(a.id, a.color);
    return (
      <Pressable key={a.id} accessibilityRole="tab" accessibilityState={{ selected: activa }}
        accessibilityLabel={`Hablar de ${a.nombre}`}
        onPress={() => abrir(a)}
        style={({ pressed }) => [
          enColumna ? e.tarjetaRamo : e.chip,
          activa ? e.ramoActivo : null,
          pressed ? { borderColor: suyo } : null,
        ]}>
        <View style={[e.puntoRamo, { backgroundColor: suyo }]} />
        <View style={{ flex: enColumna ? 1 : undefined, minWidth: 0 }}>
          <Text style={[e.ramoTexto, activa ? e.ramoTextoActivo : null]} numberOfLines={1}>
            {a.nombre}
          </Text>
          {enColumna ? <Text style={e.ramoCodigo}>{a.codigo}</Text> : null}
        </View>
      </Pressable>
    );
  });

  if (enColumna) {
    return (
      <>
        <Text style={[tipo.etiqueta, { marginBottom: espacio.s }]}>De qué ramo</Text>
        {contenido}
      </>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.chips}
      contentContainerStyle={e.chipsDentro}>
      {contenido}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  sinRamos: {
    flex: 1, backgroundColor: color.fondo, alignItems: "center", justifyContent: "center",
    gap: espacio.m, padding: espacio.l,
  },
  selloVacio: {
    width: 54, height: 54, borderRadius: radio.tarjeta, borderWidth: FILETE,
    borderColor: color.bordeFuerte, alignItems: "center", justifyContent: "center",
  },
  tituloVacio: { ...tipo.titulo, textAlign: "center" },
  bajadaVacia: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", maxWidth: 340 },
  notaVacia: { ...tipo.detalle, color: color.textoSuave, textAlign: "center", maxWidth: 340 },

  pantalla: { flex: 1, backgroundColor: color.fondo },
  marco: { flex: 1 },
  marcoAncho: {
    flexDirection: "row", gap: espacio.l,
    padding: espacio.l, width: "100%", maxWidth: 1180, alignSelf: "center",
  },
  columna: { width: 250, gap: espacio.s },

  // ── Los ramos ──
  chips: {
    flexGrow: 0, backgroundColor: color.papel,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  chipsDentro: { gap: espacio.s, paddingHorizontal: espacio.m, paddingVertical: espacio.m },
  chip: {
    flexDirection: "row", alignItems: "center", gap: espacio.s, maxWidth: 230,
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 8,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  tarjetaRamo: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    borderRadius: radio.campo, paddingHorizontal: espacio.m, paddingVertical: 12,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  // El destacador marca dónde estás, igual que en el planificador: no es el
  // color de ningún ramo, es la marca de «acá».
  ramoActivo: { backgroundColor: color.destacador, boxShadow: sombra(3) },
  puntoRamo: { width: 9, height: 9, borderRadius: 999 },
  ramoTexto: { fontSize: 14.5, fontWeight: "600", color: color.textoSuave, flexShrink: 1 },
  ramoTextoActivo: { color: color.texto, fontWeight: "700" },
  ramoCodigo: { ...tipo.detalle, fontSize: 11.5, marginTop: 1 },

  // ── La conversación ──
  conversacion: { flex: 1, minWidth: 0 },
  conversacionAncha: {
    backgroundColor: color.papel, borderRadius: 18,
    borderWidth: FILETE, borderColor: color.bordeFuerte,
    overflow: "hidden", boxShadow: sombra(5),
  },
  cabeza: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: espacio.s + 2,
    backgroundColor: color.fondo,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  sello: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: FILETE, borderColor: color.bordeFuerte,
    alignItems: "center", justifyContent: "center",
  },
  selloTexto: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: -0.4 },
  // El papel del agente, escrito a mano: es lo que hace la cabecera en vez de
  // una barra de título más.
  papel: { fontFamily: letra.mano, fontSize: 19, color: color.anotacion, lineHeight: 20 },
  nombre: { ...tipo.subtitulo, fontSize: 16 },
  contextoChip: {
    maxWidth: 260, borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 4,
    backgroundColor: color.papel, borderWidth: 1.5, borderColor: color.bordeFuerte,
  },
  contextoTexto: { ...tipo.detalle, fontSize: 12, fontWeight: "600" },

  hilo: { padding: espacio.m, gap: espacio.s },
  contextoSuelto: {
    alignSelf: "center", ...tipo.detalle, backgroundColor: color.elemento,
    paddingHorizontal: espacio.m, paddingVertical: 6,
    borderRadius: radio.pastilla, overflow: "hidden",
  },

  burbuja: {
    maxWidth: "84%", paddingHorizontal: espacio.m, paddingVertical: 11,
    borderRadius: radio.burbuja, borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  mia: {
    alignSelf: "flex-end", backgroundColor: color.destacadoSuave,
    borderBottomRightRadius: 5,
  },
  suya: { alignSelf: "flex-start", backgroundColor: color.papel, borderBottomLeftRadius: 5 },
  quien: { fontFamily: letra.mano, fontSize: 18, color: color.anotacion, marginBottom: 1 },
  burbujaTexto: { fontSize: 15.5, lineHeight: 23, color: color.texto },

  escribiendo: { ...tipo.detalle, fontStyle: "italic", paddingLeft: espacio.xs },
  fallo: { ...tipo.detalle, color: color.vivo, textAlign: "center" },

  // ── Lo que se puede preguntar ──
  sugerencias: {
    flexDirection: "row", flexWrap: "wrap", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingBottom: espacio.s,
  },
  sugerencia: {
    maxWidth: "100%",
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderStyle: "dashed",
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 5,
  },
  sugerenciaTexto: { fontSize: 12.5, fontWeight: "600", color: color.textoSuave },

  compositor: {
    flexDirection: "row", alignItems: "flex-end", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingTop: espacio.s,
    backgroundColor: color.fondo,
    borderTopWidth: FILETE, borderTopColor: color.bordeFuerte,
  },
  enviar: {
    borderRadius: radio.campo, paddingHorizontal: 18, height: 46,
    alignItems: "center", justifyContent: "center",
    backgroundColor: color.marca,
    borderWidth: FILETE, borderColor: color.bordeFuerte, boxShadow: sombra(3),
  },
  enviarApretado: {
    transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: sombra(0),
  },
  enviarTexto: { color: color.sobreMarca, fontWeight: "700", fontSize: 15 },
});
