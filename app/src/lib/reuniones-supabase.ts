// Las reuniones, contra Supabase.
//
// Cada consulta va con el token de quien la hace, así que las políticas
// deciden qué se ve. No hay ningún filtro por dueño escrito acá: si lo
// hubiera, sería un filtro que se puede olvidar.

import { supabase } from "./supabase.ts";
import type { Tarea } from "../dominio/acta.ts";
import type { Rubro } from "../dominio/rubros.ts";
import { normalizarCodigo, nuevoCodigo } from "../dominio/sala.ts";
import type {
  Reunion, ReunionCompleta, ReunionNueva, TareaConReunion,
} from "./tipos-reunion.ts";

function reventar(queHacia: string, error: { message: string } | null): void {
  if (error) throw new Error(`${queHacia}: ${error.message}`);
}

// En una sola línea a propósito: partida en dos con un `+`, Supabase deja de
// inferir el tipo de la fila y todo lo que sigue queda en `any` disfrazado.
const CABECERA = "id, titulo, rubro, estado, ocurrio_en, duracion_seg, participantes, tabla, dueno_id, codigo, sala_abierta, sala_abierta_en, programada_para, repite";

/** Quién soy, para saber qué tareas quedaron a mi nombre. */
export async function quienSoy(): Promise<string> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return "";
  const { data } = await supabase
    .from("perfiles").select("nombre").eq("id", sesion.user.id).maybeSingle();
  return data?.nombre ?? "";
}

export async function miPerfil(): Promise<{ nombre: string; correo: string }> {
  const { data: sesion } = await supabase.auth.getUser();
  const { data } = sesion.user
    ? await supabase.from("perfiles").select("nombre").eq("id", sesion.user.id).maybeSingle()
    : { data: null };
  return { nombre: data?.nombre ?? "", correo: sesion.user?.email ?? "" };
}

export async function cambiarNombre(nombre: string): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");
  const { error } = await supabase
    .from("perfiles").update({ nombre: nombre.trim() }).eq("id", sesion.user.id);
  reventar("No pude guardar tu nombre", error);
}

export async function misReuniones(): Promise<Reunion[]> {
  const { data: sesion } = await supabase.auth.getUser();
  const yo = sesion.user?.id ?? "";

  const { data, error } = await supabase
    .from("reuniones")
    .select(`${CABECERA}, invitados_reunion(persona_id, puede_editar)`)
    .order("ocurrio_en", { ascending: false });
  reventar("No pude cargar tus reuniones", error);

  return (data ?? []).map((r) => armarCabecera(r, yo));
}

type FilaConInvitados = Record<string, unknown> & {
  invitados_reunion?: { persona_id: string; puede_editar: boolean }[];
};

function armarCabecera(fila: FilaConInvitados, yo: string): Reunion {
  const mia = fila.dueno_id === yo;
  const invitacion = (fila.invitados_reunion ?? []).find((i) => i.persona_id === yo);
  return {
    id: String(fila.id),
    titulo: String(fila.titulo),
    rubro: fila.rubro as Rubro,
    estado: fila.estado as Reunion["estado"],
    ocurrio_en: String(fila.ocurrio_en),
    duracion_seg: (fila.duracion_seg as number | null) ?? null,
    participantes: (fila.participantes as string[] | null) ?? [],
    tabla: (fila.tabla as string[] | null) ?? [],
    mia,
    puedo_editar: mia || invitacion?.puede_editar === true,
    // El código solo se le muestra a quien puede repartirlo.
    codigo: mia ? ((fila.codigo as string | null) ?? null) : null,
    sala_abierta: fila.sala_abierta === true,
    sala_abierta_en: (fila.sala_abierta_en as string | null) ?? null,
    programada_para: (fila.programada_para as string | null) ?? null,
    repite: (fila.repite as Reunion["repite"]) ?? "nunca",
  };
}

export async function reunionPorId(id: string): Promise<ReunionCompleta | null> {
  const { data: sesion } = await supabase.auth.getUser();
  const yo = sesion.user?.id ?? "";

  const { data, error } = await supabase
    .from("reuniones")
    .select(`${CABECERA}, documento, transcripcion_limpia, invitados_reunion(persona_id, puede_editar)`)
    .eq("id", id)
    .maybeSingle();
  reventar("No pude cargar la reunión", error);
  if (!data) return null;

  const [analisis, tareas, sala] = await Promise.all([
    supabase.from("analisis")
      .select("resumen, acuerdos, pendientes, sin_tratar, aportes, contradicciones")
      .eq("reunion_id", id).maybeSingle(),
    supabase.from("tareas_reunion")
      .select("id, que, responsable, plazo, prioridad, acuerdo, lista")
      .eq("reunion_id", id),
    supabase.rpc("gente_de_la_sala", { p_reunion: id }),
  ]);

  const a = analisis.data;
  return {
    ...armarCabecera(data, yo),
    sala: (sala.data ?? []) as ReunionCompleta["sala"],
    documento: (data.documento as string | null) ?? null,
    transcripcion: (data.transcripcion_limpia as string | null) ?? null,
    resumen: a?.resumen ?? "",
    acuerdos: (a?.acuerdos as ReunionCompleta["acuerdos"] | null) ?? [],
    pendientes: (a?.pendientes as ReunionCompleta["pendientes"] | null) ?? [],
    sinTratar: a?.sin_tratar ?? [],
    aportes: a?.aportes ?? [],
    contradicciones: a?.contradicciones ?? [],
    tareas: (tareas.data ?? []).map(armarTarea),
  };
}

const armarTarea = (t: Record<string, unknown>): Tarea => ({
  id: String(t.id),
  que: String(t.que),
  responsable: (t.responsable as string | null) ?? null,
  plazo: (t.plazo as string | null) ?? null,
  prioridad: t.prioridad === "alta" ? "alta" : "normal",
  acuerdo: (t.acuerdo as number | null) ?? null,
  lista: t.lista === true,
});

export async function crearReunion(nueva: ReunionNueva): Promise<Reunion> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { data, error } = await supabase
    .from("reuniones")
    .insert({
      dueno_id: sesion.user.id,
      titulo: nueva.titulo.trim(),
      rubro: nueva.rubro,
      participantes: nueva.participantes,
      tabla: nueva.tabla,
      programada_para: nueva.programada_para ?? null,
      repite: nueva.repite ?? "nunca",
    })
    .select(CABECERA)
    .single();
  reventar("No pude crear la reunión", error);
  if (!data) throw new Error("No pude crear la reunión.");
  return armarCabecera(data, sesion.user.id);
}

/** Cambiar la hora o la repetición de una reunión ya creada. */
export async function agendar(
  reunionId: string, programada_para: string | null, repite: Reunion["repite"],
): Promise<void> {
  const { error } = await supabase
    .from("reuniones")
    // Sin fecha no hay repetición que valga: la base lo exige y acá se
    // manda coherente en vez de dejar que reviente allá.
    .update({ programada_para, repite: programada_para === null ? "nunca" : repite })
    .eq("id", reunionId);
  reventar("No pude agendar la reunión", error);
}

export async function borrarReunion(id: string): Promise<void> {
  const { error } = await supabase.from("reuniones").delete().eq("id", id);
  reventar("No pude borrar la reunión", error);
}

export async function marcarTarea(tareaId: string, lista: boolean): Promise<void> {
  // `lista_en` la pone la base: dos aparatos con el reloj corrido darían dos
  // horas distintas para el mismo hecho.
  const { error } = await supabase
    .from("tareas_reunion").update({ lista }).eq("id", tareaId);
  reventar("No pude marcar la tarea", error);
}

export async function agregarTarea(reunionId: string, que: string): Promise<void> {
  const { error } = await supabase
    .from("tareas_reunion").insert({ reunion_id: reunionId, que: que.trim() });
  reventar("No pude agregar la tarea", error);
}

export async function misTareasDeTodas(): Promise<TareaConReunion[]> {
  const { data, error } = await supabase
    .from("tareas_reunion")
    .select("id, que, responsable, plazo, prioridad, acuerdo, lista, reunion_id, reuniones(titulo, rubro)");
  reventar("No pude cargar las tareas", error);

  return (data ?? []).map((t) => {
    const r = t.reuniones as unknown as { titulo: string; rubro: Rubro } | null;
    return {
      ...armarTarea(t),
      reunion_id: String(t.reunion_id),
      reunion: r?.titulo ?? "",
      rubro: r?.rubro ?? "gerencia",
    };
  });
}

/* --------------------------------------------------------------- la sala */

/**
 * Abre la sala y devuelve el código. Se genera acá y no en la base para que
 * sea el mismo alfabeto que la app sabe leer, y se reintenta si choca: hay
 * 244 millones de códigos posibles, así que chocar es raro, pero raro no es
 * nunca y quedarse sin sala por eso sería absurdo.
 */
export async function abrirSala(reunionId: string): Promise<string> {
  for (let intento = 0; intento < 5; intento++) {
    const codigo = nuevoCodigo();
    const { error } = await supabase
      .from("reuniones")
      .update({ codigo, sala_abierta: true })
      .eq("id", reunionId);

    if (!error) return codigo;
    // 23505 es la clave única: ese código ya lo tiene otra reunión.
    if ((error as { code?: string }).code !== "23505") {
      reventar("No pude abrir la sala", error);
    }
  }
  throw new Error("No pude abrir la sala. Inténtalo de nuevo.");
}

export async function cerrarSala(reunionId: string): Promise<void> {
  const { error } = await supabase
    .from("reuniones").update({ sala_abierta: false }).eq("id", reunionId);
  reventar("No pude cerrar la sala", error);
}

/**
 * Entrar con un código. Devuelve el id de la reunión, o null si el código no
 * sirve. La base no dice si el código no existe o si la sala se cerró: la
 * diferencia serviría para averiguar qué códigos existen probando de a uno.
 */
export async function entrarConCodigo(escrito: string): Promise<string | null> {
  const codigo = normalizarCodigo(escrito);
  if (codigo === null) return null;

  const { data, error } = await supabase.rpc("entrar_con_codigo", { p_codigo: codigo });
  reventar("No pude entrar a la sala", error);
  return (data as string | null) ?? null;
}

/**
 * Le pasa la reunión al equipo de tres. La función hace el trabajo y guarda
 * el resultado; acá solo se espera y se avisa si algo salió mal.
 */
export async function analizarReunion(reunionId: string, transcripcion: string): Promise<void> {
  const { error: errorGuardar } = await supabase
    .from("reuniones")
    .update({ transcripcion, estado: "analizando" })
    .eq("id", reunionId);
  reventar("No pude guardar la transcripción", errorGuardar);

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  if (!token) throw new Error("No hay sesión.");

  const { data, error } = await supabase.functions.invoke("equipo", {
    body: { reunion_id: reunionId },
  });
  if (error) {
    throw new Error(
      (data as { error?: string } | null)?.error ??
      "No pude analizar la reunión. La transcripción quedó guardada; puedes reintentar.",
    );
  }
}
