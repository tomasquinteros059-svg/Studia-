import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Easing, Linking, NativeModules, Platform,
  Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icono } from "../ui/Icono.tsx";
import { LETRAS, pintaDe } from "../dominio/quiz.ts";
import { espacio, letra } from "../ui/tema.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { VERSION_VISIBLE } from "../lib/version.ts";
import { HojaModal } from "../ui/componentes.tsx";
import { VistaLegal, TITULO_LEGAL, type Cual } from "./Legal.tsx";
import { aviso } from "../dominio/legales.ts";
import { PROVEEDORES, type Proveedor } from "../dominio/acceso-proveedores.ts";
import { entrarCon } from "../lib/proveedores.ts";
import {
  MONEDAS, PLANES, monedaDeIdioma, monedaPorCodigo, precioDe, referencia,
  type Moneda, type Plan,
} from "../dominio/precios.ts";

// ── La paleta de la portada ───────────────────────────────────────────────

/**
 * Vive acá y no en el tema porque es de esta pantalla y de ninguna otra. El
 * tema de la aplicación no tiene azul de marca a propósito: adentro el color
 * es de los ramos.
 */
const p = {
  papel: "#FBFAF5",
  papelHondo: "#F2F0E6",
  tinta: "#171C3F",
  azul: "#2F45D4",
  azulClaro: "#CFD5F6",
  destacador: "#FFE14D",
  destacadoSuave: "#FFF2AF",
  verde: "#1FA97C",
  verdeClaro: "#A9E6CE",
  rojo: "#E4574B",
  gris: "#6B6F85",
  raya: "rgba(47,69,212,0.13)",
} as const;

const ANCHO_MAXIMO = 1120;
const BORDE = 2;


/**
 * La portada: lo primero que se ve al abrir StudIA.
 *
 * Es la única superficie de la aplicación que tiene paleta propia, y vale la
 * pena decir por qué, porque parece contradecir la regla que ordena todo lo
 * demás —el color siempre significa un ramo—. No la contradice: la portada
 * está *afuera* de la aplicación. Acá todavía no hay ramos que distinguir, y
 * lo que hay que hacer es que alguien que no conoce esto entienda qué es en
 * cinco segundos y quiera entrar. Cruzando la puerta, el color vuelve a
 * significar una sola cosa y esta paleta no aparece nunca más.
 *
 * El vocabulario es de cuaderno: papel cuadriculado, tinta azul, destacador
 * amarillo y anotaciones al margen con letra manuscrita. Nada de eso es
 * decoración suelta: es de lo que está hecha la materia de un estudiante, que
 * es de lo que trata la aplicación.
 */
export default function Portada({
  entrar, sinServidor,
}: {
  entrar: () => void;
  /**
   * No hay con quién autenticarse. Lo decide quien abre la portada, no ella:
   * así se puede dibujar y probar en los dos casos sin depender de cómo esté
   * configurado el arranque.
   */
  sinServidor?: boolean;
}) {
  const { ancho } = usarDisposicion();
  const margenes = useSafeAreaInsets();
  const [entrando, setEntrando] = useState<Proveedor | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  /** Cuál de los textos legales está abierto, o null si ninguno. */
  const [legal, setLegal] = useState<Cual | null>(null);

  // Para que los enlaces de arriba lleven a alguna parte de verdad. Cada
  // sección anota dónde quedó al medirse, y el enlace desplaza hasta ahí.
  const rollo = useRef<ScrollView>(null);
  const marcas = useRef<Record<string, number>>({});
  const anotar = (nombre: string) => (ev: LayoutChangeEvent) => {
    marcas.current[nombre] = ev.nativeEvent.layout.y;
  };
  const irA = (nombre: string) => {
    rollo.current?.scrollTo({ y: Math.max(0, (marcas.current[nombre] ?? 0) - 80), animated: true });
  };

  const conProveedor = async (id: Proveedor) => {
    // El botón se muestra igual —es parte de cómo se entra— pero dice por
    // qué no puede hacerlo ahora, que es más honesto que desaparecer sin
    // explicación.
    if (sinServidor) {
      setFalla(
        "Esta es la versión de demostración y no tiene servidor detrás. "
        + "Entra con tu correo para mirarla.",
      );
      return;
    }
    setEntrando(id);
    setFalla(null);
    const r = await entrarCon(id);
    if (!r.ok) setFalla(r.motivo || null);
    setEntrando(null);
  };

  // Tres anchos, no dos: el titular y la ventana de muestra necesitan aire
  // mucho antes de que quepan dos columnas de contenido.
  const media = ancho >= 700;
  const ancha = ancho >= 980;
  const margen = ancha ? 40 : media ? 28 : 20;

  // La cuadrícula se dibuja con rayas, así que necesita saber hasta dónde
  // llegar. Se mide la hoja en vez de suponerle un alto: el titular ocupa
  // dos líneas o tres según el ancho, y una cuadrícula que se corta a la
  // mitad se nota más que si no estuviera.
  const [altoHoja, setAltoHoja] = useState(0);

  return (
    <View style={e.todo}>
      <Barra irA={irA} entrar={entrar} media={media} margen={margen} arriba={margenes.top} />

      <ScrollView
        ref={rollo}
        style={e.rollo}
        contentContainerStyle={{ paddingBottom: margenes.bottom }}
      >
        {/* ── Portada ─────────────────────────────────────────────── */}
        <View style={[e.hoja, { paddingHorizontal: margen }]}
          onLayout={(ev) => setAltoHoja(ev.nativeEvent.layout.height)}>
          <Cuadricula ancho={ancho} alto={altoHoja} />

          <View style={[e.centro, { paddingTop: media ? 70 : 44, paddingBottom: media ? 56 : 40 }]}>
            <View style={e.pildora}>
              <Text style={e.pildoraTexto}>Tu semestre, con un tutor al lado</Text>
            </View>

            <Titular ancha={ancha} media={media} />

            <Text style={[e.bajada, media ? e.bajadaGrande : null]}>
              StudIA junta tus ramos, tu horario, tu material y tus apuntes en un
              solo lugar. Y pone al lado un tutor que te guía para que llegues tú
              a la respuesta, no para que la copies.
            </Text>

            <View style={e.acciones}>
              <BotonDuro texto="Entrar" onPress={entrar} tono="azul" />
              <BotonDuro texto="Ver cómo funciona" onPress={() => irA("funciones")} />
              {media ? <Text style={e.mano}>gratis, y sin tarjeta ↷</Text> : null}
            </View>
          </View>

          <Ventana media={media} />
        </View>

        {/* ── Lo que hace ─────────────────────────────────────────── */}
        <View onLayout={anotar("funciones")} style={[e.seccion, { paddingHorizontal: margen }]}>
          <View style={e.centro}>
            <Text style={[e.titulo2, media ? e.titulo2Grande : null]}>
              Todo el semestre <Text style={e.resaltado}>en un solo lugar</Text>
            </Text>
            <Text style={e.entrada}>
              Se acabó saltar entre el cuaderno, el drive, el grupo del curso y
              tres aplicaciones más para saber qué hay que estudiar hoy.
            </Text>

            <View style={[e.fichas, media ? e.fichasAnchas : null]}>
              {FICHAS.map((f, i) => (
                <Ficha key={f.titulo} {...f} tono={TONOS_FICHA[i % TONOS_FICHA.length]!}
                  anchura={ancha ? "cuarto" : media ? "mitad" : "entera"} />
              ))}
            </View>
          </View>
        </View>

        {/* ── El repaso ───────────────────────────────────────────── */}
        <View onLayout={anotar("repaso")} style={[e.seccion, { paddingHorizontal: margen }]}>
          <View style={e.centro}>
            <Text style={[e.titulo2, media ? e.titulo2Grande : null]}>
              Saber si lo sabes, <Text style={e.resaltado}>antes de la prueba</Text>
            </Text>
            <Text style={e.entrada}>
              Releer el apunte da la sensación de estar estudiando. Contestar una
              pregunta te dice si es cierto. StudIA arma el quiz con el material
              de tu propio ramo, corrige apenas respondes y te explica por qué.
            </Text>

            <View style={[e.repaso, ancha ? e.repasoAncho : null]}>
              <QuizMuestra ancha={ancha} />
              <View style={e.pasos}>
                {PASOS.map((s, i) => (
                  <Paso key={s.titulo} numero={i + 1} titulo={s.titulo} texto={s.texto} />
                ))}
                <Text style={e.pasosMano}>y no lo ve nadie más ↷</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Los agentes ─────────────────────────────────────────── */}
        <View onLayout={anotar("agentes")} style={[e.nocturno, { paddingHorizontal: margen }]}>
          <View style={e.centro}>
            <Text style={[e.titulo2, e.titulo2Claro, media ? e.titulo2Grande : null]}>
              No es un chat cualquiera
            </Text>
            <Text style={[e.entrada, e.entradaClara]}>
              Los tres conocen tus ramos, tu material y tus fechas. Y ninguno te
              pasa la respuesta lista: eso es una decisión, no una limitación.
            </Text>

            <View style={[e.agentes, media ? e.agentesAnchos : null]}>
              {AGENTES.map((a) => (
                <Agente key={a.nombre} {...a} anchura={ancha ? "tercio" : media ? "mitad" : "entera"} />
              ))}
            </View>
          </View>
        </View>

        {/* ── Lo que cuesta ───────────────────────────────────────── */}
        <View onLayout={anotar("precios")} style={[e.seccion, { paddingHorizontal: margen }]}>
          <View style={e.centro}>
            <Text style={[e.titulo2, media ? e.titulo2Grande : null]}>
              Lo que cuesta, <Text style={e.resaltado}>sin letra chica</Text>
            </Text>
            <Text style={e.entrada}>
              Parte gratis y sube de plan si te topas con un tope. Si eres una
              institución, el precio depende del tamaño y lo conversamos.
            </Text>

            <Precios ancha={ancha} media={media} entrar={entrar} />
          </View>
        </View>

        {/* ── Entrar ──────────────────────────────────────────────── */}
        <View onLayout={anotar("entrar")} style={[e.seccion, { paddingHorizontal: margen }]}>
          <View style={[e.centro, { alignItems: "center" }]}>
            <Text style={[e.titulo2, media ? e.titulo2Grande : null, { textAlign: "center", maxWidth: 520 }]}>
              Tu próximo semestre parte <Text style={e.resaltado}>ordenado</Text>
            </Text>
            <Text style={[e.entrada, { textAlign: "center", maxWidth: 460 }]}>
              Con el correo de tu institución tus ramos aparecen solos. Con
              cualquier otro, armas los tuyos.
            </Text>

            <View style={e.puerta}>
              {/* Primero las cuentas que la persona ya tiene: en una
                  universidad la de Google o la de Microsoft ya existe, y es
                  una contraseña menos que inventar y que nosotros tengamos
                  que cuidar. */}
              {PROVEEDORES.map((pr) => (
                <Pressable key={pr.id} accessibilityRole="button"
                  accessibilityLabel={`Continuar con ${pr.nombre}`}
                  onPress={() => void conProveedor(pr.id)}
                  disabled={entrando !== null}
                  style={({ pressed }) => [
                    e.proveedor,
                    pressed ? { backgroundColor: p.papelHondo } : null,
                    entrando !== null && entrando !== pr.id ? { opacity: 0.5 } : null,
                  ]}>
                  <View style={e.marcaProveedor}>
                    <Text style={e.marcaProveedorTexto}>{pr.marca}</Text>
                  </View>
                  <Text style={e.proveedorTexto}>
                    {entrando === pr.id ? "Un momento…" : `Continuar con ${pr.nombre}`}
                  </Text>
                </Pressable>
              ))}

              <View style={e.o}>
                <View style={e.oRaya} />
                <Text style={e.oTexto}>o</Text>
                <View style={e.oRaya} />
              </View>

              {falla ? <Text style={e.falla}>{falla}</Text> : null}

              <BotonDuro texto="Entrar con mi correo" onPress={entrar} tono="azul" ancho />

              {sinServidor ? (
                <Text style={e.nota}>
                  Sin servidor los datos son de ejemplo y se quedan en este
                  aparato, pero el correo se pide igual: es la misma puerta.
                </Text>
              ) : null}

              {/* El consentimiento se pide donde se entra, no escondido en un
                  ajuste: quien crea la cuenta tiene que poder leer qué acepta
                  antes de aceptarlo, y de ahí que los enlaces abran el texto
                  completo acá mismo. */}
              <Text style={e.nota}>
                Al entrar aceptas los{" "}
                <Text style={e.enlaceLegal} accessibilityRole="link"
                  onPress={() => setLegal("terminos")}>Términos de uso</Text>
                {" "}y la{" "}
                <Text style={e.enlaceLegal} accessibilityRole="link"
                  onPress={() => setLegal("privacidad")}>Política de privacidad</Text>.
              </Text>
            </View>
          </View>
        </View>

        <View style={[e.pie, { paddingHorizontal: margen }]}>
          <View style={[e.centro, media ? e.pieAncho : null]}>
            <Text style={e.pieTexto}>StudIA · el tutor guía, no resuelve.</Text>
            <Text style={e.pieTexto}>
              Hecha para estudiantes{VERSION_VISIBLE ? ` · ${VERSION_VISIBLE}` : ""}
            </Text>
          </View>
          <View style={[e.centro, e.pieLegal, media ? e.pieAncho : null]}>
            <Text style={e.pieTexto}>{aviso(new Date().getFullYear())}</Text>
            <Text style={e.pieTexto}>
              <Text style={e.enlaceLegal} accessibilityRole="link"
                onPress={() => setLegal("terminos")}>Términos</Text>
              {"  ·  "}
              <Text style={e.enlaceLegal} accessibilityRole="link"
                onPress={() => setLegal("privacidad")}>Privacidad</Text>
              {"  ·  "}
              <Text style={e.enlaceLegal} accessibilityRole="link"
                onPress={() => setLegal("terceros")}>Licencias</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* En un modal y no en la pila de navegación: acá todavía no hay
          sesión, y por lo tanto tampoco hay navegador donde apilar nada. */}
      <HojaModal abierto={legal !== null} cerrar={() => setLegal(null)}
        titulo={legal ? TITULO_LEGAL[legal] : ""}>
        {legal ? <VistaLegal que={legal} /> : null}
      </HojaModal>
    </View>
  );
}

// ── La barra de arriba ────────────────────────────────────────────────────

function Barra({
  irA, entrar, media, margen, arriba,
}: {
  irA: (n: string) => void;
  entrar: () => void;
  media: boolean;
  margen: number;
  arriba: number;
}) {
  return (
    <View style={[e.barra, { paddingTop: arriba, paddingHorizontal: margen }]}>
      <View style={[e.centro, e.barraDentro]}>
        <Text style={e.logo}>
          Stud<Text style={e.logoIA}>IA</Text>
        </Text>

        <View style={e.barraDerecha}>
          {media ? (
            <>
              <Enlace texto="Qué hace" onPress={() => irA("funciones")} />
              <Enlace texto="El repaso" onPress={() => irA("repaso")} />
              <Enlace texto="Los agentes" onPress={() => irA("agentes")} />
              <Enlace texto="Precios" onPress={() => irA("precios")} />
            </>
          ) : null}
          <BotonDuro texto="Iniciar sesión" onPress={entrar} chico />
        </View>
      </View>
    </View>
  );
}

function Enlace({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
      <Text style={e.enlace}>{texto}</Text>
    </Pressable>
  );
}

// ── El titular, con el destacador que se pinta solo ───────────────────────

/**
 * El titular se arma palabra por palabra, no como un párrafo con trozos
 * resaltados. Es lo que permite que el destacador sea una figura de verdad
 * detrás de la palabra —y que se pinte de izquierda a derecha, como se pasa
 * un destacador— en vez de un rectángulo de fondo del texto.
 */
function Titular({ ancha, media }: { ancha: boolean; media: boolean }) {
  const tamano = ancha ? 62 : media ? 46 : 34;
  const estilo = { fontSize: tamano, lineHeight: tamano * 1.12 };
  return (
    <View style={e.titular}>
      {TITULAR.map((palabra, i) => (
        <Palabra key={`${palabra.texto}-${i}`} {...palabra} estilo={estilo} />
      ))}
    </View>
  );
}

const TITULAR = [
  { texto: "Estudia" },
  { texto: "con" },
  { texto: "método,", marca: p.destacador, retraso: 420 },
  { texto: "no" },
  { texto: "con" },
  { texto: "trasnoche.", marca: p.verdeClaro, retraso: 980 },
] as const;

function Palabra({
  texto, marca, retraso = 0, estilo,
}: {
  texto: string;
  marca?: string;
  retraso?: number;
  estilo: { fontSize: number; lineHeight: number };
}) {
  const [anchoPalabra, setAncho] = useState(0);
  const crecer = useRef(new Animated.Value(0)).current;
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    let vigente = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((sinMovimiento) => {
      if (vigente) setQuieto(sinMovimiento);
    });
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (!marca || anchoPalabra === 0) return;
    if (quieto) { crecer.setValue(1); return; }
    const a = Animated.timing(crecer, {
      toValue: 1, duration: 620, delay: retraso,
      easing: Easing.bezier(0.7, 0, 0.3, 1), useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [marca, anchoPalabra, quieto, retraso, crecer]);

  return (
    <View onLayout={(ev) => setAncho(ev.nativeEvent.layout.width)}>
      {marca && anchoPalabra > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            e.destacador,
            {
              backgroundColor: marca,
              top: estilo.fontSize * 0.28,
              height: estilo.fontSize * 0.66,
              width: crecer.interpolate({ inputRange: [0, 1], outputRange: [0, anchoPalabra + 10] }),
            },
          ]}
        />
      ) : null}
      <Text style={[e.titularTexto, estilo]}>{texto}</Text>
    </View>
  );
}

// ── La ventana de muestra ─────────────────────────────────────────────────

/**
 * Un pedazo de la aplicación, dibujado acá. No es una captura: una imagen se
 * vería borrosa en la mitad de las pantallas y quedaría vieja a la primera
 * corrección. Esto se dibuja con lo mismo que la aplicación de verdad.
 */
function Ventana({ media }: { media: boolean }) {
  return (
    <View style={e.ventana}>
      <View style={e.ventanaBarra}>
        {[p.destacador, p.verde, p.azul].map((tono) => (
          <View key={tono} style={[e.punto, { backgroundColor: tono }]} />
        ))}
        <Text style={e.ventanaTitulo}>Mi semestre</Text>
      </View>

      <View style={[e.ventanaCuerpo, media ? e.ventanaCuerpoAncho : null]}>
        <View style={[e.ventanaLado, media ? e.ventanaLadoAncho : null]}>
          <Text style={e.ventanaEtiqueta}>Mis ramos</Text>
          {RAMOS_MUESTRA.map((r, i) => (
            <View key={r.nombre} style={[e.ramo, i === 0 ? e.ramoAbierto : null]}>
              <View style={[e.ramoMarca, { backgroundColor: r.tono }]} />
              <Text style={[e.ramoTexto, i === 0 ? e.ramoTextoAbierto : null]}>{r.nombre}</Text>
            </View>
          ))}
        </View>

        <View style={e.ventanaMedio}>
          {LINEAS_MUESTRA.map((l) => (
            <View key={l.texto} style={e.linea}>
              <View style={[e.casilla, l.listo ? e.casillaLista : null]}>
                {l.listo ? <Text style={e.casillaTic}>✓</Text> : null}
              </View>
              <Text style={e.lineaTexto} numberOfLines={1}>{l.texto}</Text>
              <Text style={e.lineaCuando}>{l.cuando}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const RAMOS_MUESTRA = [
  { nombre: "Cálculo I", tono: "#2F6BE3" },
  { nombre: "Álgebra", tono: "#C9701C" },
  { nombre: "Física I", tono: "#1FA97C" },
  { nombre: "Programación", tono: "#7A4FD6" },
];

const LINEAS_MUESTRA = [
  { texto: "Clase de hoy · sala B-21", cuando: "10:15", listo: true },
  { texto: "Apuntes: integrales por partes", cuando: "ayer", listo: true },
  { texto: "Tarea 3 · entrega el viernes", cuando: "en 3 días", listo: false },
  { texto: "Lectura del capítulo 4", cuando: "18 min", listo: false },
];

// ── El quiz de muestra ────────────────────────────────────────────────────

/**
 * Una pregunta ya contestada —y contestada mal—, que es el momento que hay
 * que mostrar. Un quiz con la respuesta correcta marcada en verde no dice
 * nada que no diga cualquier formulario; lo que distingue a este es que el
 * error y la explicación llegan juntos, y eso solo se ve cuando alguien se
 * equivoca.
 *
 * Se dibuja con el mismo vocabulario de la pantalla de verdad: la letra en su
 * cuadrado, el verde de la correcta, el rojo de la elegida y la explicación
 * debajo. No es una captura, por lo mismo que la ventana de arriba.
 */
function QuizMuestra({ ancha }: { ancha: boolean }) {
  return (
    <View style={[e.quiz, ancha ? e.quizAncho : null]}>
      <View style={e.quizCabeza}>
        <Text style={e.quizTema}>Límites y continuidad</Text>
        <View style={e.quizSello}>
          <Text style={e.quizSelloTexto}>repaso</Text>
        </View>
      </View>

      <View style={e.quizBarra}>
        <View style={e.quizBarraLlena} />
      </View>
      <Text style={e.quizMano}>pregunta 2 de 5</Text>

      <Text style={e.quizEnunciado}>{MUESTRA.pregunta}</Text>

      {MUESTRA.opciones.map((texto, i) => {
        const pinta = pintaDe(i, MUESTRA.correcta, MUESTRA.elegida);
        return (
          <View key={texto} style={[
            e.quizOpcion,
            pinta === "correcta" ? e.quizOpcionBuena : null,
            pinta === "equivocada" ? e.quizOpcionMala : null,
            pinta === "apagada" ? { opacity: 0.45 } : null,
          ]}>
            <View style={[
              e.quizLetra,
              pinta === "correcta" ? { backgroundColor: p.verde, borderColor: p.verde } : null,
              pinta === "equivocada" ? { backgroundColor: p.rojo, borderColor: p.rojo } : null,
            ]}>
              <Text style={[
                e.quizLetraTexto,
                pinta === "correcta" || pinta === "equivocada" ? { color: "#fff" } : null,
              ]}>{LETRAS[i]}</Text>
            </View>
            <Text style={e.quizOpcionTexto}>{texto}</Text>
          </View>
        );
      })}

      <View style={e.quizExplicacion}>
        <Text style={e.quizExplicacionTexto}>
          <Text style={e.quizExplicacionQuien}>La correcta era otra. </Text>
          {MUESTRA.explicacion}
        </Text>
      </View>
    </View>
  );
}

const MUESTRA = {
  pregunta: "¿Qué pasa con f(x) = (x² − 1)/(x − 1) cuando x tiende a 1?",
  opciones: [
    "No existe: se indetermina en 0/0",
    "Tiende a 2",
    "Tiende a infinito",
    "Vale 1, porque f(1) = 1",
  ],
  correcta: 1,
  elegida: 0,
  explicacion:
    "0/0 dice que hay que seguir trabajando, no que no exista. Al factorizar, "
    + "(x² − 1)/(x − 1) = x + 1 para todo x ≠ 1, y esa expresión tiende a 2.",
} as const;

const PASOS = [
  {
    titulo: "Sale de tu material",
    texto: "Las preguntas se arman con los apuntes y las lecturas de ese módulo, no de un banco genérico. Preguntan lo que pasaron en clase.",
  },
  {
    titulo: "Corrige al momento",
    texto: "La explicación llega junto con el error, que es cuando sirve. Por eso tampoco se puede cambiar una respuesta ya dada: no es para subir el puntaje.",
  },
  {
    titulo: "Lo que fallas vuelve",
    texto: "Cada tema deja además un mazo de fichas. Las que aciertas tardan cada vez más en volver —1, 3, 7, 16 y 35 días—; las que fallas vuelven hoy mismo.",
  },
];

function Paso({ numero, titulo, texto }: { numero: number; titulo: string; texto: string }) {
  return (
    <View style={e.paso}>
      <View style={e.pasoNumero}>
        <Text style={e.pasoNumeroTexto}>{numero}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.pasoTitulo}>{titulo}</Text>
        <Text style={e.pasoTexto}>{texto}</Text>
      </View>
    </View>
  );
}

// ── Fichas y agentes ──────────────────────────────────────────────────────

type Anchura = "entera" | "mitad" | "tercio" | "cuarto";

const REPARTO: Record<Anchura, "100%" | "48.5%" | "31.8%" | "23.5%"> = {
  entera: "100%", mitad: "48.5%", tercio: "31.8%", cuarto: "23.5%",
};

function Ficha({
  icono, titulo, texto, tono, anchura,
}: {
  icono: Parameters<typeof Icono>[0]["nombre"];
  titulo: string;
  texto: string;
  tono: string;
  anchura: Anchura;
}) {
  return (
    <View style={[e.ficha, { width: REPARTO[anchura] }]}>
      <View style={[e.fichaSello, { backgroundColor: tono }]}>
        <Icono nombre={icono} tamano={22} tono={p.tinta} />
      </View>
      <Text style={e.fichaTitulo}>{titulo}</Text>
      <Text style={e.fichaTexto}>{texto}</Text>
    </View>
  );
}

function Agente({
  papel, nombre, texto, dice, anchura,
}: {
  papel: string;
  nombre: string;
  texto: string;
  dice: string;
  anchura: Anchura;
}) {
  return (
    <View style={[e.agente, { width: REPARTO[anchura] }]}>
      <Text style={e.agentePapel}>{papel}</Text>
      <Text style={e.agenteNombre}>{nombre}</Text>
      <Text style={e.agenteTexto}>{texto}</Text>
      <View style={e.globo}>
        <Text style={e.globoTexto}>
          <Text style={e.globoQuien}>{nombre}: </Text>{dice}
        </Text>
      </View>
    </View>
  );
}

const TONOS_FICHA = [p.destacador, p.verdeClaro, p.azulClaro, p.destacador];

const FICHAS = [
  {
    icono: "horario",
    titulo: "Tu semestre completo",
    texto: "Ramos, horario, salas y tareas. Se carga de una vez, no de a uno, y queda al día para todo el curso.",
  },
  {
    icono: "documento",
    titulo: "Apuntes de clase",
    texto: "Escribes mientras el profesor habla y el apunte queda guardado junto al material de ese ramo.",
  },
  {
    icono: "escuchar",
    titulo: "Lectura en voz alta",
    texto: "Pega un texto y lo escuchas mientras la frase que suena se va resaltando sola en la pantalla.",
  },
  {
    icono: "tareas",
    titulo: "Cómo vas de verdad",
    texto: "Tus notas, lo que llevas ponderado y cuánto necesitas en lo que queda para aprobar. Sin sacar cuentas.",
  },
] as const satisfies readonly {
  icono: Parameters<typeof Icono>[0]["nombre"];
  titulo: string;
  texto: string;
}[];

const AGENTES = [
  {
    papel: "te pregunta",
    nombre: "El Tutor",
    texto: "Responde con tus propios apuntes al frente, al nivel del ramo que estás cursando. Y no te da la respuesta: te devuelve la pregunta hasta que la encuentres tú.",
    dice: "Partamos por lo que ya sabes. ¿Qué pasa si derivas los dos lados?",
  },
  {
    papel: "te lee",
    nombre: "El Lector",
    texto: "Lee en voz alta lo que le pegues y va resaltando la frase que suena, para que puedas seguirla con la vista mientras tomas apuntes.",
    dice: "Vas en el párrafo 3 de 12. Quedan 14 minutos de lectura.",
  },
  {
    papel: "te avisa",
    nombre: "Cómo vas",
    texto: "Mira lo que estudiaste y lo que te falta, y te dice sin rodeos en qué estás flojo antes de que llegue la prueba.",
    dice: "Vas bien en límites. Integrales impropias necesita otra pasada.",
  },
];


// ── Lo que cuesta ─────────────────────────────────────────────────────────

/**
 * Los tres planes, en la moneda de quien mira.
 *
 * El precio se muestra en la moneda del país que declara el aparato, y se
 * puede cambiar. No es un detalle de comodidad: un chileno que ve «US$16» hace
 * la cuenta mal —o no la hace— y decide que es caro sin haberlo pensado. Los
 * montos de cada moneda están pensados uno por uno y no convertidos, porque
 * convertir da cifras que nadie pondría en una lista de precios.
 */
function Precios({
  ancha, media, entrar,
}: {
  ancha: boolean;
  media: boolean;
  entrar: () => void;
}) {
  const [moneda, setMoneda] = useState<Moneda>(() => monedaDeIdioma(idiomaDelAparato()));

  const escribir = () => {
    void Linking.openURL(
      "mailto:hola@studia.cl?subject=" + encodeURIComponent("StudIA para mi institución"),
    ).catch(() => { /* sin cliente de correo */ });
  };

  return (
    <>
      <View style={e.monedas}>
        <Text style={e.monedasEtiqueta}>Ver en</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={e.monedasFila}>
          {MONEDAS.map((m) => {
            const puesta = m.codigo === moneda.codigo;
            return (
              <Pressable key={m.codigo} accessibilityRole="button"
                accessibilityState={{ selected: puesta }}
                accessibilityLabel={`Ver los precios en ${m.nombre}`}
                onPress={() => setMoneda(monedaPorCodigo(m.codigo))}
                style={[e.monedaChip, puesta ? e.monedaPuesta : null]}>
                <Text style={[e.monedaTexto, puesta ? e.monedaTextoPuesta : null]}>
                  {m.codigo}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[e.planes, media ? e.planesAnchos : null]}>
        {PLANES.map((plan) => (
          <Tarjeta key={plan.id} plan={plan} moneda={moneda}
            anchura={ancha ? "tercio" : media ? "mitad" : "entera"}
            elegir={plan.id === "institucion" ? escribir : entrar} />
        ))}
      </View>

      {/* Mientras no haya cobro conectado, decirlo. Una tabla de precios con
          un botón que en realidad no cobra nada es la clase de cosa que se
          descubre después y hace desconfiar de todo lo demás. Es una línea, y
          se saca el día que exista la pasarela. */}
      <Text style={e.aunNoSeCobra}>
        Todavía no hay cobro conectado: por ahora las cuentas entran con todo
        abierto. Cuando lo haya, esto lo va a decir antes de pedirte nada.
      </Text>
    </>
  );
}

function Tarjeta({
  plan, moneda, anchura, elegir,
}: {
  plan: Plan;
  moneda: Moneda;
  anchura: Anchura;
  elegir: () => void;
}) {
  const nota = plan.precio === "personal" ? referencia(moneda) : null;

  return (
    <View style={[
      e.plan,
      { width: REPARTO[anchura] },
      plan.destacado ? e.planDestacado : null,
    ]}>
      {plan.destacado ? (
        <View style={e.cinta}>
          <Text style={e.cintaTexto}>el que eligen casi todos</Text>
        </View>
      ) : null}

      <Text style={e.planNombre}>{plan.nombre}</Text>
      <Text style={e.planPara}>{plan.para}</Text>

      <View style={e.precioCaja}>
        <Text style={[e.precio, plan.precio === null ? e.precioConversado : null]}>
          {precioDe(plan, moneda)}
        </Text>
        <Text style={e.periodo}>{plan.periodo}</Text>
        {nota ? <Text style={e.equivale}>{nota}</Text> : null}
      </View>

      <View style={e.incluye}>
        {plan.incluye.map((x) => (
          <View key={x.texto} style={e.item}>
            <View style={[e.tic, x.hay ? e.ticSi : e.ticNo]}>
              {x.hay ? <Icono nombre="listo" tamano={11} tono="#fff" /> : null}
            </View>
            <Text style={[e.itemTexto, x.hay ? null : e.itemSinEllo]}>{x.texto}</Text>
          </View>
        ))}
      </View>

      <BotonDuro texto={plan.accion} onPress={elegir}
        tono={plan.destacado ? "azul" : "papel"} ancho />
    </View>
  );
}

/**
 * El idioma que declara el aparato, que es de donde sale el país.
 *
 * No hay una forma sola de preguntarlo: en el navegador está en `navigator`,
 * y en el teléfono lo entregan los módulos nativos, con una llave distinta en
 * cada plataforma. Si nada responde, no se adivina: `monedaDeIdioma` deja el
 * dólar, que se entiende como referencia en cualquier parte.
 */
function idiomaDelAparato(): string | undefined {
  if (Platform.OS === "web") {
    return globalThis.navigator?.language;
  }
  const ajustes = NativeModules.SettingsManager?.settings;
  return (
    ajustes?.AppleLocale
    ?? ajustes?.AppleLanguages?.[0]
    ?? NativeModules.I18nManager?.localeIdentifier
  ) as string | undefined;
}

// ── El papel cuadriculado ─────────────────────────────────────────────────

/**
 * La cuadrícula del fondo, dibujada con rayas y no con una imagen: así se
 * ve nítida en cualquier pantalla y no hay ningún archivo que cargar.
 */
function Cuadricula({ ancho, alto }: { ancho: number; alto: number }) {
  const paso = 28;
  const verticales = Array.from({ length: Math.ceil(ancho / paso) }, (_, i) => i * paso);
  const horizontales = Array.from({ length: Math.ceil(alto / paso) }, (_, i) => i * paso);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      {verticales.map((x) => <View key={`v${x}`} style={[e.raya, { left: x, top: 0, bottom: 0, width: 1 }]} />)}
      {horizontales.map((y) => <View key={`h${y}`} style={[e.raya, { top: y, left: 0, right: 0, height: 1 }]} />)}
    </View>
  );
}

// ── El botón de cuaderno ──────────────────────────────────────────────────

/**
 * Un botón con la sombra dura corrida, que es la firma de esta portada. La
 * sombra no se desenfoca: es una segunda silueta, como la de una calcomanía
 * pegada en la tapa del cuaderno.
 */
function BotonDuro({
  texto, onPress, tono = "papel", chico, ancho,
}: {
  texto: string;
  onPress: () => void;
  tono?: "papel" | "azul";
  chico?: boolean;
  ancho?: boolean;
}) {
  const azul = tono === "azul";
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [
        e.duro,
        chico ? e.duroChico : null,
        azul ? e.duroAzul : null,
        ancho ? { alignSelf: "stretch" } : null,
        pressed ? e.duroApretado : null,
      ]}>
      <Text style={[e.duroTexto, chico ? e.duroTextoChico : null, azul ? e.duroTextoAzul : null]}>
        {texto}
      </Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  todo: { flex: 1, backgroundColor: p.papel },
  rollo: { flex: 1 },
  centro: { width: "100%", maxWidth: ANCHO_MAXIMO, alignSelf: "center" },

  // ── Barra ──
  barra: {
    backgroundColor: p.papel,
    borderBottomWidth: BORDE, borderBottomColor: p.tinta,
  },
  barraDentro: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: 66,
  },
  logo: { fontFamily: letra.titulo, fontSize: 24, fontWeight: "800", color: p.tinta, letterSpacing: -0.6 },
  logoIA: { color: p.azul },
  barraDerecha: { flexDirection: "row", alignItems: "center", gap: 24 },
  enlace: { fontFamily: letra.cuerpo, fontSize: 15, fontWeight: "500", color: p.tinta },

  // ── Hoja de portada ──
  hoja: { backgroundColor: p.papel, overflow: "hidden" },
  raya: { position: "absolute", backgroundColor: p.raya },

  pildora: {
    alignSelf: "flex-start", backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: p.azul, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24,
  },
  pildoraTexto: {
    fontFamily: letra.cuerpo, fontSize: 12, fontWeight: "600",
    letterSpacing: 1.2, textTransform: "uppercase", color: p.azul,
  },

  titular: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, maxWidth: 900 },
  titularTexto: {
    fontFamily: letra.titulo, fontWeight: "800", color: p.tinta, letterSpacing: -1.6,
  },
  destacador: { position: "absolute", left: -5, borderRadius: 4 },

  bajada: {
    fontFamily: letra.cuerpo, fontSize: 16, lineHeight: 26, color: p.gris,
    maxWidth: 580, marginTop: 24,
  },
  bajadaGrande: { fontSize: 18.5, lineHeight: 30 },

  acciones: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 32 },
  // Ladeada, como una anotación hecha al margen con el cuaderno torcido.
  mano: {
    fontFamily: letra.mano, fontSize: 23, color: p.azul,
    marginLeft: 8, transform: [{ rotate: "-3deg" }],
  },

  // ── Botón duro ──
  duro: {
    borderWidth: BORDE, borderColor: p.tinta, borderRadius: 14,
    backgroundColor: p.papel, paddingHorizontal: 22, paddingVertical: 13,
    alignItems: "center",
    boxShadow: `3px 3px 0 ${p.tinta}`,
  },
  duroChico: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11 },
  duroAzul: { backgroundColor: p.azul },
  duroApretado: { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: `0px 0px 0 ${p.tinta}` },
  duroTexto: { fontFamily: letra.cuerpo, fontSize: 15.5, fontWeight: "600", color: p.tinta },
  duroTextoChico: { fontSize: 14.5 },
  duroTextoAzul: { color: "#fff" },

  // ── Ventana de muestra ──
  ventana: {
    width: "100%", maxWidth: ANCHO_MAXIMO, alignSelf: "center",
    borderWidth: BORDE, borderColor: p.tinta, borderRadius: 18,
    backgroundColor: "#fff", overflow: "hidden", marginBottom: 46,
    boxShadow: `6px 6px 0 ${p.tinta}`,
  },
  ventanaBarra: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: BORDE, borderBottomColor: p.tinta, backgroundColor: p.papel,
  },
  punto: { width: 11, height: 11, borderRadius: 999, borderWidth: 1.5, borderColor: p.tinta },
  ventanaTitulo: {
    fontFamily: letra.cuerpo, fontSize: 12.5, fontWeight: "600",
    color: p.gris, marginLeft: 6,
  },
  ventanaCuerpo: { minHeight: 250 },
  ventanaCuerpoAncho: { flexDirection: "row" },
  ventanaLado: {
    padding: 18, backgroundColor: p.papel, gap: 2,
    borderBottomWidth: BORDE, borderBottomColor: p.tinta,
  },
  ventanaLadoAncho: {
    width: 210, borderBottomWidth: 0,
    borderRightWidth: BORDE, borderRightColor: p.tinta,
  },
  ventanaEtiqueta: {
    fontFamily: letra.cuerpo, fontSize: 11.5, fontWeight: "700",
    letterSpacing: 1, textTransform: "uppercase", color: p.gris, marginBottom: 10,
  },
  ramo: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9,
  },
  ramoAbierto: { backgroundColor: p.destacador },
  ramoMarca: { width: 9, height: 9, borderRadius: 3 },
  ramoTexto: { fontFamily: letra.cuerpo, fontSize: 14, color: p.gris },
  ramoTextoAbierto: { color: p.tinta, fontWeight: "600" },

  ventanaMedio: { flex: 1, padding: 22, gap: 10 },
  linea: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: p.raya, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff",
  },
  casilla: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: p.tinta,
    alignItems: "center", justifyContent: "center",
  },
  casillaLista: { backgroundColor: p.verde, borderColor: p.verde },
  casillaTic: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 14 },
  lineaTexto: { flex: 1, fontFamily: letra.cuerpo, fontSize: 14.5, color: p.tinta },
  lineaCuando: { fontFamily: letra.cuerpo, fontSize: 12.5, color: p.gris },

  // ── Secciones ──
  seccion: { paddingVertical: 78 },
  titulo2: {
    fontFamily: letra.titulo, fontSize: 30, fontWeight: "800",
    color: p.tinta, letterSpacing: -0.9, maxWidth: 760,
  },
  titulo2Grande: { fontSize: 42, letterSpacing: -1.3 },
  titulo2Claro: { color: "#fff" },
  resaltado: { backgroundColor: p.destacador, color: p.tinta },
  entrada: {
    fontFamily: letra.cuerpo, fontSize: 16.5, lineHeight: 27, color: p.gris,
    maxWidth: 600, marginTop: 14, marginBottom: 44,
  },
  entradaClara: { color: "rgba(251,250,245,0.72)" },


  // ── El repaso ──
  repaso: { gap: 28 },
  repasoAncho: { flexDirection: "row", alignItems: "flex-start", gap: 40 },

  quiz: {
    borderWidth: BORDE, borderColor: p.tinta, borderRadius: 16,
    backgroundColor: p.papel, padding: 22, gap: 10,
    boxShadow: `6px 6px 0 ${p.tinta}`,
  },
  quizAncho: { flex: 1.15 },
  quizCabeza: { flexDirection: "row", alignItems: "center", gap: 10 },
  quizTema: {
    flex: 1, fontFamily: letra.titulo, fontSize: 17, fontWeight: "800",
    color: p.tinta, letterSpacing: -0.4,
  },
  quizSello: {
    borderWidth: 1.5, borderColor: p.tinta, borderRadius: 999,
    backgroundColor: p.destacador, paddingHorizontal: 10, paddingVertical: 2,
  },
  quizSelloTexto: { fontSize: 11, fontWeight: "700", color: p.tinta, letterSpacing: 0.3 },

  quizBarra: {
    height: 10, borderRadius: 999, backgroundColor: p.papelHondo,
    borderWidth: 1.5, borderColor: p.tinta, overflow: "hidden",
  },
  quizBarraLlena: { width: "40%", height: "100%", backgroundColor: p.azul },
  quizMano: { fontFamily: letra.mano, fontSize: 18, color: p.azul, textAlign: "right" },

  quizEnunciado: {
    fontFamily: letra.cuerpo, fontSize: 16, lineHeight: 24, fontWeight: "700",
    color: p.tinta, marginBottom: 4,
  },
  quizOpcion: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: "rgba(23,28,63,0.18)", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: p.papel,
  },
  quizOpcionBuena: { borderColor: p.verde, backgroundColor: "rgba(31,169,124,0.08)" },
  quizOpcionMala: { borderColor: p.rojo, backgroundColor: "rgba(228,87,75,0.07)" },
  quizLetra: {
    width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(23,28,63,0.18)", backgroundColor: p.papelHondo,
  },
  quizLetraTexto: { fontSize: 12.5, fontWeight: "800", color: p.tinta },
  quizOpcionTexto: { flex: 1, fontFamily: letra.cuerpo, fontSize: 14.5, color: p.tinta },

  quizExplicacion: {
    marginTop: 4, borderRadius: 12, borderWidth: 1.5, borderColor: p.tinta,
    backgroundColor: p.destacadoSuave, padding: 14,
  },
  quizExplicacionTexto: { fontFamily: letra.cuerpo, fontSize: 14, lineHeight: 22, color: p.tinta },
  quizExplicacionQuien: { fontWeight: "800" },

  pasos: { gap: 26, flex: 1 },
  paso: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  pasoNumero: {
    width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center",
    borderWidth: BORDE, borderColor: p.tinta, backgroundColor: p.destacador,
  },
  pasoNumeroTexto: { fontSize: 13.5, fontWeight: "800", color: p.tinta },
  pasoTitulo: {
    fontFamily: letra.titulo, fontSize: 17, fontWeight: "700",
    color: p.tinta, letterSpacing: -0.3, marginBottom: 4,
  },
  pasoTexto: { fontFamily: letra.cuerpo, fontSize: 14.5, lineHeight: 22, color: p.gris },
  pasosMano: { fontFamily: letra.mano, fontSize: 20, color: p.azul, marginLeft: 44 },

  // ── Fichas ──
  fichas: { gap: 20 },
  fichasAnchas: { flexDirection: "row", flexWrap: "wrap" },
  ficha: {
    backgroundColor: "#fff", borderWidth: BORDE, borderColor: p.tinta,
    borderRadius: 14, padding: 24, gap: 8,
    boxShadow: `4px 4px 0 ${p.tinta}`,
  },
  fichaSello: {
    width: 50, height: 50, borderRadius: 12,
    borderWidth: BORDE, borderColor: p.tinta,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  fichaTitulo: { fontFamily: letra.titulo, fontSize: 17.5, fontWeight: "700", color: p.tinta, letterSpacing: -0.3 },
  fichaTexto: { fontFamily: letra.cuerpo, fontSize: 14.5, lineHeight: 22, color: p.gris },

  // ── Agentes ──
  nocturno: {
    backgroundColor: p.tinta, paddingVertical: 84,
    borderTopWidth: BORDE, borderBottomWidth: BORDE, borderColor: p.tinta,
  },
  agentes: { gap: 20 },
  agentesAnchos: { flexDirection: "row", flexWrap: "wrap" },
  agente: {
    borderWidth: BORDE, borderColor: "rgba(251,250,245,0.32)", borderRadius: 14,
    padding: 24, backgroundColor: "rgba(255,255,255,0.04)", gap: 6,
  },
  agentePapel: {
    fontFamily: letra.mano, fontSize: 23, color: p.destacador,
    alignSelf: "flex-start", transform: [{ rotate: "-2deg" }],
  },
  agenteNombre: { fontFamily: letra.titulo, fontSize: 19, fontWeight: "700", color: "#fff", letterSpacing: -0.3 },
  agenteTexto: { fontFamily: letra.cuerpo, fontSize: 14.5, lineHeight: 22, color: "rgba(251,250,245,0.72)" },
  globo: {
    // Empujado abajo: los tres textos son de largo distinto y las burbujas
    // desalineadas se leen como un descuido.
    marginTop: "auto", backgroundColor: p.papel, borderRadius: 12,
    borderWidth: BORDE, borderColor: p.tinta, paddingHorizontal: 14, paddingVertical: 12,
  },
  globoTexto: { fontFamily: letra.cuerpo, fontSize: 13.5, lineHeight: 20, color: p.tinta },
  globoQuien: { fontWeight: "700", color: p.azul },


  // ── Precios ──
  monedas: { gap: espacio.s, marginBottom: espacio.l },
  monedasEtiqueta: {
    fontFamily: letra.cuerpo, fontSize: 12, fontWeight: "700",
    letterSpacing: 1, textTransform: "uppercase", color: p.gris,
  },
  monedasFila: { flexDirection: "row", gap: espacio.s, paddingRight: espacio.l },
  monedaChip: {
    borderWidth: 1.5, borderColor: p.tinta, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 5, backgroundColor: "#fff",
  },
  monedaPuesta: { backgroundColor: p.destacador, boxShadow: `2px 2px 0 ${p.tinta}` },
  monedaTexto: { fontFamily: letra.cuerpo, fontSize: 12.5, fontWeight: "700", color: p.gris },
  monedaTextoPuesta: { color: p.tinta },

  planes: { gap: 20 },
  planesAnchos: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  plan: {
    backgroundColor: "#fff", borderWidth: BORDE, borderColor: p.tinta,
    borderRadius: 18, padding: 26, gap: 6,
    boxShadow: `4px 4px 0 ${p.tinta}`,
  },
  // El destacado lleva la sombra azul: es el único azul de relleno de toda la
  // portada, y por eso señala sin que haga falta ninguna palabra.
  planDestacado: { borderColor: p.azul, boxShadow: `6px 6px 0 ${p.azul}` },
  cinta: {
    position: "absolute", top: -14, alignSelf: "center",
    backgroundColor: p.destacador, borderWidth: BORDE, borderColor: p.tinta,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 0,
    transform: [{ rotate: "-2deg" }],
  },
  cintaTexto: { fontFamily: letra.mano, fontSize: 19, color: p.tinta },

  planNombre: {
    fontFamily: letra.titulo, fontSize: 21, fontWeight: "800",
    color: p.tinta, letterSpacing: -0.4, marginTop: 4,
  },
  planPara: { fontFamily: letra.cuerpo, fontSize: 13.5, lineHeight: 20, color: p.gris },

  precioCaja: { marginTop: espacio.m, marginBottom: espacio.s },
  precio: {
    fontFamily: letra.titulo, fontSize: 40, fontWeight: "800",
    color: p.tinta, letterSpacing: -1.4,
  },
  precioConversado: { fontSize: 27, letterSpacing: -0.8 },
  periodo: { fontFamily: letra.cuerpo, fontSize: 13.5, color: p.gris },
  equivale: { fontFamily: letra.cuerpo, fontSize: 11.5, color: p.gris, marginTop: 3 },

  incluye: { gap: 9, marginBottom: espacio.l, flex: 1 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tic: {
    width: 19, height: 19, borderRadius: 6, marginTop: 1,
    borderWidth: 1.5, borderColor: p.tinta,
    alignItems: "center", justifyContent: "center",
  },
  ticSi: { backgroundColor: p.verde, borderColor: p.verde },
  ticNo: { backgroundColor: p.papelHondo },
  itemTexto: { flex: 1, fontFamily: letra.cuerpo, fontSize: 13.5, lineHeight: 20, color: p.tinta },
  itemSinEllo: { color: p.gris },

  aunNoSeCobra: {
    fontFamily: letra.cuerpo, fontSize: 13, lineHeight: 20, color: p.gris,
    marginTop: espacio.l, maxWidth: 560,
  },

  // ── La puerta ──
  puerta: {
    width: "100%", maxWidth: 420, gap: 12, marginTop: 8,
    backgroundColor: "#fff", borderWidth: BORDE, borderColor: p.tinta,
    borderRadius: 16, padding: 22,
    boxShadow: `5px 5px 0 ${p.tinta}`,
  },
  proveedor: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: p.tinta, borderRadius: 12,
    backgroundColor: p.papel, paddingHorizontal: 14, paddingVertical: 12,
  },
  marcaProveedor: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: p.tinta,
  },
  marcaProveedorTexto: { fontFamily: letra.titulo, fontSize: 15, fontWeight: "800", color: p.tinta },
  proveedorTexto: { flex: 1, fontFamily: letra.cuerpo, fontSize: 15, fontWeight: "600", color: p.tinta },

  o: { flexDirection: "row", alignItems: "center", gap: 12 },
  oRaya: { flex: 1, height: 1.5, backgroundColor: p.raya },
  oTexto: { fontFamily: letra.cuerpo, fontSize: 13, color: p.gris },

  falla: { fontFamily: letra.cuerpo, fontSize: 13.5, lineHeight: 20, color: "#C0392B" },
  nota: { fontFamily: letra.cuerpo, fontSize: 12.5, lineHeight: 19, color: p.gris },

  // ── Pie ──
  pie: { borderTopWidth: BORDE, borderTopColor: p.tinta, paddingVertical: 26, gap: 10 },
  pieLegal: { borderTopWidth: 1, borderTopColor: p.raya, paddingTop: 10 },
  enlaceLegal: { textDecorationLine: "underline", color: p.azul, fontWeight: "600" },
  pieAncho: { flexDirection: "row", justifyContent: "space-between" },
  pieTexto: { fontFamily: letra.cuerpo, fontSize: 13.5, color: p.gris },
});
