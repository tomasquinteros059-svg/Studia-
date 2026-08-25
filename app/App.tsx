import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./src/lib/supabase.ts";
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

const Pila = createNativeStackNavigator<RutasPila>();
const Pestanas = createBottomTabNavigator<RutasPestanas>();

const ICONOS: Record<string, string> = {
  Inicio: "🏠", Horario: "🗓", Tareas: "📋", Tutor: "💬",
};

function Principal() {
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.marca,
        tabBarInactiveTintColor: color.textoSuave,
        tabBarIcon: () => null,
        tabBarLabel: `${ICONOS[route.name] ?? ""}\n${route.name}`,
        tabBarLabelStyle: { fontSize: 10.5, textAlign: "center" },
      })}
    >
      <Pestanas.Screen name="Inicio" component={Inicio} />
      <Pestanas.Screen name="Horario" component={Horario} />
      <Pestanas.Screen name="Tareas" component={Tareas} />
      <Pestanas.Screen name="Tutor" component={Tutor} />
    </Pestanas.Navigator>
  );
}

export default function App() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
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
      <NavigationContainer>
        {sesion ? (
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
          </Pila.Navigator>
        ) : (
          <Sesion />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
