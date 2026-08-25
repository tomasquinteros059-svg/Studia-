import { useWindowDimensions } from "react-native";

/**
 * Una tablet en horizontal tiene espacio para dos columnas; un teléfono no.
 * El corte va por ancho disponible, no por tipo de aparato: una tablet en
 * vertical se comporta como teléfono, que es lo correcto.
 */
export const ANCHO_DOS_COLUMNAS = 900;

export type Formato = "una_columna" | "dos_columnas";

export function usarFormato(): Formato {
  const { width } = useWindowDimensions();
  return width >= ANCHO_DOS_COLUMNAS ? "dos_columnas" : "una_columna";
}

export function usarEsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) >= 600;
}
