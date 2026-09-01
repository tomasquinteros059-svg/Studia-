import { useCallback, useEffect, useRef, useState } from "react";

import { comoSeDice } from "../dominio/fallas.ts";

export type Carga<T> = {
  datos: T | null;
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

export function usarCarga<T>(traer: () => Promise<T>, deps: unknown[] = []): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null);
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
      .then((r) => { if (vigente) setDatos(r); })
      .catch((e: unknown) => {
        // Acá pasan todas las pantallas, así que es el lugar donde arreglarlo
        // una vez sirve para todas. Antes mostraba el mensaje crudo, y sin
        // señal eso era «TypeError: Network request failed» en la cara.
        if (vigente) setError(comoSeDice(e));
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
    datos, cargando, refrescando, error,
    recargar: () => { silencioso.current = false; setIntento((n) => n + 1); },
    refrescar: () => { silencioso.current = true; setIntento((n) => n + 1); },
  };
}
