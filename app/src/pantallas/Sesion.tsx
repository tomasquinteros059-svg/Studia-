import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Campo, Titulo } from "../ui/componentes.tsx";
import { color, espacio, radio, tipo } from "../ui/tema.ts";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase.ts";
import { caminoDe, comoSePresenta } from "../dominio/acceso.ts";
import { LARGO_MINIMO, hayAlgoQueMandar, revisarClaveNueva } from "../dominio/clave.ts";

export default function Sesion() {
  // El correo primero, y recién después la clave. No es un capricho de
  // pantalla: el dominio decide por dónde entra la persona —con los ramos de
  // su institución o armando el suyo— y conviene decírselo antes de que se
  // haga una idea equivocada.
  //
  // Ya no empieza por una bienvenida: quien llega acá viene de la portada,
  // que es donde se cuenta qué es esto. Repetirlo sería una pantalla de más
  // entre la persona y su cuenta.
  const [modo, setModo] = useState<"correo" | "entrar" | "crear">("correo");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Lo que salió bien, que no es lo mismo que un error y no se pinta igual.
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    setError(null);
    setAviso(null);

    // Dos reglas distintas a propósito. Al crear la cuenta se exige una clave
    // decente; al entrar no se exige nada, porque quien ya tiene una cuenta
    // con una clave corta tiene derecho a entrar con ella.
    if (modo === "crear") {
      const revision = revisarClaveNueva(clave, clave);
      if (!revision.sirve) { setError(revision.problema); return; }
    }
    if (!hayAlgoQueMandar(correo, clave)) {
      setError("Escribe tu correo y tu clave.");
      return;
    }

    setOcupado(true);
    try {
      if (modo === "crear") {
        const { data, error: falla } = await supabase.auth.signUp({
          email: correo.trim(),
          password: clave,
          options: { data: { nombre: nombre.trim() || correo.split("@")[0] } },
        });
        if (falla) { setError(traducir(falla.message)); return; }

        // Con la confirmación por correo activada —que es lo que trae Supabase
        // por omisión— acá no viene error **ni** sesión: hay que ir a leer el
        // correo. Sin este aviso, la pantalla se quedaba igual y en silencio,
        // y la persona apretaba «Crear cuenta» tres veces antes de irse.
        if (!data.session) {
          setAviso(`Te mandamos un correo a ${correo.trim()}. Ábrelo para confirmar tu `
            + "cuenta y ya puedes entrar. Si no llega, mira en «spam» o en «promociones».");
          setModo("entrar");
          setClave("");
        }
        return;
      }

      const { error: falla } = await supabase.auth.signInWithPassword({
        email: correo.trim(), password: clave,
      });
      if (falla) setError(traducir(falla.message));
    } catch {
      setError("No pude conectar. Revisa tu internet.");
    } finally {
      setOcupado(false);
    }
  }

  /**
   * El correo para volver a entrar cuando se perdió la clave.
   *
   * `redirectTo` vuelve a la aplicación por su propio esquema. Para que
   * Supabase lo acepte hay que tenerlo en la lista de direcciones permitidas
   * del proyecto; si no está, el correo llega igual y el enlace no abre nada.
   */
  async function recuperar() {
    if (!correo.trim()) { setError("Escribe tu correo primero."); return; }
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      const { error: falla } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
        redirectTo: Linking.createURL("recuperar"),
      });
      // Se dice lo mismo haya cuenta o no. Contestar distinto sería una manera
      // cómoda de averiguar qué correos tienen cuenta en StudIA.
      if (falla && !falla.message.toLowerCase().includes("not found")) {
        setError("No pude mandar el correo. Revisa tu internet e inténtalo de nuevo.");
        return;
      }
      setAviso(`Si ${correo.trim()} tiene cuenta, le llega un enlace para poner una clave `
        + "nueva. Dura una hora. Revisa también «spam».");
    } catch {
      setError("No pude conectar. Revisa tu internet.");
    } finally {
      setOcupado(false);
    }
  }

  const camino = caminoDe(correo);

  if (modo === "correo") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[e.pantalla, e.centrado]}
      >
        <Titulo>¿Cuál es tu correo?</Titulo>
        <Text style={e.sub}>
          Si estudias en una institución con convenio, usa el correo que te dio
          ella: tus ramos aparecen solos. Si no, cualquier correo sirve.
        </Text>

        <Campo placeholder="tucorreo@ejemplo.cl" value={correo} onChangeText={setCorreo}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          autoFocus accessibilityLabel="Correo" onSubmitEditing={() => {
            if (camino.tipo !== "invalido") setModo("entrar");
          }} returnKeyType="next" />

        {aviso ? <Text style={e.aviso2}>{aviso}</Text> : null}
        {error ? <Text style={e.error}>{error}</Text> : null}

        {/* Se dice qué va a pasar antes de pedir la clave, no después. */}
        {correo.trim().length > 0 ? (
          <View style={[e.aviso, camino.tipo === "invalido" ? e.avisoMalo : null]}>
            <Text style={[e.avisoTexto, camino.tipo === "invalido" ? e.avisoTextoMalo : null]}>
              {comoSePresenta(camino)}
            </Text>
          </View>
        ) : null}

        <Boton
          texto="Continuar"
          onPress={() => setModo("entrar")}
          deshabilitado={camino.tipo === "invalido"}
        />

      </KeyboardAvoidingView>
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

      <Pressable onPress={() => { setModo("correo"); setError(null); setAviso(null); }}
        accessibilityRole="button" accessibilityLabel={`Cambiar el correo, ahora ${correo}`}
        style={e.correoElegido}>
        <Text style={e.correoTexto} numberOfLines={1}>{correo}</Text>
        <Text style={e.correoCambiar}>Cambiar</Text>
      </Pressable>
      <Campo placeholder={creando ? `Contraseña (mín. ${LARGO_MINIMO})` : "Contraseña"}
        value={clave} onChangeText={setClave}
        secureTextEntry accessibilityLabel="Contraseña" />

      {aviso ? <Text style={e.aviso2}>{aviso}</Text> : null}
      {error ? <Text style={e.error}>{error}</Text> : null}

      <Boton
        texto={ocupado ? "Un momento…" : creando ? "Crear cuenta" : "Iniciar sesión"}
        onPress={enviar}
        deshabilitado={ocupado}
      />

      {/* Solo al entrar: a quien está creando la cuenta ofrecerle recuperar
          una clave que todavía no tiene lo único que hace es confundir. */}
      {creando ? null : (
        <Pressable onPress={recuperar} disabled={ocupado} accessibilityRole="button">
          <Text style={e.enlace}>Olvidé mi clave</Text>
        </Pressable>
      )}

      <Pressable accessibilityRole="button"
        onPress={() => { setModo(creando ? "entrar" : "crear"); setError(null); setAviso(null); }}>
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
  if (m.includes("weak") || m.includes("pwned")) return "Esa clave es muy fácil de adivinar. Usa una frase más larga.";
  if (m.includes("password")) return `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`;
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  }
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
  // Lo que salió bien no se pinta del color de un error, que es lo primero
  // que mira el ojo cuando algo aparece de golpe en una pantalla.
  aviso2: {
    ...tipo.cuerpo, color: color.texto, lineHeight: 20, textAlign: "center",
    backgroundColor: color.elemento, borderRadius: radio.tarjeta, padding: espacio.m,
  },

  aviso: { backgroundColor: color.elemento, borderRadius: radio.tarjeta, padding: espacio.m },
  avisoMalo: { backgroundColor: `${color.vivo}14` },
  avisoTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20 },
  avisoTextoMalo: { color: color.vivo },

  correoElegido: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: espacio.s, borderWidth: 1, borderColor: color.borde,
    borderRadius: radio.campo, paddingHorizontal: espacio.m, paddingVertical: 13,
  },
  correoTexto: { flex: 1, ...tipo.cuerpo, color: color.texto },
  correoCambiar: { fontSize: 13, fontWeight: "600", color: color.marca },
  enlace: { color: color.marca, fontWeight: "600", fontSize: 13.5, textAlign: "center" },
});
