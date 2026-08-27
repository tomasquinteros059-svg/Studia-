import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Boton, Cargando, Error, Pantalla, Vacio } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import { analizarReunion, reunionPorId } from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { equipoDe } from "../../dominio/rubros.ts";
import type { PropsPila } from "../../lib/rutas.ts";

type Props = PropsPila<"Grabar">;

/**
 * Grabar la reunión, o pegar lo que se dijo.
 *
 * Grabar desde el micrófono todavía no transcribe: falta conectar el
 * reconocimiento de voz. Pegar el texto sí funciona de punta a punta y es lo
 * que permite probar el equipo hoy —mucha de esta gente ya sale de la reunión
 * con una transcripción de Teams o de Meet en la mano—, así que está primero
 * y no escondido detrás de un botón que no anda.
 */
export default function Grabar({ route, navigation }: Props) {
  const { reunionId } = route.params;
  const [texto, setTexto] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const traer = useCallback(() => reunionPorId(reunionId), [reunionId]);
  const { datos: reunion, cargando, error, recargar } = usarCarga(traer, [reunionId]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!reunion) return <Vacio texto="No encontré esa reunión." />;

  const equipo = equipoDe(reunion.rubro);
  const hayTexto = texto.trim().length > 40;

  const analizar = async () => {
    setAnalizando(true);
    setFalla(null);
    try {
      await analizarReunion(reunionId, texto.trim());
      navigation.replace("Reunion", { reunionId });
    } catch (err) {
      setFalla(err instanceof globalThis.Error ? err.message : "No pude analizar la reunión.");
    } finally {
      setAnalizando(false);
    }
  };

  return (
    <Pantalla>
      <View style={e.equipo}>
        <Text style={tipo.etiqueta}>Tu equipo para esta reunión</Text>
        {equipo.agentes.map((a, i) => (
          <View key={a.papel} style={e.agente}>
            <Text style={e.paso}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={e.agenteNombre}>{a.nombre}</Text>
              <Text style={tipo.detalle}>{a.hace}</Text>
            </View>
          </View>
        ))}
      </View>

      {equipo.cuidado ? (
        <View style={e.cuidado}>
          <Icono nombre="aviso" tamano={18} tono={color.ambar} />
          <Text style={e.cuidadoTexto}>{equipo.cuidado}</Text>
        </View>
      ) : null}

      <Text style={[tipo.etiqueta, e.margen]}>Lo que se dijo</Text>
      <TextInput
        style={e.papel}
        value={texto}
        onChangeText={setTexto}
        multiline
        textAlignVertical="top"
        placeholder={"Pega acá la transcripción de la reunión.\n\nSirve la de Teams, la de Meet o la que hayas escrito. No importa si viene desordenada: eso lo arregla quien escucha."}
        placeholderTextColor="#9AA0A6"
        accessibilityLabel="Transcripción de la reunión"
      />

      {falla ? (
        <View style={e.falla}><Text style={e.fallaTexto}>{falla}</Text></View>
      ) : null}

      <View style={e.acciones}>
        <Boton
          texto={analizando ? "El equipo está trabajando…" : "Analizar la reunión"}
          onPress={() => void analizar()}
          deshabilitado={!hayTexto || analizando}
        />
        {!hayTexto && texto.trim().length > 0 ? (
          <Text style={tipo.detalle}>Es muy poco texto para sacar algo útil.</Text>
        ) : null}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Grabar con el micrófono"
        disabled
        style={e.micro}>
        <Icono nombre="micro" tamano={20} tono={color.textoSuave} />
        <View style={{ flex: 1 }}>
          <Text style={e.microTitulo}>Grabar con el micrófono</Text>
          <Text style={tipo.detalle}>
            Todavía no transcribe: falta conectar el reconocimiento de voz.
          </Text>
        </View>
      </Pressable>

      <View style={{ height: espacio.xl }} />
    </Pantalla>
  );
}

const e = StyleSheet.create({
  equipo: {
    margin: espacio.m, padding: espacio.m, gap: espacio.s,
    backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
  agente: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  paso: {
    width: 22, height: 22, borderRadius: 11, textAlign: "center", lineHeight: 22,
    backgroundColor: color.marca, color: color.sobreMarca, fontSize: 12, fontWeight: "700",
  },
  agenteNombre: { fontSize: 14, fontWeight: "600", color: color.texto },

  cuidado: {
    flexDirection: "row", gap: espacio.s, alignItems: "flex-start",
    marginHorizontal: espacio.m, padding: espacio.m,
    backgroundColor: tenue(color.ambar), borderRadius: radio.tarjeta,
  },
  cuidadoTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20, flex: 1 },

  margen: { paddingHorizontal: espacio.m, paddingTop: espacio.m },
  papel: {
    margin: espacio.m, minHeight: 220, padding: espacio.m,
    fontSize: 15, lineHeight: 24, color: color.texto,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.campo,
  },
  falla: {
    marginHorizontal: espacio.m, padding: espacio.m,
    backgroundColor: tenue(color.vivo), borderRadius: radio.tarjeta,
  },
  fallaTexto: { ...tipo.cuerpo, color: color.texto },
  acciones: { paddingHorizontal: espacio.m, gap: espacio.s },

  micro: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    margin: espacio.m, padding: espacio.m, opacity: 0.55,
    borderWidth: 1, borderColor: color.borde, borderStyle: "dashed",
    borderRadius: radio.tarjeta,
  },
  microTitulo: { fontSize: 14, fontWeight: "600", color: color.texto },
});
