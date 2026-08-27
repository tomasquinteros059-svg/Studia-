// Las reuniones, contra Supabase.
//
// Cada consulta va con el token de quien la hace, así que las políticas
// deciden qué se ve. No hay ningún filtro por dueño escrito acá: si lo
// hubiera, sería un filtro que se puede olvidar.

import { supabase } from "./supabase.ts";
import type { Tarea } from "../dominio/acta.ts";
import type { Rubro } from "../dominio/rubros.ts";
import type {
  Reunion, ReunionCompleta, ReunionNueva, TareaConReunion,
} from "./tipos-reunion.ts";

function reventar(queHacia: string, error: { message: string } | null): void {
  if (error) throw new Error(`${queHacia}: ${error.message}`);
}

const CABECERA = "id, titulo, rubro, estado, ocurrio_en, duracion_seg, participantes, tabla, dueno_id";

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

  const [analisis, tareas] = await Promise.all([
    supabase.from("analisis")
      .select("resumen, acuerdos, pendientes, sin_tratar, aportes, contradicciones")
      .eq("reunion_id", id).maybeSingle(),
    supabase.from("tareas_reunion")
      .select("id, que, responsable, plazo, prioridad, acuerdo, lista")
      .eq("reunion_id", id),
  ]);

  const a = analisis.data;
  return {
    ...armarCabecera(data, yo),
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
    })
    .select(CABECERA)
    .single();
  reventar("No pude crear la reunión", error);
  if (!data) throw new Error("No pude crear la reunión.");
  return armarCabecera(data, sesion.user.id);
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
