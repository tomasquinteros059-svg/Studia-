// El botón para avisar que una respuesta de la IA salió mal.
//
// Google Play lo exige en cualquier aplicación que genere contenido con
// inteligencia artificial: la manera de reportar tiene que estar adentro, en
// el mismo lugar donde apareció el contenido, y no en una dirección de
// contacto. Sin eso la revisión rechaza la app.
//
// Va pegado a cada respuesta y no en un menú de ajustes por la misma razón:
// quien quiere reportar algo lo quiere hacer mientras lo está leyendo. Un
// aviso que hay que ir a buscar es un aviso que no se manda.
//
// Es discreto a propósito. La bandera está siempre, pero pequeña y en gris:
// no compite con la respuesta, y no sugiere que lo normal sea desconfiar.

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Campo, HojaModal } from "./componentes.tsx";
import { Icono } from "./Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "./tema.ts";
import { GRACIAS, MOTIVOS, revisar, type Motivo, type Origen } from "../dominio/reportes.ts";
import { reportar } from "../lib/reportes.ts";

export function ReportarIA({ origen, contenido }: { origen: Origen; contenido: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [detalle, setDetalle] = useState("");
  const [mandando, setMandando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function cerrar() {
    setAbierto(false);
    // Se limpia al cerrar y no al abrir: si alguien reporta dos respuestas
    // seguidas, la segunda parte en blanco.
    setMotivo(null);
    setDetalle("");
    setFalla(null);
    setListo(false);
  }

  async function mandar() {
    const revision = revisar({ origen, contenido, motivo, detalle });
    if (!revision.ok) { setFalla(revision.motivo); return; }

    setFalla(null);
    setMandando(true);
    try {
      await reportar(revision.reporte);
      setListo(true);
    } catch (e) {
      setFalla(e instanceof Error ? e.message : "No pude mandar el reporte.");
    } finally {
      setMandando(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reportar esta respuesta"
        onPress={() => setAbierto(true)}
        hitSlop={10}
        style={({ pressed }) => [e.bandera, pressed ? { opacity: 0.5 } : null]}>
        <Icono nombre="reportar" tamano={14} tono={color.textoTenue} />
      </Pressable>

      <HojaModal abierto={abierto} cerrar={cerrar} titulo="Reportar esta respuesta">
        {listo ? (
          <View style={e.gracias}>
            <Icono nombre="listo" tamano={26} tono={color.ok} />
            <Text style={e.graciasTexto}>{GRACIAS}</Text>
            <Boton texto="Cerrar" onPress={cerrar} />
          </View>
        ) : (
          <>
            <Text style={e.bajada}>
              Esta respuesta la escribió una inteligencia artificial y se puede
              equivocar. Cuéntame qué pasó y alguien de tu establecimiento lo
              va a mirar.
            </Text>

            <View style={e.cita}>
              <Text style={e.citaTexto} numberOfLines={4}>{contenido}</Text>
            </View>

            <View style={e.motivos}>
              {MOTIVOS.map((m) => {
                const elegido = motivo === m.motivo;
                return (
                  <Pressable
                    key={m.motivo}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: elegido }}
                    accessibilityLabel={m.texto}
                    onPress={() => { setMotivo(m.motivo); setFalla(null); }}
                    style={[e.motivo, elegido ? e.motivoElegido : null]}>
                    <Text style={[e.motivoTexto, elegido ? e.motivoTextoElegido : null]}>
                      {m.texto}
                    </Text>
                    <Text style={e.motivoDetalle}>{m.detalle}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Campo
              value={detalle}
              onChangeText={setDetalle}
              placeholder="Si quieres, cuéntame más (opcional)"
              accessibilityLabel="Detalle del reporte"
              multiline
              style={e.campo}
            />

            {falla ? <Text style={e.falla}>{falla}</Text> : null}

            <Boton
              texto={mandando ? "Mandando…" : "Mandar el reporte"}
              onPress={mandar}
              deshabilitado={mandando}
            />
          </>
        )}
      </HojaModal>
    </>
  );
}

const e = StyleSheet.create({
  bandera: { alignSelf: "flex-end", paddingTop: espacio.xs, paddingLeft: espacio.s },

  bajada: { ...tipo.cuerpo, color: color.textoSuave, marginBottom: espacio.m },

  cita: {
    borderLeftWidth: 3, borderLeftColor: color.borde,
    paddingLeft: espacio.s, marginBottom: espacio.m,
  },
  citaTexto: { ...tipo.detalle, color: color.textoSuave, fontStyle: "italic" },

  motivos: { gap: espacio.xs, marginBottom: espacio.m },
  motivo: {
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.tarjeta,
    padding: espacio.s, backgroundColor: color.papel,
  },
  motivoElegido: { borderColor: color.marca, backgroundColor: tenue(color.marca) },
  motivoTexto: { ...tipo.cuerpo, fontWeight: "600", color: color.texto },
  motivoTextoElegido: { color: color.texto },
  motivoDetalle: { ...tipo.detalle, color: color.textoSuave, marginTop: 2 },

  campo: { minHeight: 72, textAlignVertical: "top", marginBottom: espacio.m },
  falla: { ...tipo.detalle, color: color.vivo, marginBottom: espacio.s },

  gracias: { alignItems: "center", gap: espacio.m, paddingVertical: espacio.xl },
  graciasTexto: { ...tipo.cuerpo, color: color.texto, textAlign: "center" },
});
