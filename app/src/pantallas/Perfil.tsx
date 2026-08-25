import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Boton, Campo, Cargando, Encabezado, Error, Pantalla } from "../ui/componentes.tsx";
import { color, espacio, tipo } from "../ui/tema.ts";
import { cambiarNombre, miPerfil } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { supabase } from "../lib/supabase.ts";

export default function Perfil() {
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
          <Text style={e.iniciales}>{iniciales(datos.nombre)}</Text>
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
    </Pantalla>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.replace(/\./g, "").split(" ").filter(Boolean);
  return `${partes[0]?.[0] ?? ""}${partes[1]?.[0] ?? ""}`.toUpperCase();
}

const e = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: espacio.xl, gap: 6 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: color.marca,
    alignItems: "center", justifyContent: "center",
  },
  iniciales: { color: color.sobreMarca, fontSize: 26, fontWeight: "700" },
  nombre: { fontSize: 20, fontWeight: "600", color: color.texto },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
});
