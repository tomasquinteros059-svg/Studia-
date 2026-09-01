// Qué trae el enlace que llega por correo.
//
// Supabase manda un enlace que rebota en su servidor y termina abriendo la
// aplicación en `studia://…`, con los datos colgando detrás de un `#`. Leer eso
// es lo único que hace este archivo, y está separado de la pantalla porque las
// tres formas en que puede llegar —bien, vencido, o cualquier otra cosa— hay
// que poder probarlas sin un correo de verdad.
//
// La forma vencida no es un caso raro: el enlace dura una hora y la gente abre
// el correo al otro día. Si eso no se distingue, la aplicación se queda muda
// justo cuando la persona ya no puede entrar.

export type Enlace =
  | { tipo: "recuperar"; acceso: string; refresco: string }
  | { tipo: "problema"; mensaje: string }
  /** No es un enlace de recuperación: alguien abrió la app por otra razón. */
  | { tipo: "otro" };

const OTRO: Enlace = { tipo: "otro" };

/**
 * Los parámetros del enlace, vengan detrás de `#` o de `?`.
 *
 * Supabase usa el `#` —así el token no queda en los registros de ningún
 * servidor— pero según cómo rebote puede llegar como consulta normal, y una de
 * las dos formas sola deja al usuario a medio camino sin explicación.
 */
function parametros(url: string): URLSearchParams {
  const juntos = new URLSearchParams();
  for (const separador of ["#", "?"]) {
    const corte = url.indexOf(separador);
    if (corte < 0) continue;
    const trozo = url.slice(corte + 1).split(separador === "#" ? "?" : "#")[0];
    for (const [k, v] of new URLSearchParams(trozo)) if (!juntos.has(k)) juntos.set(k, v);
  }
  return juntos;
}

/** Los mensajes de Supabase vienen en inglés y con guiones bajos. */
function enCastellano(codigo: string, descripcion: string): string {
  const texto = `${codigo} ${descripcion}`.toLowerCase();
  if (texto.includes("expired")) {
    return "Este enlace ya venció. Pide uno nuevo: duran una hora.";
  }
  if (texto.includes("invalid") || texto.includes("not_found")) {
    return "Este enlace ya no sirve. Puede que lo hayas usado antes; pide uno nuevo.";
  }
  return "No pude abrir este enlace. Pide uno nuevo desde la pantalla de entrada.";
}

export function leerEnlace(url: string | null | undefined): Enlace {
  if (!url) return OTRO;
  const p = parametros(url);

  const error = p.get("error") ?? p.get("error_code");
  if (error) return { tipo: "problema", mensaje: enCastellano(error, p.get("error_description") ?? "") };

  if (p.get("type") !== "recovery") return OTRO;

  const acceso = p.get("access_token");
  const refresco = p.get("refresh_token");
  // Un enlace de recuperación sin los dos tokens no sirve para nada, y
  // tratarlo como bueno dejaría a la persona en una pantalla que no puede
  // guardar. Vale más decirlo.
  if (!acceso || !refresco) {
    return { tipo: "problema", mensaje: "Este enlace llegó incompleto. Pide uno nuevo." };
  }
  return { tipo: "recuperar", acceso, refresco };
}
