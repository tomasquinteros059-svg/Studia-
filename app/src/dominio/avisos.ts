// Lo único que el teléfono decide sobre los avisos.
//
// Qué merece sonar y a qué hora lo decide el servidor —está en
// `supabase/functions/_compartido/avisos-nucleo.ts`, con sus pruebas— porque
// el teléfono no elige qué le llega. Acá queda solo esto, que sí es suyo.

/**
 * Un identificador de aparato de Expo, o null si no lo parece.
 *
 * Se comprueba antes de guardarlo porque después se le manda a Expo tal cual,
 * y una tabla con basura adentro produce errores de envío que no se parecen en
 * nada a su causa.
 */
export function tokenValido(token: string | null | undefined): string | null {
  if (!token) return null;
  const limpio = token.trim();
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(limpio) ? limpio : null;
}
