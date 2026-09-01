import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cargando, Error as ErrorUI } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { FILETE, cifras, color, colorDeRamo, espacio, radio, tipo } from "../ui/tema.ts";
import { crearApunte, guardarApunte, lecturaPorId, marcarMaterial, misApuntes } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { usarLector } from "../lib/usarLector.ts";
import { hayVoz } from "../lib/voz.ts";
import {
  TAMANOS, VELOCIDADES, agruparEnParrafos, citar, estiloDeLectura,
  minutosDeEscucha, paletaDeLectura, progreso, resalteDeRamo, velocidadDe,
  type Fondo, type Interlineado,
} from "../dominio/lectura.ts";
import type { PropsPila } from "../lib/rutas.ts";

const ESPERA_GUARDADO = 1500;

export default function Lectura({ route, navigation }: PropsPila<"Lectura">) {
  const { materialId } = route.params;
  const { dosPaneles } = usarDisposicion();

  const traer = useCallback(() => lecturaPorId(materialId), [materialId]);
  const { datos, cargando, error, recargar } = usarCarga(traer, [materialId]);

  const lector = usarLector(materialId, datos?.texto ?? "");
  const {
    frases, indice, sonando, termino, aviso, preferencias, ajustar,
    alternar, pausar, irA, atras, adelante, reiniciar,
  } = lector;

  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [apuntesAbiertos, setApuntesAbiertos] = useState(false);

  // La app dibuja de borde a borde: sin esto, los mandos del lector quedan
  // debajo de la barra de gestos del sistema.
  const margenes = useSafeAreaInsets();

  const paleta = paletaDeLectura(preferencias.fondo);
  // Todo el color de esta pantalla sale del ramo: lo que se resalta, la
  // barra que avanza y el botón de escuchar.
  const tono = colorDeRamo(datos?.asignatura_id ?? "", datos?.asignatura_color);
  const resalte = resalteDeRamo(preferencias.fondo, tono);
  const estilo = estiloDeLectura(preferencias);
  const velocidad = velocidadDe(preferencias);
  const fraseActual = frases[indice] ?? null;

  useEffect(() => {
    navigation.setOptions({ title: datos?.titulo ?? "Lectura" });
  }, [navigation, datos?.titulo]);

  // Al salir de la pantalla la voz se calla. Que siga hablando desde otra
  // pantalla sería un fantasma imposible de apagar.
  useEffect(() => navigation.addListener("blur", pausar), [navigation, pausar]);

  // Terminar de escucharlo cuenta como haberlo visto.
  useEffect(() => {
    if (termino) void marcarMaterial(materialId, true).catch(() => {});
  }, [termino, materialId]);

  // ── Apuntes que se toman mientras se escucha ─────────────────────────
  const [nota, setNota] = useState<string | null>(null);
  const [apunteId, setApunteId] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<"limpio" | "escribiendo" | "guardando">("limpio");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tituloApunte = datos ? `Lectura · ${datos.titulo}` : "";

  // Si ya hubo una sesión de lectura de este material, se sigue el mismo
  // apunte en vez de empezar uno nuevo cada vez.
  useEffect(() => {
    if (!datos) return;
    let vigente = true;
    void misApuntes(datos.asignatura_id).then((lista) => {
      const previo = lista.find((a) => a.titulo === `Lectura · ${datos.titulo}`);
      if (!vigente || !previo) return;
      setApunteId(previo.id);
      setNota((n) => n ?? previo.contenido);
    }).catch(() => {});
    return () => { vigente = false; };
  }, [datos]);

  const guardarPronto = useCallback((texto: string) => {
    if (!datos) return;
    setNota(texto);
    setGuardado("escribiendo");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      setGuardado("guardando");
      const escribir = async () => {
        let id = apunteId;
        if (!id) {
          const nuevo = await crearApunte(datos.asignatura_id, tituloApunte);
          id = nuevo.id;
          setApunteId(id);
        }
        await guardarApunte(id, { contenido: texto });
      };
      escribir().then(() => setGuardado("limpio")).catch(() => setGuardado("escribiendo"));
    }, ESPERA_GUARDADO);
  }, [datos, apunteId, tituloApunte]);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  /** Manda la frase que suena a los apuntes, con comillas. */
  const anotarFrase = useCallback(() => {
    if (!fraseActual) return;
    const previo = nota ?? "";
    guardarPronto(previo ? `${previo.replace(/\s*$/, "")}\n\n${citar(fraseActual.texto)}` : citar(fraseActual.texto));
    if (!dosPaneles) setApuntesAbiertos(true);
  }, [fraseActual, nota, guardarPronto, dosPaneles]);

  // ── El texto ─────────────────────────────────────────────────────────
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const alturas = useRef<Record<number, number>>({});
  const parrafoVisto = useRef(-1);

  // Sigue la lectura con la vista: cuando la voz cambia de párrafo, la
  // pantalla lo acompaña. Dentro del párrafo no se mueve, para no marear.
  useEffect(() => {
    if (!fraseActual || !sonando) return;
    if (parrafoVisto.current === fraseActual.parrafo) return;
    parrafoVisto.current = fraseActual.parrafo;
    const y = alturas.current[fraseActual.parrafo];
    if (typeof y === "number") scroll.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
  }, [fraseActual, sonando]);

  if (cargando) return <Cargando texto="Abriendo la lectura…" />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos) return <ErrorUI mensaje="Este material no tiene texto para leer." />;

  const parrafos = agruparEnParrafos(frases);
  const minutos = minutosDeEscucha(frases, velocidad, indice);

  const cuerpo = (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: paleta.fondo }}
      contentContainerStyle={[e.hoja, { maxWidth: estilo.anchoMaximo }]}
    >
      <Text style={[e.ramo, { color: tono }]} numberOfLines={1}>
        {datos.asignatura_nombre}
      </Text>
      <Text style={[e.encabezado, { color: paleta.texto, fontSize: estilo.fontSize + 11 }]}>
        {datos.titulo}
      </Text>
      <View style={[e.hilo, { backgroundColor: tono }]} />

      {/*
        El toque va en el párrafo y no en cada frase. Es a propósito: un Text
        con onPress deja de fluir en línea y el párrafo termina partido en una
        frase por renglón. Para saltar a una frase puntual están los mandos de
        la barra; para saltar a una idea, basta con tocar su párrafo.
      */}
      {parrafos.map((p) => (
        <Text
          key={p.indice}
          onPress={() => irA(p.frases[0]?.indice ?? 0)}
          accessibilityLabel={`Leer desde: ${p.frases[0]?.texto ?? ""}`}
          onLayout={(ev) => { alturas.current[p.indice] = ev.nativeEvent.layout.y; }}
          style={{ marginBottom: estilo.lineHeight * 0.7 }}
        >
          {p.frases.map((f) => {
            const esActual = f.indice === indice;
            return (
              <Text
                key={f.indice}
                style={{
                  fontSize: estilo.fontSize,
                  lineHeight: estilo.lineHeight,
                  color: esActual
                    ? paleta.texto
                    : preferencias.foco ? paleta.atenuado : paleta.texto,
                  backgroundColor: esActual ? resalte : "transparent",
                }}
              >
                {f.texto}{" "}
              </Text>
            );
          })}
        </Text>
      ))}

      <View style={{ height: espacio.xl }} />
    </ScrollView>
  );

  const barra = (
    <View style={[e.barra, {
      backgroundColor: paleta.fondo, borderTopColor: paleta.borde,
      paddingBottom: espacio.s + margenes.bottom,
    }]}>
      <View style={[e.riel, { backgroundColor: paleta.borde }]}>
        <View style={[e.avance, {
          width: `${progreso(indice, frases.length) * 100}%`, backgroundColor: tono,
        }]} />
      </View>

      {aviso ? <Text style={e.aviso}>{aviso}</Text> : null}

      <View style={e.mandos}>
        <Boton icono="fraseAtras" etiqueta="Frase anterior" onPress={atras} tono={paleta.texto} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sonando ? "Pausar" : termino ? "Volver a empezar" : "Escuchar"}
          onPress={termino ? reiniciar : alternar}
          style={({ pressed }) => [e.play, { backgroundColor: tono }, pressed && { opacity: 0.85 }]}
        >
          <Icono
            nombre={sonando ? "pausar" : termino ? "fraseAtras" : "reproducir"}
            tamano={26}
            tono={color.sobreMarca}
          />
        </Pressable>

        <Boton icono="fraseAdelante" etiqueta="Frase siguiente" onPress={adelante} tono={paleta.texto} />

        <Pressable accessibilityRole="button" accessibilityLabel={`Velocidad ${velocidad}, tocar para cambiarla`}
          onPress={() => setAjustesAbiertos(true)}
          style={[e.pastilla, { borderColor: paleta.borde }]}>
          <Text style={[e.pastillaTexto, { color: paleta.texto }]}>{velocidad}×</Text>
        </Pressable>

        <Boton icono="letra" etiqueta="Ajustes de lectura"
          onPress={() => setAjustesAbiertos(true)} tono={paleta.texto} />

        <View style={{ flex: 1 }} />

        <Text style={[e.restante, { color: paleta.atenuado }]}>
          {termino ? "Listo" : `${minutos} min`}
        </Text>
      </View>

      <View style={e.acciones}>
        <Pressable accessibilityRole="button" accessibilityLabel="Anotar esta frase"
          onPress={anotarFrase} disabled={!fraseActual}
          style={({ pressed }) => [
            e.accion, { borderColor: paleta.borde },
            pressed && { backgroundColor: resalte },
            !fraseActual && { opacity: 0.4 },
          ]}>
          <Icono nombre="lapiz" tamano={16} tono={tono} />
          <Text style={[e.accionTexto, { color: paleta.texto }]}>Anotar esta frase</Text>
        </Pressable>

        {!dosPaneles ? (
          <Pressable accessibilityRole="button"
            accessibilityLabel={apuntesAbiertos ? "Cerrar apuntes" : "Mis apuntes"}
            onPress={() => setApuntesAbiertos((v) => !v)}
            style={({ pressed }) => [
              e.accion, { borderColor: paleta.borde },
              apuntesAbiertos && { backgroundColor: resalte, borderColor: tono },
              pressed && { backgroundColor: resalte },
            ]}>
            <Icono nombre="documento" tamano={16} tono={tono} />
            <Text style={[e.accionTexto, { color: paleta.texto }]}>
              {apuntesAbiertos ? "Cerrar apuntes" : "Mis apuntes"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!hayVoz ? (
        <Text style={e.sinVoz}>
          Este cliente no trae la voz. El texto se lee igual; para escucharlo hace
          falta la app instalada.
        </Text>
      ) : null}
    </View>
  );

  const columnaApuntes = (
    <View style={[e.apuntes, dosPaneles ? e.apuntesLado : e.apuntesAbajo]}>
      <View style={e.tituloApuntes}>
        <Icono nombre="lapiz" tamano={16} tono={tono} />
        <Text style={e.tituloApuntesTexto}>Mis apuntes</Text>
        <Text style={tipo.detalle}>
          {guardado === "limpio" ? "· guardado" : guardado === "guardando" ? "· guardando…" : "· sin guardar"}
        </Text>
      </View>
      <TextInput
        style={e.papel}
        value={nota ?? ""}
        onChangeText={guardarPronto}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        placeholder={"Escribe mientras escuchas.\n\nLo que anotes queda en tus apuntes del ramo."}
        placeholderTextColor="#9AA0A6"
        accessibilityLabel="Apuntes de la lectura"
      />
    </View>
  );

  const lectura = (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      {cuerpo}
      {!dosPaneles && apuntesAbiertos ? columnaApuntes : null}
      {barra}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      {dosPaneles ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 3 }}>{lectura}</View>
          {columnaApuntes}
        </View>
      ) : lectura}

      <Ajustes
        abierto={ajustesAbiertos}
        cerrar={() => setAjustesAbiertos(false)}
        preferencias={preferencias}
        ajustar={ajustar}
        tono={tono}
        margenAbajo={margenes.bottom}
      />
    </View>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────

function Boton({
  icono, etiqueta, onPress, tono,
}: {
  icono: "fraseAtras" | "fraseAdelante" | "letra";
  etiqueta: string;
  onPress: () => void;
  tono: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress}
      hitSlop={8} style={e.mando}>
      <Icono nombre={icono} tamano={20} tono={tono} />
    </Pressable>
  );
}

const INTERLINEADOS: { id: Interlineado; texto: string }[] = [
  { id: "normal", texto: "Junto" },
  { id: "amplio", texto: "Amplio" },
  { id: "doble", texto: "Doble" },
];

const FONDOS: { id: Fondo; texto: string }[] = [
  { id: "papel", texto: "Papel" },
  { id: "sepia", texto: "Sepia" },
  { id: "noche", texto: "Noche" },
];

function Ajustes({
  abierto, cerrar, preferencias, ajustar, tono, margenAbajo,
}: {
  abierto: boolean;
  cerrar: () => void;
  preferencias: ReturnType<typeof usarLector>["preferencias"];
  ajustar: ReturnType<typeof usarLector>["ajustar"];
  tono: string;
  margenAbajo: number;
}) {
  return (
    <Modal visible={abierto} transparent animationType="slide" onRequestClose={cerrar}
      statusBarTranslucent>
      <Pressable style={a.velo} onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar ajustes" />
      <View style={[a.hoja, { paddingBottom: espacio.l + margenAbajo }]}>
        <View style={a.asa} />

        <Text style={tipo.etiqueta}>Tamaño de la letra</Text>
        <View style={a.fila}>
          <Pressable accessibilityRole="button" accessibilityLabel="Letra más chica"
            style={a.cuadro}
            onPress={() => ajustar({ tamano: Math.max(0, preferencias.tamano - 1) })}>
            <Text style={[a.muestra, { fontSize: 14 }]}>A</Text>
          </Pressable>
          <View style={a.escala}>
            {TAMANOS.map((_, i) => (
              <View key={i} style={[a.paso, i <= preferencias.tamano && { backgroundColor: tono }]} />
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Letra más grande"
            style={a.cuadro}
            onPress={() => ajustar({ tamano: Math.min(TAMANOS.length - 1, preferencias.tamano + 1) })}>
            <Text style={[a.muestra, { fontSize: 24 }]}>A</Text>
          </Pressable>
        </View>

        <Text style={tipo.etiqueta}>Separación entre líneas</Text>
        <View style={a.fila}>
          {INTERLINEADOS.map((x) => (
            <Chip key={x.id} texto={x.texto} tono={tono} activo={preferencias.interlineado === x.id}
              onPress={() => ajustar({ interlineado: x.id })} />
          ))}
        </View>

        <Text style={tipo.etiqueta}>Fondo</Text>
        <View style={a.fila}>
          {FONDOS.map((x) => (
            <Chip key={x.id} texto={x.texto} tono={tono} activo={preferencias.fondo === x.id}
              onPress={() => ajustar({ fondo: x.id })} />
          ))}
        </View>

        <Text style={tipo.etiqueta}>Velocidad de la voz</Text>
        <View style={a.fila}>
          {VELOCIDADES.map((v, i) => (
            <Chip key={v} texto={`${v}×`} tono={tono} activo={preferencias.velocidad === i}
              onPress={() => ajustar({ velocidad: i })} />
          ))}
        </View>

        <View style={a.interruptor}>
          <View style={{ flex: 1 }}>
            <Text style={a.interruptorTitulo}>Foco de línea</Text>
            <Text style={tipo.detalle}>
              Atenúa todo menos la frase que se está leyendo.
            </Text>
          </View>
          <Switch
            value={preferencias.foco}
            onValueChange={(v) => ajustar({ foco: v })}
            trackColor={{ false: color.bordeFuerte, true: tono }}
            accessibilityLabel="Foco de línea"
          />
        </View>

        <Pressable accessibilityRole="button" onPress={cerrar} style={a.listo}>
          <Text style={a.listoTexto}>Listo</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Chip({
  texto, activo, onPress, tono,
}: { texto: string; activo: boolean; onPress: () => void; tono: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: activo }}
      onPress={onPress}
      style={[a.chip, activo && { backgroundColor: tono, borderColor: tono }]}>
      <Text style={[a.chipTexto, activo ? a.chipTextoActivo : null]}>{texto}</Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  hoja: { padding: espacio.l, paddingTop: espacio.xl, width: "100%", alignSelf: "center" },
  // El nombre del ramo va arriba y con su color: es lo primero que ubica
  // la lectura, antes incluso de leer de qué se trata.
  ramo: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  encabezado: { fontWeight: "700", letterSpacing: -0.6, marginTop: espacio.s },
  hilo: { width: 46, height: 3, borderRadius: 2, marginTop: espacio.m, marginBottom: espacio.xl },

  barra: { borderTopWidth: FILETE },
  riel: { height: 4 },
  avance: { height: 4 },
  mandos: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingTop: espacio.m,
  },
  mando: { padding: espacio.xs },
  play: {
    width: 58, height: 58, borderRadius: radio.pastilla,
    alignItems: "center", justifyContent: "center",
  },
  pastilla: {
    borderWidth: FILETE, borderRadius: radio.pastilla,
    paddingHorizontal: espacio.m, paddingVertical: 7,
  },
  pastillaTexto: { ...cifras, fontSize: 14, fontWeight: "700" },
  restante: { ...cifras, fontSize: 13 },

  acciones: {
    flexDirection: "row", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingTop: espacio.m,
  },
  accion: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderWidth: FILETE, borderRadius: radio.pastilla,
    paddingHorizontal: espacio.m, paddingVertical: 9,
  },
  accionTexto: { fontSize: 14, fontWeight: "600" },

  aviso: {
    ...tipo.detalle, color: color.ambar, paddingHorizontal: espacio.m, paddingTop: espacio.s,
  },
  sinVoz: { ...tipo.detalle, paddingHorizontal: espacio.m, paddingTop: 2, lineHeight: 16 },

  apuntes: { backgroundColor: color.papel },
  apuntesLado: { flex: 2, borderLeftWidth: FILETE, borderLeftColor: color.bordeFuerte },
  apuntesAbajo: { height: 230, borderTopWidth: FILETE, borderTopColor: color.bordeFuerte },
  tituloApuntes: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingVertical: espacio.m,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  tituloApuntesTexto: { ...tipo.fila, flex: 1 },
  papel: { flex: 1, padding: espacio.m, fontSize: 16, lineHeight: 26, color: color.texto },
});

const a = StyleSheet.create({
  velo: { flex: 1, backgroundColor: "rgba(25,26,31,0.4)" },
  hoja: {
    backgroundColor: color.papel, padding: espacio.l, gap: espacio.s,
    borderTopLeftRadius: radio.tarjeta, borderTopRightRadius: radio.tarjeta,
  },
  asa: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: color.bordeFuerte,
    alignSelf: "center", marginBottom: espacio.m,
  },
  // Con seis velocidades no caben en una fila de 390 px: bajan solas.
  fila: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    gap: espacio.s, marginBottom: espacio.m,
  },

  cuadro: {
    width: 50, height: 46, borderRadius: radio.boton,
    borderWidth: FILETE, borderColor: color.bordeFuerte,
    alignItems: "center", justifyContent: "center",
  },
  muestra: { fontWeight: "700", color: color.texto },
  escala: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  paso: { flex: 1, height: 5, borderRadius: 3, backgroundColor: color.elemento },

  chip: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.pastilla,
    paddingHorizontal: espacio.m, paddingVertical: 9,
  },
  chipTexto: { ...cifras, fontSize: 14, fontWeight: "600", color: color.textoSuave },
  chipTextoActivo: { color: color.sobreMarca },

  interruptor: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingVertical: espacio.m,
    borderTopWidth: FILETE, borderTopColor: color.bordeFuerte,
  },
  interruptorTitulo: { ...tipo.fila },

  listo: {
    backgroundColor: color.marca, borderRadius: radio.boton,
    paddingVertical: 15, alignItems: "center", marginTop: espacio.s,
  },
  listoTexto: { color: color.sobreMarca, fontWeight: "700", fontSize: 16 },
});
