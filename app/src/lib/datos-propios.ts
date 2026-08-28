// El espacio de quien llega por su cuenta, en modo demostración.
//
// Vive aparte porque no es ni la mirada del alumno de una institución ni la
// del profesor: es la de alguien que arma su propio ramo con sus propios
// archivos. En demostración los ramos quedan en memoria y se pierden al
// cerrar la app; con Supabase conectado los guarda `consultas-supabase.ts`
// y esto no se usa.

import { codigoDe, introDe, normalizar } from "../dominio/ramo-propio.ts";
import type { MaterialNuevo } from "./consultas-supabase.ts";
import type { Asignatura, Lectura, Modulo } from "./tipos.ts";

export const RAMOS_PROPIOS: Asignatura[] = [];
export const MODULOS_PROPIOS: Record<string, Modulo[]> = {};

/** El texto que se escribió a mano, para que el lector lo pueda leer. */
const TEXTOS: Record<string, string> = {};

let siguiente = 1;
const nuevoId = (prefijo: string) => `${prefijo}-${siguiente++}`;
const dormir = () => new Promise((r) => setTimeout(r, 90));
const copiar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export async function crearRamoPropio(nombre: string, color: string): Promise<Asignatura> {
  await dormir();
  const limpio = normalizar(nombre);
  const ramo: Asignatura = {
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
  RAMOS_PROPIOS.push(ramo);
  MODULOS_PROPIOS[ramo.id] = [];
  return copiar(ramo);
}

export async function borrarRamoPropio(asignaturaId: string): Promise<void> {
  const i = RAMOS_PROPIOS.findIndex((r) => r.id === asignaturaId);
  if (i >= 0) RAMOS_PROPIOS.splice(i, 1);
  for (const m of MODULOS_PROPIOS[asignaturaId] ?? []) {
    for (const x of m.materiales) delete TEXTOS[x.id];
  }
  delete MODULOS_PROPIOS[asignaturaId];
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
      };
    }
  }
  return null;
}

/** Solo para las pruebas: deja el espacio como recién instalado. */
export function vaciarEspacioPropio(): void {
  RAMOS_PROPIOS.length = 0;
  for (const k of Object.keys(MODULOS_PROPIOS)) delete MODULOS_PROPIOS[k];
  for (const k of Object.keys(TEXTOS)) delete TEXTOS[k];
  siguiente = 1;
}
