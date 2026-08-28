// Fachada de datos: la app pide siempre por acá y no sabe si detrás está
// Supabase o las reuniones de ejemplo del modo demostración.

import { MODO_DEMO } from "./config.ts";
import * as supabase from "./reuniones-supabase.ts";
import * as demo from "./datos-reuniones.ts";

const fuente = MODO_DEMO ? demo : supabase;

export const quienSoy = fuente.quienSoy;
export const miPerfil = fuente.miPerfil;
export const cambiarNombre = fuente.cambiarNombre;

export const misReuniones = fuente.misReuniones;
export const reunionPorId = fuente.reunionPorId;
export const crearReunion = fuente.crearReunion;
export const borrarReunion = fuente.borrarReunion;
export const analizarReunion = fuente.analizarReunion;
export const agendar = fuente.agendar;

export const abrirSala = fuente.abrirSala;
export const cerrarSala = fuente.cerrarSala;
export const entrarConCodigo = fuente.entrarConCodigo;

export const misTareasDeTodas = fuente.misTareasDeTodas;
export const marcarTarea = fuente.marcarTarea;
export const agregarTarea = fuente.agregarTarea;
