import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./src/lib/supabase.ts";
import { AVISO_DEMO, MODO_DEMO } from "./src/lib/config.ts";
import { color } from "./src/ui/tema.ts";
import type { RutasPestanas, RutasPila } from "./src/lib/rutas.ts";

import Sesion from "./src/pantallas/Sesion.tsx";
import Perfil from "./src/pantallas/Perfil.tsx";
import Reuniones from "./src/pantallas/reuniones/Reuniones.tsx";
import Reunion from "./src/pantallas/reuniones/Reunion.tsx";
import Grabar from "./src/pantallas/reuniones/Grabar.tsx";
import Tareas from "./src/pantallas/reuniones/Tareas.tsx";
import { Icono } from "./src/ui/Icono.tsx";

const Pila = createNativeStackNavigator<RutasPila>();
const Pestanas = createBottomTabNavigator<RutasPestanas>();

const ICONO_PESTANA = {
  Reuniones: "equipo", Tareas: "tareas", Apuntes: "documento",
} as const;

function Principal() {
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.marca,
        tabBarInactiveTintColor: color.textoSuave,
        tabBarIcon: ({ color: tono, size }) => (
          <Icono nombre={ICONO_PESTANA[route.name]} tamano={size} tono={tono} />
        ),
        tabBarLabelStyle: { fontSize: 10.5 },
      })}
    >
      <Pestanas.Screen name="Reuniones" component={Reuniones} />
      <Pestanas.Screen name="Tareas" component={Tareas} />
    </Pestanas.Navigator>
  );
}

export default function App() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    // En demostración no hay a quién preguntarle por la sesión: se entra directo.
    if (MODO_DEMO) { setListo(true); return; }

    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setListo(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!listo) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.fondo }}>
        <ActivityIndicator color={color.marca} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {MODO_DEMO ? (
        <SafeAreaView edges={["top"]} style={cinta.fondo}>
          <Text style={cinta.texto}>{AVISO_DEMO}</Text>
        </SafeAreaView>
      ) : null}
      <NavigationContainer>
        {!sesion && !MODO_DEMO ? (
          <Sesion />
        ) : (
          <Pila.Navigator
            screenOptions={{
              headerTintColor: color.marca,
              headerTitleStyle: { color: color.texto, fontSize: 15 },
            }}
          >
            <Pila.Screen name="Principal" component={Principal} options={{ headerShown: false }} />
            <Pila.Screen name="Reunion" component={Reunion} options={{ title: "Reunión" }} />
            <Pila.Screen name="Grabar" component={Grabar} options={{ title: "Grabar la reunión" }} />
            <Pila.Screen name="Perfil" component={Perfil} options={{ title: "Mi perfil" }} />
          </Pila.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const cinta = StyleSheet.create({
  fondo: { backgroundColor: color.marcaOscura },
  texto: {
    color: "#fff", fontSize: 11.5, fontWeight: "600",
    textAlign: "center", paddingVertical: 5, letterSpacing: 0.2,
  },
});
