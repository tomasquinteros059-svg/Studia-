// Quién está usando la app, venga de donde venga.
//
// Con Supabase conectado el rol y los ramos que dicta salen de la base:
// `perfiles.rol` y `dictados`. Sin backend salen del perfil que se eligió al
// entrar. Las pantallas no deberían saber cuál de los dos es —si lo supieran,
// habría que acordarse de tocar las dos ramas cada vez— así que preguntan acá.

import { useEffect, useState } from "react";
import { MODO_DEMO } from "./config.ts";
import { miPerfil, misDictados } from "./consultas.ts";
import { usarPerfilDemo } from "./perfiles-demo.ts";
import type { Rol } from "./tipos.ts";

export type QuienSoy = {
  nombre: string;
  correo: string;
  rol: Rol;
  /** Solo docentes: publicar notas es del profesor. */
  papel: "profesor" | "ayudante" | null;
  /** Identificadores de los ramos que dicta. Vacío para alumno y colegio. */
  dicta: string[];
};

/**
 * Devuelve quién eres y si ya se terminó de averiguar. Lo segundo hace falta:
 * sin eso la app parpadearía por la pantalla del alumno antes de descubrir
 * que quien entró es docente.
 */
export function usarQuienSoy(): { yo: QuienSoy | null; listo: boolean } {
  const demo = usarPerfilDemo();
  const [yo, setYo] = useState<QuienSoy | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (MODO_DEMO) return;
    let vigente = true;
    void (async () => {
      try {
        const [perfil, dictados] = await Promise.all([miPerfil(), misDictados()]);
        if (!vigente) return;
        setYo({
          nombre: perfil.nombre,
          correo: perfil.correo,
          rol: perfil.rol,
          // Basta con ser profesor en un ramo para poder publicar en ese ramo;
          // la base vuelve a decidirlo por ramo en cada escritura.
          papel: dictados.some((d) => d.papel === "profesor") ? "profesor"
               : dictados.length > 0 ? "ayudante" : null,
          dicta: dictados.map((d) => d.asignatura_id),
        });
      } catch {
        // Si no se pudo averiguar, se entra como estudiante: es lo que menos
        // puede hacer, y no deja a nadie fuera de su propia app.
        if (vigente) setYo(null);
      } finally {
        if (vigente) setListo(true);
      }
    })();
    return () => { vigente = false; };
  }, []);

  if (!MODO_DEMO) return { yo, listo };

  const p = demo.perfil;
  return {
    listo: demo.listo,
    yo: p === null ? null : {
      nombre: p.nombre,
      correo: p.correo,
      rol: p.rol,
      papel: p.papel ?? null,
      dicta: p.dicta,
    },
  };
}
