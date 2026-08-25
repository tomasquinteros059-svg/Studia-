// Fachada de datos: la app pide siempre por acá y no sabe si detrás está
// Supabase o los datos en memoria del modo demostración.

import { MODO_DEMO } from "./config.ts";
import * as supabase from "./consultas-supabase.ts";
import * as demo from "./datos-demo.ts";

const fuente = MODO_DEMO ? demo : supabase;

export const misAsignaturas = fuente.misAsignaturas;
export const miHorario = fuente.miHorario;
export const materiaDe = fuente.materiaDe;
export const marcarMaterial = fuente.marcarMaterial;
export const clasesDe = fuente.clasesDe;
export const claseEnVivo = fuente.claseEnVivo;
export const capitulosDe = fuente.capitulosDe;
export const misTareas = fuente.misTareas;
export const tareaPorId = fuente.tareaPorId;
export const entregarTarea = fuente.entregarTarea;
export const evaluacionesDe = fuente.evaluacionesDe;
export const todasLasEvaluaciones = fuente.todasLasEvaluaciones;
export const foroDe = fuente.foroDe;
export const respuestasDe = fuente.respuestasDe;
export const responderHilo = fuente.responderHilo;
export const crearHilo = fuente.crearHilo;
export const hiloPorId = fuente.hiloPorId;
export const companerosDe = fuente.companerosDe;
export const miPerfil = fuente.miPerfil;
export const cambiarNombre = fuente.cambiarNombre;
export const misNotificaciones = fuente.misNotificaciones;
export const marcarLeida = fuente.marcarLeida;
export const marcarTodasLeidas = fuente.marcarTodasLeidas;
export const mensajesDe = fuente.mensajesDe;
export const misApuntes = fuente.misApuntes;
export const apuntePorId = fuente.apuntePorId;
export const crearApunte = fuente.crearApunte;
export const guardarApunte = fuente.guardarApunte;
export const fijarApunte = fuente.fijarApunte;
export const borrarApunte = fuente.borrarApunte;
export const resumenDe = fuente.resumenDe;
