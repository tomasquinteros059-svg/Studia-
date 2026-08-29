// El espacio de quien llega por su cuenta, en modo demostración.
//
// Vive aparte porque no es ni la mirada del alumno de una institución ni la
// del profesor: es la de alguien que arma su propio ramo con sus propios
// archivos. En demostración los ramos quedan en memoria y se pierden al
// cerrar la app; con Supabase conectado los guarda `consultas-supabase.ts`
// y esto no se usa.

import { codigoDe, introDe, normalizar } from "../dominio/ramo-propio.ts";
import { colorDeLaCarga, type RamoEscrito } from "../dominio/horario-escrito.ts";
import type { MaterialNuevo } from "./consultas-supabase.ts";
import type { Asignatura, BloqueHorario, Lectura, Modulo } from "./tipos.ts";
import { COLORES_DE_RAMO } from "../dominio/ramos.ts";

export const RAMOS_PROPIOS: Asignatura[] = [];
export const MODULOS_PROPIOS: Record<string, Modulo[]> = {};
/** Las horas de los ramos propios. Los del colegio van por otro lado. */
export const HORARIO_PROPIO: BloqueHorario[] = [];

/** El texto que se escribió a mano, para que el lector lo pueda leer. */
const TEXTOS: Record<string, string> = {};

let siguiente = 1;
const nuevoId = (prefijo: string) => `${prefijo}-${siguiente++}`;
const dormir = () => new Promise((r) => setTimeout(r, 90));
const copiar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export async function crearRamoPropio(nombre: string, color: string): Promise<Asignatura> {
  await dormir();
  const ramo = armarRamo(nombre, color);
  RAMOS_PROPIOS.push(ramo);
  MODULOS_PROPIOS[ramo.id] = [];
  return copiar(ramo);
}

/** El molde de un ramo propio, uno solo para las dos maneras de crearlo. */
function armarRamo(nombre: string, color: string): Asignatura {
  const limpio = normalizar(nombre);
  return {
    id: nuevoId("propio"),
    codigo: codigoDe(limpio),
    nombre: limpio,
    profesor: "Por tu cuenta",
    ayudante: null,
    color,
    creditos: 1,
    descripcion: null,
    requisitos: null,
    bibliografia: [],
    intro_tutor: introDe(limpio),
    propio: true,
  };
}

/**
 * Crea de una vez los ramos de un horario escrito, con sus bloques.
 *
 * Es la diferencia entre poner un semestre en un minuto y pasar por el mismo
 * formulario seis veces. Los colores se reparten por orden de llegada para
 * que dos ramos seguidos no salgan iguales.
 */
export async function crearHorarioPropio(
  ramos: RamoEscrito[], desde: number,
): Promise<Asignatura[]> {
  await dormir();
  const creados: Asignatura[] = [];

  for (const [i, escrito] of ramos.entries()) {
    const color = colorDeLaCarga(i, desde, COLORES_DE_RAMO);
    const ramo = armarRamo(escrito.nombre, color);
    RAMOS_PROPIOS.push(ramo);
    MODULOS_PROPIOS[ramo.id] = [];

    for (const b of escrito.bloques) {
      HORARIO_PROPIO.push({
        id: nuevoId("bloque"),
        asignatura_id: ramo.id,
        dia: b.dia,
        hora_inicio: b.inicio,
        hora_fin: b.fin,
        sala: b.sala,
        tipo: b.tipo,
      });
    }
    creados.push(ramo);
  }
  return copiar(creados);
}

/** Los bloques de los ramos propios, para sumarlos al horario que se ve. */
export function horarioPropio(): BloqueHorario[] {
  return copiar(HORARIO_PROPIO);
}

export async function borrarRamoPropio(asignaturaId: string): Promise<void> {
  const i = RAMOS_PROPIOS.findIndex((r) => r.id === asignaturaId);
  if (i >= 0) RAMOS_PROPIOS.splice(i, 1);
  for (let j = HORARIO_PROPIO.length - 1; j >= 0; j--) {
    if (HORARIO_PROPIO[j]!.asignatura_id === asignaturaId) HORARIO_PROPIO.splice(j, 1);
  }
  for (const m of MODULOS_PROPIOS[asignaturaId] ?? []) {
    for (const x of m.materiales) delete TEXTOS[x.id];
  }
  delete MODULOS_PROPIOS[asignaturaId];
}

/**
 * La unidad donde va a caer un material que se sube sin elegir dónde: la
 * primera que exista, o una nueva si el ramo está vacío. Crear siempre una
 * dejaría una unidad "Mi material" por cada archivo.
 */
export async function moduloParaMaterial(asignaturaId: string): Promise<string> {
  const primera = MODULOS_PROPIOS[asignaturaId]?.[0]?.id;
  return primera ?? await crearModulo(asignaturaId, "Mi material");
}

export async function crearModulo(asignaturaId: string, titulo: string): Promise<string> {
  await dormir();
  const lista = MODULOS_PROPIOS[asignaturaId] ?? [];
  const modulo: Modulo = {
    id: nuevoId("mod"),
    titulo: titulo.trim(),
    orden: lista.length + 1,
    materiales: [],
  };
  lista.push(modulo);
  MODULOS_PROPIOS[asignaturaId] = lista;
  return modulo.id;
}

export async function crearMaterial(nuevo: MaterialNuevo): Promise<void> {
  await dormir();
  const modulo = todosLosModulos().find((m) => m.id === nuevo.moduloId);
  if (!modulo) throw new Error("Esa unidad ya no existe.");

  const id = nuevoId("mat");
  const texto = nuevo.texto?.trim() ?? "";
  if (texto) TEXTOS[id] = texto;

  modulo.materiales.push({
    id,
    tipo: nuevo.tipo,
    titulo: nuevo.titulo.trim(),
    detalle: nuevo.detalle,
    orden: modulo.materiales.length + 1,
    completado: false,
    leible: texto.length > 0,
  });
}

function todosLosModulos(): Modulo[] {
  return Object.values(MODULOS_PROPIOS).flat();
}

/** ¿Es un ramo armado por la propia persona? Lo usa la pantalla del ramo. */
export function esPropio(asignaturaId: string): boolean {
  return RAMOS_PROPIOS.some((r) => r.id === asignaturaId);
}

export function modulosPropiosDe(asignaturaId: string): Modulo[] {
  return copiar(MODULOS_PROPIOS[asignaturaId] ?? []);
}

/** El material propio abierto en el lector, si tiene texto adentro. */
export function lecturaPropiaDe(materialId: string): Lectura | null {
  const texto = TEXTOS[materialId];
  if (texto === undefined) return null;

  for (const ramo of RAMOS_PROPIOS) {
    for (const modulo of MODULOS_PROPIOS[ramo.id] ?? []) {
      const material = modulo.materiales.find((x) => x.id === materialId);
      if (!material) continue;
      return {
        id: material.id,
        titulo: material.titulo,
        texto,
        asignatura_id: ramo.id,
        asignatura_nombre: ramo.nombre,
        asignatura_color: ramo.color,
      };
    }
  }
  return null;
}

/** Solo para las pruebas: deja el espacio como recién instalado. */
export function vaciarEspacioPropio(): void {
  RAMOS_PROPIOS.length = 0;
  HORARIO_PROPIO.length = 0;
  for (const k of Object.keys(MODULOS_PROPIOS)) delete MODULOS_PROPIOS[k];
  for (const k of Object.keys(TEXTOS)) delete TEXTOS[k];
  siguiente = 1;
}
