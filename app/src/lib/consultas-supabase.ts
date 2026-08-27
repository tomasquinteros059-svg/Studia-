// Todas las lecturas contra Supabase. Las políticas de acceso ya limitan lo
// que vuelve, así que acá no se filtra por estudiante: sería redundante y
// daría la falsa impresión de que la seguridad vive en el cliente.

import { supabase } from "./supabase.ts";
import type {
  Apunte, Asignatura, BloqueHorario, Capitulo, Clase, EvaluacionConNota,
  Dictado, Hilo, Lectura, MensajeTutor, Modulo, Notificacion, Perfil,
  ResumenGuardado, Respuesta, TareaConEstado,
} from "./tipos.ts";
import type { EntregaDeCurso, NotaDeCurso } from "../dominio/curso.ts";
import type { AvanceDeAlumno } from "../dominio/asistente-demo.ts";

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
    // El texto no se trae acá: son varios miles de palabras por documento y
    // la lista solo necesita saber si hay algo que leer.
    .select("id, titulo, orden, materiales(id, tipo, titulo, detalle, orden, texto)")
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
      .map(({ texto, ...mat }) => ({
        ...mat,
        completado: completados.has(mat.id),
        leible: typeof texto === "string" && texto.trim().length > 0,
      })),
  }));
}

/** El texto completo de un material, para el lector. */
export async function lecturaPorId(materialId: string): Promise<Lectura | null> {
  const { data, error } = await supabase
    .from("materiales")
    .select("id, titulo, texto, modulos(asignatura_id, asignaturas(nombre))")
    .eq("id", materialId)
    .maybeSingle();
  reventar("No pude cargar la lectura", error);
  if (!data?.texto) return null;

  const modulo = Array.isArray(data.modulos) ? data.modulos[0] : data.modulos;
  const asignatura = Array.isArray(modulo?.asignaturas) ? modulo.asignaturas[0] : modulo?.asignaturas;
  return {
    id: data.id,
    titulo: data.titulo,
    texto: data.texto,
    asignatura_id: modulo?.asignatura_id ?? "",
    asignatura_nombre: asignatura?.nombre ?? "",
  };
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

export async function miPerfil(): Promise<Perfil> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { data, error } = await supabase
    .from("perfiles").select("nombre, rol").eq("id", sesion.user.id).single();
  reventar("No pude cargar tu perfil", error);

  // El correo sale de la sesión, no de la base: la columna no es legible desde
  // el cliente para que nadie pueda leer el de otro. El rol sí se lee, y es lo
  // que decide qué aplicación abre la persona.
  return {
    nombre: data?.nombre ?? "",
    correo: sesion.user.email ?? "",
    rol: (data?.rol as Perfil["rol"]) ?? "estudiante",
  };
}

/** Qué dicta esta persona, y con qué papel. Vacío para un estudiante. */
export async function misDictados(): Promise<Dictado[]> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return [];

  const { data, error } = await supabase
    .from("dictados").select("asignatura_id, papel").eq("docente_id", sesion.user.id);
  reventar("No pude cargar tus ramos", error);
  return (data ?? []) as Dictado[];
}

export async function cambiarNombre(nombre: string): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");
  const { error } = await supabase
    .from("perfiles").update({ nombre }).eq("id", sesion.user.id);
  reventar("No pude guardar tu nombre", error);
}

// ---------------------------------------------------------------- apuntes
export async function misApuntes(asignaturaId?: string): Promise<Apunte[]> {
  let consulta = supabase
    .from("apuntes")
    .select("id, asignatura_id, clase_id, titulo, contenido, fijado, actualizado_en")
    .order("actualizado_en", { ascending: false });
  if (asignaturaId) consulta = consulta.eq("asignatura_id", asignaturaId);

  const { data, error } = await consulta;
  reventar("No pude cargar tus apuntes", error);
  return data ?? [];
}

export async function apuntePorId(apunteId: string): Promise<Apunte | null> {
  const { data, error } = await supabase
    .from("apuntes")
    .select("id, asignatura_id, clase_id, titulo, contenido, fijado, actualizado_en")
    .eq("id", apunteId)
    .maybeSingle();
  reventar("No pude cargar el apunte", error);
  return data;
}

export async function crearApunte(
  asignaturaId: string, titulo: string, claseId?: string | null,
): Promise<Apunte> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { data, error } = await supabase
    .from("apuntes")
    .insert({
      estudiante_id: sesion.user.id,
      asignatura_id: asignaturaId,
      clase_id: claseId ?? null,
      titulo,
    })
    .select("id, asignatura_id, clase_id, titulo, contenido, fijado, actualizado_en")
    .single();
  reventar("No pude crear el apunte", error);
  if (!data) throw new Error("No pude crear el apunte.");
  return data;
}

export async function guardarApunte(
  apunteId: string, campos: { titulo?: string; contenido?: string },
): Promise<void> {
  const { error } = await supabase.from("apuntes").update(campos).eq("id", apunteId);
  reventar("No pude guardar el apunte", error);
}

export async function fijarApunte(apunteId: string, fijado: boolean): Promise<void> {
  const { error } = await supabase.from("apuntes").update({ fijado }).eq("id", apunteId);
  reventar("No pude fijar el apunte", error);
}

export async function borrarApunte(apunteId: string): Promise<void> {
  const { error } = await supabase.from("apuntes").delete().eq("id", apunteId);
  reventar("No pude borrar el apunte", error);
}

export async function resumenDe(apunteId: string): Promise<ResumenGuardado | null> {
  const { data, error } = await supabase
    .from("resumenes")
    .select("cuerpo, vacios, consejos, creado_en")
    .eq("apunte_id", apunteId)
    .maybeSingle();
  reventar("No pude cargar el resumen", error);
  return data;
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

/* ------------------------------------------------------------- docentes */
// Lo que ve quien dicta. Todo vuelve filtrado por las políticas: un ramo
// ajeno no aparece aunque se pida por su identificador.

export async function cursoDe(asignaturaId: string): Promise<{ id: string; nombre: string }[]> {
  // Por función y no por tabla: `perfiles` está cerrado por columnas y el
  // correo no se lee desde el cliente.
  const { data, error } = await supabase.rpc("alumnos_de", { p_asignatura: asignaturaId });
  reventar("No pude cargar el curso", error);
  return (data ?? []) as { id: string; nombre: string }[];
}

/**
 * El curso llega como parámetro y no se vuelve a pedir acá. Antes cada
 * llamada resolvía la lista sola, y una pantalla que carga diez tareas hacía
 * veinte viajes de más para traer siempre los mismos veinte nombres.
 */
export async function entregasDe(
  tareaId: string, curso: { id: string; nombre: string }[],
): Promise<EntregaDeCurso[]> {
  const { data, error } = await supabase
    .from("entregas")
    .select("id, tarea_id, estudiante_id, entregado_en, puntos_obtenidos")
    .eq("tarea_id", tareaId);
  reventar("No pude cargar las entregas", error);

  const nombres = new Map(curso.map((a) => [a.id, a.nombre]));
  return (data ?? []).map((e) => ({
    id: e.id,
    tarea_id: e.tarea_id,
    estudiante_id: e.estudiante_id,
    estudiante: nombres.get(e.estudiante_id) ?? "Sin nombre",
    entregado_en: e.entregado_en,
    puntos_obtenidos: e.puntos_obtenidos,
  }));
}

export async function notasDe(
  evaluacionId: string, curso: { id: string; nombre: string }[],
): Promise<NotaDeCurso[]> {
  const { data, error } = await supabase
    .from("notas").select("estudiante_id, nota, publicada_en").eq("evaluacion_id", evaluacionId);
  reventar("No pude cargar las notas", error);

  // Se parte del curso y no de las notas: quien todavía no tiene nota igual
  // tiene que aparecer en la lista, o el docente no sabe a quién le falta.
  const puestas = new Map((data ?? []).map((n) => [n.estudiante_id, n]));
  return curso.map((alumno) => {
    const fila = puestas.get(alumno.id);
    return {
      evaluacion_id: evaluacionId,
      estudiante_id: alumno.id,
      estudiante: alumno.nombre,
      nota: fila?.nota == null ? null : Number(fila.nota),
      publicada: Boolean(fila?.publicada_en),
    };
  });
}

export async function avanceDe(
  asignaturaId: string, curso: { id: string; nombre: string }[],
): Promise<AvanceDeAlumno[]> {
  const { data: modulos, error } = await supabase
    .from("modulos").select("materiales(id)").eq("asignatura_id", asignaturaId);
  reventar("No pude cargar el material del ramo", error);

  const materiales = (modulos ?? []).flatMap((m) => (m.materiales ?? []).map((x) => x.id));
  if (materiales.length === 0) {
    return curso.map((a) => ({
      estudiante_id: a.id, estudiante: a.nombre, hechos: 0, totales: 0, ultimo_acceso: null,
    }));
  }

  const { data: progreso, error: errorProgreso } = await supabase
    .from("progreso_material")
    .select("estudiante_id, completado_en")
    .in("material_id", materiales);
  // Sin esto, una consulta fallida devolvería a todo el curso con cero
  // materiales vistos, y el asistente diría que nadie ha estudiado.
  reventar("No pude cargar el avance del curso", errorProgreso);

  const porAlumno = new Map<string, { hechos: number; ultimo: string | null }>();
  for (const p of progreso ?? []) {
    const fila = porAlumno.get(p.estudiante_id) ?? { hechos: 0, ultimo: null };
    fila.hechos += 1;
    if (!fila.ultimo || p.completado_en > fila.ultimo) fila.ultimo = p.completado_en;
    porAlumno.set(p.estudiante_id, fila);
  }

  return curso.map((a) => {
    const fila = porAlumno.get(a.id);
    return {
      estudiante_id: a.id,
      estudiante: a.nombre,
      hechos: fila?.hechos ?? 0,
      totales: materiales.length,
      ultimo_acceso: fila?.ultimo ?? null,
    };
  });
}

/**
 * Corregir es poner el puntaje y nada más. El identificador de la tarea no
 * hace falta acá, pero se recibe igual para que la firma sea la misma en las
 * dos fuentes: en demostración es lo que permite encontrar la entrega.
 */
export async function corregir(
  _tareaId: string, entregaId: string, puntos: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("entregas").update({ puntos_obtenidos: puntos }).eq("id", entregaId);
  reventar("No pude guardar el puntaje", error);
}

export async function ponerNota(
  evaluacionId: string, estudianteId: string, nota: number | null,
): Promise<void> {
  if (nota === null) {
    const { error } = await supabase.from("notas").delete()
      .eq("evaluacion_id", evaluacionId).eq("estudiante_id", estudianteId);
    reventar("No pude borrar la nota", error);
    return;
  }
  const { error } = await supabase.from("notas")
    .upsert({ evaluacion_id: evaluacionId, estudiante_id: estudianteId, nota },
            { onConflict: "evaluacion_id,estudiante_id" });
  reventar("No pude guardar la nota", error);
}

/** Publicar deja al curso ver lo que ya estaba puesto, y solo eso. */
export async function publicarNotas(evaluacionId: string): Promise<void> {
  const { error } = await supabase
    .from("notas")
    .update({ publicada_en: new Date().toISOString() })
    .eq("evaluacion_id", evaluacionId)
    .is("publicada_en", null);
  reventar("No pude publicar las notas", error);
}
