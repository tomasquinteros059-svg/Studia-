// Cómo está configurada la app en este arranque.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const claveAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const hayBackend = Boolean(url && claveAnon);

/**
 * Sin Supabase configurado la app no se cae: entra en modo demostración, con
 * datos en memoria. Sirve para instalar el APK y recorrerla en una tablet
 * antes de montar el backend.
 */
export const MODO_DEMO = !hayBackend;

export const URL_SUPABASE = url ?? "";
export const CLAVE_ANON = claveAnon ?? "";

export const AVISO_DEMO =
  "Modo demostración · datos de ejemplo en el teléfono";
