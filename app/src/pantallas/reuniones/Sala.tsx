import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Encabezado, Hoja } from "../../ui/componentes.tsx";
import { color, espacio, monoespaciada, radio, tenue, tipo } from "../../ui/tema.ts";
import { HORAS_ABIERTA, comoEsta, comoSeMuestra, sePuedeEntrar } from "../../dominio/sala.ts";
import { comoSala, type ReunionCompleta } from "../../lib/tipos-reunion.ts";

/**
 * La sala, dentro de la reunión.
 *
 * Es lo que resuelve el caso real: en una asamblea con treinta personas o en
 * una sala de clases, graba una sola —la que tiene el teléfono a mano— y el
 * acta le sirve a todos. Invitarlos de a uno buscándolos por nombre no ocurre
 * nunca; dictar un código de seis letras, sí.
 *
 * El código solo lo ve el dueño. Quien entró por la sala no tiene por qué
 * poder repartir la reunión.
 */
export default function Sala({
  reunion, abrir, cerrar,
}: {
  reunion: ReunionCompleta;
  abrir: () => Promise<void>;
  cerrar: () => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const abierta = sePuedeEntrar(comoSala(reunion));
  const cuantos = reunion.sala.length;

  const hacer = async (que: () => Promise<void>) => {
    setOcupado(true);
    try { await que(); } finally { setOcupado(false); }
  };

  if (!reunion.mia) {
    // Quien entró con un código ve que no está solo, y nada más.
    if (cuantos === 0) return null;
    return (
      <>
        <Encabezado texto="La sala" />
        <Hoja><Text style={e.gente}>{nombres(reunion)}</Text></Hoja>
      </>
    );
  }

  return (
    <>
      <Encabezado texto="Compartir con los que estuvieron" />
      <Hoja>

      {abierta && reunion.codigo ? (
        <>
          <Text style={e.explica}>
            Dicta este código. Quien lo escriba recibe el acta y las tareas.
          </Text>
          <View style={e.codigoCaja}>
            <Text style={e.codigo} accessibilityLabel={`Código de la sala: ${deletreado(reunion.codigo)}`}>
              {comoSeMuestra(reunion.codigo)}
            </Text>
          </View>
          <Text style={tipo.detalle}>
            {comoEsta(comoSala(reunion), cuantos)} Sirve por {HORAS_ABIERTA} horas.
          </Text>
          {cuantos > 0 ? <Text style={e.gente}>{nombres(reunion)}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar la sala"
            disabled={ocupado} onPress={() => void hacer(cerrar)}>
            <Text style={e.enlace}>Cerrar la sala</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={e.explica}>
            {cuantos > 0
              ? `${comoEsta(comoSala(reunion), cuantos)} Puedes volver a abrirla con un código nuevo.`
              : "Abre la sala y dicta el código. Los que estuvieron en la reunión reciben el acta y las tareas sin que tengas que buscarlos uno por uno."}
          </Text>
          <Boton
            texto={ocupado ? "Abriendo…" : "Abrir la sala"}
            variante="suave"
            onPress={() => void hacer(abrir)}
            deshabilitado={ocupado}
          />
        </>
      )}
      </Hoja>
    </>
  );
}

const nombres = (r: ReunionCompleta): string =>
  r.sala.map((p) => p.nombre).join(" · ");

/** Para el lector de pantalla: un código se dicta letra por letra. */
const deletreado = (codigo: string): string => codigo.split("").join(" ");

const e = StyleSheet.create({
  explica: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21 },
  // El código se muestra como un sello: es lo que hay que dictar en voz alta
  // y por eso es lo único de la pantalla que grita.
  codigoCaja: {
    alignItems: "center", paddingVertical: espacio.l,
    backgroundColor: tenue(color.marca), borderRadius: radio.tarjeta,
    borderWidth: 1.2, borderColor: tenue(color.marca), borderStyle: "dashed",
  },
  codigo: {
    fontFamily: monoespaciada,
    fontSize: 31, fontWeight: "700", color: color.marca, letterSpacing: 5,
  },
  gente: { ...tipo.cuerpo, lineHeight: 21 },
  enlace: { color: color.marca, fontWeight: "700", fontSize: 13, paddingTop: 4 },
});
