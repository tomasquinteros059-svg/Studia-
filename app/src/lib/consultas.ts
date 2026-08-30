// Fachada de datos: la app pide siempre por acá y no sabe si detrás está
// Supabase o los datos en memoria del modo demostración.

import { MODO_DEMO } from "./config.ts";
import * as supabase from "./consultas-supabase.ts";
import * as demo from "./datos-demo.ts";

const fuente = MODO_DEMO ? demo : supabase;

export const misAsignaturas = fuente.misAsignaturas;
export const miHorario = fuente.miHorario;
export const materiaDe = fuente.materiaDe;
export const lecturaPorId = fuente.lecturaPorId;
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
export const misDictados = fuente.misDictados;
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

/* Lo que ve y escribe quien dicta. */
export const cursoDe = fuente.cursoDe;
export const entregasDe = fuente.entregasDe;
export const notasDe = fuente.notasDe;
export const avanceDe = fuente.avanceDe;
export const corregir = fuente.corregir;
export const ponerNota = fuente.ponerNota;
export const publicarNotas = fuente.publicarNotas;

/* El espacio de quien llega por su cuenta. */
export const crearRamoPropio = fuente.crearRamoPropio;
export const crearHorarioPropio = fuente.crearHorarioPropio;
export const borrarRamoPropio = fuente.borrarRamoPropio;
export const crearModulo = fuente.crearModulo;
export const cargarCatalogo = fuente.cargarCatalogo;
export const registros = fuente.registros;
export const cambiarRol = fuente.cambiarRol;
export const moduloParaMaterial = fuente.moduloParaMaterial;
export const crearMaterial = fuente.crearMaterial;

export const misSesiones = fuente.misSesiones;
export const crearSesion = fuente.crearSesion;
export const marcarSesion = fuente.marcarSesion;
export const borrarSesion = fuente.borrarSesion;

export const misQuices = fuente.misQuices;
export const quizPorId = fuente.quizPorId;
export const responderQuiz = fuente.responderQuiz;
export const borrarQuiz = fuente.borrarQuiz;


export const misFichas = fuente.misFichas;
export const repasarFicha = fuente.repasarFicha;
