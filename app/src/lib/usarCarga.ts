import { useCallback, useEffect, useState } from "react";

export type Carga<T> = {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
};

/** Cargar, mostrar el error si lo hay y poder reintentar, sin repetirlo en cada pantalla. */
export function usarCarga<T>(traer: () => Promise<T>, deps: unknown[] = []): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const traerMemo = useCallback(traer, deps);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);

    traerMemo()
      .then((r) => { if (vigente) setDatos(r); })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof globalThis.Error ? e.message : "Algo salió mal.");
      })
      .finally(() => { if (vigente) setCargando(false); });

    // Si la pantalla se cierra antes de que llegue la respuesta, no tocamos su estado.
    return () => { vigente = false; };
  }, [traerMemo, intento]);

  return { datos, cargando, error, recargar: () => setIntento((n) => n + 1) };
}
