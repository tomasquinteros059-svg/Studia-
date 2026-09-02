// StudIA · función "avisar", en un solo archivo.
//
// Generado por herramientas/juntar-funciones.mjs para poder pegarla en el
// editor del panel de Supabase. No lo edites acá: lo que vale es
// supabase/functions/avisar/index.ts, y este se rehace.

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

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CLAVE_SERVICIO = claveServicio();

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

  // Solo la tarea programada, no cualquiera con una sesión.
  //
  // Supabase comprueba que el token sea válido, y el de cualquier estudiante lo
  // es: sin esto, cualquiera podía disparar la corrida de avisos. No es un robo
  // —los avisos van a sus dueños igual— pero adelanta lo que tenía que salir a
  // su hora, y marca como enviado lo que quizás no salió.
  const clave = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  // Contra todas las que el proyecto tenga puestas: quien llama pudo mandar la
  // del formato viejo o la del nuevo, y las dos son igual de válidas.
  if (!clavesDeServicio().includes(clave)) {
    return json({ error: "Esta función la llama la tarea programada." }, 403, origen);
  }

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

// ── de _compartido/cors.ts ─────────────────────────────────────────────

const ORIGENES = (Deno.env.get("ORIGENES_PERMITIDOS") ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function cabecerasCors(origen: string | null): Record<string, string> {
  const permitido = ORIGENES.includes("*")
    ? "*"
    : (origen && ORIGENES.includes(origen) ? origen : ORIGENES[0] ?? "");
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(cuerpo: unknown, estado: number, origen: string | null): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabecerasCors(origen), "Content-Type": "application/json; charset=utf-8" },
  });
}

// ── de _compartido/entorno.ts ──────────────────────────────────────────

// De dónde salen las claves del propio proyecto.
//
// Supabase le pone estas variables a cada función; no se cargan a mano. El
// problema es que hay dos generaciones de nombres conviviendo: los proyectos
// viejos traen `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, y los que se
// crean con el formato nuevo de claves —`sb_publishable_…` y `sb_secret_…`—
// pueden traerlas como `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`.
//
// Leer solo un par de nombres deja la función en pie pero muerta: arranca sin
// quejarse, y cada consulta se cae con «Invalid API key» sin decir por qué.
// Acá se aceptan los dos, que además es lo correcto mientras dure la
// transición: un proyecto puede tener puestos los cuatro.

/** El valor del primero de estos nombres que esté puesto y no venga vacío. */
function delEntorno(...nombres: string[]): string {
  for (const nombre of nombres) {
    const valor = Deno.env.get(nombre)?.trim();
    if (valor) return valor;
  }
  return "";
}

/** La clave pública, la que lleva la aplicación. */
function claveAnon(): string {
  return delEntorno("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
}

/** La clave que se salta las políticas de acceso. No sale de acá adentro. */
function claveServicio(): string {
  return delEntorno("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

/**
 * Todas las claves de servicio que el proyecto tenga puestas.
 *
 * Para comparar contra lo que llega en una cabecera: quien llama pudo mandar
 * cualquiera de las dos, y son igual de válidas.
 */
function clavesDeServicio(): string[] {
  return ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]
    .map((n) => Deno.env.get(n)?.trim())
    .filter((v): v is string => Boolean(v));
}

// ── de _compartido/avisos-nucleo.ts ────────────────────────────────────

// Qué merece sonar en el teléfono, y a qué hora.
//
// La pregunta no es «¿se puede avisar?» sino «¿vale la pena interrumpir?».
// Una aplicación de estudio que vibra por cualquier cosa se silencia en la
// primera semana, y entonces tampoco avisa lo que sí importaba.
//
// Vive en el servidor porque la decisión se toma ahí: el teléfono no elige qué
// le llega. Y vive aparte de `avisar/index.ts` para poder probarla sin mandar
// nada a ninguna parte.

/** Los avisos que la aplicación ya sabe generar. */
type TipoDeAviso = "clase" | "anuncio" | "tarea" | "nota";

/**
 * Si este aviso merece salir del teléfono.
 *
 * Los anuncios del profesor no: se acumulan, muchos son de trámite, y llegan
 * igual la próxima vez que se abra la aplicación. Los otros tres tienen algo
 * en común: si uno se entera tarde, ya no sirven de nada.
 */
function vibra(tipo: TipoDeAviso): boolean {
  return tipo !== "anuncio";
}

/** Desde qué hora y hasta cuál se puede interrumpir. */
const DESDE_LAS = 8;
const HASTA_LAS = 22;

/**
 * Si a esta hora se puede avisar.
 *
 * A las tres de la mañana ningún aviso de una app de estudio es urgente. Lo
 * que queda fuera de hora no se pierde: sale a la mañana siguiente, y por eso
 * esto decide «ahora sí o ahora no», no «se manda o no se manda».
 */
function esHoraDecente(hora: number): boolean {
  return hora >= DESDE_LAS && hora < HASTA_LAS;
}

/** El texto de un aviso, tal como se ve en la pantalla bloqueada. */
type Aviso = { titulo: string; cuerpo: string };

const SIN_DETALLE: Record<TipoDeAviso, string> = {
  clase: "Tu clase está empezando.",
  anuncio: "Hay un aviso nuevo.",
  tarea: "Tienes una entrega cerca.",
  nota: "Publicaron una nota nueva.",
};

/**
 * Cómo se lee el aviso afuera de la aplicación.
 *
 * Afuera no hay contexto: no se sabe de qué ramo es ni qué se estaba haciendo.
 * Por eso el ramo va adelante —«Cálculo I · …»— y por eso el cuerpo tiene que
 * poder leerse solo. Un aviso que dice «Nueva nota» y nada más obliga a abrir
 * la aplicación para saber si vale la pena abrirla.
 */
function comoSuena(
  tipo: TipoDeAviso, titulo: string, detalle: string, ramo?: string | null,
): Aviso {
  const conRamo = ramo?.trim() ? `${ramo.trim()} · ` : "";
  const cuerpo = detalle.trim() || SIN_DETALLE[tipo];
  return { titulo: `${conRamo}${titulo.trim()}`.slice(0, 80), cuerpo: cuerpo.slice(0, 160) };
}
