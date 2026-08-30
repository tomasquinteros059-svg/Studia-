import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Boton, Cargando, Error as ErrorUI } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { PanelTutor } from "../ui/PanelTutor.tsx";
import { Pizarra } from "../ui/Pizarra.tsx";
import { FILETE, color, espacio, radio, tipo } from "../ui/tema.ts";
import { guardar as guardarTrazos, hayTinta, leer as leerTrazos, type Trazo, type Util } from "../dominio/trazos.ts";
import { apuntePorId, guardarApunte, misAsignaturas, resumenDe } from "../lib/consultas.ts";
import { pedirResumen, type ResultadoResumen } from "../lib/resumen.ts";
import { guardarTutorALaVista, leerTutorALaVista } from "../lib/preferencias.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import type { PropsPila } from "../lib/rutas.ts";

/** Cuánto se espera sin escribir antes de guardar. */
const ESPERA_GUARDADO = 1500;

export default function Apunte({ route, navigation }: PropsPila<"Apunte">) {
  const { apunteId } = route.params;
  const { dosPaneles: dosColumnas } = usarDisposicion();

  const traer = useCallback(async () => {
    const [apunte, asignaturas, resumen] = await Promise.all([
      apuntePorId(apunteId), misAsignaturas(), resumenDe(apunteId),
    ]);
    return { apunte, asignaturas, resumen };
  }, [apunteId]);

  const { datos, cargando, error, recargar } = usarCarga(traer, [apunteId]);

  const [contenido, setContenido] = useState<string | null>(null);

  // Lo escrito a mano. Nulo mientras no se ha leído el apunte: así se
  // distingue «todavía no sé» de «no hay nada dibujado», y no se guarda un
  // tablero vacío encima de uno que sí tenía tinta.
  const [trazos, setTrazos] = useState<Trazo[] | null>(null);
  const [aMano, setAMano] = useState(false);
  const [util, setUtil] = useState<Util>("lapiz");
  const [guardado, setGuardado] = useState<"limpio" | "escribiendo" | "guardando">("limpio");
  const [resumiendo, setResumiendo] = useState(false);
  const [resumen, setResumen] = useState<ResultadoResumen | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temporizadorTinta = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El tutor empieza guardado y se recuerda como se dejó. Nulo mientras se
  // lee la preferencia: sin eso, la columna aparecería y desaparecería de un
  // salto en cada apertura.
  const [tutorALaVista, setTutorALaVista] = useState<boolean | null>(null);

  useEffect(() => {
    let vigente = true;
    void leerTutorALaVista().then((v) => { if (vigente) setTutorALaVista(v); });
    return () => { vigente = false; };
  }, []);

  const mostrarTutor = (aLaVista: boolean) => {
    setTutorALaVista(aLaVista);
    void guardarTutorALaVista(aLaVista);
  };

  useEffect(() => {
    if (datos?.apunte) setTrazos(leerTrazos(datos.apunte.trazos));
  }, [datos?.apunte]);

  useEffect(() => {
    if (datos?.resumen) {
      setResumen({
        cuerpo: datos.resumen.cuerpo,
        vacios: datos.resumen.vacios,
        consejos: datos.resumen.consejos,
        conTranscripcion: false,
      });
    }
  }, [datos?.resumen]);

  // Se guarda solo, poco después de dejar de escribir. Nadie debería perder
  // apuntes de clase por olvidar tocar un botón.
  const alEscribir = useCallback((texto: string) => {
    setContenido(texto);
    setGuardado("escribiendo");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      setGuardado("guardando");
      guardarApunte(apunteId, { contenido: texto })
        .then(() => setGuardado("limpio"))
        .catch(() => setGuardado("escribiendo"));
    }, ESPERA_GUARDADO);
  }, [apunteId]);

  /**
   * Los trazos se guardan aparte del texto, y enteros.
   *
   * Aparte porque un trazo no se «va escribiendo»: existe cuando se levanta
   * el lápiz, y ahí ya está completo. Y enteros porque el tablero es una
   * unidad: guardar la mitad de los trazos deja un dibujo que nadie hizo.
   *
   * Espera igual que el texto: en clase se dibuja una flecha tras otra, y
   * un guardado por trazo sería una llamada por segundo.
   */
  const alDibujar = useCallback((nuevos: Trazo[]) => {
    setTrazos(nuevos);
    setGuardado("escribiendo");
    if (temporizadorTinta.current) clearTimeout(temporizadorTinta.current);
    temporizadorTinta.current = setTimeout(() => {
      setGuardado("guardando");
      guardarApunte(apunteId, { trazos: hayTinta(nuevos) ? guardarTrazos(nuevos) : null })
        .then(() => setGuardado("limpio"))
        .catch(() => setGuardado("escribiendo"));
    }, ESPERA_GUARDADO);
  }, [apunteId]);

  // Al salir de la pantalla se guarda lo que quedó pendiente.
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    if (temporizadorTinta.current) clearTimeout(temporizadorTinta.current);
  }, []);

  const cerrarClase = useCallback(async () => {
    const texto = contenido ?? datos?.apunte?.contenido ?? "";
    if (temporizador.current) clearTimeout(temporizador.current);
    setResumiendo(true);
    try {
      await guardarApunte(apunteId, { contenido: texto });
      setGuardado("limpio");
      const r = await pedirResumen(apunteId);
      setResumen(r);
    } catch (e) {
      Alert.alert("No pude resumir", e instanceof Error ? e.message : "");
    } finally {
      setResumiendo(false);
    }
  }, [apunteId, contenido, datos?.apunte?.contenido]);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos?.apunte) return <ErrorUI mensaje="No encontré ese apunte." />;

  const ramo = datos.asignaturas.find((a) => a.id === datos.apunte!.asignatura_id) ?? null;
  const texto = contenido ?? datos.apunte.contenido;

  const editor = (
    <View style={e.editor}>
      <View style={e.barra}>
        <Text style={e.ramo} numberOfLines={1}>
          {ramo?.nombre ?? "Apuntes"}
        </Text>
        <Text style={tipo.detalle}>
          {guardado === "limpio" ? "Guardado" : guardado === "guardando" ? "Guardando…" : "Sin guardar"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: aMano }}
          accessibilityLabel={aMano ? "Escribir con el teclado" : "Escribir a mano"}
          onPress={() => setAMano((v) => !v)}
          style={({ pressed }) => [e.aMano, aMano ? e.aManoPuesto : null, pressed ? { opacity: 0.7 } : null]}>
          <Icono nombre={aMano ? "teclado" : "lapiz"} tamano={17}
            tono={aMano ? color.sobreMarca : color.texto} />
        </Pressable>
      </View>

      {/*
        La hoja de tinta va encima del texto y no al lado: un apunte de clase
        es un texto con una flecha, un eje o una integral dibujada al medio, y
        separarlos en dos pantallas obligaría a decidir de antemano cuál de
        las dos cosas se va a hacer.

        Cuando no se está escribiendo a mano deja pasar los toques, así que
        escribir a máquina funciona igual que antes.
      */}
      <View style={e.zonaEscritura}>
        <TextInput
          style={e.papel}
          value={texto}
          onChangeText={alEscribir}
          multiline
          editable={!aMano}
          autoCapitalize="sentences"
          placeholder={"Escribe aquí lo que va diciendo el profesor…\n\nCon tus palabras: es lo que más ayuda a recordar."}
          placeholderTextColor="#9AA0A6"
          accessibilityLabel="Apuntes de la clase"
          textAlignVertical="top"
        />
        <Pizarra
          trazos={trazos ?? []}
          util={util}
          grosor={util === "destacador" ? 18 : 3}
          cambiar={alDibujar}
          sinTinta={!aMano}
        />
      </View>

      {aMano ? (
        <Utiles
          util={util} elegir={setUtil}
          deshacer={() => alDibujar((trazos ?? []).slice(0, -1))}
          hayQueDeshacer={(trazos ?? []).length > 0}
        />
      ) : null}

      <View style={e.pie}>
        <Boton
          texto={resumiendo ? "Resumiendo…" : "Terminar clase y resumir"}
          onPress={() => void cerrarClase()}
          deshabilitado={resumiendo}
        />
      </View>
    </View>
  );

  const panelTutor = (
    <View style={dosColumnas ? e.columnaTutor : { flex: 1 }}>
      {dosColumnas ? (
        <View style={e.tituloPanel}>
          <Icono nombre="tutor" tamano={16} tono={color.marca} />
          <Text style={e.tituloPanelTexto}>Tutor</Text>
          <Text style={[tipo.detalle, { flex: 1 }]} numberOfLines={1}>
            · pregúntale sin salir de la clase
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Guardar el tutor"
            onPress={() => mostrarTutor(false)} hitSlop={10}
            style={({ pressed }) => [e.guardarTutor, pressed ? { opacity: 0.6 } : null]}>
            <Icono nombre="siguiente" tamano={17} tono={color.textoSuave} />
          </Pressable>
        </View>
      ) : null}
      <PanelTutor asignatura={ramo} compacto={dosColumnas}
        contexto={`Estoy en clase de ${ramo?.nombre ?? "este ramo"}, tomando apuntes.`} />
    </View>
  );

  /**
   * La pestaña que queda cuando el tutor está guardado.
   *
   * Un riel angosto pegado al borde y no un botón flotante: el flotante se
   * pondría encima de lo que se está escribiendo, que es justo el espacio que
   * esto viene a devolver. Y estando siempre en el mismo sitio, se aprende
   * dónde está y se abre sin buscarlo.
   */
  const pestanaTutor = (
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir el tutor"
      onPress={() => mostrarTutor(true)}
      style={({ pressed }) => [e.riel, pressed ? { backgroundColor: color.elemento } : null]}>
      <Icono nombre="tutor" tamano={20} tono={color.marca} />
      <Text style={e.rielTexto}>Tutor</Text>
    </Pressable>
  );

  const bloqueResumen = resumen ? (
    <ScrollView style={e.resumen} contentContainerStyle={{ padding: espacio.m, gap: espacio.m }}>
      <View>
        <Text style={tipo.etiqueta}>Resumen de la clase</Text>
        <Text style={e.resumenCuerpo}>{resumen.cuerpo}</Text>
        {!resumen.conTranscripcion ? (
          <Text style={e.avisoTranscripcion}>
            Hecho solo con tus apuntes y el temario del ramo. Cuando las clases
            se transcriban, el resumen también cruzará lo que dijo el profesor.
          </Text>
        ) : null}
      </View>

      {resumen.vacios.length > 0 ? (
        <View>
          <Text style={tipo.etiqueta}>Quedó fuera de tus apuntes</Text>
          {resumen.vacios.map((v, i) => (
            <View key={i} style={e.punto}>
              <Text style={e.vinneta}>·</Text>
              <Text style={e.puntoTexto}>{v}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {resumen.consejos.length > 0 ? (
        <View>
          <Text style={tipo.etiqueta}>Para estudiar esto</Text>
          {resumen.consejos.map((c, i) => (
            <View key={i} style={e.punto}>
              <Text style={e.vinneta}>·</Text>
              <Text style={e.puntoTexto}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setResumen(null)} style={e.volverEditor}>
        <Text style={e.volverTexto}>Volver a los apuntes</Text>
      </Pressable>
    </ScrollView>
  ) : null;

  if (dosColumnas) {
    // Mientras no se sabe cómo quedó la última vez, se dibuja sin tutor: es
    // lo que va a ser en la mayoría de los casos, y así no parpadea.
    const abierto = tutorALaVista === true;
    return (
      <View style={e.dosColumnas}>
        <View style={e.columnaApuntes}>{bloqueResumen ?? editor}</View>
        <View style={e.separador} />
        {abierto ? panelTutor : pestanaTutor}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.fondo }}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {bloqueResumen ?? editor}
      {!bloqueResumen ? (
        <Pressable accessibilityRole="button" style={e.flotante}
          onPress={() => navigation.navigate("Principal", {
            screen: "Tutor",
            params: { asignaturaId: ramo?.id, contexto: `Estoy tomando apuntes de ${ramo?.nombre ?? "clase"}.` },
          })}>
          <Icono nombre="tutor" tamano={20} tono={color.sobreMarca} />
          <Text style={e.flotanteTexto}>Tutor</Text>
        </Pressable>
      ) : null}
      {resumiendo ? (
        <View style={e.velo}><ActivityIndicator color={color.marca} /></View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/**
 * Los útiles: lápiz, destacador, goma y deshacer.
 *
 * Tres y no diez. Una paleta de colores acá pelearía con lo que ordena toda
 * la aplicación —el color significa un ramo— y además nadie subraya una clase
 * en seis colores: subraya en uno. El destacador amarillo es la excepción que
 * ya existe en el resto de la aplicación y significa lo mismo acá: «esto es
 * lo importante».
 *
 * Deshacer va junto a los útiles y no escondido en un menú porque es el botón
 * que más se usa: escribir a mano en una pantalla sale mal seguido, y tener
 * que buscar cómo arreglarlo es lo que hace que alguien deje de escribir a
 * mano.
 */
function Utiles({
  util, elegir, deshacer, hayQueDeshacer,
}: {
  util: Util;
  elegir: (u: Util) => void;
  deshacer: () => void;
  hayQueDeshacer: boolean;
}) {
  const cuales: { id: Util; icono: "lapiz" | "destacador" | "goma"; nombre: string }[] = [
    { id: "lapiz", icono: "lapiz", nombre: "Lápiz" },
    { id: "destacador", icono: "destacador", nombre: "Destacador" },
    { id: "goma", icono: "goma", nombre: "Goma" },
  ];

  return (
    <View style={e.utiles}>
      {cuales.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityState={{ selected: util === c.id }}
          accessibilityLabel={c.nombre}
          onPress={() => elegir(c.id)}
          style={({ pressed }) => [
            e.util, util === c.id ? e.utilPuesto : null, pressed ? { opacity: 0.7 } : null,
          ]}>
          <Icono nombre={c.icono} tamano={19}
            tono={util === c.id ? color.sobreMarca : color.texto} />
        </Pressable>
      ))}

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Deshacer el último trazo"
        accessibilityState={{ disabled: !hayQueDeshacer }}
        disabled={!hayQueDeshacer}
        onPress={deshacer}
        style={({ pressed }) => [
          e.util, !hayQueDeshacer ? { opacity: 0.35 } : null, pressed ? { opacity: 0.7 } : null,
        ]}>
        <Icono nombre="deshacer" tamano={19} tono={color.texto} />
      </Pressable>
    </View>
  );
}

const e = StyleSheet.create({
  dosColumnas: { flex: 1, flexDirection: "row", backgroundColor: color.fondo },
  columnaApuntes: { flex: 3 },
  columnaTutor: { flex: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.borde },
  separador: { width: StyleSheet.hairlineWidth, backgroundColor: color.borde },
  tituloPanel: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: espacio.m, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  tituloPanelTexto: { fontSize: 13, fontWeight: "600", color: color.texto },
  guardarTutor: { padding: 2 },

  riel: {
    width: 52, alignItems: "center", justifyContent: "center", gap: espacio.s,
    backgroundColor: color.papel,
  },
  // El nombre va de lado, como la etiqueta del lomo de una carpeta: es lo que
  // permite que quepa en cincuenta píxeles sin cortarse ni achicarse.
  rielTexto: {
    fontSize: 12.5, fontWeight: "700", color: color.texto,
    transform: [{ rotate: "90deg" }], width: 60, textAlign: "center",
  },

  editor: { flex: 1 },
  zonaEscritura: { flex: 1 },

  // El interruptor de escribir a mano, en la misma barra que dice si está
  // guardado: es donde ya se mira antes de empezar.
  aMano: {
    marginLeft: espacio.s, padding: 7, borderRadius: radio.campo,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel,
  },
  aManoPuesto: { backgroundColor: color.marca, borderColor: color.marca },

  utiles: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingVertical: espacio.s,
    borderTopWidth: FILETE, borderTopColor: color.bordeFuerte,
    backgroundColor: color.papel,
  },
  util: {
    padding: 9, borderRadius: radio.campo,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel,
  },
  utilPuesto: { backgroundColor: color.marca, borderColor: color.marca },


  barra: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  ramo: { flex: 1, fontSize: 14, fontWeight: "600", color: color.texto },
  papel: {
    flex: 1, padding: espacio.l, fontSize: 16, lineHeight: 26, color: color.texto,
  },
  pie: {
    padding: espacio.m,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.borde,
  },

  resumen: { flex: 1, backgroundColor: color.fondo },
  resumenCuerpo: { ...tipo.cuerpo, color: color.texto, lineHeight: 23, marginTop: 6 },
  avisoTranscripcion: {
    ...tipo.detalle, lineHeight: 19, marginTop: 10, padding: 11,
    backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
  punto: { flexDirection: "row", gap: 8, marginTop: 6 },
  vinneta: { color: color.textoSuave, fontSize: 14 },
  puntoTexto: { flex: 1, ...tipo.cuerpo, color: color.texto, lineHeight: 21 },
  volverEditor: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton,
    paddingVertical: 12, alignItems: "center", marginTop: espacio.s,
  },
  volverTexto: { fontSize: 14, fontWeight: "600", color: color.textoSuave },

  flotante: {
    position: "absolute", right: espacio.l, bottom: espacio.xl,
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: color.marca, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: radio.pastilla,
  },
  flotanteTexto: { color: color.sobreMarca, fontWeight: "600", fontSize: 14 },
  velo: {
    position: "absolute", inset: 0, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
});
