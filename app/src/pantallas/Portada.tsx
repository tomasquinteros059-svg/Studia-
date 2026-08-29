import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text,
  View, type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icono } from "../ui/Icono.tsx";
import { letra } from "../ui/tema.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { VERSION_VISIBLE } from "../lib/version.ts";
import { PROVEEDORES, type Proveedor } from "../dominio/acceso-proveedores.ts";
import { entrarCon } from "../lib/proveedores.ts";

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
  verde: "#1FA97C",
  verdeClaro: "#A9E6CE",
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
        </View>
      </ScrollView>
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
              <Enlace texto="Los agentes" onPress={() => irA("agentes")} />
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
  pie: { borderTopWidth: BORDE, borderTopColor: p.tinta, paddingVertical: 26 },
  pieAncho: { flexDirection: "row", justifyContent: "space-between" },
  pieTexto: { fontFamily: letra.cuerpo, fontSize: 13.5, color: p.gris },
});
