// Pedir permiso, registrar el aparato y saber si están encendidos.
//
// Qué merece sonar y a qué hora lo decide `dominio/avisos.ts`. Acá solo se
// habla con el sistema y con el servidor.

import { Platform } from "react-native";

import { MODO_DEMO } from "./config.ts";
import { supabase } from "./supabase.ts";
import { tokenValido } from "../dominio/avisos.ts";

type ModuloAvisos = typeof import("expo-notifications");

// Igual que el micrófono y el dictado: si el cliente no trae el módulo
// nativo, la app abre igual y el interruptor explica por qué no se puede.
let avisos: ModuloAvisos | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  avisos = require("expo-notifications") as ModuloAvisos;
} catch {
  avisos = null;
}

export const sePuedeAvisar = avisos !== null && !MODO_DEMO;

/**
 * Cómo se comporta un aviso con la aplicación abierta.
 *
 * Sin esto, un aviso que llega mientras alguien está usando la app no se ve
 * en ninguna parte: el sistema asume que la propia aplicación ya lo mostró.
 */
export function prepararAvisos(): void {
  avisos?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Si este aparato ya está registrado para recibir avisos. */
export async function avisosEncendidos(): Promise<boolean> {
  if (!sePuedeAvisar) return false;
  const token = await tokenDelAparato();
  if (!token) return false;
  const { data } = await supabase.from("aparatos").select("id").eq("token", token).maybeSingle();
  return data !== null;
}

/** El identificador que Expo le da a este aparato, o null si no hay permiso. */
async function tokenDelAparato(): Promise<string | null> {
  if (!avisos) return null;
  try {
    const { status } = await avisos.getPermissionsAsync();
    if (status !== "granted") return null;
    const { data } = await avisos.getExpoPushTokenAsync();
    return tokenValido(data);
  } catch {
    return null;
  }
}

export type Resultado =
  | { ok: true }
  | { ok: false; motivo: string };

/**
 * Enciende los avisos en este aparato.
 *
 * Pide el permiso si hace falta. Si la persona ya lo negó antes, el sistema no
 * lo vuelve a preguntar y hay que decírselo: si no, el interruptor se queda en
 * «no» sin ninguna explicación y parece que la app está rota.
 */
export async function encenderAvisos(): Promise<Resultado> {
  if (!avisos) return { ok: false, motivo: "Este aparato no puede recibir avisos." };
  if (MODO_DEMO) {
    return { ok: false, motivo: "En la demostración no hay servidor que mande avisos." };
  }

  try {
    let { status } = await avisos.getPermissionsAsync();
    if (status !== "granted") ({ status } = await avisos.requestPermissionsAsync());
    if (status !== "granted") {
      return {
        ok: false,
        motivo: "No diste permiso para avisarte. Se cambia en los ajustes del teléfono, "
          + "en la ficha de StudIA.",
      };
    }

    // Android necesita un canal para poder mostrar nada. Sin él los avisos
    // llegan y no se ven, que es la falla más difícil de perseguir.
    if (Platform.OS === "android") {
      await avisos.setNotificationChannelAsync("default", {
        name: "Avisos de StudIA",
        importance: avisos.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await avisos.getExpoPushTokenAsync();
    const limpio = tokenValido(token);
    if (!limpio) return { ok: false, motivo: "No pude registrar este aparato. Inténtalo de nuevo." };

    const { data: sesion } = await supabase.auth.getUser();
    if (!sesion.user) return { ok: false, motivo: "Tu sesión venció. Vuelve a entrar." };

    const { error } = await supabase.from("aparatos").upsert({
      persona_id: sesion.user.id,
      token: limpio,
      plataforma: `${Platform.OS} ${String(Platform.Version)}`,
      visto_en: new Date().toISOString(),
    }, { onConflict: "token" });

    if (error) return { ok: false, motivo: "No pude guardar este aparato. Revisa tu internet." };
    return { ok: true };
  } catch {
    return { ok: false, motivo: "No pude encender los avisos. Inténtalo de nuevo." };
  }
}

/**
 * Los apaga en este aparato, borrando su fila.
 *
 * Borrar en vez de marcar una preferencia: así no hay dos lugares que puedan
 * decir cosas distintas, y quien apaga los avisos deja de estar en la tabla a
 * la que se le manda, que es lo que uno espera al apagarlos.
 */
export async function apagarAvisos(): Promise<Resultado> {
  const token = await tokenDelAparato();
  if (!token) return { ok: true };   // no estaba encendido

  const { error } = await supabase.from("aparatos").delete().eq("token", token);
  return error ? { ok: false, motivo: "No pude apagarlos. Revisa tu internet." } : { ok: true };
}
