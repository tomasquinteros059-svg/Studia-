import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Boton } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { FILETE, cifras, color, colorDeRamo, espacio, letra, radio, sombra, tipo } from "../ui/tema.ts";
import { pedirMicrofono, permisoDeMicrofono } from "../lib/audio.ts";
import { disponible as hayDictado, escuchar } from "../../modules/voz/index.ts";
import {
  armarLaClase, cuantosEscuchan, empezarAEscuchar, subirTramos, tramosDeLaClase,
} from "../lib/consultas.ts";
import { comoQuedo, comoReloj, unir, type Acordado } from "../dominio/escucha.ts";
import { estadoDesdePermiso } from "../dominio/microfono.ts";
import type { TramoOido } from "../lib/tipos.ts";
import type { PropsPila } from "../lib/rutas.ts";

/** Cada cuánto se manda lo oído. */
const CADA = 15_000;

/**
 * El modo escucha: la clase presencial, oída por el curso.
 *
 * Lo que hace este teléfono es transcribir en el propio aparato y subir texto.
 * El audio no sale de acá y no se guarda en ninguna parte: se descarta a
 * medida que se reconoce. Guardar la voz de treinta personas para no usarla
 * sería cargar con un riesgo a cambio de nada, y el texto es todo lo que el
 * resumen necesita.
 *
 * Que oigan varios no es redundancia: ninguno oye bien la clase entera. El de
 * adelante pierde la pregunta de atrás, al de atrás le llega la profesora
 * lejos. Al terminar se cruzan las versiones y queda una sola clase, que es lo
 * que hace `dominio/escucha.ts`.
 */
export default function Escucha({ route, navigation }: PropsPila<"Escucha">) {
  const { claseId, titulo, asignaturaId } = route.params;
  const marca = colorDeRamo(asignaturaId, undefined);

  const [oyendo, setOyendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [mio, setMio] = useState<TramoOido[]>([]);
  const [enElAire, setEnElAire] = useState("");
  const [aparatos, setAparatos] = useState(1);
  const [armando, setArmando] = useState(false);
  const [clase, setClase] = useState<Acordado[] | null>(null);
  const [falla, setFalla] = useState<string | null>(null);

  const escuchaId = useRef<string | null>(null);
  const detener = useRef<(() => void) | null>(null);
  const sinSubir = useRef<TramoOido[]>([]);
  const arranque = useRef(0);

  // ── El reloj de la clase ──────────────────────────────────────────────
  useEffect(() => {
    if (!oyendo) return;
    const reloj = setInterval(() => setSegundos(Math.round((Date.now() - arranque.current) / 1000)), 1000);
    return () => clearInterval(reloj);
  }, [oyendo]);

  // ── Subir de a tandas, no tramo por tramo ─────────────────────────────
  //
  // Una llamada por frase serían cientos en una clase, con la batería y los
  // datos de treinta personas encima. De a quince segundos alcanza para que
  // el curso vea la cuenta subir y no se pierde nada si la app se cierra.
  const mandar = useCallback(async () => {
    const pendientes = sinSubir.current;
    if (pendientes.length === 0 || !escuchaId.current) return;
    sinSubir.current = [];
    try {
      await subirTramos(claseId, escuchaId.current, pendientes);
    } catch {
      // Se devuelven a la cola: perder un tramo por un bache de red sería
      // perder ese pedazo de clase para todo el curso.
      sinSubir.current = [...pendientes, ...sinSubir.current];
    }
  }, [claseId]);

  useEffect(() => {
    if (!oyendo) return;
    const tanda = setInterval(() => void mandar(), CADA);
    return () => clearInterval(tanda);
  }, [oyendo, mandar]);

  // ── Cuántos están oyendo ──────────────────────────────────────────────
  useEffect(() => {
    if (!oyendo) return;
    let vigente = true;
    const mirar = () => {
      void cuantosEscuchan(claseId)
        .then((n) => { if (vigente) setAparatos(Math.max(1, n)); })
        .catch(() => {});
    };
    mirar();
    const cada = setInterval(mirar, 20_000);
    return () => { vigente = false; clearInterval(cada); };
  }, [oyendo, claseId]);

  // Al salir se suelta el micrófono. El reconocedor se lo queda tomado si no
  // se le dice que pare, y el teléfono queda con el punto rojo encendido.
  useEffect(() => () => { detener.current?.(); }, []);

  const empezar = async () => {
    setFalla(null);
    if (!hayDictado()) {
      setFalla(
        "Este aparato no puede transcribir. Necesita el reconocimiento de voz "
        + "de Android, que no está en el navegador ni en iPhone.",
      );
      return;
    }

    // Si la consulta del permiso falla, se sigue como si no lo tuviéramos: es
    // el camino que igual termina preguntando, en vez de darlo por perdido.
    const NEGADO = { granted: false, canAskAgain: true };
    const yaTengo = estadoDesdePermiso(await permisoDeMicrofono().catch(() => NEGADO) ?? NEGADO);
    if (yaTengo !== "concedido") {
      const dado = estadoDesdePermiso(await pedirMicrofono().catch(() => NEGADO) ?? NEGADO);
      if (dado !== "concedido") {
        setFalla("Sin permiso del micrófono no se puede oír la clase.");
        return;
      }
    }

    try {
      escuchaId.current = await empezarAEscuchar(claseId, nombreDeAparato());
    } catch (e) {
      setFalla(e instanceof Error ? e.message : "No pude ponerte a oír la clase.");
      return;
    }

    arranque.current = Date.now();
    setSegundos(0);
    setOyendo(true);

    detener.current = escuchar({
      alParcial: (texto) => setEnElAire(texto),
      alTexto: (texto, confianza) => {
        const t: TramoOido = {
          segundo: Math.round((Date.now() - arranque.current) / 1000),
          texto, confianza,
        };
        setEnElAire("");
        setMio((previos) => [...previos, t]);
        sinSubir.current = [...sinSubir.current, t];
      },
      alError: (e) => {
        setFalla(e.mensaje);
        setOyendo(false);
        detener.current?.();
        detener.current = null;
      },
    });
  };

  const terminar = async () => {
    detener.current?.();
    detener.current = null;
    setOyendo(false);
    setEnElAire("");
    setArmando(true);
    try {
      await mandar();
      const todos = await tramosDeLaClase(claseId);
      const armada = unir(todos);
      await armarLaClase(claseId, armada.map((a) => ({ segundo: a.segundo, texto: a.texto })));
      setClase(armada);
    } catch (e) {
      Alert.alert("No pude armar la clase", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setArmando(false);
    }
  };

  if (clase) {
    return (
      <ScrollView style={e.pantalla} contentContainerStyle={e.dentro}>
        <View style={e.listo}>
          <Icono nombre="listo" tamano={24} tono={color.ok} />
          <Text style={e.listoTexto}>La clase quedó escrita</Text>
        </View>
        <Text style={e.comoQuedo}>{comoQuedo(clase, aparatos)}</Text>

        <View style={e.hoja}>
          {clase.map((a, i) => (
            <View key={`${a.segundo}-${i}`} style={e.linea}>
              <Text style={[e.reloj, cifras]}>{comoReloj(a.segundo)}</Text>
              <Text style={e.dicho}>{a.texto}</Text>
              {a.votos > 1 ? (
                <Text style={e.votos}>{a.votos}/{a.deCuantos}</Text>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={e.pie}>
          El audio no se guardó en ninguna parte: cada teléfono lo transcribió
          adentro y lo fue soltando. Esto es lo que queda.
        </Text>

        <Boton texto="Volver al ramo" onPress={() => navigation.goBack()} variante="suave" />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={e.pantalla} contentContainerStyle={e.dentro}>
      <View style={e.cabeza}>
        <Text style={e.titulo} numberOfLines={2}>{titulo}</Text>
        <View style={e.sello}><Text style={e.selloTexto}>en sala</Text></View>
      </View>

      {oyendo ? (
        <View style={e.oyendo}>
          <Latido />
          <View style={{ flex: 1 }}>
            <Text style={e.oyendoTitulo}>Escuchando la clase</Text>
            <Text style={e.oyendoDetalle}>
              {aparatos > 1
                ? `Tu teléfono y ${aparatos - 1} más del curso`
                : "Por ahora, solo tu teléfono"}
            </Text>
          </View>
          <Text style={[e.contador, cifras]}>{comoReloj(segundos)}</Text>
        </View>
      ) : null}

      {falla ? (
        <View style={e.falla}>
          <Icono nombre="aviso" tamano={18} tono={color.vivo} />
          <Text style={e.fallaTexto}>{falla}</Text>
        </View>
      ) : null}

      {oyendo ? (
        <View style={e.hoja}>
          <Text style={tipo.etiqueta}>Lo que va oyendo tu teléfono</Text>
          {mio.length === 0 && !enElAire ? (
            <Text style={e.nada}>Todavía nada. Empieza cuando alguien hable.</Text>
          ) : null}
          {mio.slice(-8).map((t, i) => (
            <View key={`${t.segundo}-${i}`} style={e.linea}>
              <Text style={[e.reloj, cifras]}>{comoReloj(t.segundo)}</Text>
              <Text style={e.dicho}>{t.texto}</Text>
            </View>
          ))}
          {enElAire ? (
            <View style={e.linea}>
              <Text style={[e.reloj, cifras]} />
              <Text style={[e.dicho, e.enElAire]}>{enElAire}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={e.hoja}>
          <Text style={e.explica}>
            El teléfono oye la clase y la va escribiendo <Text style={e.fuerte}>aquí adentro</Text>:
            el sonido no se guarda ni sale del aparato. Lo que sube es el texto.
          </Text>
          <Text style={e.explica}>
            Mientras más gente del curso escuche, mejor queda: ninguno oye bien
            la clase entera, y al terminar se cruzan las versiones para dejar
            una sola.
          </Text>
          <Text style={e.aMano}>quien faltó recibe esta misma clase ↷</Text>
        </View>
      )}

      {oyendo ? (
        <Boton
          texto={armando ? "Armando la clase…" : "Terminar y armar la clase"}
          onPress={() => void terminar()}
          deshabilitado={armando}
        />
      ) : (
        <Boton texto="Escuchar esta clase" onPress={() => void empezar()} />
      )}

      <Text style={e.pie}>
        No separa quién habló: el reconocedor entrega una sola corriente de
        texto. Poner «profesora» o «alumno» sería atribuirle a alguien algo que
        no se sabe que dijo.
      </Text>
    </ScrollView>
  );
}

/** El punto rojo. Que la sala vea que la sala está grabando. */
function Latido() {
  const vivo = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(vivo, { toValue: 0.25, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(vivo, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [vivo]);
  return <Animated.View style={[e.punto, { opacity: vivo }]} />;
}

/**
 * Cómo se llama este aparato para la clase.
 *
 * Un identificador por sesión y no el nombre de la persona: lo que hace falta
 * es no votar dos veces con el mismo teléfono, no saber de quién es cada voz.
 */
let nombrePuesto: string | null = null;
function nombreDeAparato(): string {
  nombrePuesto ??= `ap-${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}`;
  return nombrePuesto;
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  dentro: { padding: espacio.m, gap: espacio.m },

  cabeza: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  titulo: { ...tipo.titulo, flex: 1 },
  sello: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.pastilla,
    backgroundColor: color.destacador, paddingHorizontal: 10, paddingVertical: 2,
  },
  selloTexto: { fontSize: 11.5, fontWeight: "700", color: color.texto, letterSpacing: 0.3 },

  oyendo: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.tarjeta,
    backgroundColor: color.destacadoSuave, padding: espacio.m,
  },
  punto: { width: 12, height: 12, borderRadius: 999, backgroundColor: color.vivo },
  oyendoTitulo: { fontSize: 15, fontWeight: "700", color: color.texto },
  oyendoDetalle: { ...tipo.detalle, marginTop: 1 },
  contador: { fontSize: 16, fontWeight: "700", color: color.texto },

  falla: {
    flexDirection: "row", gap: espacio.s, alignItems: "flex-start",
    borderWidth: FILETE, borderColor: color.vivo, borderRadius: radio.tarjeta,
    backgroundColor: color.papel, padding: espacio.m,
  },
  fallaTexto: { ...tipo.cuerpo, flex: 1, fontSize: 14, lineHeight: 21 },

  hoja: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.tarjeta,
    backgroundColor: color.papel, padding: espacio.m, gap: espacio.s,
    boxShadow: sombra(3),
  },
  explica: { ...tipo.cuerpo, fontSize: 14.5, lineHeight: 22 },
  fuerte: { fontWeight: "700" },
  aMano: { fontFamily: letra.mano, fontSize: 19, color: color.anotacion, marginTop: 2 },
  nada: { ...tipo.detalle },

  linea: { flexDirection: "row", gap: espacio.s, alignItems: "flex-start" },
  reloj: { fontSize: 12, color: color.textoTenue, minWidth: 42, paddingTop: 3 },
  dicho: { ...tipo.cuerpo, flex: 1, fontSize: 14.5, lineHeight: 21 },
  enElAire: { color: color.textoTenue, fontStyle: "italic" },
  votos: { fontSize: 11.5, fontWeight: "700", color: color.ok, paddingTop: 4 },

  listo: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  listoTexto: { ...tipo.titulo, fontSize: 20 },
  comoQuedo: { ...tipo.detalle, lineHeight: 20 },

  pie: { ...tipo.detalle, lineHeight: 20 },
});
