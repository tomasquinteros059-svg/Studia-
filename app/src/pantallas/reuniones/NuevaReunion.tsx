import { useState } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { Boton, Campo } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import { EQUIPOS, equipoDe, type Rubro } from "../../dominio/rubros.ts";
import type { ReunionNueva } from "../../lib/tipos-reunion.ts";
import { SIN_AGENDA, type Agenda } from "../../dominio/agenda.ts";
import Agendar from "./Agendar.tsx";

/**
 * El encabezado de la reunión, antes de grabar.
 *
 * Lo único obligatorio es el título y el rubro. Los participantes y la tabla
 * ayudan mucho —con la tabla se puede decir después qué no se alcanzó a
 * tratar— pero se graba una reunión que ya empezó, y exigir llenar un
 * formulario mientras la gente habla es la manera de que nadie grabe nada.
 */
export default function NuevaReunion({
  abierta, cerrar, crear,
}: {
  abierta: boolean;
  cerrar: () => void;
  crear: (nueva: ReunionNueva) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [rubro, setRubro] = useState<Rubro | null>(null);
  const [participantes, setParticipantes] = useState("");
  const [tabla, setTabla] = useState("");
  const [agenda, setAgenda] = useState<Agenda>(SIN_AGENDA);
  const [ocupado, setOcupado] = useState(false);

  const limpiar = () => {
    setTitulo(""); setRubro(null); setParticipantes(""); setTabla("");
    setAgenda(SIN_AGENDA); setOcupado(false);
  };

  const sePuede = titulo.trim().length > 0 && rubro !== null && !ocupado;

  const enviar = async () => {
    if (rubro === null) return;
    setOcupado(true);
    try {
      await crear({
        titulo: titulo.trim(),
        rubro,
        participantes: enLineas(participantes),
        tabla: enLineas(tabla),
        programada_para: agenda.programada_para,
        repite: agenda.repite,
      });
      limpiar();
      cerrar();
    } finally {
      setOcupado(false);
    }
  };

  const elegido = rubro ? equipoDe(rubro) : null;

  return (
    <Modal visible={abierta} animationType="slide" onRequestClose={cerrar}>
      <KeyboardAvoidingView style={e.pantalla}
        behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={e.barra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={cerrar} hitSlop={10}>
            <Icono nombre="cerrar" tamano={22} tono={color.marca} />
          </Pressable>
          <Text style={e.barraTitulo}>Nueva reunión</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={e.hoja} keyboardShouldPersistTaps="handled">
          <Campo placeholder="¿Qué reunión es?" value={titulo} onChangeText={setTitulo}
            autoCapitalize="sentences" accessibilityLabel="Título de la reunión" />

          <Text style={tipo.etiqueta}>¿De qué se trata?</Text>
          <Text style={e.pista}>
            De esto depende quién la escucha, cómo se redacta y qué se busca
            en ella. Se puede cambiar después.
          </Text>

          <View style={{ gap: espacio.s }}>
            {EQUIPOS.map((eq) => {
              const activo = eq.id === rubro;
              return (
                <Pressable key={eq.id} accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  accessibilityLabel={eq.nombre}
                  onPress={() => setRubro(eq.id)}
                  style={({ pressed }) => [
                    e.rubro,
                    activo ? e.rubroElegido : null,
                    pressed && !activo ? { backgroundColor: color.elemento } : null,
                  ]}>
                  <View style={[e.marca, { backgroundColor: tenue(color.marca) }]}>
                    <Icono nombre={eq.id} tamano={19} tono={color.marca} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={e.rubroNombre}>{eq.nombre}</Text>
                    <Text style={tipo.detalle}>{eq.ejemplos.slice(0, 3).join(" · ")}</Text>
                  </View>
                  {activo ? <Icono nombre="listo" tamano={18} tono={color.marca} /> : null}
                </Pressable>
              );
            })}
          </View>

          {elegido ? (
            <View style={e.equipo}>
              <Text style={tipo.etiqueta}>Tu equipo</Text>
              {elegido.agentes.map((a) => (
                <View key={a.papel} style={e.agente}>
                  <Text style={e.agenteNombre}>{a.nombre}</Text>
                  <Text style={tipo.detalle}>{a.hace}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {elegido?.cuidado ? (
            <View style={e.cuidado}>
              <Icono nombre="aviso" tamano={18} tono={color.ambar} />
              <Text style={e.cuidadoTexto}>{elegido.cuidado}</Text>
            </View>
          ) : null}

          <Text style={tipo.etiqueta}>Quiénes participan</Text>
          <Campo
            style={e.varias}
            placeholder={"Uno por línea.\nSirve para que la transcripción diga quién habló."}
            value={participantes} onChangeText={setParticipantes}
            multiline textAlignVertical="top"
            accessibilityLabel="Participantes"
          />

          <Text style={tipo.etiqueta}>Qué se va a tratar</Text>
          <Campo
            style={e.varias}
            placeholder={"Un punto por línea.\nCon esto se puede decir después qué quedó sin tratar."}
            value={tabla} onChangeText={setTabla}
            multiline textAlignVertical="top"
            accessibilityLabel="Tabla de la reunión"
          />

          <Agendar agenda={agenda} cambiar={setAgenda} />

          <Boton
            texto={ocupado ? "Creando…" : agenda.programada_para ? "Agendar" : "Empezar"}
            onPress={() => void enviar()}
            deshabilitado={!sePuede}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Una por línea, sin vacías ni viñetas que alguien pegó de otra parte. */
export function enLineas(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((l) => l.length > 0);
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  barra: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  barraTitulo: { fontSize: 16, fontWeight: "600", color: color.texto },
  hoja: { padding: espacio.l, gap: espacio.m, paddingBottom: espacio.xl },
  pista: { ...tipo.detalle, lineHeight: 19, marginTop: -6 },

  rubro: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.tarjeta,
    padding: espacio.m,
  },
  rubroElegido: { borderColor: color.marca, backgroundColor: tenue(color.marca) },
  rubroNombre: { fontSize: 15, fontWeight: "600", color: color.texto },
  marca: { width: 38, height: 38, borderRadius: radio.campo, alignItems: "center", justifyContent: "center" },

  equipo: {
    gap: espacio.s, padding: espacio.m,
    backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
  agente: { gap: 1 },
  agenteNombre: { fontSize: 14, fontWeight: "600", color: color.texto },

  cuidado: {
    flexDirection: "row", gap: espacio.s, alignItems: "flex-start",
    padding: espacio.m, backgroundColor: tenue(color.ambar), borderRadius: radio.tarjeta,
  },
  cuidadoTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20, flex: 1 },

  varias: { minHeight: 92, paddingTop: 11, lineHeight: 20 },
});
