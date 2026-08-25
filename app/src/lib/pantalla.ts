import { useWindowDimensions } from "react-native";
import {
  admiteDosPaneles, anchoDeContenido, clasificarAncho, columnasDeTarjetas,
  muestraBarraDeSecciones, type Ancho,
} from "../dominio/disposicion.ts";

export type Disposicion = {
  ancho: number;
  tamano: Ancho;
  /** Contenido y tutor lado a lado. */
  dosPaneles: boolean;
  /** Tarjetas de asignatura por fila. */
  columnas: number;
  /** Ancho máximo de una columna de texto, para que se pueda leer. */
  anchoContenido: number;
  /** Las secciones caben a la vista y el menú de los tres puntitos sobra. */
  barraDeSecciones: boolean;
};

/**
 * Todo se decide por el ancho disponible, no por el tipo de aparato: una
 * tablet en vertical se comporta como teléfono, y girar la tablet cambia la
 * disposición sin reiniciar nada.
 */
export function usarDisposicion(): Disposicion {
  const { width } = useWindowDimensions();
  return {
    ancho: width,
    tamano: clasificarAncho(width),
    dosPaneles: admiteDosPaneles(width),
    columnas: columnasDeTarjetas(width),
    anchoContenido: anchoDeContenido(width),
    barraDeSecciones: muestraBarraDeSecciones(width),
  };
}
