import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

import { CLAVE_ANON, MODO_DEMO, URL_SUPABASE } from "./config.ts";

// Sin configuración no se revienta al importar: la app arranca en modo
// demostración y este cliente nunca se usa. Reventar acá dejaba un APK que se
// cerraba solo antes de mostrar nada.
const url = MODO_DEMO ? "https://demostracion.invalid" : URL_SUPABASE;
const claveAnon = MODO_DEMO ? "sin-clave" : CLAVE_ANON;

export const supabase = createClient(url, claveAnon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // En React Native no hay URL que interpretar al volver de un correo.
    detectSessionInUrl: false,
  },
});

export const urlFuncion = (nombre: string) => `${url}/functions/v1/${nombre}`;
