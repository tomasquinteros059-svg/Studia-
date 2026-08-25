// Todas las lecturas contra Supabase. Las políticas de acceso ya limitan lo
// que vuelve, así que acá no se filtra por estudiante: sería redundante y
// daría la falsa impresión de que la seguridad vive en el cliente.

import { supabase } from "./supabase.ts";
import type {
  Asignatura, BloqueHorario, Capitulo, Clase, EvaluacionConNota,
  Hilo, MensajeTutor, Modulo, Notificacion, Respuesta, TareaConEstado,
} from "./tipos.ts";

function reventar(contexto: string, error: { message: string } | null): void {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

export async function misAsignaturas(): Promise<Asignatura[]> {
  const { data, error } = await supabase
    .from("asignaturas")
    .select("id, codigo, nombre, profesor, ayudante, color, creditos, descripcion, requisitos, bibliografia, intro_tutor")
    .order("nombre");
  reventar("No pude cargar tus asignaturas", error);
  return data ?? [];
}

export async function miHorario(): Promise<BloqueHorario[]> {
  const { data, error } = await supabase
    .from("bloques_horario")
    .select("id, asignatura_id, dia, hora_inicio, hora_fin, sala, tipo")
    .order("dia")
    .order("hora_inicio");
  reventar("No pude cargar el horario", error);
  return data ?? [];
}

export async function materiaDe(asignaturaId: string): Promise<Modulo[]> {
  const { data, error } = await supabase
    .from("modulos")
    .select("id, titulo, orden, materiales(id, tipo, titulo, detalle, orden)")
    .eq("asignatura_id", asignaturaId)
    .order("orden");
  reventar("No pude cargar la materia", error);

  const { data: hechos } = await supabase.from("progreso_material").select("material_id");
  const completados = new Set((hechos ?? []).map((p) => p.material_id));

  return (data ?? []).map((m) => ({
    id: m.id,
    titulo: m.titulo,
    orden: m.orden,
    materiales: [...(m.materiales ?? [])]
      .sort((a, b) => a.orden - b.orden)
      .map((mat) => ({ ...mat, completado: completados.has(mat.id) })),
  }));
}

export async function marcarMaterial(materialId: string, completado: boolean): Promise<void> {
  if (completado) {
    const { data: sesion } = await supabase.auth.getUser();
    if (!sesion.user) return;
    const { error } = await supabase
      .from("progreso_material")
      .insert({ material_id: materialId, estudiante_id: sesion.user.id });
    // Si ya estaba marcado, la clave primaria lo rechaza; no es un problema.
    if (error && !error.message.includes("duplicate")) reventar("No pude guardar el avance", error);
  } else {
    const { error } = await supabase.from("progreso_material").delete().eq("material_id", materialId);
    reventar("No pude quitar el avance", error);
  }
}

export async function clasesDe(asignaturaId: string): Promise<Clase[]> {
  const { data, error } = await supabase
    .from("clases")
    .select("id, asignatura_id, titulo, estado, inicia_en, duracion_seg, audio_url")
    .eq("asignatura_id", asignaturaId)
    .order("inicia_en", { ascending: false });
  reventar("No pude cargar las clases", error);
  return data ?? [];
}

export async function claseEnVivo(): Promise<Clase | null> {
  const { data, error } = await supabase
    .from("clases")
    .select("id, asignatura_id, titulo, estado, inicia_en, duracion_seg, audio_url")
    .eq("estado", "en_vivo")
    .order("inicia_en", { ascending: false })
    .limit(1);
  reventar("No pude revisar si hay clase en vivo", error);
  return data?.[0] ?? null;
}

export async function capitulosDe(claseId: string): Promise<Capitulo[]> {
  const { data, error } = await supabase
    .from("capitulos_clase")
    .select("id, titulo, segundo")
    .eq("clase_id", claseId)
    .order("orden");
  reventar("No pude cargar los capítulos", error);
  return data ?? [];
}

export async function misTareas(asignaturaId?: string): Promise<TareaConEstado[]> {
  let consulta = supabase
    .from("tareas")
    .select("id, asignatura_id, titulo, enunciado, criterios, puntos, vence_en, entregas(entregado_en, puntos_obtenidos)")
    .order("vence_en");
  if (asignaturaId) consulta = consulta.eq("asignatura_id", asignaturaId);

  const { data, error } = await consulta;
  reventar("No pude cargar las tareas", error);

  return (data ?? []).map((t) => {
    const entrega = t.entregas?.[0];
    return {
      id: t.id,
      asignatura_id: t.asignatura_id,
      titulo: t.titulo,
      enunciado: t.enunciado,
      criterios: t.criterios ?? [],
      puntos: t.puntos,
      vence_en: t.vence_en,
      entregada_en: entrega?.entregado_en ?? null,
      puntos_obtenidos: entrega?.puntos_obtenidos ?? null,
    };
  });
}

export async function entregarTarea(tareaId: string, archivoUrl?: string): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");
  const { error } = await supabase
    .from("entregas")
    .insert({ tarea_id: tareaId, estudiante_id: sesion.user.id, archivo_url: archivoUrl ?? null });
  reventar("No pude registrar la entrega", error);
}

export async function evaluacionesDe(asignaturaId: string): Promise<EvaluacionConNota[]> {
  const { data, error } = await supabase
    .from("evaluaciones")
    .select("id, titulo, peso, orden, notas(nota)")
    .eq("asignatura_id", asignaturaId)
    .order("orden");
  reventar("No pude cargar las notas", error);

  return (data ?? []).map((e) => ({
    id: e.id,
    titulo: e.titulo,
    peso: Number(e.peso),
    orden: e.orden,
    nota: e.notas?.[0]?.nota != null ? Number(e.notas[0]!.nota) : null,
  }));
}

/** Todas las evaluaciones de golpe, para la pantalla de notas. */
export async function todasLasEvaluaciones(): Promise<Map<string, EvaluacionConNota[]>> {
  const { data, error } = await supabase
    .from("evaluaciones")
    .select("id, asignatura_id, titulo, peso, orden, notas(nota)")
    .order("orden");
  reventar("No pude cargar las notas", error);

  const porRamo = new Map<string, EvaluacionConNota[]>();
  for (const e of data ?? []) {
    const lista = porRamo.get(e.asignatura_id) ?? [];
    lista.push({
      id: e.id,
      titulo: e.titulo,
      peso: Number(e.peso),
      orden: e.orden,
      nota: e.notas?.[0]?.nota != null ? Number(e.notas[0]!.nota) : null,
    });
    porRamo.set(e.asignatura_id, lista);
  }
  return porRamo;
}

export async function foroDe(asignaturaId: string): Promise<Hilo[]> {
  const { data, error } = await supabase
    .from("hilos")
    .select("id, asignatura_id, autor_nombre, autor_rol, titulo, cuerpo, fijado, creado_en, respuestas(count)")
    .eq("asignatura_id", asignaturaId)
    .order("fijado", { ascending: false })
    .order("creado_en", { ascending: false });
  reventar("No pude cargar el foro", error);

  return (data ?? []).map((h) => ({
    id: h.id,
    asignatura_id: h.asignatura_id,
    autor_nombre: h.autor_nombre,
    autor_rol: h.autor_rol,
    titulo: h.titulo,
    cuerpo: h.cuerpo,
    fijado: h.fijado,
    creado_en: h.creado_en,
    respuestas: h.respuestas?.[0]?.count ?? 0,
  }));
}

export async function respuestasDe(hiloId: string): Promise<Respuesta[]> {
  const { data, error } = await supabase
    .from("respuestas")
    .select("id, autor_nombre, autor_rol, cuerpo, creado_en")
    .eq("hilo_id", hiloId)
    .order("creado_en");
  reventar("No pude cargar las respuestas", error);
  return data ?? [];
}

export async function responderHilo(hiloId: string, cuerpo: string): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { data: perfil } = await supabase
    .from("perfiles").select("nombre").eq("id", sesion.user.id).single();

  const { error } = await supabase.from("respuestas").insert({
    hilo_id: hiloId,
    autor_id: sesion.user.id,
    autor_nombre: perfil?.nombre ?? "Estudiante",
    autor_rol: "Estudiante",
    cuerpo,
  });
  reventar("No pude publicar tu respuesta", error);
}

export async function companerosDe(asignaturaId: string): Promise<{ id: string; nombre: string }[]> {
  // Función acotada del lado de la base: devuelve nombres, nunca correos, y
  // solo si quien pregunta está inscrito en esa asignatura.
  const { data, error } = await supabase.rpc("companeros_de", { p_asignatura: asignaturaId });
  reventar("No pude cargar el curso", error);
  return (data ?? []) as { id: string; nombre: string }[];
}

export async function crearHilo(
  asignaturaId: string, titulo: string, cuerpo: string,
): Promise<string> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { data: perfil } = await supabase
    .from("perfiles").select("nombre").eq("id", sesion.user.id).single();

  const { data, error } = await supabase
    .from("hilos")
    .insert({
      asignatura_id: asignaturaId,
      autor_id: sesion.user.id,
      autor_nombre: perfil?.nombre ?? "Estudiante",
      autor_rol: "Estudiante",
      titulo,
      cuerpo,
    })
    .select("id")
    .single();
  reventar("No pude abrir el hilo", error);
  if (!data) throw new Error("No pude abrir el hilo.");
  return data.id;
}

export async function tareaPorId(tareaId: string): Promise<TareaConEstado | null> {
  const { data, error } = await supabase
    .from("tareas")
    .select("id, asignatura_id, titulo, enunciado, criterios, puntos, vence_en, entregas(entregado_en, puntos_obtenidos)")
    .eq("id", tareaId)
    .maybeSingle();
  reventar("No pude cargar la tarea", error);
  if (!data) return null;

  const entrega = data.entregas?.[0];
  return {
    id: data.id,
    asignatura_id: data.asignatura_id,
    titulo: data.titulo,
    enunciado: data.enunciado,
    criterios: data.criterios ?? [],
    puntos: data.puntos,
    vence_en: data.vence_en,
    entregada_en: entrega?.entregado_en ?? null,
    puntos_obtenidos: entrega?.puntos_obtenidos ?? null,
  };
}

export async function hiloPorId(hiloId: string) {
  const { data, error } = await supabase
    .from("hilos")
    .select("id, autor_nombre, autor_rol, titulo, cuerpo, creado_en")
    .eq("id", hiloId)
    .maybeSingle();
  reventar("No pude cargar el hilo", error);
  return data;
}

export async function miPerfil(): Promise<{ nombre: string; correo: string }> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { data, error } = await supabase
    .from("perfiles").select("nombre").eq("id", sesion.user.id).single();
  reventar("No pude cargar tu perfil", error);

  // El correo sale de la sesión, no de la base: la columna no es legible desde
  // el cliente para que nadie pueda leer el de otro.
  return { nombre: data?.nombre ?? "", correo: sesion.user.email ?? "" };
}

export async function cambiarNombre(nombre: string): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");
  const { error } = await supabase
    .from("perfiles").update({ nombre }).eq("id", sesion.user.id);
  reventar("No pude guardar tu nombre", error);
}

export async function misNotificaciones(): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, detalle, asignatura_id, ref_tipo, ref_id, leida, creado_en")
    .order("creado_en", { ascending: false });
  reventar("No pude cargar las notificaciones", error);
  return data ?? [];
}

export async function marcarLeida(id: string): Promise<void> {
  const { error } = await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
  reventar("No pude marcarla como leída", error);
}

export async function marcarTodasLeidas(): Promise<void> {
  const { error } = await supabase.from("notificaciones").update({ leida: true }).eq("leida", false);
  reventar("No pude marcarlas como leídas", error);
}

export async function mensajesDe(conversacionId: string): Promise<MensajeTutor[]> {
  const { data, error } = await supabase
    .from("mensajes")
    .select("id, rol, contenido")
    .eq("conversacion_id", conversacionId)
    .order("creado_en");
  reventar("No pude cargar la conversación", error);
  return data ?? [];
}
