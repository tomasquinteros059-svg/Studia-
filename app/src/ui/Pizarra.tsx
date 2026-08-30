import { useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type PointerEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color } from "./tema.ts";
import {
  borrarDonde, comoCurva, dibuja, grosorEn, velocidad,
  type Punto, type Trazo, type Util,
} from "../dominio/trazos.ts";

/**
 * La hoja donde se escribe a mano.
 *
 * Usa los eventos de puntero de React Native y no los de toque, que es lo que
 * hace posible el rechazo de palma: el evento de puntero trae qué tocó la
 * pantalla —Android lo saca de `MotionEvent.getToolType`— y con eso se puede
 * ignorar la mano apoyada sin ignorar el dedo de quien no tiene lápiz.
 *
 * El grosor no sale de la presión. React Native la devuelve fija en 0.5 en
 * Android, esté el lápiz apoyado apenas o hundido, así que un trazo «sensible
 * a la presión» sería una línea de grosor constante con nombre bonito. Sale de
 * la velocidad, que sí se sabe y varía por la misma razón física.
 *
 * Cada trazo se parte en tramos de grosor propio en vez de ser un solo camino.
 * Un `Path` de SVG tiene un `strokeWidth` y nada más, así que la única forma de
 * que una letra adelgace al final es que sean varios.
 */
export function Pizarra({
  trazos, util, grosor, cambiar, alMedir, sinTinta,
}: {
  trazos: readonly Trazo[];
  util: Util;
  grosor: number;
  cambiar: (trazos: Trazo[]) => void;
  alMedir?: (alto: number) => void;
  /** Para que la hoja en blanco no coma los toques cuando no se está dibujando. */
  sinTinta?: boolean;
}) {
  const [enCurso, setEnCurso] = useState<Punto[]>([]);
  const puntos = useRef<Punto[]>([]);
  const trazando = useRef<number | null>(null);
  // Se recuerda mientras el apunte esté abierto: quien dejó el lápiz y siguió
  // con el dedo no tiene por qué volver a buscarlo.
  const huboLapiz = useRef(false);
  const [ancho, setAncho] = useState(0);
  const [alto, setAlto] = useState(0);

  const medir = (ev: LayoutChangeEvent) => {
    const { width, height } = ev.nativeEvent.layout;
    setAncho(width);
    setAlto(height);
    alMedir?.(height);
  };

  const empezar = (ev: PointerEvent) => {
    const { pointerType, pointerId, offsetX, offsetY } = ev.nativeEvent;
    if (pointerType === "pen") huboLapiz.current = true;
    if (!dibuja(pointerType as never, huboLapiz.current)) return;
    if (trazando.current !== null) return;

    if (util === "goma") {
      cambiar(borrarDonde(trazos, offsetX, offsetY));
      return;
    }

    trazando.current = pointerId;
    const p = { x: offsetX, y: offsetY, t: Date.now() };
    puntos.current = [p];
    setEnCurso([p]);
  };

  const seguir = (ev: PointerEvent) => {
    const { pointerId, offsetX, offsetY } = ev.nativeEvent;
    if (util === "goma") {
      // Con la goma apretada se borra al pasar, que es como se usa una goma.
      if (ev.nativeEvent.pressure > 0) cambiar(borrarDonde(trazos, offsetX, offsetY));
      return;
    }
    if (trazando.current !== pointerId) return;
    const p = { x: offsetX, y: offsetY, t: Date.now() };
    puntos.current = [...puntos.current, p];
    setEnCurso(puntos.current);
  };

  const terminar = (ev: PointerEvent) => {
    if (trazando.current !== ev.nativeEvent.pointerId) return;
    trazando.current = null;
    const hechos = puntos.current;
    puntos.current = [];
    setEnCurso([]);
    if (hechos.length === 0) return;
    cambiar([...trazos, {
      id: `t${Date.now()}${Math.round(Math.random() * 1e4)}`,
      util, grosor,
      color: util === "destacador" ? color.destacador : color.bordeFuerte,
      puntos: hechos,
    }]);
  };

  const dibujando = enCurso.length > 0
    ? [{ id: "encurso", util, grosor, color: util === "destacador" ? color.destacador : color.bordeFuerte, puntos: enCurso }]
    : [];

  return (
    <View
      style={e.hoja}
      accessibilityLabel="Hoja para escribir a mano"
      onLayout={medir}
      // Cuando no se está dibujando, la hoja deja pasar los toques al texto
      // que hay debajo. Si no, escribir a máquina sería imposible con un
      // dibujo encima.
      pointerEvents={sinTinta ? "none" : "auto"}
      onPointerDown={empezar}
      onPointerMove={seguir}
      onPointerUp={terminar}
      onPointerCancel={terminar}
      onPointerLeave={terminar}
    >
      {ancho > 0 && alto > 0 ? (
        <Svg width={ancho} height={alto} pointerEvents="none">
          {[...trazos, ...dibujando].map((t) => (
            <Tinta key={t.id} trazo={t} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Un trazo, en tantos tramos como haga falta para que el grosor varíe.
 *
 * Los tramos van de a cuatro puntos con uno de solape: sin el solape se ven
 * las juntas, y de a uno serían cientos de nodos por renglón.
 */
function Tinta({ trazo }: { trazo: Trazo }) {
  const { puntos, grosor, color: tono, util } = trazo;
  if (puntos.length === 0) return null;

  const opacidad = util === "destacador" ? 0.38 : 1;

  // El destacador va de una sola pasada. Partirlo en tramos se ve: como es
  // translúcido, donde dos tramos se solapan la tinta se suma y queda una
  // mancha más oscura cada pocos milímetros, como un subrayado hecho a
  // pedacitos. Y no pierde nada, porque tampoco adelgaza: un marcador tiene
  // el ancho de su punta y no le importa a qué velocidad se pase.
  if (util === "destacador" || puntos.length < 3) {
    return (
      <Path d={comoCurva(puntos)} stroke={tono} strokeWidth={grosor} opacity={opacidad}
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
    );
  }

  const tramos = [];
  const PASO = 3;
  for (let i = 0; i < puntos.length - 1; i += PASO) {
    const pedazo = puntos.slice(i, i + PASO + 1);
    if (pedazo.length < 2) break;
    const ancho = grosorEn(grosor, velocidad(pedazo[0]!, pedazo[pedazo.length - 1]!));
    tramos.push(
      <Path key={i} d={comoCurva(pedazo)} stroke={tono} strokeWidth={ancho} opacity={opacidad}
        strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    );
  }
  return <>{tramos}</>;
}

const e = StyleSheet.create({
  hoja: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
