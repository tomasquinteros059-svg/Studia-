export type Asignatura = {
  id: string;
  codigo: string;
  nombre: string;
  profesor: string;
  ayudante: string | null;
  color: string;
  creditos: number;
  descripcion: string | null;
  requisitos: string | null;
  bibliografia: string[];
  intro_tutor: string;
  /**
   * Lo armó la propia persona, no una institución. Cambia qué se muestra:
   * un ramo propio no tiene foro, ni notas, ni compañeros, y sí tiene el
   * botón para agregar material.
   */
  propio: boolean;
};

export type BloqueHorario = {
  id: string;
  asignatura_id: string;
  dia: number;
  hora_inicio: string;
  hora_fin: string;
  sala: string;
  tipo: string;
};

export type Material = {
  id: string;
  tipo: "video" | "documento" | "ejercicios";
  titulo: string;
  detalle: string;
  orden: number;
  completado: boolean;
  /** Trae texto adentro: se puede abrir en el lector y escuchar. */
  leible: boolean;
};

/** Un material abierto en el lector. El texto solo se pide al abrirlo. */
/** Una persona registrada, como la ve la administración. */
export type Registro = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  creado_en: string;
};

export type Lectura = {
  id: string;
  titulo: string;
  asignatura_id: string;
  /** Para volver al ramo y para el contexto del tutor. */
  asignatura_nombre: string;
  /** El color del ramo, con el que el lector resalta lo que va leyendo. */
  asignatura_color: string | null;
  texto: string;
};

export type Modulo = {
  id: string;
  titulo: string;
  orden: number;
  materiales: Material[];
};

export type Clase = {
  id: string;
  asignatura_id: string;
  titulo: string;
  estado: "programada" | "en_vivo" | "grabada";
  inicia_en: string;
  duracion_seg: number | null;
  audio_url: string | null;
};

export type Capitulo = { id: string; titulo: string; segundo: number };

export type TareaConEstado = {
  id: string;
  asignatura_id: string;
  titulo: string;
  enunciado: string;
  criterios: string[];
  puntos: number;
  vence_en: string;
  entregada_en: string | null;
  puntos_obtenidos: number | null;
};

export type EvaluacionConNota = {
  id: string;
  titulo: string;
  peso: number;
  orden: number;
  nota: number | null;
};

export type Hilo = {
  id: string;
  asignatura_id: string;
  autor_nombre: string;
  autor_rol: string;
  titulo: string;
  cuerpo: string;
  fijado: boolean;
  creado_en: string;
  respuestas: number;
};

export type Respuesta = {
  id: string;
  autor_nombre: string;
  autor_rol: string;
  cuerpo: string;
  creado_en: string;
};

export type Notificacion = {
  id: string;
  tipo: "clase" | "anuncio" | "tarea" | "nota";
  titulo: string;
  detalle: string;
  asignatura_id: string | null;
  ref_tipo: "clase" | "hilo" | "tarea" | "notas" | null;
  ref_id: string | null;
  leida: boolean;
  creado_en: string;
};

export type Rol = "estudiante" | "profesor" | "administrador";

export type Perfil = {
  nombre: string;
  correo: string;
  /** Decide qué aplicación abre la persona. Lo pone el colegio, no el cliente. */
  rol: Rol;
};

/** Un ramo que esta persona dicta, y con qué papel. */
export type Dictado = {
  asignatura_id: string;
  papel: "profesor" | "ayudante";
};

export type MensajeTutor = { id: string; rol: "estudiante" | "tutor"; contenido: string };

export type Apunte = {
  id: string;
  asignatura_id: string;
  clase_id: string | null;
  titulo: string;
  contenido: string;
  fijado: boolean;
  actualizado_en: string;
};

export type ResumenGuardado = {
  cuerpo: string;
  vacios: string[];
  consejos: string[];
  creado_en: string;
};

/**
 * Una sesión de estudio: lo que la persona se propuso hacer, y cuándo.
 *
 * Es lo único del planificador que no viene de la institución. Las clases
 * las pone el horario y las entregas las ponen las tareas; esto lo pone
 * quien estudia, y no lo ve nadie más.
 */
export type SesionEstudio = {
  id: string;
  asignatura_id: string | null;
  titulo: string;
  empieza_en: string;
  minutos: number;
  hecha_en: string | null;
};

export type PreguntaDeQuiz = {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
};

/**
 * Un quiz de repaso. Las preguntas las escribió el evaluador con el material
 * del ramo; las respuestas son de quien lo está haciendo, y de nadie más.
 */
export type Quiz = {
  id: string;
  asignatura_id: string;
  tema: string;
  preguntas: PreguntaDeQuiz[];
  respuestas: (number | null)[];
  terminado_en: string | null;
  creado_en: string;
};
