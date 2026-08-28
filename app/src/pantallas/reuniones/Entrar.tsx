import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Boton, Campo, HojaModal } from "../../ui/componentes.tsx";
import { color, espacio, monoespaciada, radio, tenue, tipo } from "../../ui/tema.ts";
import { LARGO, normalizarCodigo } from "../../dominio/sala.ts";

/**
 * Entrar a la sala de otro con el código que le dictaron.
 *
 * El código se dicta en voz alta y se escribe mal: se acepta en minúsculas,
 * con espacios, con guion, y con las confusiones de siempre —el 1 por la L,
 * el 0 por la O— ya corregidas. Rechazar a alguien por eso sería rechazarlo
 * por algo que hicimos nosotros al elegir las letras.
 */
export default function Entrar({
  abierto, cerrar, entrar,
}: {
  abierto: boolean;
  cerrar: () => void;
  entrar: (codigo: string) => Promise<string | null>;
}) {
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const servible = normalizarCodigo(codigo) !== null;

  const enviar = async () => {
    setOcupado(true);
    setFalla(null);
    try {
      const id = await entrar(codigo);
      if (id === null) {
        setFalla("Ese código no sirve. Puede estar mal escrito, o la sala ya se cerró.");
        return;
      }
      setCodigo("");
      cerrar();
    } catch {
      setFalla("No pude conectar. Revisa tu internet.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <HojaModal abierto={abierto} cerrar={cerrar} titulo="Entrar a una sala">
      <Text style={e.explica}>
        Si alguien grabó una reunión en la que estuviste, te va a dictar un
        código de {LARGO} letras. Escríbelo acá y recibes el acta y las tareas.
      </Text>

      <Campo
        style={e.campoCodigo}
        placeholder="ACD-234"
        value={codigo}
        onChangeText={(t) => { setCodigo(t); setFalla(null); }}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={LARGO + 3}
        accessibilityLabel="Código de la sala"
        onSubmitEditing={() => { if (servible) void enviar(); }}
      />

      {falla ? (
        <View style={e.falla}><Text style={e.fallaTexto}>{falla}</Text></View>
      ) : null}

      <Boton
        texto={ocupado ? "Entrando…" : "Entrar"}
        onPress={() => void enviar()}
        deshabilitado={!servible || ocupado}
      />
    </HojaModal>
  );
}

const e = StyleSheet.create({
  explica: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 22 },
  campoCodigo: {
    fontFamily: monoespaciada,
    fontSize: 27, fontWeight: "700", letterSpacing: 5,
    textAlign: "center", paddingVertical: espacio.l,
  },
  falla: {
    padding: espacio.m, backgroundColor: tenue(color.vivo), borderRadius: radio.tarjeta,
  },
  fallaTexto: { ...tipo.cuerpo, lineHeight: 21 },
});
