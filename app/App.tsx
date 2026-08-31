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
import {
  OPCIONES_PESTANAS, OPCIONES_PILA, TEMA_NAVEGACION,
} from "./src/ui/navegacion.ts";
import type {
  RutasPestanas, RutasPestanasDocente, RutasPila, RutasPilaDocente,
} from "./src/lib/rutas.ts";

import Entrada from "./src/pantallas/Entrada.tsx";
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
import Escucha from "./src/pantallas/Escucha.tsx";
import Apunte from "./src/pantallas/Apunte.tsx";
import Lectura from "./src/pantallas/Lectura.tsx";
import Consejos from "./src/pantallas/Consejos.tsx";
import Quiz from "./src/pantallas/Quiz.tsx";
import Fichas from "./src/pantallas/Fichas.tsx";
import MisApuntes from "./src/pantallas/MisApuntes.tsx";
import InicioDocente from "./src/pantallas/docente/InicioDocente.tsx";
import RamoDocente from "./src/pantallas/docente/RamoDocente.tsx";
import PerfilDocente from "./src/pantallas/docente/PerfilDocente.tsx";
import Asistente from "./src/pantallas/docente/Asistente.tsx";
import InicioAdmin from "./src/pantallas/admin/InicioAdmin.tsx";
import { usarQuienSoy } from "./src/lib/quien-soy.ts";
import { Icono } from "./src/ui/Icono.tsx";

const Pila = createNativeStackNavigator<RutasPila>();
const Pestanas = createBottomTabNavigator<RutasPestanas>();
const PilaDocente = createNativeStackNavigator<RutasPilaDocente>();
const PestanasDocente = createBottomTabNavigator<RutasPestanasDocente>();

const ICONO_PESTANA = {
  Inicio: "inicio", Horario: "horario", Tareas: "tareas",
  Apuntes: "documento", Tutor: "tutor",
} as const;

function Principal() {
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        ...OPCIONES_PESTANAS,
        tabBarIcon: ({ color: tono, size }) => (
          <Icono nombre={ICONO_PESTANA[route.name]} tamano={size} tono={tono} />
        ),
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

const ICONO_DOCENTE = {
  Cursos: "documento", Asistente: "tutor", Horario: "horario", Perfil: "persona",
} as const;

/** Las pestañas de quien dicta. Otra aplicación sobre los mismos datos. */
function PrincipalDocente() {
  return (
    <PestanasDocente.Navigator
      screenOptions={({ route }) => ({
        ...OPCIONES_PESTANAS,
        tabBarIcon: ({ color: tono, size }) => (
          <Icono nombre={ICONO_DOCENTE[route.name]} tamano={size} tono={tono} />
        ),
      })}
    >
      <PestanasDocente.Screen name="Cursos" component={InicioDocente} />
      <PestanasDocente.Screen name="Asistente" component={Asistente} />
      <PestanasDocente.Screen name="Horario" component={Horario} />
      <PestanasDocente.Screen name="Perfil" component={PerfilDocente} />
    </PestanasDocente.Navigator>
  );
}

function AppDocente() {
  return (
    <PilaDocente.Navigator screenOptions={OPCIONES_PILA}>
      <PilaDocente.Screen name="PrincipalDocente" component={PrincipalDocente}
        options={{ headerShown: false }} />
      <PilaDocente.Screen name="RamoDocente" component={RamoDocente} options={{ title: "Curso" }} />
    </PilaDocente.Navigator>
  );
}

export default function App() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);
  // Quién eres sale de la base cuando hay servidor, y del perfil elegido
  // cuando no. La app no distingue: solo mira el rol.
  const { yo, listo: sePudoAveriguar } = usarQuienSoy();

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

  if (!listo || !sePudoAveriguar) {
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
      <NavigationContainer theme={TEMA_NAVEGACION}>
        {/* Con servidor o sin él, se entra por la portada. */}
        {(MODO_DEMO && !yo) || (!sesion && !MODO_DEMO) ? (
          <Entrada />
        ) : yo?.rol === "profesor" ? (
          <AppDocente />
        ) : yo?.rol === "administrador" ? (
          <PilaDocente.Navigator screenOptions={{ headerShown: false }}>
            <PilaDocente.Screen name="PrincipalDocente" component={PrincipalAdmin} />
          </PilaDocente.Navigator>
        ) : (
          <Pila.Navigator screenOptions={OPCIONES_PILA}>
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
            <Pila.Screen name="Lectura" component={Lectura} options={{ title: "Lectura" }} />
            <Pila.Screen name="Consejos" component={Consejos} options={{ title: "Cómo vas estudiando" }} />
            <Pila.Screen name="Quiz" component={Quiz} options={{ title: "Ponerme a prueba" }} />
            <Pila.Screen name="Fichas" component={Fichas} options={{ title: "Fichas de repaso" }} />
            <Pila.Screen name="Grabacion" component={Grabacion} options={{ title: "Clase grabada" }} />
            <Pila.Screen name="Escucha" component={Escucha} options={{ title: "Modo escucha" }} />
            <Pila.Screen name="ClaseEnVivo" component={ClaseEnVivo}
              options={{ headerShown: false, presentation: "fullScreenModal" }} />
          </Pila.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const ICONO_ADMIN = {
  Cursos: "horario", Asistente: "tutor", Horario: "documento", Perfil: "persona",
} as const;

/** Las pestañas del colegio. */
function PrincipalAdmin() {
  return (
    <PestanasDocente.Navigator
      screenOptions={({ route }) => ({
        ...OPCIONES_PESTANAS,
        tabBarIcon: ({ color: tono, size }) => (
          <Icono nombre={ICONO_ADMIN[route.name]} tamano={size} tono={tono} />
        ),
      })}
    >
      <PestanasDocente.Screen name="Cursos" component={InicioAdmin} options={{ title: "Colegio" }} />
      <PestanasDocente.Screen name="Asistente" component={Asistente} />
      <PestanasDocente.Screen name="Perfil" component={PerfilDocente} />
    </PestanasDocente.Navigator>
  );
}

const cinta = StyleSheet.create({
  fondo: { backgroundColor: color.marcaOscura },
  texto: {
    color: "#fff", fontSize: 11.5, fontWeight: "600",
    textAlign: "center", paddingVertical: 5, letterSpacing: 0.2,
  },
});
