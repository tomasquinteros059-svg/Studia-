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

export type MensajeTutor = { id: string; rol: "estudiante" | "tutor"; contenido: string };
