import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { Cargando, Error as ErrorUI } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { color, espacio, radio, tipo } from "../ui/tema.ts";
import { crearApunte, guardarApunte, lecturaPorId, marcarMaterial, misApuntes } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { usarLector } from "../lib/usarLector.ts";
import { hayVoz } from "../lib/voz.ts";
import {
  TAMANOS, VELOCIDADES, agruparEnParrafos, citar, estiloDeLectura,
  minutosDeEscucha, paletaDeLectura, progreso, velocidadDe,
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

  const paleta = paletaDeLectura(preferencias.fondo);
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
      <Text style={[e.encabezado, { color: paleta.texto, fontSize: estilo.fontSize + 6 }]}>
        {datos.titulo}
      </Text>
      <Text style={[e.ramo, { color: paleta.atenuado }]}>{datos.asignatura_nombre}</Text>

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
                  backgroundColor: esActual ? paleta.resalte : "transparent",
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
    <View style={[e.barra, { backgroundColor: paleta.fondo, borderTopColor: paleta.borde }]}>
      <View style={[e.riel, { backgroundColor: paleta.borde }]}>
        <View style={[e.avance, { width: `${progreso(indice, frases.length) * 100}%` }]} />
      </View>

      {aviso ? <Text style={e.aviso}>{aviso}</Text> : null}

      <View style={e.mandos}>
        <Boton icono="fraseAtras" etiqueta="Frase anterior" onPress={atras} tono={paleta.texto} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sonando ? "Pausar" : termino ? "Volver a empezar" : "Escuchar"}
          onPress={termino ? reiniciar : alternar}
          style={e.play}
        >
          <Icono
            nombre={sonando ? "pausar" : termino ? "fraseAtras" : "reproducir"}
            tamano={22}
            tono={color.sobreMarca}
          />
        </Pressable>

        <Boton icono="fraseAdelante" etiqueta="Frase siguiente" onPress={adelante} tono={paleta.texto} />

        <Pressable accessibilityRole="button" onPress={() => setAjustesAbiertos(true)}
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
          onPress={anotarFrase} style={e.accion} disabled={!fraseActual}>
          <Icono nombre="lapiz" tamano={15} tono={color.marca} />
          <Text style={e.accionTexto}>Anotar esta frase</Text>
        </Pressable>

        {!dosPaneles ? (
          <Pressable accessibilityRole="button"
            accessibilityLabel={apuntesAbiertos ? "Cerrar apuntes" : "Mis apuntes"}
            onPress={() => setApuntesAbiertos((v) => !v)} style={e.accion}>
            <Icono nombre="documento" tamano={15} tono={color.marca} />
            <Text style={e.accionTexto}>{apuntesAbiertos ? "Cerrar apuntes" : "Mis apuntes"}</Text>
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
        <Icono nombre="lapiz" tamano={15} tono={color.marca} />
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
  abierto, cerrar, preferencias, ajustar,
}: {
  abierto: boolean;
  cerrar: () => void;
  preferencias: ReturnType<typeof usarLector>["preferencias"];
  ajustar: ReturnType<typeof usarLector>["ajustar"];
}) {
  return (
    <Modal visible={abierto} transparent animationType="slide" onRequestClose={cerrar}>
      <Pressable style={a.velo} onPress={cerrar} accessibilityLabel="Cerrar ajustes" />
      <View style={a.hoja}>
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
              <View key={i} style={[a.paso, i <= preferencias.tamano ? a.pasoLleno : null]} />
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
            <Chip key={x.id} texto={x.texto} activo={preferencias.interlineado === x.id}
              onPress={() => ajustar({ interlineado: x.id })} />
          ))}
        </View>

        <Text style={tipo.etiqueta}>Fondo</Text>
        <View style={a.fila}>
          {FONDOS.map((x) => (
            <Chip key={x.id} texto={x.texto} activo={preferencias.fondo === x.id}
              onPress={() => ajustar({ fondo: x.id })} />
          ))}
        </View>

        <Text style={tipo.etiqueta}>Velocidad de la voz</Text>
        <View style={a.fila}>
          {VELOCIDADES.map((v, i) => (
            <Chip key={v} texto={`${v}×`} activo={preferencias.velocidad === i}
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

function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: activo }}
      onPress={onPress} style={[a.chip, activo ? a.chipActivo : null]}>
      <Text style={[a.chipTexto, activo ? a.chipTextoActivo : null]}>{texto}</Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  hoja: { padding: espacio.l, paddingTop: espacio.xl, width: "100%", alignSelf: "center" },
  encabezado: { fontWeight: "600", marginBottom: 2 },
  ramo: { fontSize: 13, marginBottom: espacio.l },

  barra: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Platform.OS === "ios" ? 22 : 10 },
  riel: { height: 3 },
  avance: { height: 3, backgroundColor: color.marca },
  mandos: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingTop: espacio.m,
  },
  mando: { padding: 2 },
  play: {
    width: 46, height: 46, borderRadius: radio.pastilla, backgroundColor: color.marca,
    alignItems: "center", justifyContent: "center",
  },
  pastilla: { borderWidth: 1, borderRadius: radio.pastilla, paddingHorizontal: 10, paddingVertical: 4 },
  pastillaTexto: { fontSize: 12.5, fontWeight: "600" },
  restante: { fontSize: 12.5, fontVariant: ["tabular-nums"] },

  acciones: { flexDirection: "row", gap: espacio.l, paddingHorizontal: espacio.m, paddingTop: espacio.s },
  accion: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6 },
  accionTexto: { fontSize: 13, fontWeight: "600", color: color.marca },

  aviso: {
    ...tipo.detalle, color: color.ambar, paddingHorizontal: espacio.m, paddingTop: espacio.s,
  },
  sinVoz: { ...tipo.detalle, paddingHorizontal: espacio.m, paddingTop: 2, lineHeight: 16 },

  apuntes: { backgroundColor: color.fondo },
  apuntesLado: { flex: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.borde },
  apuntesAbajo: { height: 210, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.borde },
  tituloApuntes: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: espacio.m, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  tituloApuntesTexto: { fontSize: 13, fontWeight: "600", color: color.texto },
  papel: { flex: 1, padding: espacio.m, fontSize: 15, lineHeight: 24, color: color.texto },
});

const a = StyleSheet.create({
  velo: { flex: 1, backgroundColor: "rgba(11,18,32,0.35)" },
  hoja: {
    backgroundColor: color.fondo, padding: espacio.l, gap: espacio.s,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  asa: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: color.borde,
    alignSelf: "center", marginBottom: espacio.s,
  },
  // Con seis velocidades no caben en una fila de 390 px: bajan solas.
  fila: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    gap: espacio.s, marginBottom: espacio.m,
  },

  cuadro: {
    width: 44, height: 40, borderRadius: radio.boton, borderWidth: 1, borderColor: color.borde,
    alignItems: "center", justifyContent: "center",
  },
  muestra: { fontWeight: "600", color: color.texto },
  escala: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  paso: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.elemento },
  pasoLleno: { backgroundColor: color.marca },

  chip: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.pastilla,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  chipActivo: { backgroundColor: color.marca, borderColor: color.marca },
  chipTexto: { fontSize: 13, fontWeight: "600", color: color.textoSuave },
  chipTextoActivo: { color: color.sobreMarca },

  interruptor: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingVertical: espacio.s,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.borde,
  },
  interruptorTitulo: { fontSize: 14, fontWeight: "600", color: color.texto },

  listo: {
    backgroundColor: color.marca, borderRadius: radio.boton,
    paddingVertical: 13, alignItems: "center", marginTop: espacio.s,
  },
  listoTexto: { color: color.sobreMarca, fontWeight: "600", fontSize: 15 },
});
