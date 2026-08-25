import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const claveAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !claveAnon) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copia app/.env.example a app/.env y complétalo.",
  );
}

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
