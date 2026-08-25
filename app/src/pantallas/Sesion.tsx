import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Campo, Titulo } from "../ui/componentes.tsx";
import { color, espacio, tipo } from "../ui/tema.ts";
import { supabase } from "../lib/supabase.ts";

export default function Sesion() {
  const [modo, setModo] = useState<"bienvenida" | "entrar" | "crear">("bienvenida");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    setError(null);
    if (!correo.trim() || clave.length < 6) {
      setError("Revisa el correo y usa una clave de al menos 6 caracteres.");
      return;
    }
    setOcupado(true);
    try {
      const r = modo === "crear"
        ? await supabase.auth.signUp({
            email: correo.trim(),
            password: clave,
            options: { data: { nombre: nombre.trim() || correo.split("@")[0] } },
          })
        : await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });

      if (r.error) setError(traducir(r.error.message));
    } catch {
      setError("No pude conectar. Revisa tu internet.");
    } finally {
      setOcupado(false);
    }
  }

  if (modo === "bienvenida") {
    return (
      <View style={[e.pantalla, e.centrado]}>
        <View style={e.logo}>
          <Text style={e.logoTexto}>S</Text>
        </View>
        <Text style={e.marca}>StudIA</Text>
        <Text style={e.lema}>Aprende pensando, no copiando.</Text>
        <Text style={e.sub}>
          Tus clases, tu materia y tus tareas en un solo lugar.{"\n"}
          Y un tutor que te guía para que descubras la respuesta.
        </Text>
        <View style={{ width: "100%", marginTop: espacio.s }}>
          <Boton texto="Comenzar" onPress={() => setModo("entrar")} />
        </View>
      </View>
    );
  }

  const creando = modo === "crear";
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[e.pantalla, e.centrado]}
    >
      <Titulo>{creando ? "Crear cuenta" : "Hola de nuevo"}</Titulo>
      <Text style={e.sub}>
        {creando
          ? "Empieza con un tutor que te guía, no que te da la respuesta."
          : "Inicia sesión para seguir aprendiendo."}
      </Text>

      {creando ? (
        <Campo placeholder="Tu nombre" value={nombre} onChangeText={setNombre}
          autoCapitalize="words" accessibilityLabel="Tu nombre" />
      ) : null}

      <Campo placeholder="Correo" value={correo} onChangeText={setCorreo}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        accessibilityLabel="Correo" />
      <Campo placeholder="Contraseña (mín. 6)" value={clave} onChangeText={setClave}
        secureTextEntry accessibilityLabel="Contraseña" />

      {error ? <Text style={e.error}>{error}</Text> : null}

      <Boton
        texto={ocupado ? "Un momento…" : creando ? "Crear cuenta" : "Iniciar sesión"}
        onPress={enviar}
        deshabilitado={ocupado}
      />

      <Pressable onPress={() => { setModo(creando ? "entrar" : "crear"); setError(null); }}>
        <Text style={e.enlace}>
          {creando ? "¿Ya tienes cuenta? Iniciar sesión" : "¿No tienes cuenta? Crear cuenta"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

/** Los mensajes de Supabase vienen en inglés y son crípticos. */
function traducir(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login")) return "El correo o la contraseña no coinciden.";
  if (m.includes("already registered")) return "Ese correo ya tiene cuenta. Inicia sesión.";
  if (m.includes("email")) return "Revisa el correo que escribiste.";
  if (m.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
  return "No pude completar la operación. Inténtalo de nuevo.";
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  centrado: { justifyContent: "center", padding: 30, gap: 13 },
  logo: {
    width: 66, height: 66, borderRadius: 19, backgroundColor: color.marca,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
  },
  logoTexto: { color: color.sobreMarca, fontSize: 32, fontWeight: "700" },
  marca: { fontSize: 36, fontWeight: "600", textAlign: "center", color: color.texto },
  lema: { fontSize: 18, fontWeight: "600", color: color.textoSuave, textAlign: "center" },
  sub: { ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 21 },
  error: { color: color.vivo, fontSize: 13.5, textAlign: "center" },
  enlace: { color: color.marca, fontWeight: "600", fontSize: 13.5, textAlign: "center" },
});
