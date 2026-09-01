// La copia de lo que hace falta para estudiar, guardada en el aparato.
//
// Es lo que hace que una sala sin cobertura o un metro bajo tierra dejen de
// ser el fin de la tarde. Cada pantalla que carga algo lo guarda al terminar;
// si la próxima vez no hay red, se muestra lo guardado con su fecha.
//
// Dos cosas que no hace, a propósito:
//
// - No se disfraza de datos frescos. La pantalla dice que es una copia y de
//   cuándo. Mostrar lo viejo como si fuera de ahora es la manera favorita del
//   software de hacer que alguien tome una decisión equivocada.
// - No guarda nada del plan gratis. No es una comprobación de adorno: si se
//   guardara igual «por si acaso», la función pagada estaría hecha y apagada
//   con un `if` en la pantalla, que es lo primero que alguien quita.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { guardaSinConexion, type Plan } from "../dominio/planes.ts";
import { queNoSeGuarda } from "../dominio/copiable.ts";

/** Lo guardado, con la hora en que se guardó. */
export type Copia<T> = { datos: T; guardadaEn: number };

const clave = (que: string) => `studia.copia.${que}`;

/**
 * El plan de quien está usando la aplicación.
 *
 * Variable de módulo y no estado de React porque la consulta el `usarCarga` de
 * cada pantalla, y pasarlo por props hasta ahí sería atravesar veinte
 * componentes que no tienen nada que ver.
 *
 * Empieza en gratis: mientras no se sabe, no se guarda nada. Al revés
 * —guardar y después borrar si resulta que era gratis— habría dejado una copia
 * en el aparato de alguien que no la contrató.
 */
let planActual: Plan = "gratis";

export function anotarPlan(plan: Plan): void {
  planActual = plan;
}

export function hayQueGuardar(): boolean {
  return guardaSinConexion(planActual);
}

export async function guardarCopia<T>(que: string, datos: T): Promise<void> {
  if (!hayQueGuardar()) return;

  // Se guarda como texto JSON, y hay cosas que no vuelven iguales: un Map
  // vuelve como `{}`, una fecha como texto, una instancia sin sus métodos. La
  // pantalla que las use revienta al abrirse sin señal, que es justo cuando la
  // copia existe. Vale más quedarse sin copia —la app funciona como antes—
  // que devolver algo roto.
  const malo = queNoSeGuarda(datos);
  if (malo) {
    if (__DEV__) console.warn(`No se guarda la copia «${que}»: ${malo}`);
    return;
  }

  try {
    const copia: Copia<T> = { datos, guardadaEn: Date.now() };
    await AsyncStorage.setItem(clave(que), JSON.stringify(copia));
  } catch {
    // Sin copia se sigue como antes: pidiéndole todo a la red.
  }
}

export async function leerCopia<T>(que: string): Promise<Copia<T> | null> {
  if (!hayQueGuardar()) return null;
  try {
    const crudo = await AsyncStorage.getItem(clave(que));
    if (!crudo) return null;
    const copia = JSON.parse(crudo) as Copia<T>;
    // Una copia a medio escribir es peor que ninguna: la pantalla se dibujaría
    // con undefined donde espera una lista.
    if (typeof copia?.guardadaEn !== "number" || copia.datos === undefined) return null;
    return copia;
  } catch {
    return null;
  }
}

/**
 * Borra todo lo guardado.
 *
 * Hace falta en dos momentos y los dos importan: al cerrar sesión —lo de una
 * persona no puede quedar en el teléfono para la siguiente— y cuando alguien
 * deja de tener plan pagado.
 */
export async function olvidarTodasLasCopias(): Promise<void> {
  try {
    const claves = await AsyncStorage.getAllKeys();
    const mias = claves.filter((k) => k.startsWith("studia.copia."));
    if (mias.length > 0) await AsyncStorage.multiRemove(mias);
  } catch {
    // Nada que hacer; la próxima sesión las sobrescribe.
  }
}
