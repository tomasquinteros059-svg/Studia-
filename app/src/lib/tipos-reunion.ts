// Lo que la app maneja de una reunión.
//
// Casi todo esto sale del equipo de tres; lo único que la persona escribe a
// mano es el encabezado —título, rubro, quiénes vienen, qué se va a tratar—
// y las tareas que agregue después.

import type { Rubro } from "../dominio/rubros.ts";
import type { Acuerdo, Pendiente, Tarea } from "../dominio/acta.ts";
import type { Sala } from "../dominio/sala.ts";

export type EstadoReunion = "borrador" | "grabando" | "analizando" | "listo" | "falló";

export type Reunion = {
  id: string;
  titulo: string;
  rubro: Rubro;
  estado: EstadoReunion;
  ocurrio_en: string;
  duracion_seg: number | null;
  participantes: string[];
  tabla: string[];
  /** Soy el dueño, o me invitaron. Cambia lo que se puede hacer. */
  mia: boolean;
  puedo_editar: boolean;
  /** El código para entrar. Null mientras la sala no se abra. */
  codigo: string | null;
  sala_abierta: boolean;
  sala_abierta_en: string | null;
};

export type EnLaSala = { id: string; nombre: string; puede_editar: boolean };

/**
 * La reunión vista como sala, que es como la mira el dominio. Las columnas
 * llevan el prefijo `sala_` porque viven en la fila de la reunión; el dominio
 * no tiene por qué saber eso.
 */
export const comoSala = (
  r: { sala_abierta: boolean; sala_abierta_en: string | null },
): Sala => ({ abierta: r.sala_abierta, abierta_en: r.sala_abierta_en });

/** La reunión con todo lo que salió de ella. */
export type ReunionCompleta = Reunion & {
  /** Quiénes entraron a la sala. Vacío si nadie más está. */
  sala: EnLaSala[];
  documento: string | null;
  transcripcion: string | null;
  resumen: string;
  acuerdos: Acuerdo[];
  tareas: Tarea[];
  pendientes: Pendiente[];
  sinTratar: string[];
  aportes: string[];
  contradicciones: string[];
};

export type ReunionNueva = {
  titulo: string;
  rubro: Rubro;
  participantes: string[];
  tabla: string[];
};

/** Una tarea con de qué reunión salió, para la lista de todas mis tareas. */
export type TareaConReunion = Tarea & {
  reunion_id: string;
  reunion: string;
  rubro: Rubro;
};
