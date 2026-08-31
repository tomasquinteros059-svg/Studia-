// Se importa el juego directo y no desde el índice del paquete: el índice
// exporta las veinte familias de íconos, y Metro empaqueta las veinte con
// sus fuentes. Solo se dibuja Ionicons, así que las otras diecinueve eran
// casi dos megas de fuentes que el aparato descargaba para nada.
import Ionicons from "@expo/vector-icons/Ionicons";
import { color } from "./tema.ts";

export type NombreIcono = React.ComponentProps<typeof Ionicons>["name"];

/** Un solo lugar donde se decide qué ícono representa cada cosa. */
export const ICONOS = {
  inicio: "home-outline",
  horario: "calendar-outline",
  tareas: "checkbox-outline",
  tutor: "chatbubble-ellipses-outline",
  campana: "notifications-outline",
  perfil: "person-circle-outline",
  video: "play-circle-outline",
  documento: "document-text-outline",
  ejercicios: "list-outline",
  descargar: "download-outline",
  micro: "mic-outline",
  microApagado: "mic-off-outline",
  mano: "hand-left-outline",
  colgar: "call-outline",
  reproducir: "play",
  pausar: "pause",
  atras15: "play-back-outline",
  adelante15: "play-forward-outline",
  fijado: "bookmark",
  listo: "checkmark",
  mas: "ellipsis-vertical",
  nuevo: "add-circle-outline",
  clase: "radio-outline",
  anuncio: "megaphone-outline",
  nota: "star-outline",
  persona: "person-outline",
  reloj: "time-outline",
  escuchar: "headset-outline",
  fraseAtras: "play-skip-back",
  fraseAdelante: "play-skip-forward",
  letra: "text-outline",
  cerrar: "close",
  microfono: "mic-outline",
  quiz: "help-circle-outline",
  lapiz: "create-outline",
  teclado: "keypad-outline",
  goma: "backspace-outline",
  destacador: "brush-outline",
  deshacer: "arrow-undo-outline",
  aviso: "alert-circle-outline",
  anterior: "chevron-back",
  siguiente: "chevron-forward",
  abajo: "chevron-down",
  arriba: "chevron-up",
} as const;

export function Icono({
  nombre, tamano = 20, tono = color.textoSuave,
}: {
  nombre: keyof typeof ICONOS;
  tamano?: number;
  tono?: string;
}) {
  return <Ionicons name={ICONOS[nombre] as NombreIcono} size={tamano} color={tono} />;
}
