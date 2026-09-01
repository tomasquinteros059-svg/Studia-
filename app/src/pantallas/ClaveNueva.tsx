import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from "react-native";
import { Boton, Campo, Titulo } from "../ui/componentes.tsx";
import { color, espacio, radio, tipo } from "../ui/tema.ts";
import { supabase } from "../lib/supabase.ts";
import { LARGO_MINIMO, revisarClaveNueva } from "../dominio/clave.ts";

/**
 * La clave nueva, después de abrir el enlace del correo.
 *
 * Aparece por encima de todo y no dentro de la navegación: el enlace llega
 * cuando la persona no tiene sesión —por eso lo pidió— y en ese momento la
 * aplicación está mostrando la portada, que no tiene pila donde apilar nada.
 *
 * La sesión ya está abierta cuando esta pantalla se monta: el enlace la trae.
 * Por eso acá solo se cambia la clave, y por eso hay que salir si se cancela;
 * si no, quien abrió un enlace ajeno se quedaría dentro de la cuenta.
 */
export default function ClaveNueva({ listo }: { listo: () => void }) {
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    const revision = revisarClaveNueva(clave, repetida);
    if (!revision.sirve) { setError(revision.problema); return; }

    setError(null);
    setOcupado(true);
    try {
      const { error: falla } = await supabase.auth.updateUser({ password: clave });
      if (falla) {
        // El caso más común acá es que Supabase rechace una clave que ya se
        // usó o que esté en sus listas; decir «error» a secas no ayuda.
        setError(falla.message.toLowerCase().includes("password")
          ? "Esa clave no se puede usar. Prueba con una frase más larga."
          : "No pude guardarla. Revisa tu internet e inténtalo de nuevo.");
        return;
      }
      // Queda con la sesión abierta y adentro: pedirle que entre de nuevo con
      // la clave que acaba de escribir sería un paso de más sin motivo.
      listo();
    } catch {
      setError("No pude conectar. Revisa tu internet.");
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    // Sin esto, quien abre un enlace que no era para él se queda con la sesión
    // abierta dentro de una cuenta ajena.
    await supabase.auth.signOut();
    listo();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[e.pantalla, e.centrado]}
    >
      <Titulo>Tu clave nueva</Titulo>
      <Text style={e.sub}>
        Escríbela dos veces. Una frase que recuerdes sirve mejor que algo corto
        con símbolos.
      </Text>

      <Campo placeholder={`Clave nueva (mín. ${LARGO_MINIMO})`} value={clave} onChangeText={setClave}
        secureTextEntry autoFocus accessibilityLabel="Clave nueva" />
      <Campo placeholder="Otra vez la misma" value={repetida} onChangeText={setRepetida}
        secureTextEntry accessibilityLabel="Repetir la clave nueva" />

      {error ? <Text style={e.error}>{error}</Text> : null}

      <Boton texto={ocupado ? "Guardando…" : "Guardar y entrar"} onPress={guardar}
        deshabilitado={ocupado} />

      <Pressable onPress={cancelar} accessibilityRole="button">
        <Text style={e.enlace}>Cancelar</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  centrado: { justifyContent: "center", padding: 30, gap: 13 },
  sub: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 21 },
  error: { color: color.vivo, fontSize: 13.5, textAlign: "center" },
  enlace: { color: color.marca, fontWeight: "600", fontSize: 13.5, textAlign: "center" },
});

/** Un aviso a pantalla completa cuando el enlace ya no sirve. */
export function EnlaceInservible({ mensaje, listo }: { mensaje: string; listo: () => void }) {
  return (
    <KeyboardAvoidingView style={[e.pantalla, e.centrado]}>
      <Titulo>Ese enlace no sirve</Titulo>
      <Text style={[e.sub, a.mensaje]}>{mensaje}</Text>
      <Boton texto="Volver a la entrada" onPress={listo} />
    </KeyboardAvoidingView>
  );
}

const a = StyleSheet.create({
  mensaje: {
    backgroundColor: color.elemento, borderRadius: radio.tarjeta,
    padding: espacio.m, textAlign: "center",
  },
});
