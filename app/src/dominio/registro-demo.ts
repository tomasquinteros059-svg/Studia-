// Con qué correo entra alguien cuando no hay servidor detrás.
//
// La regla del producto es una sola y no cambia según haya backend o no:
// nadie entra sin correo. Con Supabase conectado la hace cumplir el inicio
// de sesión; sin él la tiene que hacer cumplir la aplicación, y la decisión
// —qué correo sirve, cómo se llama quien no dio nombre— es de negocio, no de
// pantalla. Por eso vive acá y se puede probar sola.

import { caminoDe, institucionDe, normalizarCorreo } from "./acceso.ts";

export type Ingreso =
  | {
      ok: true;
      correo: string;
      nombre: string;
      /** El nombre de la institución si el correo es de una, o null. */
      institucion: string | null;
    }
  | { ok: false; motivo: string };

/**
 * El nombre que se supone de un correo cuando la persona no escribió ninguno.
 *
 * `jose.perez@uc.cl` es José Pérez para quien lo lee, pero la aplicación no
 * puede inventar tildes. Se queda en "Jose Perez": separa por puntos, guiones
 * y números, y sube la primera letra de cada parte. Preferimos algo modesto y
 * correcto a algo que parezca el nombre de otra persona.
 */
export function nombreDesde(correo: string): string {
  const local = normalizarCorreo(correo).split("@")[0] ?? "";
  const partes = local
    .split(/[._\-+0-9]+/)
    .filter((p) => p.length > 0)
    .map((p) => p[0]!.toUpperCase() + p.slice(1));
  return partes.join(" ");
}

/** Si este correo y este nombre alcanzan para entrar, y con qué datos. */
export function revisarIngreso(correo: string, nombre: string): Ingreso {
  const camino = caminoDe(correo);
  if (camino.tipo === "invalido") return { ok: false, motivo: camino.motivo };

  const escrito = nombre.trim().replace(/\s+/g, " ");
  const supuesto = nombreDesde(camino.correo);
  const definitivo = escrito.length > 0 ? escrito : supuesto;

  if (definitivo.length === 0) {
    return { ok: false, motivo: "Escribe tu nombre: el correo no alcanza para suponerlo." };
  }
  if (definitivo.length > 60) {
    return { ok: false, motivo: "Ese nombre es demasiado largo." };
  }

  return {
    ok: true,
    correo: camino.correo,
    nombre: definitivo,
    institucion: institucionDe(camino.correo)?.nombre ?? null,
  };
}
