import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Boton, Cargando, Encabezado, Error, Fila, Pastilla, Vacio,
} from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  FILETE, cifras, color, colorDeRamo, duracion, espacio, fechaCorta, hora,
  inicialesDeRamo, nombreDia, radio, tenue, tipo, velado,
} from "../ui/tema.ts";
import {
  clasesDe, companerosDe, crearApunte, crearMaterial, evaluacionesDe, foroDe,
  marcarMaterial, materiaDe, miHorario, misApuntes, misAsignaturas, misTareas,
  moduloParaMaterial,
} from "../lib/consultas.ts";
import NuevoMaterial, { type MaterialArmado } from "./propio/NuevoMaterial.tsx";
import * as WebBrowser from "expo-web-browser";
import { direccionFirmada } from "../lib/archivos.ts";
import { generarFichas, generarQuiz } from "../lib/quiz.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { formatearNota, notaDelRamo, proyeccionParaAprobar } from "../dominio/notas.ts";
import { cuandoVence, estadoDeTarea, ordenarTareas } from "../dominio/tareas.ts";
import { porcentajeVisto } from "../dominio/ramos.ts";
import { unir } from "../dominio/horario-escrito.ts";
import { inicialesDePersona } from "../dominio/personas.ts";
import { type PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Asignatura">;

/** Solo tres viven en la fila; el resto está tras los tres puntitos. */
const EN_LA_FILA = ["materia", "clases", "tareas"] as const;

/**
 * Un ramo propio no tiene curso detrás: nadie publica tareas, nadie dicta
 * clases, no hay foro ni notas ni compañeros. Mostrar esas secciones vacías
 * sería prometer algo que no va a llegar nunca.
 */
const SECCIONES_PROPIAS = ["materia", "apuntes", "archivos"] as const;
const SECCIONES = [
  { id: "materia", texto: "Materia", corto: "Materia" },
  { id: "clases", texto: "Clases", corto: "Clases" },
  { id: "tareas", texto: "Tareas", corto: "Tareas" },
  { id: "foro", texto: "Foro", corto: "Foro" },
  { id: "apuntes", texto: "Mis apuntes", corto: "Apuntes" },
  { id: "notas", texto: "Notas", corto: "Notas" },
  { id: "horario", texto: "Horario", corto: "Horario" },
  { id: "programa", texto: "Programa del curso", corto: "Programa" },
  { id: "companeros", texto: "Compañeros", corto: "Curso" },
  { id: "archivos", texto: "Archivos", corto: "Archivos" },
] as const;
type Seccion = (typeof SECCIONES)[number]["id"];

const ICONO_SECCION = {
  materia: "documento", clases: "video", tareas: "tareas", foro: "tutor",
  apuntes: "documento", notas: "nota", horario: "horario",
  programa: "documento", companeros: "persona", archivos: "descargar",
} as const satisfies Record<Seccion, Parameters<typeof Icono>[0]["nombre"]>;

export default function Asignatura({ route, navigation }: Props) {
  const { asignaturaId } = route.params;
  const [seccion, setSeccion] = useState<Seccion>((route.params.seccion as Seccion) ?? "materia");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [agregando, setAgregando] = useState(false);
  // Con ancho de sobra, las nueve secciones caben a la vista y esconderlas
  // tras un menú sería peor: el menú existe porque en un teléfono no caben.
  const { barraDeSecciones } = usarDisposicion();

  const traer = useCallback(async () => {
    const [asignaturas, modulos, clases, tareas, foro, evaluaciones, horario, companeros] =
      await Promise.all([
        misAsignaturas(), materiaDe(asignaturaId), clasesDe(asignaturaId),
        misTareas(asignaturaId), foroDe(asignaturaId), evaluacionesDe(asignaturaId),
        miHorario(), companerosDe(asignaturaId),
      ]);
    const apuntes = await misApuntes(asignaturaId);
    const ramo = asignaturas.find((a) => a.id === asignaturaId) ?? null;
    return {
      ramo, modulos, clases, tareas, foro, evaluaciones, companeros, apuntes,
      horario: horario.filter((b) => b.asignatura_id === asignaturaId),
    };
  }, [asignaturaId]);

  const { datos, cargando, error, recargar } = usarCarga(traer, [asignaturaId]);

  useEffect(() => {
    navigation.setOptions({
      title: datos?.ramo?.nombre ?? "Asignatura",
      headerRight: barraDeSecciones
        ? undefined
        : () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Todas las secciones"
              onPress={() => setMenuAbierto(true)} hitSlop={10}>
              <Icono nombre="mas" tamano={20} tono={color.marca} />
            </Pressable>
          ),
    });
  }, [navigation, datos?.ramo?.nombre, barraDeSecciones]);

  // Si la pantalla se angosta con el menú abierto, se cierra solo.
  useEffect(() => {
    if (barraDeSecciones) setMenuAbierto(false);
  }, [barraDeSecciones]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos?.ramo) return <Vacio texto="No encontré esa asignatura." />;

  const ramo = datos.ramo;
  const tono = colorDeRamo(ramo.id, ramo.color);
  const propio = ramo.propio;
  const secciones = propio
    ? SECCIONES.filter((x) => (SECCIONES_PROPIAS as readonly string[]).includes(x.id))
    : SECCIONES;
  // Si se llegó pidiendo una sección que este ramo no tiene —un enlace viejo,
  // o un ramo que dejó de ser del colegio— se cae a la primera y no a nada.
  const actual: Seccion = secciones.some((x) => x.id === seccion) ? seccion : "materia";
  const enLaFila = propio ? SECCIONES_PROPIAS : EN_LA_FILA;
  const visibles: Seccion[] = (enLaFila as readonly Seccion[]).includes(actual)
    ? [...enLaFila]
    : [actual, ...enLaFila];

  /**
   * Guardar material en un ramo propio. La unidad la decide la capa de
   * datos: pedirle a alguien que invente una unidad antes de poder pegar un
   * texto es un paso de más.
   */
  const guardarMaterial = async ({ moduloId, ...resto }: MaterialArmado) => {
    // La unidad la puede haber elegido el modal —cuando el ramo tiene
    // programa—; si no, la decide la capa de datos.
    await crearMaterial({ ...resto, moduloId: moduloId ?? await moduloParaMaterial(asignaturaId) });
    recargar();
  };

  const visto = porcentajeVisto(datos.modulos);
  // Lo próximo que vence de este ramo, que es lo que aprieta. Las
  // evaluaciones no traen fecha en la base, así que la fecha sale de las
  // tareas, que es la que existe de verdad.
  const proxima = ordenarTareas(datos.tareas.filter((t) => t.entregada_en === null))[0];

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      {/* El color del ramo es dueño de la cabecera: es cómo sabes dónde
          estás sin leer el título. */}
      <View style={[e.cabecera, { backgroundColor: tono }]}>
        <View style={e.selloRamo}>
          <Text style={e.selloTexto}>{inicialesDeRamo(ramo.nombre)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={e.codigo}>{ramo.codigo}</Text>
          <Text style={e.nombre} numberOfLines={2}>{ramo.nombre}</Text>
          <Text style={e.profesor} numberOfLines={1}>{ramo.profesor}</Text>
        </View>

        {/* Cuánto llevas visto. Solo sale si hay material que contar: un
            «0%» sobre un ramo vacío no dice que vas atrasado, dice que
            todavía no han subido nada, y no es lo mismo. */}
        {visto !== null ? (
          <View style={e.avance}>
            <Text style={[e.avanceCifra, cifras]}>{visto}%</Text>
            <Text style={e.avanceEtiqueta}>visto</Text>
          </View>
        ) : null}
      </View>

      {proxima ? (
        <View style={e.proxima}>
          <Icono nombre="aviso" tamano={16} tono={color.ambar} />
          <Text style={e.proximaTexto} numberOfLines={1}>
            {proxima.titulo} · {cuandoVence(proxima)}
          </Text>
        </View>
      ) : null}

      {barraDeSecciones ? null : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={e.fila} contentContainerStyle={{ gap: espacio.s, paddingHorizontal: espacio.m, paddingVertical: espacio.m }}>
        {visibles.map((id) => {
          const s = SECCIONES.find((x) => x.id === id)!;
          const activa = id === actual;
          return (
            <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: activa }}
              onPress={() => setSeccion(id)}
              style={({ pressed }) => [
                e.chip,
                activa ? { backgroundColor: tono, borderColor: tono } : null,
                pressed && !activa ? { backgroundColor: color.elemento } : null,
              ]}>
              <Text style={[e.chipTexto, activa ? { color: color.sobreMarca, fontWeight: "700" } : null]}>
                {s.corto}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      )}

      <View style={[e.cuerpo, barraDeSecciones ? e.conBarra : null]}>
      {barraDeSecciones ? (
        <View style={e.barraLateral}>
          {secciones.map((sec) => {
            const activa = sec.id === actual;
            return (
              <Pressable key={sec.id} accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                onPress={() => setSeccion(sec.id)}
                style={({ pressed }) => [
                  e.itemBarra,
                  activa && { backgroundColor: tenue(tono) },
                  pressed && !activa && { backgroundColor: color.elemento },
                ]}>
                <Icono nombre={ICONO_SECCION[sec.id]} tamano={18}
                  tono={activa ? tono : color.textoSuave} />
                <Text style={[e.itemBarraTexto, activa && { color: tono, fontWeight: "700" }]}>
                  {sec.texto}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: espacio.xl }}>
        {actual === "materia" && propio ? (
          <View style={e.agregarCaja}>
            <Boton texto="Agregar material" onPress={() => setAgregando(true)} />
          </View>
        ) : null}

        {actual === "materia" ? (
          datos.modulos.length === 0 ? (
            <Vacio texto={propio
              ? "Todavía no hay nada acá. Agrega un texto y el lector te lo lee en voz alta."
              : "Todavía no hay material publicado."} />
          ) :
          datos.modulos.map((m) => (
            <View key={m.id}>
              <View style={e.modulo}>
                <Text style={e.moduloTitulo} numberOfLines={2}>{m.titulo}</Text>
                <Text style={e.moduloCuenta}>
                  {m.materiales.filter((x) => x.completado).length}/{m.materiales.length}
                </Text>
              </View>
              {m.materiales.map((mat) => {
                const marcar = async () => {
                  await marcarMaterial(mat.id, !mat.completado).catch(() => {});
                  recargar();
                };

                /**
                 * Abre el archivo guardado.
                 *
                 * La dirección se pide en el momento y vence: lo guardado en
                 * la base es una ruta, no algo que se pueda abrir. Así un
                 * archivo de un ramo no queda accesible a quien tenga el
                 * enlace.
                 */
                const abrirArchivo = async () => {
                  const donde = await direccionFirmada(mat.archivo);
                  if (!donde) {
                    Alert.alert("No pude abrirlo",
                      "El archivo ya no está disponible o no tienes permiso para verlo.");
                    return;
                  }
                  try {
                    await WebBrowser.openBrowserAsync(donde);
                  } catch {
                    Alert.alert("No pude abrirlo", "Tu teléfono no encontró con qué abrirlo.");
                  }
                };
                return (
                  <Fila key={mat.id}
                    izquierda={<Icono
                      nombre={mat.tipo === "video" ? "video" : mat.tipo === "documento" ? "documento" : "ejercicios"}
                      tono={mat.completado ? tono : color.textoSuave} />}
                    titulo={mat.titulo}
                    detalle={mat.detalle}
                    derecha={
                      // Si hay algo que leer, tocar la fila abre el lector y la
                      // marca queda como su propio botón: si no, sería imposible
                      // abrir un material sin darlo por visto.
                      mat.leible ? (
                        <Pressable accessibilityRole="button" hitSlop={10}
                          accessibilityLabel={mat.completado ? `Desmarcar ${mat.titulo}` : `Marcar ${mat.titulo} como visto`}
                          onPress={() => void marcar()}>
                          <Icono nombre={mat.completado ? "listo" : "escuchar"} tamano={18}
                            tono={mat.completado ? tono : color.marca} />
                        </Pressable>
                      ) : mat.completado ? (
                        <Icono nombre="listo" tamano={18} tono={tono} />
                      ) : null
                    }
                    onPress={mat.leible
                      ? () => navigation.navigate("Lectura", { materialId: mat.id })
                      : mat.archivo
                        ? () => void abrirArchivo()
                        : () => void marcar()}
                  />
                );
              })}

              {/* Al final del tema, no arriba: ponerse a prueba es lo que se
                  hace después de pasar el material, y ofrecerlo antes invita a
                  saltárselo. */}
              <Ponerme modulo={m} tono={tono} asignaturaId={asignaturaId}
                abrirQuiz={(quizId) => navigation.navigate("Quiz", { quizId, tono })}
                abrirFichas={() => navigation.navigate("Fichas", {
                  asignaturaId, tema: m.titulo, tono,
                })} />
            </View>
          ))
        ) : null}

        {actual === "clases" ? (
          <>
            {datos.clases.filter((c) => c.estado === "en_vivo").map((c) => (
              <Pressable key={c.id} accessibilityRole="button" style={e.enVivo}
                onPress={() => navigation.navigate("ClaseEnVivo", {
                  titulo: c.titulo,
                  asignatura: ramo.nombre,
                  codigo: ramo.codigo,
                  profesor: ramo.profesor,
                  desdeSegundos: Math.max(0,
                    Math.floor((Date.now() - new Date(c.inicia_en).getTime()) / 1000)),
                })}>
                <View style={e.puntoVivo} />
                <View style={{ flex: 1 }}>
                  <Text style={e.vivoEtiqueta}>EN VIVO AHORA</Text>
                  <Text style={e.vivoTitulo}>{c.titulo}</Text>
                </View>
                <Pastilla texto="ENTRAR" tono="vivo" />
              </Pressable>
            ))}

            {/*
              El modo escucha aparece solo donde tiene sentido: una clase que
              está pasando, en sala, y con el permiso de quien la dicta. En una
              clase por pantalla no aparece —su audio ya pasa por la
              aplicación— y sin permiso tampoco, porque la voz que más se oye
              en una clase es la de quien la hace.
            */}
            {datos.clases
              .filter((c) => c.estado === "en_vivo" && c.presencial && c.escucha_permitida)
              .map((c) => (
                <Pressable key={`escucha-${c.id}`} accessibilityRole="button"
                  accessibilityLabel={`Escuchar la clase: ${c.titulo}`}
                  style={e.escuchar}
                  onPress={() => navigation.navigate("Escucha", {
                    claseId: c.id, titulo: c.titulo, asignaturaId: ramo.id,
                  })}>
                  <Icono nombre="microfono" tamano={20} tono={color.texto} />
                  <View style={{ flex: 1 }}>
                    <Text style={e.escucharTitulo}>Modo escucha</Text>
                    <Text style={tipo.detalle}>
                      Deja la clase escrita, para ti y para quien no vino
                    </Text>
                  </View>
                  <Icono nombre="siguiente" tamano={18} tono={color.textoSuave} />
                </Pressable>
              ))}

            <Encabezado texto="Clases grabadas" />
            {datos.clases.filter((c) => c.estado === "grabada").length === 0
              ? <Vacio texto="Todavía no hay grabaciones de esta asignatura." />
              : datos.clases.filter((c) => c.estado === "grabada").map((c) => (
                  <Fila key={c.id}
                    izquierda={<Icono nombre="video" tono={tono} />}
                    titulo={c.titulo}
                    detalle={`${fechaCorta(c.inicia_en)} · audio`}
                    derecha={<Text style={tipo.detalle}>
                      {c.duracion_seg ? duracion(c.duracion_seg) : ""}
                    </Text>}
                    onPress={() => navigation.navigate("Grabacion", {
                      claseId: c.id,
                      asignaturaId: ramo.id,
                      titulo: c.titulo,
                      fecha: c.inicia_en,
                      duracionSeg: c.duracion_seg,
                      audioUrl: c.audio_url,
                    })}
                  />
                ))}
          </>
        ) : null}

        {actual === "tareas" ? (
          datos.tareas.length === 0 ? <Vacio texto="Sin tareas en esta asignatura." /> :
          ordenarTareas(datos.tareas).map((t) => {
            const estado = estadoDeTarea(t);
            return (
              <Fila key={t.id} titulo={t.titulo} detalle={cuandoVence(t)}
                derecha={<Pastilla
                  texto={estado === "entregada" ? "ENTREGADA" : estado === "atrasada" ? "ATRASADA" : "PENDIENTE"}
                  tono={estado === "entregada" ? "ok" : estado === "atrasada" ? "atrasada" : "pendiente"} />}
                onPress={() => navigation.navigate("Tarea", { tareaId: t.id })}
              />
            );
          })
        ) : null}

        {actual === "foro" ? (
          <>
            <View style={{ padding: espacio.m }}>
              <Pressable accessibilityRole="button" style={e.nuevoHilo}
                onPress={() => navigation.navigate("NuevoHilo", { asignaturaId: ramo.id })}>
                <Icono nombre="nuevo" tamano={18} tono={color.marca} />
                <Text style={e.nuevoHiloTexto}>Abrir un hilo nuevo</Text>
              </Pressable>
            </View>
            {datos.foro.length === 0 ? <Vacio texto="El foro está vacío. Parte tú." /> :
              datos.foro.map((h) => (
                <Fila key={h.id}
                  izquierda={h.fijado ? <Icono nombre="fijado" tamano={16} tono={color.ambar} /> : null}
                  titulo={h.titulo}
                  detalle={`${h.autor_nombre} · ${h.respuestas === 0 ? "Sin respuestas"
                    : `${h.respuestas} ${h.respuestas === 1 ? "respuesta" : "respuestas"}`}`}
                  onPress={() => navigation.navigate("Hilo", { hiloId: h.id, titulo: h.titulo })}
                />
              ))}
            <Text style={e.pie}>
              El foro es entre compañeros y el profesor. El tutor no responde aquí:
              para eso está el chat.
            </Text>
          </>
        ) : null}

        {actual === "notas" ? <SeccionNotas evaluaciones={datos.evaluaciones} /> : null}

        {actual === "horario" ? (
          datos.horario.map((b) => (
            <Fila key={b.id}
              izquierda={<View style={[e.barraColor, { backgroundColor: tono }]} />}
              titulo={b.tipo}
              detalle={unir([
                nombreDia(b.dia),
                `${hora(b.hora_inicio)}–${hora(b.hora_fin)}`,
                b.sala,
              ])}
            />
          ))
        ) : null}

        {actual === "programa" ? (
          <>
            <Text style={e.prosa}>{ramo.descripcion ?? "Sin descripción."}</Text>
            <Encabezado texto="Requisitos" />
            <Text style={e.prosa}>{ramo.requisitos ?? "Sin requisitos."}</Text>
            <Encabezado texto="Evaluación" />
            {datos.evaluaciones.map((ev) => (
              <Fila key={ev.id} titulo={ev.titulo}
                derecha={<Text style={tipo.detalle}>{ev.peso}%</Text>} />
            ))}
            <Encabezado texto="Bibliografía" />
            {ramo.bibliografia.map((b, i) => <Fila key={i} titulo={b} />)}
          </>
        ) : null}

        {actual === "apuntes" ? (
          <>
            <View style={{ padding: espacio.m }}>
              <Pressable accessibilityRole="button" style={e.nuevoHilo}
                onPress={async () => {
                  try {
                    const nuevo = await crearApunte(
                      ramo.id,
                      `Apuntes · ${new Date().toLocaleDateString("es-CL")}`,
                      datos.clases.find((c) => c.estado === "en_vivo")?.id ?? null,
                    );
                    navigation.navigate("Apunte", { apunteId: nuevo.id });
                  } catch (err) {
                    Alert.alert("No pude crear el apunte",
                      err instanceof globalThis.Error ? err.message : "");
                  }
                }}>
                <Icono nombre="nuevo" tamano={18} tono={color.marca} />
                <Text style={e.nuevoHiloTexto}>Nuevo apunte</Text>
              </Pressable>
            </View>
            {datos.apuntes.length === 0
              ? <Vacio texto="Todavía no tienes apuntes de este ramo. En tablet puedes escribir con el tutor al lado." />
              : datos.apuntes.map((a) => (
                  <Fila key={a.id}
                    izquierda={<Icono nombre="documento" tono={tono} />}
                    titulo={a.titulo}
                    detalle={a.contenido.trim()
                      ? `${a.contenido.trim().slice(0, 60)}…`
                      : "Sin escribir todavía"}
                    onPress={() => navigation.navigate("Apunte", { apunteId: a.id })}
                  />
                ))}
          </>
        ) : null}

        {actual === "companeros" ? (
          <>
            <Encabezado texto="Equipo docente" />
            <Fila izquierda={<Avatar nombre={ramo.profesor} destacado tono={tono} />}
              titulo={ramo.profesor} detalle="Profesor o profesora del curso" />
            {ramo.ayudante ? (
              <Fila izquierda={<Avatar nombre={ramo.ayudante} destacado tono={tono} />}
                titulo={ramo.ayudante} detalle="Ayudantía" />
            ) : null}
            <Encabezado texto={`Inscritos · ${datos.companeros.length}`} />
            {datos.companeros.map((c) => (
              <Fila key={c.id} izquierda={<Avatar nombre={c.nombre} tono={tono} />}
                titulo={c.nombre} detalle="Estudiante" />
            ))}
            <Text style={e.pie}>
              Solo se muestran los nombres de quienes comparten esta asignatura
              contigo. Los correos no salen de la base de datos.
            </Text>
          </>
        ) : null}

        {actual === "archivos" ? (
          (() => {
            const docs = datos.modulos.flatMap((m) =>
              m.materiales.filter((x) => x.tipo === "documento").map((x) => ({ ...x, modulo: m.titulo })));
            return docs.length === 0
              ? <Vacio texto="No hay documentos en esta asignatura." />
              : docs.map((d) => (
                  <Fila key={d.id} izquierda={<Icono nombre="documento" tono={tono} />}
                    titulo={d.titulo} detalle={`${d.modulo} · ${d.detalle}`}
                    derecha={<Icono nombre="descargar" tamano={18} tono={tono} />} />
                ));
          })()
        ) : null}
      </ScrollView>
      </View>

      {propio ? (
        <NuevoMaterial abierto={agregando} cerrar={() => setAgregando(false)}
          guardar={guardarMaterial} />
      ) : null}

      <Modal visible={menuAbierto} transparent animationType="slide"
        onRequestClose={() => setMenuAbierto(false)}>
        <Pressable style={e.fondoModal} onPress={() => setMenuAbierto(false)} accessibilityLabel="Cerrar" />
        <View style={e.hoja}>
          <View style={e.asa} />
          <Text style={tipo.etiqueta}>Ir a una sección de</Text>
          <Text style={e.hojaNombre}>{ramo.nombre}</Text>
          {secciones.map((s) => {
            const activa = s.id === actual;
            return (
              <Pressable key={s.id} accessibilityRole="button"
                onPress={() => { setSeccion(s.id); setMenuAbierto(false); }}
                style={({ pressed }) => [e.opcion, pressed && { backgroundColor: color.elemento }]}>
                <Text style={[e.opcionTexto, activa && { color: color.marca, fontWeight: "700" }]}>
                  {s.texto}
                </Text>
                {activa ? <Text style={{ color: color.marca }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

function Avatar({ nombre, tono, destacado }: { nombre: string; tono: string; destacado?: boolean }) {
  return (
    <View style={[e.avatar, destacado && { backgroundColor: tono }]}>
      <Text style={[e.avatarTexto, destacado && { color: "#fff" }]}>
        {inicialesDePersona(nombre)}
      </Text>
    </View>
  );
}

function SeccionNotas({ evaluaciones }: { evaluaciones: { id: string; titulo: string; peso: number; nota: number | null }[] }) {
  const { nota, rendido } = notaDelRamo(evaluaciones);
  const proyeccion = proyeccionParaAprobar(evaluaciones);

  const frase =
    proyeccion.tipo === "ya_aprobado"
      ? "Con lo rendido hasta ahora superas el 4,0 pase lo que pase en lo que queda."
      : proyeccion.tipo === "inalcanzable"
        ? `Necesitarías más de un 7,0 en el ${proyeccion.pendiente}% restante. Habla con tu profesor.`
        : proyeccion.tipo === "necesita"
          ? `Necesitas ${formatearNota(proyeccion.nota)} en el ${proyeccion.pendiente}% que falta.`
          : null;

  return (
    <>
      <View style={e.heroNotas}>
        <Text style={tipo.etiqueta}>Nota actual</Text>
        <Text style={[e.notaGrande, nota !== null && nota < 4 && { color: color.vivo }]}>
          {formatearNota(nota)}
        </Text>
        <Text style={tipo.detalle}>
          {rendido === 0 ? "Todavía sin evaluaciones rendidas" : `Con el ${rendido}% del curso evaluado`}
        </Text>
      </View>

      <Encabezado texto="Evaluaciones" />
      {evaluaciones.map((ev) => (
        <Fila key={ev.id} titulo={ev.titulo} detalle={`${ev.peso}% de la nota final`}
          derecha={
            <Text style={[e.notaFila, ev.nota === null
              ? { color: color.textoSuave, fontWeight: "400" }
              : ev.nota < 4 && { color: color.vivo }]}>
              {formatearNota(ev.nota)}
            </Text>
          } />
      ))}

      {frase ? (
        <View style={e.proyeccion}>
          <Text style={e.proyeccionTitulo}>
            {proyeccion.tipo === "ya_aprobado" ? "Ya tienes el ramo aprobado"
              : proyeccion.tipo === "inalcanzable" ? "No alcanza con lo que queda"
                : "Para aprobar con 4,0"}
          </Text>
          <Text style={tipo.detalle}>{frase}</Text>
        </View>
      ) : null}

      <Text style={e.pie}>Escala de 1,0 a 7,0. Se aprueba con 4,0.</Text>
    </>
  );
}


/**
 * Las dos formas de repasar un tema, al pie del tema.
 *
 * Al pie y no arriba: repasar es lo que se hace después de pasar el material,
 * y ofrecerlo antes invita a saltárselo. Son dos y no una porque hacen cosas
 * distintas: el quiz dice cómo vas hoy, las fichas te lo dejan grabado. Pedir
 * cualquiera de las dos tarda —hay que escribirlas— así que el botón dice qué
 * está pasando en vez de quedarse mudo.
 */
function Ponerme({
  modulo, tono, asignaturaId, abrirQuiz, abrirFichas,
}: {
  modulo: { id: string; titulo: string };
  tono: string;
  asignaturaId: string;
  abrirQuiz: (quizId: string) => void;
  abrirFichas: () => void;
}) {
  const [pidiendo, setPidiendo] = useState<"quiz" | "fichas" | null>(null);
  const [falla, setFalla] = useState<string | null>(null);

  const pedir = async (que: "quiz" | "fichas") => {
    setPidiendo(que);
    setFalla(null);
    try {
      const comun = { moduloId: modulo.id, asignaturaId, tema: modulo.titulo };
      if (que === "quiz") abrirQuiz((await generarQuiz(comun)).id);
      else { await generarFichas(comun); abrirFichas(); }
    } catch (err) {
      setFalla(err instanceof globalThis.Error ? err.message : "No pude prepararlo.");
    } finally {
      setPidiendo(null);
    }
  };

  return (
    <View style={e.ponerme}>
      <View style={e.ponermeFila}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={`Ponerme a prueba en ${modulo.titulo}`}
          disabled={pidiendo !== null} onPress={() => void pedir("quiz")}
          style={({ pressed }) => [
            e.ponermeBoton,
            pressed ? { backgroundColor: color.elemento } : null,
            pidiendo !== null ? { opacity: 0.6 } : null,
          ]}>
          <Icono nombre="tutor" tamano={17} tono={tono} />
          <Text style={e.ponermeTexto} numberOfLines={1}>
            {pidiendo === "quiz" ? "Preparando…" : "Ponerme a prueba"}
          </Text>
        </Pressable>

        <Pressable accessibilityRole="button"
          accessibilityLabel={`Fichas de repaso de ${modulo.titulo}`}
          disabled={pidiendo !== null} onPress={() => void pedir("fichas")}
          style={({ pressed }) => [
            e.ponermeBoton,
            pressed ? { backgroundColor: color.elemento } : null,
            pidiendo !== null ? { opacity: 0.6 } : null,
          ]}>
          <Icono nombre="documento" tamano={17} tono={tono} />
          <Text style={e.ponermeTexto} numberOfLines={1}>
            {pidiendo === "fichas" ? "Preparando…" : "Fichas de repaso"}
          </Text>
        </Pressable>
      </View>
      {falla ? <Text style={e.ponermeFalla}>{falla}</Text> : null}
    </View>
  );
}

const e = StyleSheet.create({
  ponerme: { paddingHorizontal: espacio.m, paddingTop: espacio.s, paddingBottom: espacio.l, gap: 6 },
  ponermeFila: { flexDirection: "row", gap: espacio.s },

  avance: {
    alignItems: "center", borderRadius: radio.campo,
    backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: espacio.m, paddingVertical: 8,
  },
  avanceCifra: { color: "#fff", fontSize: 21, fontWeight: "800", letterSpacing: -0.6 },
  avanceEtiqueta: {
    color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700",
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  proxima: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    marginHorizontal: espacio.m, marginTop: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: 8,
    borderRadius: radio.pastilla,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: tenue(color.ambar),
  },
  proximaTexto: { fontSize: 13.5, fontWeight: "600", color: color.texto, flex: 1 },
  ponermeBoton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: espacio.s,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderStyle: "dashed",
    borderRadius: radio.boton, paddingVertical: 11, paddingHorizontal: espacio.s,
  },
  ponermeTexto: { fontSize: 14.5, fontWeight: "600", color: color.texto },
  ponermeFalla: { ...tipo.detalle, color: color.vivo, lineHeight: 19 },
  agregarCaja: { padding: espacio.m, paddingBottom: 0 },
  cabecera: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingVertical: espacio.l,
  },
  selloRamo: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  selloTexto: {
    color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: -0.5,
  },
  codigo: {
    ...cifras,
    color: "#fff", fontSize: 11.5, fontWeight: "700", letterSpacing: 1, opacity: 0.85,
  },
  nombre: { color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  profesor: { color: "#fff", fontSize: 13, opacity: 0.9 },
  // `flexShrink: 0` no es adorno: sin él, cuando la sección de abajo trae
  // una lista larga —la materia de un ramo completo— esta fila se encoge
  // hasta un píxel y las secciones desaparecen de la pantalla.
  fila: {
    flexGrow: 0, flexShrink: 0,
    backgroundColor: color.papel,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  cuerpo: { flex: 1 },
  conBarra: { flexDirection: "row" },
  barraLateral: {
    width: 240, paddingVertical: espacio.m, paddingHorizontal: espacio.s, gap: 2,
    backgroundColor: color.papel,
    borderRightWidth: FILETE, borderRightColor: color.bordeFuerte,
  },
  itemBarra: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingVertical: 13, paddingHorizontal: espacio.m, borderRadius: radio.boton,
  },
  itemBarraTexto: { ...tipo.fila, color: color.textoSuave },
  chip: {
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 9,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.bordeFuerte,
  },
  chipTexto: { fontSize: 14, fontWeight: "600", color: color.textoSuave },
  // La unidad se anuncia, no se encajona: un rótulo sobre el papel pesa
  // menos a la vista que una franja gris y separa igual de bien.
  modulo: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
    gap: espacio.m, paddingHorizontal: espacio.m,
    paddingTop: espacio.l, paddingBottom: espacio.s,
  },
  moduloTitulo: { ...tipo.etiqueta, flex: 1 },
  moduloCuenta: { ...tipo.detalle, ...cifras, color: color.textoTenue },
  enVivo: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    margin: espacio.m, padding: espacio.m,
    borderRadius: radio.tarjeta, borderWidth: FILETE,
    borderColor: velado(color.vivo), backgroundColor: tenue(color.vivo),
  },
  escuchar: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    marginHorizontal: espacio.m, marginBottom: espacio.s,
    padding: espacio.m, borderRadius: radio.tarjeta,
    borderWidth: FILETE, borderColor: color.bordeFuerte,
    backgroundColor: color.destacadoSuave,
  },
  escucharTitulo: { fontSize: 15, fontWeight: "700", color: color.texto },

  puntoVivo: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.vivo },
  vivoEtiqueta: { ...tipo.etiqueta, color: color.vivo },
  vivoTitulo: { ...tipo.fila, marginTop: 2 },
  barraColor: { width: 3, height: 38, borderRadius: 2 },
  prosa: { ...tipo.cuerpo, lineHeight: 24, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
  heroNotas: {
    alignItems: "center", paddingVertical: espacio.xl, gap: espacio.xs,
    backgroundColor: color.papel,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
  },
  notaGrande: { ...cifras, fontSize: 64, fontWeight: "700", color: color.texto, letterSpacing: -2.5 },
  notaFila: { ...cifras, fontSize: 19, fontWeight: "700", color: color.texto },
  proyeccion: {
    margin: espacio.m, padding: espacio.m, borderRadius: radio.tarjeta,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel, gap: espacio.xs,
  },
  proyeccionTitulo: { ...tipo.fila },
  fondoModal: { flex: 1, backgroundColor: "rgba(25,26,31,0.4)" },
  hoja: {
    backgroundColor: color.papel, borderTopLeftRadius: radio.tarjeta, borderTopRightRadius: radio.tarjeta,
    paddingHorizontal: espacio.l, paddingBottom: espacio.xl,
  },
  asa: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: color.bordeFuerte,
    alignSelf: "center", marginVertical: espacio.m,
  },
  hojaNombre: { ...tipo.subtitulo, marginTop: 2, marginBottom: espacio.s },
  opcion: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: espacio.m,
  },
  opcionTexto: { ...tipo.fila },
  avatar: {
    width: 38, height: 38, borderRadius: radio.campo, backgroundColor: color.elemento,
    alignItems: "center", justifyContent: "center",
  },
  avatarTexto: { fontSize: 13, fontWeight: "700", color: color.textoSuave },
  nuevoHilo: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: espacio.s,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.boton,
    backgroundColor: color.papel, paddingVertical: 14,
  },
  nuevoHiloTexto: { ...tipo.fila, color: color.marca },
});
