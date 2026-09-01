import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Cargando, Error as ErrorUI, Fila, HojaModal, Pantalla, Pastilla, Punto, Vacio,
} from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  FILETE, color, colorDeRamo, espacio, fechaYHora, radio, sombra, tipo,
} from "../ui/tema.ts";
import { materiaDe, misAsignaturas, misTareas } from "../lib/consultas.ts";
import { generarQuiz } from "../lib/quiz.ts";
import type { Asignatura, Modulo } from "../lib/tipos.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { cuandoVence, estadoDeTarea, ordenarTareas } from "../dominio/tareas.ts";
import type { PropsPestana } from "../lib/rutas.ts";

type Props = PropsPestana<"Tareas">;
/** Qué se dice cuando la lista queda vacía, según lo que se estaba mirando. */
const SIN_NADA: Record<"pendientes" | "entregadas" | "todas", string> = {
  pendientes: "No tienes nada pendiente. Buen momento para repasar.",
  entregadas: "Todavía no has entregado ninguna tarea.",
  todas: "No hay tareas en tus ramos todavía.",
};

const FILTROS = [
  { id: "pendientes", texto: "Pendientes" },
  { id: "entregadas", texto: "Entregadas" },
  { id: "todas", texto: "Todas" },
] as const;

export default function Tareas({ navigation }: Props) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("pendientes");
  const [armando, setArmando] = useState(false);

  const traer = useCallback(async () => {
    const [tareas, asignaturas] = await Promise.all([misTareas(), misAsignaturas()]);
    return { tareas, porId: new Map(asignaturas.map((a) => [a.id, a])) };
  }, []);
  const { datos, cargando, refrescando, error, recargar, refrescar } = usarCarga(traer);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const lista = ordenarTareas(datos.tareas).filter((t) => {
    const estado = estadoDeTarea(t);
    if (filtro === "pendientes") return estado !== "entregada";
    if (filtro === "entregadas") return estado === "entregada";
    return true;
  });

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={e.filtros}>
        {FILTROS.map((f) => {
          const activo = f.id === filtro;
          return (
            <Pressable key={f.id} accessibilityRole="tab" accessibilityState={{ selected: activo }}
              onPress={() => setFiltro(f.id)} style={[e.filtro, activo && { backgroundColor: color.marca }]}>
              <Text style={[e.filtroTexto, activo && { color: color.sobreMarca, fontWeight: "600" }]}>
                {f.texto}
              </Text>
            </Pressable>
          );
        })}

        {/*
          Va en la misma fila que los filtros, pero no se ve como uno: los
          filtros cambian qué se muestra y esto abre otra cosa. Un botón que
          parece filtro y no filtra es de las cosas que hacen que alguien deje
          de confiar en una barra entera.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear un quiz con mi material"
          onPress={() => setArmando(true)}
          style={({ pressed }) => [e.armar, pressed ? e.armarApretado : null]}>
          <Icono nombre="quiz" tamano={16} tono={color.sobreMarca} />
          <Text style={e.armarTexto}>Crear quiz</Text>
        </Pressable>
      </View>

      {/*
        Cada filtro vacío quiere decir algo distinto, y decir «Nada por acá»
        en los tres era desperdiciar el único momento en que la pantalla tiene
        toda la atención de alguien. En pendientes, además, la noticia es
        buena y hay que darla como tal.
      */}
      {lista.length === 0 ? <Vacio texto={SIN_NADA[filtro]} /> : lista.map((t) => {
        const ramo = datos.porId.get(t.asignatura_id);
        const estado = estadoDeTarea(t);
        return (
          <Fila key={t.id}
            izquierda={<Punto tono={ramo ? colorDeRamo(ramo.id, ramo.color) : color.bordeFuerte} />}
            titulo={t.titulo}
            detalle={`${ramo?.nombre ?? ""} · ${fechaYHora(t.vence_en)} · ${t.puntos} pts`}
            derecha={
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                <Pastilla
                  texto={estado === "entregada" ? "ENTREGADA" : estado === "atrasada" ? "ATRASADA" : "PENDIENTE"}
                  tono={estado === "entregada" ? "ok" : estado === "atrasada" ? "atrasada" : "pendiente"} />
                <Text style={tipo.detalle}>{cuandoVence(t)}</Text>
              </View>
            }
            onPress={() => navigation.navigate("Tarea", { tareaId: t.id })}
          />
        );
      })}
      <Text style={e.pie}>
        El tutor no las resuelve por ti: te ayuda a encontrar el camino.
      </Text>

      <ArmarQuiz
        abierto={armando}
        cerrar={() => setArmando(false)}
        ramos={[...datos.porId.values()]}
        alQuedarListo={(quizId, tono) => {
          setArmando(false);
          navigation.navigate("Quiz", { quizId, tono });
        }}
      />
    </Pantalla>
  );
}

// ── Armar un quiz con lo que uno ya tiene ─────────────────────────────────

/**
 * Elegir de qué armar el quiz: primero el ramo, después el tema.
 *
 * En dos pasos y no en una lista larga porque la lista larga habría que
 * traerla entera —la materia de los seis ramos— para que alguien elija una
 * sola cosa. Así se pide la materia del ramo que efectivamente eligió.
 *
 * Las preguntas salen del material de ese tema, que es lo que lo distingue de
 * un quiz genérico de internet: pregunta lo que pasaron en clase.
 */
function ArmarQuiz({
  abierto, cerrar, ramos, alQuedarListo,
}: {
  abierto: boolean;
  cerrar: () => void;
  ramos: Asignatura[];
  alQuedarListo: (quizId: string, tono: string) => void;
}) {
  const [ramo, setRamo] = useState<Asignatura | null>(null);
  const [modulos, setModulos] = useState<Modulo[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);

  const volver = () => { setRamo(null); setModulos(null); };
  const salir = () => { volver(); cerrar(); };

  const elegirRamo = async (a: Asignatura) => {
    setRamo(a);
    setBuscando(true);
    try {
      setModulos(await materiaDe(a.id));
    } catch {
      setModulos([]);
    } finally {
      setBuscando(false);
    }
  };

  const elegirTema = async (m: Modulo) => {
    if (!ramo) return;
    setGenerando(m.id);
    try {
      const quiz = await generarQuiz({
        moduloId: m.id, asignaturaId: ramo.id, tema: m.titulo,
      });
      alQuedarListo(quiz.id, colorDeRamo(ramo.id, ramo.color));
      volver();
    } catch (falla) {
      Alert.alert("No pude armar el quiz",
        falla instanceof Error ? falla.message : "Inténtalo de nuevo.");
    } finally {
      setGenerando(null);
    }
  };

  // Un módulo sin material no puede dar preguntas de nada: ofrecerlo sería
  // ofrecer un botón que falla.
  const conMaterial = (modulos ?? []).filter((m) => m.materiales.length > 0);

  return (
    <HojaModal abierto={abierto} cerrar={salir}
      titulo={ramo ? `Quiz de ${ramo.nombre}` : "¿De qué te tomo la prueba?"}>
      <View style={e.hoja}>
        {!ramo ? (
          <>
            <Text style={e.explica}>
              Las preguntas salen de tu propio material, no de un banco
              genérico: preguntan lo que pasaron en clase.
            </Text>
            {ramos.length === 0 ? (
              <Vacio texto="Todavía no tienes ramos con material." />
            ) : (
              <ScrollView style={e.lista}>
                {ramos.map((a) => (
                  <Pressable key={a.id} accessibilityRole="button"
                    accessibilityLabel={`Quiz de ${a.nombre}`}
                    onPress={() => void elegirRamo(a)}
                    style={({ pressed }) => [e.opcion, pressed ? e.opcionApretada : null]}>
                    <Punto tono={colorDeRamo(a.id, a.color)} />
                    <Text style={e.opcionTexto} numberOfLines={1}>{a.nombre}</Text>
                    <Icono nombre="siguiente" tamano={17} tono={color.textoSuave} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        ) : buscando ? (
          <Cargando texto="Buscando tu material…" />
        ) : conMaterial.length === 0 ? (
          <>
            <Vacio texto={`${ramo.nombre} todavía no tiene material del que preguntar.`} />
            <Pressable accessibilityRole="button" onPress={volver} style={e.volver}>
              <Text style={e.volverTexto}>Elegir otro ramo</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={e.explica}>Cinco preguntas del tema que elijas.</Text>
            <ScrollView style={e.lista}>
              {conMaterial.map((m) => (
                <Pressable key={m.id} accessibilityRole="button"
                  accessibilityLabel={`Ponerme a prueba en ${m.titulo}`}
                  disabled={generando !== null}
                  onPress={() => void elegirTema(m)}
                  style={({ pressed }) => [
                    e.opcion, pressed ? e.opcionApretada : null,
                    generando !== null && generando !== m.id ? { opacity: 0.4 } : null,
                  ]}>
                  <Text style={e.opcionTexto} numberOfLines={2}>{m.titulo}</Text>
                  {generando === m.id
                    ? <ActivityIndicator color={color.marca} />
                    : <Text style={tipo.detalle}>{m.materiales.length} recursos</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={volver} style={e.volver}>
              <Text style={e.volverTexto}>Elegir otro ramo</Text>
            </Pressable>
          </>
        )}
      </View>
    </HojaModal>
  );
}

const e = StyleSheet.create({
  // Se envuelve. En un teléfono angosto los tres filtros más el botón no
  // caben en una línea, y sin esto el botón se salía de la pantalla: quedaba
  // cortado por el borde derecho y no se podía tocar entero.
  filtros: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    gap: espacio.s, padding: espacio.m,
  },
  filtro: {
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 9,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  filtroTexto: { fontSize: 14, fontWeight: "600", color: color.textoSuave },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },

  armar: {
    // Al final de su línea: si cabe, queda a la derecha de los filtros; si no,
    // baja a la línea siguiente y queda a la derecha igual.
    marginLeft: "auto",
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: radio.boton, paddingHorizontal: espacio.m, paddingVertical: 9,
    backgroundColor: color.marca, borderWidth: FILETE, borderColor: color.bordeFuerte,
    boxShadow: sombra(3),
  },
  armarApretado: { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: sombra(0) },
  armarTexto: { fontSize: 14, fontWeight: "700", color: color.sobreMarca },

  hoja: { flex: 1, padding: espacio.m, gap: espacio.m },
  explica: { ...tipo.cuerpo, fontSize: 14.5, lineHeight: 22 },
  lista: { flexGrow: 0, maxHeight: 420 },
  opcion: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingVertical: 13, paddingHorizontal: espacio.m, marginBottom: espacio.s,
    borderRadius: radio.tarjeta, borderWidth: FILETE, borderColor: color.bordeFuerte,
    backgroundColor: color.papel,
  },
  opcionApretada: { backgroundColor: color.elemento },
  opcionTexto: { ...tipo.fila, flex: 1 },
  volver: { alignSelf: "flex-start", paddingVertical: espacio.s },
  volverTexto: { fontSize: 14, fontWeight: "600", color: color.anotacion },
});
