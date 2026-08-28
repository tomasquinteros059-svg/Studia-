import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Boton, Cargando, Error as ErrorUI } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { PanelTutor } from "../ui/PanelTutor.tsx";
import { color, espacio, radio, tipo } from "../ui/tema.ts";
import { apuntePorId, guardarApunte, misAsignaturas, resumenDe } from "../lib/consultas.ts";
import { pedirResumen, type ResultadoResumen } from "../lib/resumen.ts";
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
  const [guardado, setGuardado] = useState<"limpio" | "escribiendo" | "guardando">("limpio");
  const [resumiendo, setResumiendo] = useState(false);
  const [resumen, setResumen] = useState<ResultadoResumen | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Al salir de la pantalla se guarda lo que quedó pendiente.
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
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
      </View>

      <TextInput
        style={e.papel}
        value={texto}
        onChangeText={alEscribir}
        multiline
        autoCapitalize="sentences"
        placeholder={"Escribe aquí lo que va diciendo el profesor…\n\nCon tus palabras: es lo que más ayuda a recordar."}
        placeholderTextColor="#9AA0A6"
        accessibilityLabel="Apuntes de la clase"
        textAlignVertical="top"
      />

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
          <Text style={tipo.detalle}>· pregúntale sin salir de la clase</Text>
        </View>
      ) : null}
      <PanelTutor asignatura={ramo} compacto={dosColumnas}
        contexto={`Estoy en clase de ${ramo?.nombre ?? "este ramo"}, tomando apuntes.`} />
    </View>
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
    return (
      <View style={e.dosColumnas}>
        <View style={e.columnaApuntes}>{bloqueResumen ?? editor}</View>
        <View style={e.separador} />
        {panelTutor}
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

  editor: { flex: 1 },
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
