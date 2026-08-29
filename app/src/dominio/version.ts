// Cómo se escribe la versión en la pantalla.
//
// Está en el dominio y no junto a expo-constants porque leer la versión del
// paquete necesita el módulo nativo, y entonces esta regla —que es solo
// texto— no se podría probar sin arrancar un teléfono.

/**
 * La versión tal como se muestra: "Versión 1.3.0 (247)".
 *
 * El número entre paréntesis es el de compilación. Va porque dos APK pueden
 * decir 1.3.0 y ser distintos —uno de ayer y uno de hoy—, y sin él no hay
 * manera de saber desde el aparato cuál quedó instalado.
 *
 * Devuelve vacío si no hay versión: es mejor no mostrar nada que mostrar
 * "Versión desconocida", que no le sirve a nadie.
 */
export function versionParaMostrar(version: string, compilacion?: number | null): string {
  const limpia = version.trim();
  if (!limpia) return "";
  // Una compilación sin numerar es la que se arma en el computador de uno.
  // Mostrar "(0)" o "(1)" ahí no diría nada, así que no se muestra.
  const numerada = typeof compilacion === "number" && Number.isFinite(compilacion)
    && compilacion > 1;
  return numerada ? `Versión ${limpia} (${compilacion})` : `Versión ${limpia}`;
}
