// Todas las lecturas contra Supabase. Las políticas de acceso ya limitan lo
// que vuelve, así que acá no se filtra por estudiante: sería redundante y
// daría la falsa impresión de que la seguridad vive en el cliente.

import { supabase } from "./supabase.ts";
import type {
  Apunte, ApunteEnLista, Asignatura, BloqueHorario, BloquePlan, TramoOido, Capitulo, Clase, EvaluacionConNota,
  Dictado, Hilo, Lectura, MensajeTutor, Modulo, Notificacion, Perfil,
  Ficha, Quiz, Registro, ResumenGuardado, Respuesta, SesionEstudio,
  TareaConEstado,
} from "./tipos.ts";
import type { EntregaDeCurso, NotaDeCurso } from "../dominio/curso.ts";
import type { AvanceDeAlumno } from "../dominio/asistente-demo.ts";
import { codigoDe, introDe, normalizar } from "../dominio/ramo-propio.ts";
import { comoFalla } from "../dominio/fallas.ts";
import { planValido, type Plan } from "../dominio/planes.ts";
import type { Tramo } from "../dominio/escucha.ts";
import { COLORES_DE_RAMO } from "../dominio/ramos.ts";
import { colorDeLaCarga, type RamoEscrito } from "../dominio/horario-escrito.ts";
import { comoHora, type Colegio } from "../dominio/planilla.ts";
import type { QuienDicta } from "../dominio/horario.ts";

function reventar(contexto: string, error: { message: string } | null): void {
  // El mensaje ya sale dicho en castellano y sin el detalle técnico. Pegar
  // «: Network request failed» al final del contexto era lo que hacía que un
  // problema de señal se leyera como una falla de la aplicación.
  // `comoFalla` y no `new Error`: el mensaje traducido ya no se parece a lo
  // que lo causó, así que la falla lleva su clase adjunta. Sin eso, la copia
  // guardada en el aparato no se usaría nunca.
  if (error) throw comoFalla(error.message, contexto);
}

export async function misAsignaturas(): Promise<Asignatura[]> {
  const { data, error } = await supabase
    .from("asignaturas")
    .select("id, codigo, nombre, profesor, ayudante, color, creditos, descripcion, requisitos, bibliografia, intro_tutor, creador_id")
    .order("nombre");
  reventar("No pude cargar tus asignaturas", error);
  // Un ramo con creador es un ramo propio. La columna no sale de acá: quién
  // lo creó es asunto de la base, la app solo necesita el sí o el no.
  return (data ?? []).map(({ creador_id, ...a }) => ({ ...a, propio: creador_id !== null }));
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
    .select("id, titulo, orden, materiales(id, tipo, titulo, detalle, orden, texto, url)")
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
      .map(({ texto, url, ...mat }) => ({
        ...mat,
        completado: completados.has(mat.id),
        leible: typeof texto === "string" && texto.trim().length > 0,
        archivo: url ?? null,
      })),
  }));
}

/** El texto completo de un material, para el lector. */
export async function lecturaPorId(materialId: string): Promise<Lectura | null> {
  const { data, error } = await supabase
    .from("materiales")
    .select("id, titulo, texto, modulos(asignatura_id, asignaturas(nombre, color))")
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
    asignatura_color: asignatura?.color ?? null,
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
    .select("id, asignatura_id, titulo, estado, inicia_en, duracion_seg, audio_url, presencial, escucha_permitida")
    .eq("asignatura_id", asignaturaId)
    .order("inicia_en", { ascending: false });
  reventar("No pude cargar las clases", error);
  return data ?? [];
}

export async function claseEnVivo(): Promise<Clase | null> {
  const { data, error } = await supabase
    .from("clases")
    .select("id, asignatura_id, titulo, estado, inicia_en, duracion_seg, audio_url, presencial, escucha_permitida")
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
    .select("id, asignatura_id, titulo, enunciado, criterios, puntos, vence_en, entregas(entregado_en, puntos_obtenidos, archivo_url)")
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
      entregado: entrega?.archivo_url ?? null,
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
    .select("id, asignatura_id, titulo, enunciado, criterios, puntos, vence_en, entregas(entregado_en, puntos_obtenidos, archivo_url)")
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
    entregado: entrega?.archivo_url ?? null,
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
    .from("perfiles").select("nombre, rol, plan").eq("id", sesion.user.id).single();
  reventar("No pude cargar tu perfil", error);

  // El correo sale de la sesión, no de la base: la columna no es legible desde
  // el cliente para que nadie pueda leer el de otro. El rol sí se lee, y es lo
  // que decide qué aplicación abre la persona.
  return {
    nombre: data?.nombre ?? "",
    correo: sesion.user.email ?? "",
    rol: (data?.rol as Perfil["rol"]) ?? "estudiante",
    // Por `planValido` y no directo: si la columna trajera algo raro, caer en
    // el plan gratis es lo correcto. Un error de escritura en la base no
    // puede regalar lo que se cobra.
    plan: planValido(data?.plan),
  };
}

/** Qué dicta esta persona, y con qué papel. Vacío para un estudiante. */
/**
 * Quién dicta cada ramo del colegio. Para la administración y nadie más.
 *
 * Sale de una función y no de una consulta directa: hace falta el nombre de
 * cada docente, y el nombre de otra persona no es legible desde el cliente.
 * La función comprueba el rol adentro, así que llamarla sin él devuelve vacío
 * en vez de fallar.
 */
export async function quienDicta(): Promise<QuienDicta[]> {
  const { data, error } = await supabase.rpc("dictados_del_colegio");
  reventar("No pude cargar quién dicta cada ramo", error);
  return (data ?? []) as QuienDicta[];
}

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
export async function misApuntes(asignaturaId?: string): Promise<ApunteEnLista[]> {
  let consulta = supabase
    .from("apuntes")
    .select("id, asignatura_id, clase_id, titulo, contenido, tiene_trazos, fijado, actualizado_en")
    .order("actualizado_en", { ascending: false });
  if (asignaturaId) consulta = consulta.eq("asignatura_id", asignaturaId);

  const { data, error } = await consulta;
  reventar("No pude cargar tus apuntes", error);
  return data ?? [];
}

export async function apuntePorId(apunteId: string): Promise<Apunte | null> {
  const { data, error } = await supabase
    .from("apuntes")
    .select("id, asignatura_id, clase_id, titulo, contenido, trazos, fijado, actualizado_en")
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
    .select("id, asignatura_id, clase_id, titulo, contenido, trazos, fijado, actualizado_en")
    .single();
  reventar("No pude crear el apunte", error);
  if (!data) throw new Error("No pude crear el apunte.");
  return data;
}

export async function guardarApunte(
  apunteId: string, campos: { titulo?: string; contenido?: string; trazos?: string | null },
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
    .select("id, tarea_id, estudiante_id, entregado_en, puntos_obtenidos, archivo_url")
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
    archivo: e.archivo_url ?? null,
  }));
}

/**
 * Las entregas de varias tareas de una vez.
 *
 * Existe por una cuenta que se hace fea sola: el panel de quien dicta pedía
 * las entregas de cada tarea por separado, y las notas de cada evaluación
 * también. Una profesora con cinco ramos, ocho tareas y seis evaluaciones
 * abría su pantalla con unos setenta viajes al servidor. Eso crece con el
 * semestre —cada tarea nueva suma uno— y no se nota probando con dos.
 *
 * Devuelve todo junto y sin agrupar: agrupar es de quien lo va a dibujar, y
 * `agrupadasPor` en el dominio lo hace en una línea.
 */
export async function entregasDeVarias(
  tareaIds: string[], curso: { id: string; nombre: string }[],
): Promise<EntregaDeCurso[]> {
  if (tareaIds.length === 0) return [];

  const { data, error } = await supabase
    .from("entregas")
    .select("id, tarea_id, estudiante_id, entregado_en, puntos_obtenidos, archivo_url")
    .in("tarea_id", tareaIds);
  reventar("No pude cargar las entregas", error);

  const nombres = new Map(curso.map((a) => [a.id, a.nombre]));
  return (data ?? []).map((e) => ({
    id: e.id,
    tarea_id: e.tarea_id,
    estudiante_id: e.estudiante_id,
    estudiante: nombres.get(e.estudiante_id) ?? "Sin nombre",
    entregado_en: e.entregado_en,
    puntos_obtenidos: e.puntos_obtenidos,
    archivo: e.archivo_url ?? null,
  }));
}

/**
 * Las notas de varias evaluaciones de una vez.
 *
 * Igual que arriba, y con el mismo cuidado que la versión de a una: se parte
 * del curso y no de las notas, porque quien todavía no tiene nota tiene que
 * aparecer igual o el docente no sabe a quién le falta. Por eso devuelve una
 * fila por alumno y evaluación, tenga nota o no.
 */
export async function notasDeVarias(
  evaluacionIds: string[], curso: { id: string; nombre: string }[],
): Promise<NotaDeCurso[]> {
  if (evaluacionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("notas")
    .select("evaluacion_id, estudiante_id, nota, publicada_en")
    .in("evaluacion_id", evaluacionIds);
  reventar("No pude cargar las notas", error);

  const puestas = new Map(
    (data ?? []).map((n) => [`${n.evaluacion_id}·${n.estudiante_id}`, n]),
  );

  return evaluacionIds.flatMap((evaluacionId) =>
    curso.map((alumno) => {
      const fila = puestas.get(`${evaluacionId}·${alumno.id}`);
      return {
        evaluacion_id: evaluacionId,
        estudiante_id: alumno.id,
        estudiante: alumno.nombre,
        nota: fila?.nota == null ? null : Number(fila.nota),
        publicada: Boolean(fila?.publicada_en),
      };
    }),
  );
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

/* -------------------------------------------------------- espacio propio */
// Quien llega sin institución arma sus propios ramos. Las políticas exigen
// que queden a nombre propio, así que acá no hay nada que decidir: se manda
// el identificador de quien está en sesión y la base hace el resto.

/**
 * Carga el catálogo del semestre —ramos y horario— de una sola vez.
 *
 * Va por una función de la base y no por inserts sueltos porque a mil ramos
 * eso deja de ser un detalle: es una transacción, así que o entra todo o no
 * entra nada. Un semestre a medio cargar no se puede arreglar desde afuera,
 * porque no hay manera de saber dónde quedó.
 *
 * Quién puede llamarla lo siguen decidiendo las políticas de las tablas: la
 * función es `security invoker`, no una puerta de atrás.
 */
export async function cargarCatalogo(
  colegio: Pick<Colegio, "asignaturas" | "horario">,
): Promise<{ ramos: number; bloques: number }> {
  const { data, error } = await supabase.rpc("cargar_catalogo", {
    p_asignaturas: colegio.asignaturas,
    // Las horas viajan como "HH:MM": adentro son minutos desde medianoche,
    // y eso es cosa de la revisión, no de la base.
    p_horario: colegio.horario.map((b) => ({
      codigo: b.codigo,
      dia: b.dia,
      hora_inicio: comoHora(b.inicio),
      hora_fin: comoHora(b.fin),
      sala: b.sala,
      tipo: b.tipo,
    })),
  });
  reventar("No pude cargar el catálogo", error);
  const r = data as { ramos?: number; bloques?: number } | null;
  return { ramos: r?.ramos ?? 0, bloques: r?.bloques ?? 0 };
}

/**
 * El registro de quiénes están en StudIA.
 *
 * Va por una función de la base y no por la tabla porque el correo ajeno no
 * es legible desde el cliente —esa es la promesa que la app le hace a cada
 * persona— y la administración es la única excepción. Leyendo la tabla, ni
 * ella ve más que su propia fila.
 */
export async function registros(): Promise<Registro[]> {
  const { data, error } = await supabase.rpc("registros");
  reventar("No pude cargar el registro", error);
  return (data ?? []) as Registro[];
}

/** Cambiar el rol de otra persona. El propio no se toca, ni para subir. */
export async function cambiarRol(personaId: string, rol: Registro["rol"]): Promise<void> {
  const { error } = await supabase.rpc("cambiar_rol", { p_persona: personaId, p_rol: rol });
  reventar("No pude cambiar el rol", error);
}

/**
 * Deja a alguien en un plan. Solo la administración.
 *
 * Es el camino de las instituciones: el contrato se conversa, se factura y se
 * firma afuera, y acá alguien deja puesto lo que se acordó. El camino de las
 * personas es otro —Google Play cobra y avisa al servidor— y no pasa por
 * esta función.
 */
export async function cambiarPlan(personaId: string, plan: Plan): Promise<void> {
  const { error } = await supabase.rpc("cambiar_plan", { p_persona: personaId, p_plan: plan });
  reventar("No pude cambiar el plan", error);
}

export async function crearRamoPropio(nombre: string, color: string): Promise<Asignatura> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const limpio = normalizar(nombre);
  const { data, error } = await supabase
    .from("asignaturas")
    .insert({
      // El código lo ve la persona en su propia lista: se arma de su nombre.
      codigo: codigoDe(limpio),
      nombre: limpio,
      color,
      creditos: 1,
      intro_tutor: introDe(limpio),
      creador_id: sesion.user.id,
    })
    .select()
    .single();
  reventar("No pude crear el ramo", error);
  if (!data) throw new Error("No pude crear el ramo.");

  // Se inscribe solo: sin esto vería el ramo por ser su dueño, pero no
  // aparecería en su horario ni en sus tareas, que van por la inscripción.
  const { error: errorInscripcion } = await supabase
    .from("inscripciones")
    .insert({ estudiante_id: sesion.user.id, asignatura_id: data.id });
  reventar("Creé el ramo pero no pude inscribirte", errorInscripcion);

  return data as Asignatura;
}

/**
 * Crea de una vez los ramos de un horario escrito, con sus bloques.
 *
 * Va ramo por ramo a propósito, y no en un solo insert: si algo falla en el
 * cuarto, los tres primeros ya están creados y sirven. Perder el semestre
 * entero porque una línea traía una hora rara sería mucho peor que quedarse
 * a medias y poder seguir escribiendo el resto.
 */
export async function crearHorarioPropio(
  ramos: RamoEscrito[], desde: number,
): Promise<Asignatura[]> {
  const creados: Asignatura[] = [];

  for (const [i, escrito] of ramos.entries()) {
    // `desde` son los ramos propios que ya tenía. Va en la cuenta para que
    // el color siga donde quedó y para que la vista previa haya mostrado
    // exactamente estos colores.
    const ramo = await crearRamoPropio(escrito.nombre, colorDeLaCarga(i, desde, COLORES_DE_RAMO));
    creados.push(ramo);
    if (escrito.bloques.length === 0) continue;

    const { error } = await supabase.from("bloques_horario").insert(
      escrito.bloques.map((b) => ({
        asignatura_id: ramo.id,
        dia: b.dia,
        hora_inicio: b.inicio,
        hora_fin: b.fin,
        sala: b.sala,
        tipo: b.tipo,
      })),
    );
    reventar(`Creé ${ramo.nombre} pero no pude guardarle las horas`, error);
  }
  return creados;
}

export async function borrarRamoPropio(asignaturaId: string): Promise<void> {
  const { error } = await supabase.from("asignaturas").delete().eq("id", asignaturaId);
  reventar("No pude borrar el ramo", error);
}

/** Un módulo dentro de un ramo propio, al final de la lista. */
/**
 * La unidad donde va a caer un material que se sube sin elegir dónde.
 *
 * Devuelve la primera que ya exista y solo crea una si el ramo está vacío.
 * Crear siempre una nueva dejaría el ramo con una unidad "Mi material" por
 * cada archivo subido, que es peor que no tener unidades.
 */
export async function moduloParaMaterial(asignaturaId: string): Promise<string> {
  const { data, error } = await supabase
    .from("modulos")
    .select("id")
    .eq("asignatura_id", asignaturaId)
    .order("orden", { ascending: true })
    .limit(1);
  reventar("No pude ver las unidades del ramo", error);
  const primera = data?.[0]?.id as string | undefined;
  return primera ?? await crearModulo(asignaturaId, "Mi material");
}

export async function crearModulo(asignaturaId: string, titulo: string): Promise<string> {
  const { data: existentes } = await supabase
    .from("modulos").select("orden").eq("asignatura_id", asignaturaId);
  const orden = Math.max(0, ...(existentes ?? []).map((m) => m.orden)) + 1;

  const { data, error } = await supabase
    .from("modulos")
    .insert({ asignatura_id: asignaturaId, titulo: titulo.trim(), orden })
    .select("id")
    .single();
  reventar("No pude crear la unidad", error);
  if (!data) throw new Error("No pude crear la unidad.");
  return data.id as string;
}

export type MaterialNuevo = {
  moduloId: string;
  tipo: "video" | "documento" | "ejercicios";
  titulo: string;
  detalle: string;
  /** El texto que el lector va a leer, si lo escribió a mano. */
  texto?: string | null;
  /** La ruta del archivo, cuando haya almacenamiento. */
  url?: string | null;
};

export async function crearMaterial(nuevo: MaterialNuevo): Promise<void> {
  const { data: existentes } = await supabase
    .from("materiales").select("orden").eq("modulo_id", nuevo.moduloId);
  const orden = Math.max(0, ...(existentes ?? []).map((m) => m.orden)) + 1;

  const { error } = await supabase.from("materiales").insert({
    modulo_id: nuevo.moduloId,
    tipo: nuevo.tipo,
    titulo: nuevo.titulo.trim(),
    detalle: nuevo.detalle,
    texto: nuevo.texto ?? null,
    url: nuevo.url ?? null,
    orden,
  });
  reventar("No pude guardar el material", error);
}

// ── El planificador ───────────────────────────────────────────────────────

const CAMPOS_SESION = "id, asignatura_id, titulo, empieza_en, minutos, hecha_en";

/**
 * Las sesiones de un tramo de fechas. Se piden por semana y no todas: son
 * del año entero y la pantalla muestra siete días.
 */
export async function misSesiones(desde: Date, hasta: Date): Promise<SesionEstudio[]> {
  const { data, error } = await supabase
    .from("sesiones_estudio")
    .select(CAMPOS_SESION)
    .gte("empieza_en", desde.toISOString())
    .lt("empieza_en", hasta.toISOString())
    .order("empieza_en");
  reventar("No pude cargar tu planificación", error);
  return data ?? [];
}

export async function crearSesion(nueva: {
  asignaturaId: string | null;
  titulo: string;
  empiezaEn: Date;
  minutos: number;
}): Promise<SesionEstudio> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { data, error } = await supabase
    .from("sesiones_estudio")
    .insert({
      estudiante_id: sesion.user.id,
      asignatura_id: nueva.asignaturaId,
      titulo: nueva.titulo,
      empieza_en: nueva.empiezaEn.toISOString(),
      minutos: nueva.minutos,
    })
    .select(CAMPOS_SESION)
    .single();
  reventar("No pude guardar la sesión", error);
  if (!data) throw new Error("No pude guardar la sesión.");
  return data;
}

/** Marcarla hecha o volver a dejarla pendiente: lo segundo pasa seguido. */
export async function marcarSesion(sesionId: string, hecha: boolean): Promise<void> {
  const { error } = await supabase
    .from("sesiones_estudio")
    .update({ hecha_en: hecha ? new Date().toISOString() : null })
    .eq("id", sesionId);
  reventar("No pude marcar la sesión", error);
}

export async function borrarSesion(sesionId: string): Promise<void> {
  const { error } = await supabase.from("sesiones_estudio").delete().eq("id", sesionId);
  reventar("No pude borrar la sesión", error);
}

// ── Los quices ────────────────────────────────────────────────────────────

const CAMPOS_QUIZ = "id, asignatura_id, tema, preguntas, respuestas, terminado_en, creado_en";

export async function misQuices(asignaturaId?: string): Promise<Quiz[]> {
  let consulta = supabase.from("quices").select(CAMPOS_QUIZ).order("creado_en", { ascending: false });
  if (asignaturaId) consulta = consulta.eq("asignatura_id", asignaturaId);

  const { data, error } = await consulta;
  reventar("No pude cargar tus quices", error);
  return data ?? [];
}

export async function quizPorId(quizId: string): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from("quices").select(CAMPOS_QUIZ).eq("id", quizId).maybeSingle();
  reventar("No pude cargar el quiz", error);
  return data;
}

/**
 * Guardar lo respondido. Pasa por una función de la base y no por un update
 * suelto: si el cliente pudiera escribir la fila entera, podría reescribir
 * sus propias preguntas y el puntaje dejaría de decir nada.
 */
export async function responderQuiz(
  quizId: string, respuestas: (number | null)[], terminado: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("responder_quiz", {
    p_quiz: quizId, p_respuestas: respuestas, p_terminado: terminado,
  });
  reventar("No pude guardar tu respuesta", error);
}

export async function borrarQuiz(quizId: string): Promise<void> {
  const { error } = await supabase.from("quices").delete().eq("id", quizId);
  reventar("No pude borrar el quiz", error);
}

// ── Las fichas ────────────────────────────────────────────────────────────

const CAMPOS_FICHA = "id, tema, pregunta, respuesta, aciertos, fallos, vuelve_en";

export async function misFichas(asignaturaId: string, tema?: string): Promise<Ficha[]> {
  let consulta = supabase
    .from("fichas").select(CAMPOS_FICHA).eq("asignatura_id", asignaturaId)
    .order("vuelve_en", { ascending: true, nullsFirst: true });
  if (tema) consulta = consulta.eq("tema", tema);

  const { data, error } = await consulta;
  reventar("No pude cargar tus fichas", error);
  return data ?? [];
}

/**
 * Anotar si se supo o no. El próximo plazo lo calcula la base: si lo hiciera
 * el cliente, se podría adelantar, y una repetición que se adelanta no repite.
 */
export async function repasarFicha(fichaId: string, acerto: boolean): Promise<void> {
  const { error } = await supabase.rpc("repasar_ficha", {
    p_ficha: fichaId, p_acerto: acerto,
  });
  reventar("No pude anotar el repaso", error);
}

// ------------------------------------------------------------ modo escucha
//
// El audio no pasa por acá. Cada teléfono transcribe en el propio aparato y
// sube tramos de texto; lo que viaja es lo que ya está escrito.

/** Anota que este aparato se puso a oír. Devuelve el identificador de esa escucha. */
export async function empezarAEscuchar(claseId: string, aparato: string): Promise<string> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  // Un aparato solo puede tener una escucha por clase: si vuelve a entrar
  // —se cortó la app, se apagó la pantalla— sigue la misma.
  const { data, error } = await supabase
    .from("escuchas")
    .upsert(
      { clase_id: claseId, persona_id: sesion.user.id, aparato, termino_en: null },
      { onConflict: "clase_id,aparato" },
    )
    .select("id")
    .single();
  reventar("No pude ponerte a oír la clase", error);
  if (!data) throw new Error("No pude ponerte a oír la clase.");
  return data.id;
}

export async function subirTramos(
  claseId: string, escuchaId: string, tramos: readonly TramoOido[],
): Promise<void> {
  if (tramos.length === 0) return;
  const { error } = await supabase.from("tramos_oidos").insert(
    tramos.map((t) => ({
      clase_id: claseId, escucha_id: escuchaId,
      segundo: t.segundo, texto: t.texto, confianza: t.confianza,
    })),
  );
  reventar("No pude guardar lo que oíste", error);
}

/** Cuántos aparatos están oyendo esta clase ahora. */
export async function cuantosEscuchan(claseId: string): Promise<number> {
  const { count, error } = await supabase
    .from("escuchas")
    .select("id", { count: "exact", head: true })
    .eq("clase_id", claseId)
    .is("termino_en", null);
  reventar("No pude ver quién está oyendo", error);
  return count ?? 0;
}

/** Todo lo que oyeron todos los aparatos, para cruzarlo. */
export async function tramosDeLaClase(claseId: string): Promise<Tramo[]> {
  const { data, error } = await supabase
    .from("tramos_oidos")
    .select("escucha_id, segundo, texto, confianza")
    .eq("clase_id", claseId)
    .order("segundo");
  reventar("No pude juntar lo que oyó el curso", error);
  return (data ?? []).map((t) => ({
    aparato: t.escucha_id, segundo: t.segundo, texto: t.texto, confianza: t.confianza,
  }));
}

/** Deja la clase escrita y borra los tramos sueltos. */
export async function armarLaClase(
  claseId: string, clase: readonly { segundo: number; texto: string }[],
): Promise<void> {
  const { error } = await supabase.rpc("armar_la_clase", {
    p_clase: claseId, p_tramos: clase,
  });
  reventar("No pude armar la clase", error);
}

export async function claseEscrita(claseId: string): Promise<{ segundo: number; texto: string }[]> {
  const { data, error } = await supabase
    .from("transcripciones")
    .select("segundo, texto")
    .eq("clase_id", claseId)
    .order("segundo");
  reventar("No pude leer la clase", error);
  return data ?? [];
}

export async function permitirEscucha(claseId: string, permitida: boolean): Promise<void> {
  const { error } = await supabase
    .from("clases").update({ escucha_permitida: permitida }).eq("id", claseId);
  reventar("No pude cambiar el permiso", error);
}

// ------------------------------------------------------- registro de notas

/**
 * Crea una evaluación con su ponderación.
 *
 * El orden sale de cuántas hay: es el número que la evaluación ocupa en el
 * semestre y la base lo exige único por ramo. Si dos personas crean una a la
 * vez, la segunda choca contra esa restricción y se lo decimos, en vez de
 * dejar dos «Control 3».
 */
export async function crearEvaluacion(
  asignaturaId: string, titulo: string, peso: number,
): Promise<void> {
  const { count, error: contando } = await supabase
    .from("evaluaciones")
    .select("id", { count: "exact", head: true })
    .eq("asignatura_id", asignaturaId);
  reventar("No pude ver las evaluaciones que ya hay", contando);

  const { error } = await supabase.from("evaluaciones").insert({
    asignatura_id: asignaturaId, titulo, peso, orden: (count ?? 0) + 1,
  });
  reventar("No pude crear la evaluación", error);
}

export async function cambiarPeso(evaluacionId: string, peso: number): Promise<void> {
  const { error } = await supabase.from("evaluaciones").update({ peso }).eq("id", evaluacionId);
  reventar("No pude cambiar la ponderación", error);
}

// ------------------------------------------------------ planificación mensual

/** Lo planificado en un rango de semanas. La aplicación manda siempre lunes. */
export async function planDe(
  asignaturaId: string, desde: string, hasta: string,
): Promise<BloquePlan[]> {
  const { data, error } = await supabase
    .from("planificacion")
    .select("id, semana, titulo, detalle, modulo_id, orden")
    .eq("asignatura_id", asignaturaId)
    .gte("semana", desde)
    .lte("semana", hasta)
    .order("semana")
    .order("orden");
  reventar("No pude cargar tu planificación", error);
  return data ?? [];
}

export async function planificar(
  asignaturaId: string, bloques: readonly Omit<BloquePlan, "id">[],
): Promise<void> {
  if (bloques.length === 0) return;
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión.");

  const { error } = await supabase.from("planificacion").insert(
    bloques.map((b) => ({
      asignatura_id: asignaturaId, autor_id: sesion.user!.id,
      semana: b.semana, titulo: b.titulo, detalle: b.detalle,
      modulo_id: b.modulo_id, orden: b.orden,
    })),
  );
  reventar("No pude guardar la planificación", error);
}

export async function borrarDelPlan(bloqueId: string): Promise<void> {
  const { error } = await supabase.from("planificacion").delete().eq("id", bloqueId);
  reventar("No pude sacarlo del plan", error);
}
