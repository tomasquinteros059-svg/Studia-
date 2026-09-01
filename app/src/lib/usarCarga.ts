import { useCallback, useEffect, useRef, useState } from "react";

import { claseDeLaFalla, comoSeDice } from "../dominio/fallas.ts";
import { guardarCopia, leerCopia } from "./copia.ts";

export type Carga<T> = {
  datos: T | null;
  /**
   * Cuándo se guardó lo que se está viendo, si es una copia del aparato.
   *
   * Null es lo normal: los datos vienen de la red y son de ahora. Cuando no
   * es null, la pantalla tiene que decirlo —para eso está `<Copia>`—: mostrar
   * lo guardado sin avisar es dejar que alguien decida con datos de otro día
   * creyendo que son de este.
   */
  copiaDe: number | null;
  /** Primera carga: la pantalla todavía no tiene nada que mostrar. */
  cargando: boolean;
  /** Recarga con datos ya en pantalla: no hay que vaciarla. */
  refrescando: boolean;
  error: string | null;
  /** Vuelve a cargar mostrando el indicador de pantalla completa. */
  recargar: () => void;
  /** Vuelve a cargar sin vaciar lo que ya se ve. Para tirar hacia abajo. */
  refrescar: () => void;
};

/**
 * @param guardarComo Con qué nombre guardar una copia en el aparato, para
 *   poder seguir estudiando sin señal. Sin esto no se guarda nada: hay
 *   pantallas —la corrección de un docente, el registro de notas— donde una
 *   copia vieja confunde más de lo que ayuda.
 */
export function usarCarga<T>(
  traer: () => Promise<T>, deps: unknown[] = [], guardarComo?: string,
): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [copiaDe, setCopiaDe] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const silencioso = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const traerMemo = useCallback(traer, deps);

  useEffect(() => {
    let vigente = true;
    if (silencioso.current) setRefrescando(true);
    else setCargando(true);
    setError(null);

    traerMemo()
      .then((r) => {
        if (!vigente) return;
        setDatos(r);
        setCopiaDe(null);
        if (guardarComo) void guardarCopia(guardarComo, r);
      })
      .catch(async (e: unknown) => {
        if (!vigente) return;

        // Sin red, si hay una copia guardada se muestra esa. Solo sin red:
        // con un permiso denegado o con algo que ya no existe, enseñar una
        // copia sería tapar el problema con datos que ya no corresponden.
        if (guardarComo && claseDeLaFalla(e) === "red") {
          const copia = await leerCopia<T>(guardarComo);
          if (!vigente) return;
          if (copia) {
            setDatos(copia.datos);
            setCopiaDe(copia.guardadaEn);
            return;
          }
        }

        // Acá pasan todas las pantallas, así que es el lugar donde arreglarlo
        // una vez sirve para todas. Antes mostraba el mensaje crudo, y sin
        // señal eso era «TypeError: Network request failed» en la cara.
        setError(comoSeDice(e));
      })
      .finally(() => {
        if (!vigente) return;
        setCargando(false);
        setRefrescando(false);
        silencioso.current = false;
      });

    // Si la pantalla se cierra antes de que llegue la respuesta, no tocamos su estado.
    return () => { vigente = false; };
  }, [traerMemo, intento]);

  return {
    datos, cargando, refrescando, error, copiaDe,
    recargar: () => { silencioso.current = false; setIntento((n) => n + 1); },
    refrescar: () => { silencioso.current = true; setIntento((n) => n + 1); },
  };
}
