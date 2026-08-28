// La costura hacia los avisos del sistema.
//
// Acá está lo único que hace falta entender del asunto: **ninguna aplicación
// puede prender el micrófono sola a una hora**. Android prohíbe crear un
// servicio de micrófono con la app en segundo plano, y iOS solo deja
// continuar una grabación que empezó con la app abierta. No es una limitación
// que se pueda rodear con un truco: es del sistema operativo, y los dos
// muestran además un indicador permanente mientras el micrófono está activo.
//
// Así que lo que se programa es el aviso, no la grabación. A la hora fijada
// llega una notificación; tocarla abre la reunión con el botón de grabar
// listo. Ese toque es lo único que las plataformas exigen, y a partir de ahí
// la grabación sigue con la pantalla bloqueada.
//
// Como con los archivos: si el módulo nativo no está —en el navegador, o en
// un cliente que no lo trae— la app sigue funcionando y la pantalla lo dice.

import { avisoDe, proximasVeces, type Agenda } from "../dominio/agenda.ts";

type ModuloAvisos = typeof import("expo-notifications");

let avisos: ModuloAvisos | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  avisos = require("expo-notifications") as ModuloAvisos;
} catch {
  avisos = null;
}

export const hayAvisos = avisos !== null;

/** Qué se puede decir en pantalla cuando no se pueden programar avisos. */
export const AVISO_SIN_AVISOS =
  "En este aparato no puedo programar avisos, así que la reunión queda agendada pero tendrás que abrirla tú a esa hora.";

if (avisos) {
  // Que el aviso suene y se vea aunque la app esté abierta: si llega en
  // silencio justo cuando la persona está mirando el teléfono, no sirve.
  avisos.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type Permiso = "concedido" | "negado" | "sin_modulo";

/**
 * Pide el permiso de avisos. Se pide al agendar y no al abrir la app: un
 * permiso que se pide sin que se entienda para qué se niega, y una vez
 * negado cuesta mucho más recuperarlo.
 */
export async function pedirPermiso(): Promise<Permiso> {
  if (!avisos) return "sin_modulo";
  const actual = await avisos.getPermissionsAsync();
  if (actual.granted) return "concedido";
  if (!actual.canAskAgain) return "negado";
  const pedido = await avisos.requestPermissionsAsync();
  return pedido.granted ? "concedido" : "negado";
}

/**
 * Deja puestos los avisos de una reunión agendada, y borra los que tenía.
 *
 * Se dejan varios de una vez porque nadie va a generar el siguiente: ni
 * Android ni iOS ejecutan código nuestro a la hora del aviso si la app no
 * está corriendo. iOS además tiene un tope de 64 avisos pendientes por
 * aplicación, y de ahí sale cuántos se dejan por reunión.
 */
export async function programarAvisos(
  reunionId: string,
  titulo: string,
  agenda: Agenda,
): Promise<number> {
  if (!avisos) return 0;

  await borrarAvisos(reunionId);
  const veces = proximasVeces(agenda);
  if (veces.length === 0) return 0;

  const texto = avisoDe(titulo);
  for (const cuando of veces) {
    await avisos.scheduleNotificationAsync({
      identifier: `${reunionId}:${cuando.getTime()}`,
      content: {
        title: texto.titulo,
        body: texto.cuerpo,
        // Con esto, tocar el aviso abre la reunión y no la portada.
        data: { reunionId },
      },
      trigger: {
        type: avisos.SchedulableTriggerInputTypes.DATE,
        date: cuando,
      },
    });
  }
  return veces.length;
}

/** Los avisos de una reunión llevan su id adelante, así se encuentran solos. */
export async function borrarAvisos(reunionId: string): Promise<void> {
  if (!avisos) return;
  const puestos = await avisos.getAllScheduledNotificationsAsync();
  for (const a of puestos) {
    if (a.identifier.startsWith(`${reunionId}:`)) {
      await avisos.cancelScheduledNotificationAsync(a.identifier);
    }
  }
}

/** Cuántos avisos hay puestos de esta reunión. Para poder mostrarlo. */
export async function avisosPuestos(reunionId: string): Promise<number> {
  if (!avisos) return 0;
  const puestos = await avisos.getAllScheduledNotificationsAsync();
  return puestos.filter((a) => a.identifier.startsWith(`${reunionId}:`)).length;
}
