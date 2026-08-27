// Con quién se entra a la aplicación en modo demostración.
//
// Con Supabase conectado esto lo decide el inicio de sesión y el rol que
// trae el perfil. Sin backend no hay a quién preguntarle, así que la app
// ofrece elegir: es la única forma de recorrer las cuatro vistas en un
// aparato donde no hay cuentas.
//
// No es un inicio de sesión de mentira. No pide clave y lo dice en pantalla:
// confundir esto con seguridad sería peor que no tenerlo.

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type RolDemo = "estudiante" | "profesor" | "administrador";

export type PerfilDemo = {
  id: string;
  nombre: string;
  correo: string;
  rol: RolDemo;
  /** Solo para docentes: publicar notas es del profesor. */
  papel?: "profesor" | "ayudante";
  /** Ramos que dicta, por id. Vacío para estudiante y administración. */
  dicta: string[];
  titulo: string;
  descripcion: string;
};

export const PERFILES_DEMO: PerfilDemo[] = [
  {
    id: "p-eduardo",
    nombre: "Eduardo Q.",
    correo: "eduardo@studia.cl",
    rol: "estudiante",
    dicta: [],
    titulo: "Estudiante",
    descripcion:
      "Segundo año. Cursa seis ramos. Ve su horario, su material, sus tareas y sus notas, y tiene el tutor y el lector.",
  },
  {
    id: "p-ana",
    nombre: "Ana Ríos",
    correo: "ana@studia.cl",
    rol: "profesor",
    papel: "profesor",
    dicta: ["cal"],
    titulo: "Profesora",
    descripcion:
      "Dicta Cálculo I. Carga material, publica tareas, corrige entregas y es la única que puede publicar notas.",
  },
  {
    id: "p-ignacio",
    nombre: "Ignacio Soto",
    correo: "ignacio@studia.cl",
    rol: "profesor",
    papel: "ayudante",
    dicta: ["cal"],
    titulo: "Ayudante",
    descripcion:
      "Ayuda en Cálculo I. Corrige, carga material y responde el foro. No puede publicar notas: eso es del profesor.",
  },
  {
    id: "p-secretaria",
    nombre: "Secretaría Académica",
    correo: "secretaria@studia.cl",
    rol: "administrador",
    dicta: [],
    titulo: "Administración",
    descripcion:
      "El colegio. Define qué ramos existen, quién los dicta, quién está inscrito y en qué sala y a qué hora.",
  },
];

export const perfilPorId = (id: string): PerfilDemo | null =>
  PERFILES_DEMO.find((p) => p.id === id) ?? null;

const CLAVE = "studia.demo.perfil";

let actual: PerfilDemo | null = null;
const oyentes = new Set<() => void>();

const avisar = () => { for (const o of oyentes) o(); };

/** Quién está usando la app ahora. Null hasta que se elige. */
export const perfilActual = (): PerfilDemo | null => actual;

export function entrarComo(id: string): void {
  actual = perfilPorId(id);
  void AsyncStorage.setItem(CLAVE, id).catch(() => {});
  avisar();
}

export function salir(): void {
  actual = null;
  void AsyncStorage.removeItem(CLAVE).catch(() => {});
  avisar();
}

/**
 * Devuelve el perfil elegido y si ya se terminó de leer lo guardado. Sin lo
 * segundo la app parpadearía por la pantalla de elección en cada arranque,
 * aunque ya hubiera un perfil recordado.
 */
export function usarPerfilDemo(): { perfil: PerfilDemo | null; listo: boolean } {
  const [perfil, setPerfil] = useState<PerfilDemo | null>(actual);
  const [listo, setListo] = useState(actual !== null);

  useEffect(() => {
    const oyente = () => setPerfil(actual);
    oyentes.add(oyente);
    return () => { oyentes.delete(oyente); };
  }, []);

  useEffect(() => {
    if (actual !== null) { setListo(true); return; }
    let vigente = true;
    void AsyncStorage.getItem(CLAVE)
      .then((id) => {
        if (!vigente) return;
        if (id) { actual = perfilPorId(id); setPerfil(actual); }
        setListo(true);
      })
      .catch(() => { if (vigente) setListo(true); });
    return () => { vigente = false; };
  }, []);

  return { perfil, listo };
}
