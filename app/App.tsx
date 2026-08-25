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
import Inicio from "./src/pantallas/Inicio.tsx";
import Horario from "./src/pantallas/Horario.tsx";
import Tareas from "./src/pantallas/Tareas.tsx";
import Tutor from "./src/pantallas/Tutor.tsx";
import Asignatura from "./src/pantallas/Asignatura.tsx";
import Notas from "./src/pantallas/Notas.tsx";
import Notificaciones from "./src/pantallas/Notificaciones.tsx";
import Hilo from "./src/pantallas/Hilo.tsx";
import NuevoHilo from "./src/pantallas/NuevoHilo.tsx";
import Tarea from "./src/pantallas/Tarea.tsx";
import Perfil from "./src/pantallas/Perfil.tsx";
import ClaseEnVivo from "./src/pantallas/ClaseEnVivo.tsx";
import Grabacion from "./src/pantallas/Grabacion.tsx";
import Apunte from "./src/pantallas/Apunte.tsx";
import Consejos from "./src/pantallas/Consejos.tsx";
import MisApuntes from "./src/pantallas/MisApuntes.tsx";
import { Icono } from "./src/ui/Icono.tsx";

const Pila = createNativeStackNavigator<RutasPila>();
const Pestanas = createBottomTabNavigator<RutasPestanas>();

const ICONO_PESTANA = {
  Inicio: "inicio", Horario: "horario", Tareas: "tareas",
  Apuntes: "documento", Tutor: "tutor",
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
      <Pestanas.Screen name="Inicio" component={Inicio} />
      <Pestanas.Screen name="Horario" component={Horario} />
      <Pestanas.Screen name="Tareas" component={Tareas} />
      <Pestanas.Screen name="Apuntes" component={MisApuntes} options={{ title: "Apuntes" }} />
      <Pestanas.Screen name="Tutor" component={Tutor} />
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
        {sesion || MODO_DEMO ? (
          <Pila.Navigator
            screenOptions={{
              headerTintColor: color.marca,
              headerTitleStyle: { color: color.texto, fontSize: 15 },
            }}
          >
            <Pila.Screen name="Principal" component={Principal} options={{ headerShown: false }} />
            <Pila.Screen name="Asignatura" component={Asignatura} />
            <Pila.Screen name="Notas" component={Notas} options={{ title: "Mis notas" }} />
            <Pila.Screen name="Notificaciones" component={Notificaciones} />
            <Pila.Screen name="Hilo" component={Hilo}
              options={({ route }) => ({ title: route.params.titulo })} />
            <Pila.Screen name="NuevoHilo" component={NuevoHilo} options={{ title: "Nuevo hilo" }} />
            <Pila.Screen name="Tarea" component={Tarea} options={{ title: "Tarea" }} />
            <Pila.Screen name="Perfil" component={Perfil} options={{ title: "Mi perfil" }} />
            <Pila.Screen name="Apunte" component={Apunte} options={{ title: "Apuntes de clase" }} />
            <Pila.Screen name="Consejos" component={Consejos} options={{ title: "Cómo vas estudiando" }} />
            <Pila.Screen name="Grabacion" component={Grabacion} options={{ title: "Clase grabada" }} />
            <Pila.Screen name="ClaseEnVivo" component={ClaseEnVivo}
              options={{ headerShown: false, presentation: "fullScreenModal" }} />
          </Pila.Navigator>
        ) : (
          <Sesion />
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
