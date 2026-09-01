// StudIA · función `avisar`
//
// Toma las notificaciones que todavía no salieron al teléfono y las manda.
//
// Va como tarea y no como disparador de la base por dos razones. La primera es
// técnica: Postgres no puede llamar a una dirección de internet sin
// extensiones que Supabase no siempre habilita. La segunda pesa más: si el
// envío estuviera pegado a la inserción, un problema de Expo haría fallar la
// inserción, y perder el aviso en la base es peor que mandarlo tarde.
//
// Se llama sin cuerpo, desde una tarea programada, cada pocos minutos:
//   curl -X POST .../functions/v1/avisar -H "Authorization: Bearer <service_role>"

import { createClient } from "npm:@supabase/supabase-js@2.58.0";

import { cabecerasCors, json } from "../_compartido/cors.ts";
import { comoSuena, esHoraDecente, vibra, type TipoDeAviso } from "../_compartido/avisos-nucleo.ts";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** A dónde se le manda a Expo. No necesita credencial: el token la lleva. */
const EXPO = "https://exp.host/--/api/v2/push/send";

/**
 * En qué huso se mira la hora para decidir si es una hora decente.
 *
 * Está escrito y no se toma del aparato porque la decisión se toma acá, en un
 * servidor que no está en ninguna parte en particular. StudIA es de Chile;
 * cuando deje de serlo, esto pasa a salir del perfil de cada persona.
 */
const HUSO = "America/Santiago";

function horaLocal(): number {
  const texto = new Intl.DateTimeFormat("es-CL", {
    timeZone: HUSO, hour: "2-digit", hour12: false,
  }).format(new Date());
  return Number(texto);
}

/** Expo acepta hasta cien por llamada. */
const DE_A = 100;

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origen);
  if (!CLAVE_SERVICIO) return json({ error: "Sin clave de servicio." }, 503, origen);

  // Fuera de hora no se manda nada, y tampoco se marca: los avisos que no
  // salieron ahora salen a la mañana siguiente. Marcarlos sería perderlos.
  if (!esHoraDecente(horaLocal())) {
    return json({ mandados: 0, motivo: "fuera de hora" }, 200, origen);
  }

  const base = createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } });

  // Solo las de las últimas horas. Una notificación de anteayer que nunca
  // salió ya no tiene sentido: avisar de una clase que terminó es peor que
  // no avisar.
  const desde = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: pendientes, error } = await base
    .from("notificaciones")
    .select("id, estudiante_id, tipo, titulo, detalle, asignatura_id, asignaturas(nombre)")
    .is("avisado_en", null)
    .gte("creado_en", desde)
    .order("creado_en")
    .limit(500);

  if (error) {
    console.error("no pude leer las notificaciones", error.message);
    return json({ error: "No pude leer las notificaciones." }, 500, origen);
  }

  const filas = (pendientes ?? []) as {
    id: string; estudiante_id: string; tipo: TipoDeAviso;
    titulo: string; detalle: string;
    asignaturas: { nombre: string } | { nombre: string }[] | null;
  }[];

  // Las que no vibran se marcan igual: ya se vieron dentro de la app, y
  // dejarlas sin marcar las haría reaparecer en cada corrida para siempre.
  const calladas = filas.filter((n) => !vibra(n.tipo));
  const sonoras = filas.filter((n) => vibra(n.tipo));

  const aparatos = new Map<string, string[]>();
  if (sonoras.length > 0) {
    const { data } = await base
      .from("aparatos")
      .select("persona_id, token")
      .in("persona_id", [...new Set(sonoras.map((n) => n.estudiante_id))]);
    for (const a of data ?? []) {
      aparatos.set(a.persona_id, [...(aparatos.get(a.persona_id) ?? []), a.token]);
    }
  }

  const mensajes: { to: string; title: string; body: string; data: { id: string } }[] = [];
  for (const n of sonoras) {
    const tokens = aparatos.get(n.estudiante_id) ?? [];
    if (tokens.length === 0) continue;   // no tiene el teléfono registrado
    const ramo = Array.isArray(n.asignaturas) ? n.asignaturas[0]?.nombre : n.asignaturas?.nombre;
    const aviso = comoSuena(n.tipo, n.titulo, n.detalle, ramo ?? null);
    for (const to of tokens) {
      mensajes.push({ to, title: aviso.titulo, body: aviso.cuerpo, data: { id: n.id } });
    }
  }

  let mandados = 0;
  for (let i = 0; i < mensajes.length; i += DE_A) {
    const tanda = mensajes.slice(i, i + DE_A);
    try {
      const r = await fetch(EXPO, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(tanda),
      });
      if (r.ok) mandados += tanda.length;
      else console.error("Expo rechazó una tanda", r.status, await r.text());
    } catch (e) {
      console.error("no pude hablar con Expo", e);
    }
  }

  // Se marcan las que se intentaron. Reintentar para siempre una que Expo
  // rechaza —un aparato desinstalado, por ejemplo— es quedarse pegado.
  const marcar = [...calladas.map((n) => n.id), ...sonoras.map((n) => n.id)];
  if (marcar.length > 0) {
    await base.from("notificaciones")
      .update({ avisado_en: new Date().toISOString() })
      .in("id", marcar);
  }

  return json({ mandados, revisadas: filas.length, calladas: calladas.length }, 200, origen);
});
