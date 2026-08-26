// El motor del lector: dice el texto frase por frase y avisa dónde va.
//
// Se le entrega una frase al sintetizador y se espera a que la termine para
// mandar la siguiente. Es más trabajo que mandar el texto entero, pero es lo
// que permite resaltar exactamente lo que suena, retroceder una sola frase y
// cambiar la velocidad sin volver al principio.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PREFERENCIAS_POR_DEFECTO, anterior, partirEnFrases, retomar, siguiente,
  velocidadDe, type Frase, type Preferencias,
} from "../dominio/lectura.ts";
import { AVISO_SIN_ESPANOL, IDIOMA, callar, hablar, hayVoz, hayVozEnEspanol } from "./voz.ts";
import {
  guardarPosicion, guardarPreferencias, leerPosicion, leerPreferencias,
} from "./preferencias.ts";

export type Lector = {
  frases: Frase[];
  indice: number;
  sonando: boolean;
  /** Llegó al final por su cuenta. */
  termino: boolean;
  /** Todavía no se cargaron las preferencias guardadas. */
  cargando: boolean;
  aviso: string | null;
  preferencias: Preferencias;
  ajustar: (cambio: Partial<Preferencias>) => void;
  alternar: () => void;
  pausar: () => void;
  irA: (indice: number) => void;
  atras: () => void;
  adelante: () => void;
  reiniciar: () => void;
};

export function usarLector(idTexto: string, texto: string): Lector {
  const frases = useMemo(() => partirEnFrases(texto), [texto]);

  const [indice, setIndice] = useState(0);
  const [sonando, setSonando] = useState(false);
  const [termino, setTermino] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [preferencias, setPreferencias] = useState<Preferencias>({ ...PREFERENCIAS_POR_DEFECTO });

  // Cada llamada al sintetizador lleva un número. Si al terminar ya no es el
  // vigente, es de una frase que se cambió mientras hablaba: se ignora. Sin
  // esto, cambiar la velocidad en medio de una frase adelanta dos.
  const turno = useRef(0);

  // Al abrir: preferencias guardadas y dónde quedó. El texto llega de la red,
  // así que este efecto corre dos veces: primero sin frases y después con
  // ellas. Sin la guarda, la primera pasada dejaría `cargando` en falso y el
  // efecto de guardado pisaría la posición con un cero antes de leerla.
  useEffect(() => {
    if (frases.length === 0) return;
    let vigente = true;
    void (async () => {
      const [p, pos] = await Promise.all([leerPreferencias(), leerPosicion(idTexto)]);
      if (!vigente) return;
      setPreferencias(p);
      setIndice(retomar(pos, frases.length));
      setCargando(false);
    })();
    return () => { vigente = false; };
  }, [idTexto, frases.length]);

  // Si el aparato no tiene voces en español, el motor lee castellano con
  // fonética inglesa: mejor decirlo antes que dejar al estudiante creyendo
  // que la app está rota.
  useEffect(() => {
    if (!hayVoz) return;
    let vigente = true;
    void hayVozEnEspanol().then((hay) => {
      if (vigente && !hay) setAviso(AVISO_SIN_ESPANOL);
    });
    return () => { vigente = false; };
  }, []);

  const velocidad = velocidadDe(preferencias);

  // El corazón: mientras esté sonando, decir la frase actual y encadenar.
  useEffect(() => {
    if (!sonando) return;
    const frase = frases[indice];
    if (!frase) { setSonando(false); return; }

    const mio = ++turno.current;
    hablar(frase.texto, {
      velocidad,
      idioma: IDIOMA,
      alTerminar: () => {
        if (turno.current !== mio) return;
        const sig = siguiente(indice, frases.length);
        if (sig === null) { setSonando(false); setTermino(true); }
        else setIndice(sig);
      },
      alFallar: (mensaje) => {
        if (turno.current !== mio) return;
        setSonando(false);
        setAviso(mensaje);
      },
    });

    return () => { turno.current++; callar(); };
  }, [sonando, indice, velocidad, frases]);

  // Se guarda dónde va para poder retomar. Solo cuando cambia de frase, que
  // es como mucho una escritura cada varios segundos.
  useEffect(() => {
    if (cargando) return;
    void guardarPosicion(idTexto, indice);
  }, [idTexto, indice, cargando]);

  const ajustar = useCallback((cambio: Partial<Preferencias>) => {
    setPreferencias((antes) => {
      const nuevo = { ...antes, ...cambio };
      void guardarPreferencias(nuevo);
      return nuevo;
    });
  }, []);

  const irA = useCallback((n: number) => {
    setTermino(false);
    setIndice(n);
  }, []);

  const alternar = useCallback(() => {
    setAviso(null);
    setSonando((s) => {
      if (s) return false;
      setTermino(false);
      return true;
    });
  }, []);

  const pausar = useCallback(() => setSonando(false), []);

  const atras = useCallback(() => setIndice((i) => anterior(i)), []);

  const adelante = useCallback(() => {
    setIndice((i) => {
      const sig = siguiente(i, frases.length);
      if (sig === null) { setSonando(false); setTermino(true); return i; }
      return sig;
    });
  }, [frases.length]);

  const reiniciar = useCallback(() => {
    setTermino(false);
    setIndice(0);
    setSonando(true);
  }, []);

  return {
    frases, indice, sonando, termino, cargando, aviso, preferencias,
    ajustar, alternar, pausar, irA, atras, adelante, reiniciar,
  };
}
