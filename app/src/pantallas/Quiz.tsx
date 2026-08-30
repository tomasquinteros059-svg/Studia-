import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Cargando, Error as ErrorUI, Pantalla } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  FILETE, cifras, color, colorDeRamo, espacio, radio, tenue, tipo,
} from "../ui/tema.ts";
import { quizPorId, responderQuiz } from "../lib/consultas.ts";
import {
  LETRAS, acomodar, avance, comoTeFue, enQueVoy, estaTerminado, pintaDe,
  revisar, type Pregunta, type Respuestas,
} from "../dominio/quiz.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Quiz">;

/**
 * Responder un quiz: una pregunta a la vez, y la explicación al momento.
 *
 * Lo de «al momento» es la decisión de fondo. Un quiz que corrige al final es
 * un simulacro de prueba; uno que corrige al responder es una forma de
 * estudiar, porque el error y la explicación llegan juntos, que es cuando la
 * explicación sirve. Por eso tampoco se puede cambiar una respuesta ya dada:
 * no es para subir el puntaje, es para saber qué falta.
 */
export default function Quiz({ route, navigation }: Props) {
  const { quizId, tono } = route.params;
  const [respuestas, setRespuestas] = useState<Respuestas | null>(null);
  const [enPantalla, setEnPantalla] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const traer = useCallback(async () => {
    const q = await quizPorId(quizId);
    if (!q) throw new Error("No encontré ese quiz.");
    const puestas = acomodar(q.respuestas, q.preguntas.length);
    setRespuestas(puestas);
    setEnPantalla(enQueVoy(puestas));
    return q;
  }, [quizId]);

  const { datos: quiz, cargando, error, recargar } = usarCarga(traer, [quizId]);

  if (cargando) return <Cargando texto="Buscando tus preguntas…" />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!quiz || !respuestas || enPantalla === null) return null;

  const marca = tono ?? colorDeRamo(quiz.asignatura_id, undefined);
  const total = quiz.preguntas.length;
  const terminado = enPantalla >= total;

  const guardar = async (nuevas: Respuestas, listo: boolean) => {
    setGuardando(true);
    try {
      await responderQuiz(quizId, nuevas, listo);
    } catch {
      // Se responde igual: perder la respuesta por un problema de red sería
      // peor que guardarla tarde. La próxima que se dé vuelve a intentar.
    } finally {
      setGuardando(false);
    }
  };

  const responder = (opcion: number) => {
    if (respuestas[enPantalla] !== null) return;
    const nuevas = respuestas.map((r, i) => (i === enPantalla ? opcion : r));
    setRespuestas(nuevas);
    void guardar(nuevas, estaTerminado(nuevas));
  };

  const seguir = () => setEnPantalla((n) => (n === null ? 0 : n + 1));

  const repetir = () => {
    const vacias: Respuestas = Array.from({ length: total }, () => null);
    setRespuestas(vacias);
    setEnPantalla(0);
    void guardar([], false);
  };

  return (
    <Pantalla>
      <View style={e.cabeza}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.etiqueta}>Repaso · {quiz.tema}</Text>
          <Text style={e.cuantas}>
            {terminado
              ? `${total} preguntas`
              : `Pregunta ${enPantalla + 1} de ${total}`}
          </Text>
        </View>
        {!terminado ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Guardar y salir"
            onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={e.salir}>Guardar y salir</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={e.barra}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${Math.round(avance(respuestas) * 100)} por ciento respondido`}
          style={[e.barraLlena, { width: `${avance(respuestas) * 100}%`, backgroundColor: marca }]}
        />
      </View>

      {terminado
        ? <Resultado quiz={quiz} respuestas={respuestas} marca={marca}
            repetir={repetir} volver={() => navigation.goBack()} />
        : (
          <Preguntando
            pregunta={quiz.preguntas[enPantalla]!}
            elegida={respuestas[enPantalla] ?? null}
            marca={marca}
            guardando={guardando}
            ultima={enPantalla === total - 1}
            responder={responder}
            seguir={seguir}
          />
        )}
    </Pantalla>
  );
}

// ── Una pregunta ──────────────────────────────────────────────────────────

function Preguntando({
  pregunta, elegida, marca, guardando, ultima, responder, seguir,
}: {
  pregunta: Pregunta;
  elegida: number | null;
  marca: string;
  guardando: boolean;
  ultima: boolean;
  responder: (i: number) => void;
  seguir: () => void;
}) {
  const contestada = elegida !== null;
  const acerto = elegida === pregunta.correcta;

  return (
    <View style={e.tarjeta}>
      <Text style={e.enunciado}>{pregunta.pregunta}</Text>

      {pregunta.opciones.map((texto, i) => {
        const pinta = pintaDe(i, pregunta.correcta, elegida);
        return (
          <Pressable
            key={texto}
            accessibilityRole="button"
            accessibilityState={{ disabled: contestada, selected: elegida === i }}
            accessibilityLabel={`${LETRAS[i]}. ${texto}`}
            disabled={contestada}
            onPress={() => responder(i)}
            style={({ pressed }) => [
              e.opcion,
              pinta === "correcta" ? e.opcionBuena : null,
              pinta === "equivocada" ? e.opcionMala : null,
              pinta === "apagada" ? { opacity: 0.45 } : null,
              pressed && !contestada ? { borderColor: marca } : null,
            ]}
          >
            <View style={[
              e.letra,
              pinta === "correcta" ? { backgroundColor: color.ok, borderColor: color.ok } : null,
              pinta === "equivocada" ? { backgroundColor: color.vivo, borderColor: color.vivo } : null,
            ]}>
              <Text style={[
                e.letraTexto,
                pinta === "correcta" || pinta === "equivocada" ? { color: "#fff" } : null,
              ]}>{LETRAS[i]}</Text>
            </View>
            <Text style={e.opcionTexto}>{texto}</Text>
          </Pressable>
        );
      })}

      {contestada ? (
        <View style={[e.explicacion, acerto ? e.explicacionBuena : null]}>
          <Text style={e.explicacionTexto}>
            <Text style={e.explicacionQuien}>{acerto ? "Bien. " : "La correcta era otra. "}</Text>
            {pregunta.explicacion}
          </Text>
        </View>
      ) : null}

      {contestada ? (
        <View style={{ marginTop: espacio.l }}>
          <Boton texto={ultima ? "Ver cómo me fue" : "Siguiente"} onPress={seguir}
            deshabilitado={guardando} />
        </View>
      ) : null}
    </View>
  );
}

// ── Cómo te fue ───────────────────────────────────────────────────────────

function Resultado({
  quiz, respuestas, marca, repetir, volver,
}: {
  quiz: { preguntas: Pregunta[]; tema: string };
  respuestas: Respuestas;
  marca: string;
  repetir: () => void;
  volver: () => void;
}) {
  const r = revisar(quiz.preguntas, respuestas);
  const v = comoTeFue(r.correctas, r.total);

  return (
    <View style={e.tarjeta}>
      <Text style={[e.puntaje, cifras, { color: marca }]}>{r.correctas}/{r.total}</Text>
      <Text style={e.veredicto}>{v.titulo}</Text>
      <Text style={e.veredictoTexto}>{v.mensaje}</Text>

      <View style={e.detalle}>
        {r.detalle.map((d, i) => (
          <View key={`${i}-${d.pregunta}`} style={e.linea}>
            <View style={[e.marcaLinea, d.acerto ? e.marcaBuena : e.marcaMala]}>
              <Icono nombre={d.acerto ? "listo" : "cerrar"} tamano={12} tono="#fff" />
            </View>
            <Text style={e.lineaTexto}>{d.pregunta}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: espacio.s }}>
        <Boton texto="Repetir el quiz" onPress={repetir} variante="suave" />
        <Boton texto="Volver al ramo" onPress={volver} />
      </View>

      <Text style={e.pie}>
        Esto no es una nota y no lo ve nadie más: ni quien dicta el ramo, ni la
        institución. Es para que sepas tú.
      </Text>
    </View>
  );
}

const e = StyleSheet.create({
  cabeza: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.s,
  },
  cuantas: { ...tipo.subtitulo, marginTop: 2 },
  salir: { fontSize: 13.5, fontWeight: "600", color: color.textoSuave },

  barra: {
    height: 10, borderRadius: 999, backgroundColor: color.elemento,
    marginHorizontal: espacio.m, marginBottom: espacio.l, overflow: "hidden",
  },
  barraLlena: { height: "100%", borderRadius: 999 },

  tarjeta: {
    marginHorizontal: espacio.m,
    borderWidth: FILETE, borderColor: color.borde, borderRadius: radio.tarjeta,
    backgroundColor: color.papel, padding: espacio.l, gap: espacio.s,
  },
  enunciado: { ...tipo.titulo, fontSize: 20, lineHeight: 27, marginBottom: espacio.m },

  opcion: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.campo,
    backgroundColor: color.fondo, paddingHorizontal: espacio.m, paddingVertical: 13,
  },
  opcionBuena: { borderColor: color.ok, backgroundColor: tenue(color.ok) },
  opcionMala: { borderColor: color.vivo, backgroundColor: tenue(color.vivo) },
  opcionTexto: { ...tipo.cuerpo, flex: 1, lineHeight: 21 },
  letra: {
    width: 28, height: 28, borderRadius: 9,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel,
    alignItems: "center", justifyContent: "center",
  },
  letraTexto: { fontSize: 12.5, fontWeight: "800", color: color.texto },

  explicacion: {
    marginTop: espacio.m, padding: espacio.m, borderRadius: radio.campo,
    backgroundColor: color.elemento,
  },
  explicacionBuena: { backgroundColor: tenue(color.ok) },
  explicacionTexto: { ...tipo.cuerpo, fontSize: 14.5, lineHeight: 21 },
  explicacionQuien: { fontWeight: "700" },

  puntaje: { fontSize: 54, fontWeight: "800", letterSpacing: -2, textAlign: "center" },
  veredicto: { ...tipo.titulo, textAlign: "center" },
  veredictoTexto: {
    ...tipo.cuerpo, color: color.textoSuave, textAlign: "center", lineHeight: 22,
    marginBottom: espacio.m,
  },

  detalle: {
    gap: espacio.s, paddingVertical: espacio.m,
    borderTopWidth: FILETE, borderTopColor: color.borde,
    borderBottomWidth: FILETE, borderBottomColor: color.borde,
    marginBottom: espacio.m,
  },
  linea: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  marcaLinea: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  marcaBuena: { backgroundColor: color.ok },
  marcaMala: { backgroundColor: color.vivo },
  lineaTexto: { ...tipo.detalle, color: color.texto, flex: 1, lineHeight: 19 },

  pie: { ...tipo.detalle, lineHeight: 19, marginTop: espacio.m },
});
