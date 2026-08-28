import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Baldosa, Boton, HojaModal } from "../../ui/componentes.tsx";
import {
  COLORES_DE_RAMO, FILETE, cifras, color, diaCorto, espacio, inicialesDeRamo,
  radio, tenue, tipo,
} from "../../ui/tema.ts";
import {
  colorDeLaCarga, cuantosBloques, leerHorario, unir, type RamoEscrito,
} from "../../dominio/horario-escrito.ts";

const EJEMPLO = `Cálculo I
lunes 8:30 a 10:00 sala B-104
miércoles 8:30 a 10:00

Física I, martes 14:00-16:00 lab
jueves 14:00-16:00`;

/**
 * Cargar el semestre entero escribiéndolo, en vez de ramo por ramo.
 *
 * Lo que se pega casi nunca está perfecto, así que la pantalla muestra
 * siempre lo que va a crear —los ramos con sus días y sus horas— y aparte
 * las líneas que no entendió. Crear a ciegas seis ramos mal escritos y
 * tener que borrarlos uno por uno sería peor que el formulario que esto
 * viene a reemplazar.
 */
export default function CargarHorario({
  abierto, cerrar, cargar, yaTengo,
}: {
  abierto: boolean;
  cerrar: () => void;
  cargar: (ramos: RamoEscrito[]) => Promise<void>;
  /** Ramos propios que ya existen, para seguir la paleta donde quedó. */
  yaTengo: number;
}) {
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const leido = useMemo(() => leerHorario(texto), [texto]);
  const bloques = cuantosBloques(leido);
  const sePuede = leido.ramos.length > 0 && !ocupado;

  const enviar = async () => {
    setOcupado(true);
    try {
      await cargar(leido.ramos);
      setTexto("");
      cerrar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <HojaModal abierto={abierto} cerrar={cerrar} titulo="Cargar mi horario">
      <Text style={e.bajada}>
        Escribe o pega tu horario tal como lo tengas. Un ramo por línea, y
        debajo sus días y horas. De ahí salen todos tus ramos de una vez.
      </Text>

      <TextInput
        style={e.papel}
        value={texto}
        onChangeText={setTexto}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        autoCorrect={false}
        placeholder={EJEMPLO}
        placeholderTextColor={color.textoTenue}
        accessibilityLabel="Tu horario"
      />

      {leido.ramos.length > 0 ? (
        <>
          <Text style={tipo.etiqueta}>
            {leido.ramos.length === 1 ? "Se va a crear" : `Se van a crear ${leido.ramos.length} ramos`}
            {bloques > 0 ? ` · ${bloques} ${bloques === 1 ? "bloque" : "bloques"}` : ""}
          </Text>

          <View style={e.vista}>
            {leido.ramos.map((r, i) => {
              const tono = colorDeLaCarga(i, yaTengo, COLORES_DE_RAMO);
              return (
                <View key={r.nombre} style={[e.ramo, i > 0 ? e.conFilete : null]}>
                  <Baldosa tono={tono} texto={inicialesDeRamo(r.nombre)} tamano={38} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={tipo.fila} numberOfLines={2}>{r.nombre}</Text>
                    {r.bloques.length === 0 ? (
                      <Text style={tipo.detalle}>Sin horas fijas</Text>
                    ) : (
                      r.bloques.map((b, j) => (
                        <Text key={j} style={[tipo.detalle, cifras]}>
                          {unir([`${diaCorto(b.dia)} ${b.inicio}–${b.fin}`, b.sala])}
                        </Text>
                      ))
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {leido.reparos.length > 0 ? (
        <View style={e.reparos}>
          <Text style={e.reparosTitulo}>
            {leido.reparos.length === 1
              ? "Hay una línea que no entendí"
              : `Hay ${leido.reparos.length} líneas que no entendí`}
          </Text>
          {leido.reparos.map((r) => (
            <Text key={r.linea} style={e.reparo}>
              <Text style={e.reparoLinea}>Línea {r.linea}: </Text>
              «{r.texto}». {r.motivo}
            </Text>
          ))}
          <Text style={e.reparoPie}>
            El resto se crea igual. Puedes arreglarlas ahora o agregarlas después.
          </Text>
        </View>
      ) : null}

      <Boton
        texto={ocupado ? "Creando…" : "Crear mis ramos"}
        onPress={() => void enviar()}
        deshabilitado={!sePuede}
      />
    </HojaModal>
  );
}

const e = StyleSheet.create({
  bajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 22 },
  papel: {
    minHeight: 190, padding: espacio.m, fontSize: 16, lineHeight: 26,
    color: color.texto, backgroundColor: color.papel,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.campo,
  },

  vista: {
    backgroundColor: color.papel,
    borderWidth: FILETE, borderColor: color.borde, borderRadius: radio.tarjeta,
    overflow: "hidden",
  },
  ramo: {
    flexDirection: "row", alignItems: "flex-start", gap: espacio.m,
    padding: espacio.m,
  },
  conFilete: { borderTopWidth: FILETE, borderTopColor: color.borde },

  reparos: {
    backgroundColor: tenue(color.ambar), borderRadius: radio.tarjeta,
    padding: espacio.m, gap: espacio.s,
  },
  reparosTitulo: { ...tipo.fila },
  reparo: { ...tipo.detalle, color: color.texto, lineHeight: 20 },
  reparoLinea: { fontWeight: "700" },
  reparoPie: { ...tipo.detalle, lineHeight: 19 },
});
