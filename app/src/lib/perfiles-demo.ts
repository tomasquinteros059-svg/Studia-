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
import { revisarIngreso } from "../dominio/registro-demo.ts";

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
  /**
   * Si es falso, esta persona no pertenece a ninguna institución: no tiene
   * ramos, ni horario, ni tareas, ni notas que le hayan cargado. Solo lo que
   * arme por su cuenta. Es el caso de quien baja la aplicación sin más.
   */
  institucion: boolean;
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
    institucion: true,
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
    institucion: true,
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
    institucion: true,
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
    institucion: true,
    titulo: "Administración",
    descripcion:
      "El colegio. Define qué ramos existen, quién los dicta, quién está inscrito y en qué sala y a qué hora.",
  },
  {
    id: "p-sofia",
    nombre: "Sofía Lagos",
    correo: "sofia@gmail.com",
    rol: "estudiante",
    dicta: [],
    institucion: false,
    titulo: "Por tu cuenta",
    descripcion:
      "Bajó la aplicación sin institución. Empieza con todo vacío: arma sus propios ramos, carga sus textos y los escucha con el lector.",
  },
];

export const perfilPorId = (id: string): PerfilDemo | null =>
  PERFILES_DEMO.find((p) => p.id === id) ?? null;

const CLAVE = "studia.demo.perfil";

// El almacenamiento del aparato puede no estar —en las pruebas no lo está— y
// recordar el perfil elegido es una comodidad, no un requisito: si falla, la
// app sigue funcionando y solo vuelve a preguntar al abrirla.
//
// Se guarda el perfil entero y no su id: desde que alguien puede entrar con
// su propio correo, el perfil elegido no siempre es uno de los cinco de
// ejemplo. Lo guardado por versiones anteriores era un id suelto y se sigue
// leyendo.
const guardar = (p: PerfilDemo | null): void => {
  try {
    void (p === null
      ? AsyncStorage.removeItem(CLAVE)
      : AsyncStorage.setItem(CLAVE, JSON.stringify(p))
    ).catch(() => {});
  } catch { /* sin almacenamiento */ }
};

const leerGuardado = async (): Promise<PerfilDemo | null> => {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE);
    if (!guardado) return null;
    if (!guardado.startsWith("{")) return perfilPorId(guardado);
    const p = JSON.parse(guardado) as PerfilDemo;
    return typeof p?.id === "string" && typeof p?.correo === "string" ? p : null;
  } catch {
    return null;
  }
};

let actual: PerfilDemo | null = null;
const oyentes = new Set<() => void>();

const avisar = () => { for (const o of oyentes) o(); };

/** Quién está usando la app ahora. Null hasta que se elige. */
export const perfilActual = (): PerfilDemo | null => actual;

export function entrarComo(id: string): void {
  actual = perfilPorId(id);
  guardar(actual);
  avisar();
}

/**
 * Entrar con el correo propio, sin servidor.
 *
 * Nadie entra a StudIA sin correo. Con Supabase conectado eso lo hace cumplir
 * el inicio de sesión; acá lo hace cumplir esto. No es seguridad —no hay clave
 * ni nada que verificar— y la pantalla lo dice: es la misma puerta, para que
 * en la demostración no exista una entrada anónima que en la aplicación de
 * verdad no existe.
 *
 * Quien se registra así empieza con todo vacío, tenga el correo que tenga: en
 * la demostración no hay institución que le mande ramos.
 */
export function registrarse(correo: string, nombre: string): PerfilDemo {
  const r = revisarIngreso(correo, nombre);
  if (!r.ok) throw new Error(r.motivo);

  actual = {
    id: `p-propio-${r.correo}`,
    nombre: r.nombre,
    correo: r.correo,
    rol: "estudiante",
    dicta: [],
    institucion: false,
    titulo: "Por tu cuenta",
    descripcion: r.institucion
      ? `Entraste con tu correo de ${r.institucion}.`
      : "Entraste con tu propio correo.",
  };
  guardar(actual);
  avisar();
  return actual;
}

export function salir(): void {
  actual = null;
  guardar(null);
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
    void leerGuardado().then((p) => {
      if (!vigente) return;
      if (p) { actual = p; setPerfil(actual); }
      setListo(true);
    });
    return () => { vigente = false; };
  }, []);

  return { perfil, listo };
}
