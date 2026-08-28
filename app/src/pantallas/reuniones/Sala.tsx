import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Boton } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
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
      <View style={e.caja}>
        <Text style={tipo.etiqueta}>La sala</Text>
        <Text style={e.gente}>{nombres(reunion)}</Text>
      </View>
    );
  }

  return (
    <View style={e.caja}>
      <Text style={tipo.etiqueta}>Compartir con los que estuvieron</Text>

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
    </View>
  );
}

const nombres = (r: ReunionCompleta): string =>
  r.sala.map((p) => p.nombre).join(" · ");

/** Para el lector de pantalla: un código se dicta letra por letra. */
const deletreado = (codigo: string): string => codigo.split("").join(" ");

const e = StyleSheet.create({
  caja: {
    margin: espacio.m, padding: espacio.m, gap: espacio.s,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.tarjeta,
  },
  explica: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 20 },
  codigoCaja: {
    alignItems: "center", paddingVertical: espacio.m,
    backgroundColor: tenue(color.marca), borderRadius: radio.tarjeta,
  },
  codigo: {
    fontSize: 30, fontWeight: "700", color: color.marca, letterSpacing: 3,
  },
  gente: { ...tipo.cuerpo, color: color.texto, lineHeight: 20 },
  enlace: { color: color.marca, fontWeight: "600", fontSize: 13, paddingTop: 4 },
});
