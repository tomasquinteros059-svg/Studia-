import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Campo } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { FILETE, cifras, color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import {
  comoSeRepite, cuandoEs, type Agenda, type Repeticion,
} from "../../dominio/agenda.ts";
import { AVISO_SIN_AVISOS, hayAvisos } from "../../lib/avisos.ts";

const REPETICIONES: Repeticion[] = ["nunca", "cada_semana", "dias_de_semana"];

/**
 * Agendar una reunión que se repite.
 *
 * Lo que se agenda es el aviso, no la grabación, y eso se dice en pantalla
 * en vez de dejarlo como sorpresa: ninguna aplicación puede prender el
 * micrófono sola a una hora, y prometerlo sería prometer algo que el sistema
 * operativo no va a permitir nunca.
 */
export default function Agendar({
  agenda, cambiar,
}: {
  agenda: Agenda;
  cambiar: (agenda: Agenda) => void;
}) {
  const [abierto, setAbierto] = useState(agenda.programada_para !== null);

  const fijar = (dias: number, hora: number) => {
    const cuando = new Date();
    cuando.setDate(cuando.getDate() + dias);
    cuando.setHours(hora, 0, 0, 0);
    cambiar({ ...agenda, programada_para: cuando.toISOString() });
  };

  if (!abierto) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Agendarla para otro día"
        onPress={() => { setAbierto(true); fijar(1, 9); }}
        style={({ pressed }) => [e.abrir, pressed ? { backgroundColor: color.elemento } : null]}>
        <Icono nombre="reloj" tamano={18} tono={color.marca} />
        <Text style={e.abrirTexto}>Agendarla para otro día</Text>
      </Pressable>
    );
  }

  return (
    <View style={e.caja}>
      <View style={e.encabezado}>
        <Text style={tipo.etiqueta}>Cuándo</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Quitar la agenda"
          onPress={() => {
            setAbierto(false);
            cambiar({ programada_para: null, repite: "nunca" });
          }} hitSlop={10}>
          <Icono nombre="cerrar" tamano={18} tono={color.textoSuave} />
        </Pressable>
      </View>

      <Text style={e.cuando}>{cuandoEs(agenda)}</Text>

      <View style={e.fila}>
        {[
          { texto: "Mañana 9:00", dias: 1, hora: 9 },
          { texto: "Mañana 14:00", dias: 1, hora: 14 },
          { texto: "En una semana", dias: 7, hora: 9 },
        ].map((op) => (
          <Pressable key={op.texto} accessibilityRole="button" accessibilityLabel={op.texto}
            onPress={() => fijar(op.dias, op.hora)} style={e.chip}>
            <Text style={e.chipTexto}>{op.texto}</Text>
          </Pressable>
        ))}
      </View>

      <Campo
        placeholder="O escribe la hora: 08:30"
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="Hora"
        onChangeText={(t) => {
          const hora = leerHora(t);
          if (hora === null || agenda.programada_para === null) return;
          const cuando = new Date(agenda.programada_para);
          cuando.setHours(hora.horas, hora.minutos, 0, 0);
          cambiar({ ...agenda, programada_para: cuando.toISOString() });
        }}
      />

      <Text style={tipo.etiqueta}>Se repite</Text>
      <View style={e.fila}>
        {REPETICIONES.map((r) => {
          const activo = r === agenda.repite;
          return (
            <Pressable key={r} accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={comoSeRepite(r)}
              onPress={() => cambiar({ ...agenda, repite: r })}
              style={[e.chip, activo ? { backgroundColor: color.marca } : null]}>
              <Text style={[e.chipTexto, activo ? { color: color.sobreMarca, fontWeight: "600" } : null]}>
                {comoSeRepite(r)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={e.nota}>
        <Icono nombre="aviso" tamano={17} tono={color.ambar} />
        <Text style={e.notaTexto}>
          {hayAvisos
            ? "A esa hora te llega un aviso y grabas con un toque. La aplicación no puede prender el micrófono sola: ni Android ni iOS lo permiten, y es mejor así."
            : AVISO_SIN_AVISOS}
        </Text>
      </View>
    </View>
  );
}

/** "8:30", "08.30", "0830" → 8 y 30. Null si no se entiende. */
export function leerHora(escrito: string): { horas: number; minutos: number } | null {
  const limpio = escrito.trim().replace(/[.\s]/g, ":");
  const con = /^(\d{1,2}):(\d{2})$/.exec(limpio);
  const sin = /^(\d{2})(\d{2})$/.exec(limpio.replace(/:/g, ""));
  const m = con ?? sin;
  if (!m) return null;

  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) return null;
  return { horas, minutos };
}

const e = StyleSheet.create({
  abrir: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    borderWidth: 1, borderColor: color.bordeFuerte, borderStyle: "dashed",
    borderRadius: radio.tarjeta, padding: espacio.m,
  },
  abrirTexto: { fontSize: 14, fontWeight: "600", color: color.marca },
  caja: {
    gap: espacio.s, padding: espacio.m, backgroundColor: color.papel,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.tarjeta,
  },
  encabezado: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cuando: { ...tipo.subtitulo, ...cifras, fontSize: 19 },
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: color.elemento, borderRadius: radio.pastilla,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipTexto: { fontSize: 13, color: color.textoSuave, fontWeight: "600" },
  nota: {
    flexDirection: "row", gap: espacio.s, alignItems: "flex-start",
    padding: espacio.m, backgroundColor: tenue(color.ambar), borderRadius: radio.tarjeta,
  },
  notaTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20, flex: 1 },
});
