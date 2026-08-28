// Cómo se escribe la versión en la pantalla.
//
// Está en el dominio y no junto a expo-constants porque leer la versión del
// paquete necesita el módulo nativo, y entonces esta regla —que es solo
// texto— no se podría probar sin arrancar un teléfono.

/**
 * La versión tal como se muestra. Vacía si no se sabe: es mejor no mostrar
 * nada que mostrar "Versión desconocida", que no le sirve a nadie.
 */
export function versionParaMostrar(version: string): string {
  const limpia = version.trim();
  return limpia ? `Versión ${limpia}` : "";
}
