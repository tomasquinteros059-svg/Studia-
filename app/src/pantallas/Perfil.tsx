import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Boton, Campo, Cargando, Encabezado, Error, Fila, Pantalla } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { cifras, color, espacio, tipo } from "../ui/tema.ts";
import { cambiarNombre, miPerfil } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { supabase } from "../lib/supabase.ts";
import { MODO_DEMO } from "../lib/config.ts";
import { salir } from "../lib/perfiles-demo.ts";
import { inicialesDePersona } from "../dominio/personas.ts";
import { VERSION_VISIBLE } from "../lib/version.ts";
import { aviso } from "../dominio/legales.ts";
import type { PropsPila } from "../lib/rutas.ts";

export default function Perfil({ navigation }: PropsPila<"Perfil">) {
  const { datos, cargando, error, recargar } = usarCarga(miPerfil, []);
  const [nombre, setNombre] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = useCallback(async () => {
    const limpio = (nombre ?? "").trim();
    if (!limpio) { Alert.alert("El nombre no puede quedar vacío."); return; }
    setGuardando(true);
    try {
      await cambiarNombre(limpio);
      setNombre(null);
      recargar();
      Alert.alert("Listo", "Tu nombre quedó actualizado.");
    } catch (err) {
      Alert.alert("No pude guardarlo", err instanceof globalThis.Error ? err.message : "");
    } finally {
      setGuardando(false);
    }
  }, [nombre, recargar]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const valor = nombre ?? datos.nombre;
  const cambio = valor.trim() !== datos.nombre;

  return (
    <Pantalla>
      <View style={e.hero}>
        <View style={e.avatar}>
          <Text style={e.iniciales}>{inicialesDePersona(datos.nombre)}</Text>
        </View>
        <Text style={e.nombre}>{datos.nombre}</Text>
        <Text style={tipo.detalle}>{datos.correo}</Text>
      </View>

      <Encabezado texto="Tu nombre" />
      <View style={{ paddingHorizontal: espacio.m, gap: 9 }}>
        <Campo value={valor} onChangeText={setNombre} accessibilityLabel="Tu nombre"
          autoCapitalize="words" />
        <Text style={tipo.detalle}>
          Es el nombre con el que apareces en el foro de tus asignaturas.
        </Text>
        {cambio ? (
          <Boton texto={guardando ? "Guardando…" : "Guardar"} onPress={guardar} deshabilitado={guardando} />
        ) : null}
      </View>

      <Encabezado texto="Sesión" />
      <View style={{ paddingHorizontal: espacio.m }}>
        <Boton texto="Cerrar sesión" variante="suave" onPress={() => supabase.auth.signOut()} />
      </View>

      <Text style={e.pie}>
        Tu correo no se guarda en la base de datos de la app: sale de tu sesión.
        Nadie más puede verlo.
      </Text>

      {/* Los textos legales se leen desde acá y no desde un enlace a la web:
          quien aceptó unos términos tiene derecho a leerlos, y en la sala
          donde no hay señal un enlace no sirve de nada. */}
      <Encabezado texto="Legal" />
      <Fila titulo="Términos de uso" detalle="Las reglas de StudIA"
        derecha={<Icono nombre="siguiente" tamano={18} tono={color.textoTenue} />}
        onPress={() => navigation.navigate("Legal", { que: "terminos" })} />
      <Fila titulo="Política de privacidad" detalle="Qué se guarda y qué no"
        derecha={<Icono nombre="siguiente" tamano={18} tono={color.textoTenue} />}
        onPress={() => navigation.navigate("Legal", { que: "privacidad" })} />
      <Fila titulo="Licencias de terceros" detalle="Las bibliotecas sobre las que está hecha"
        derecha={<Icono nombre="siguiente" tamano={18} tono={color.textoTenue} />}
        onPress={() => navigation.navigate("Legal", { que: "terceros" })} />

      <Text style={e.copyright}>{aviso(new Date().getFullYear())}</Text>

      {/* Para saber qué versión estás probando sin tener que adivinar. */}
      {VERSION_VISIBLE ? <Text style={e.version}>{VERSION_VISIBLE}</Text> : null}

      {MODO_DEMO ? (
        <View style={{ paddingHorizontal: espacio.l, paddingBottom: espacio.l }}>
          <Boton texto="Cambiar de perfil" onPress={salir} />
        </View>
      ) : null}
    </Pantalla>
  );
}

const e = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: espacio.xl, gap: espacio.s },
  avatar: {
    width: 84, height: 84, borderRadius: 28, backgroundColor: color.marca,
    alignItems: "center", justifyContent: "center",
  },
  iniciales: { color: color.sobreMarca, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  nombre: { ...tipo.titulo },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
  version: {
    ...tipo.detalle, ...cifras, color: color.textoTenue,
    textAlign: "center", paddingBottom: espacio.l,
  },
  copyright: {
    ...tipo.detalle, color: color.textoTenue,
    textAlign: "center", paddingTop: espacio.l,
  },
});
