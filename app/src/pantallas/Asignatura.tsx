import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Cargando, Encabezado, Error, Fila, Pastilla, Vacio,
} from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { color, duracion, espacio, fechaCorta, hora, nombreDia, radio, tenue, tipo } from "../ui/tema.ts";
import {
  clasesDe, companerosDe, crearApunte, evaluacionesDe, foroDe, marcarMaterial,
  materiaDe, miHorario, misApuntes, misAsignaturas, misTareas,
} from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { formatearNota, notaDelRamo, proyeccionParaAprobar } from "../dominio/notas.ts";
import { cuandoVence, estadoDeTarea, ordenarTareas } from "../dominio/tareas.ts";
import { type PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Asignatura">;

/** Solo tres viven en la fila; el resto está tras los tres puntitos. */
const EN_LA_FILA = ["materia", "clases", "tareas"] as const;
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
  const visibles: Seccion[] = EN_LA_FILA.includes(seccion as (typeof EN_LA_FILA)[number])
    ? [...EN_LA_FILA]
    : [seccion, ...EN_LA_FILA];

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={[e.cabecera, { backgroundColor: ramo.color }]}>
        <Text style={e.codigo}>{ramo.codigo}</Text>
        <Text style={e.nombre}>{ramo.nombre}</Text>
        <Text style={e.profesor}>{ramo.profesor}</Text>
      </View>

      {barraDeSecciones ? null : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={e.fila} contentContainerStyle={{ gap: 6, paddingHorizontal: espacio.m, paddingVertical: 11 }}>
        {visibles.map((id) => {
          const s = SECCIONES.find((x) => x.id === id)!;
          const activa = id === seccion;
          return (
            <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: activa }}
              onPress={() => setSeccion(id)} style={[e.chip, activa && { backgroundColor: color.marca }]}>
              <Text style={[e.chipTexto, activa && { color: color.sobreMarca, fontWeight: "600" }]}>
                {s.corto}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      )}

      <View style={barraDeSecciones ? e.conBarra : undefined}>
      {barraDeSecciones ? (
        <View style={e.barraLateral}>
          {SECCIONES.map((sec) => {
            const activa = sec.id === seccion;
            return (
              <Pressable key={sec.id} accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                onPress={() => setSeccion(sec.id)}
                style={({ pressed }) => [
                  e.itemBarra,
                  activa && { backgroundColor: tenue(ramo.color) },
                  pressed && !activa && { backgroundColor: color.elemento },
                ]}>
                <Icono nombre={ICONO_SECCION[sec.id]} tamano={17}
                  tono={activa ? ramo.color : color.textoSuave} />
                <Text style={[e.itemBarraTexto, activa && { color: ramo.color, fontWeight: "700" }]}>
                  {sec.texto}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView style={barraDeSecciones ? { flex: 1 } : undefined}
        contentContainerStyle={{ paddingBottom: espacio.xl }}>
        {seccion === "materia" ? (
          datos.modulos.length === 0 ? <Vacio texto="Todavía no hay material publicado." /> :
          datos.modulos.map((m) => (
            <View key={m.id}>
              <View style={e.modulo}>
                <Text style={e.moduloTitulo}>{m.titulo}</Text>
                <Text style={tipo.detalle}>
                  {m.materiales.filter((x) => x.completado).length}/{m.materiales.length}
                </Text>
              </View>
              {m.materiales.map((mat) => {
                const marcar = async () => {
                  await marcarMaterial(mat.id, !mat.completado).catch(() => {});
                  recargar();
                };
                return (
                  <Fila key={mat.id}
                    izquierda={<Icono
                      nombre={mat.tipo === "video" ? "video" : mat.tipo === "documento" ? "documento" : "ejercicios"}
                      tono={mat.completado ? ramo.color : color.textoSuave} />}
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
                            tono={mat.completado ? ramo.color : color.marca} />
                        </Pressable>
                      ) : mat.completado ? (
                        <Icono nombre="listo" tamano={17} tono={ramo.color} />
                      ) : null
                    }
                    onPress={mat.leible
                      ? () => navigation.navigate("Lectura", { materialId: mat.id })
                      : () => void marcar()}
                  />
                );
              })}
            </View>
          ))
        ) : null}

        {seccion === "clases" ? (
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
            <Encabezado texto="Clases grabadas" />
            {datos.clases.filter((c) => c.estado === "grabada").length === 0
              ? <Vacio texto="Todavía no hay grabaciones de esta asignatura." />
              : datos.clases.filter((c) => c.estado === "grabada").map((c) => (
                  <Fila key={c.id}
                    izquierda={<Icono nombre="video" tono={ramo.color} />}
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

        {seccion === "tareas" ? (
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

        {seccion === "foro" ? (
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

        {seccion === "notas" ? <SeccionNotas evaluaciones={datos.evaluaciones} /> : null}

        {seccion === "horario" ? (
          datos.horario.map((b) => (
            <Fila key={b.id}
              izquierda={<View style={[e.barraColor, { backgroundColor: ramo.color }]} />}
              titulo={b.tipo}
              detalle={`${nombreDia(b.dia)} · ${hora(b.hora_inicio)}–${hora(b.hora_fin)} · ${b.sala}`}
            />
          ))
        ) : null}

        {seccion === "programa" ? (
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

        {seccion === "apuntes" ? (
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
                    izquierda={<Icono nombre="documento" tono={ramo.color} />}
                    titulo={a.titulo}
                    detalle={a.contenido.trim()
                      ? `${a.contenido.trim().slice(0, 60)}…`
                      : "Sin escribir todavía"}
                    onPress={() => navigation.navigate("Apunte", { apunteId: a.id })}
                  />
                ))}
          </>
        ) : null}

        {seccion === "companeros" ? (
          <>
            <Encabezado texto="Equipo docente" />
            <Fila izquierda={<Avatar nombre={ramo.profesor} destacado tono={ramo.color} />}
              titulo={ramo.profesor} detalle="Profesor o profesora del curso" />
            {ramo.ayudante ? (
              <Fila izquierda={<Avatar nombre={ramo.ayudante} destacado tono={ramo.color} />}
                titulo={ramo.ayudante} detalle="Ayudantía" />
            ) : null}
            <Encabezado texto={`Inscritos · ${datos.companeros.length}`} />
            {datos.companeros.map((c) => (
              <Fila key={c.id} izquierda={<Avatar nombre={c.nombre} tono={ramo.color} />}
                titulo={c.nombre} detalle="Estudiante" />
            ))}
            <Text style={e.pie}>
              Solo se muestran los nombres de quienes comparten esta asignatura
              contigo. Los correos no salen de la base de datos.
            </Text>
          </>
        ) : null}

        {seccion === "archivos" ? (
          (() => {
            const docs = datos.modulos.flatMap((m) =>
              m.materiales.filter((x) => x.tipo === "documento").map((x) => ({ ...x, modulo: m.titulo })));
            return docs.length === 0
              ? <Vacio texto="No hay documentos en esta asignatura." />
              : docs.map((d) => (
                  <Fila key={d.id} izquierda={<Icono nombre="documento" tono={ramo.color} />}
                    titulo={d.titulo} detalle={`${d.modulo} · ${d.detalle}`}
                    derecha={<Icono nombre="descargar" tamano={17} tono={ramo.color} />} />
                ));
          })()
        ) : null}
      </ScrollView>
      </View>

      <Modal visible={menuAbierto} transparent animationType="slide"
        onRequestClose={() => setMenuAbierto(false)}>
        <Pressable style={e.fondoModal} onPress={() => setMenuAbierto(false)} accessibilityLabel="Cerrar" />
        <View style={e.hoja}>
          <View style={e.asa} />
          <Text style={tipo.etiqueta}>Ir a una sección de</Text>
          <Text style={e.hojaNombre}>{ramo.nombre}</Text>
          {SECCIONES.map((s) => {
            const activa = s.id === seccion;
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
  const partes = nombre.replace(/\./g, "").split(" ").filter(Boolean);
  const iniciales = `${partes[0]?.[0] ?? ""}${partes[1]?.[0] ?? ""}`.toUpperCase();
  return (
    <View style={[e.avatar, destacado && { backgroundColor: tono }]}>
      <Text style={[e.avatarTexto, destacado && { color: "#fff" }]}>{iniciales}</Text>
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

const e = StyleSheet.create({
  cabecera: { padding: espacio.m, paddingBottom: espacio.m },
  codigo: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.6, opacity: 0.85 },
  nombre: { color: "#fff", fontSize: 20, fontWeight: "600", marginTop: 2 },
  profesor: { color: "#fff", fontSize: 12.5, opacity: 0.88, marginTop: 2 },
  fila: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde },
  conBarra: { flex: 1, flexDirection: "row" },
  barraLateral: {
    width: 232, paddingVertical: espacio.s, paddingHorizontal: espacio.s, gap: 2,
    borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.borde,
  },
  itemBarra: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: radio.boton,
  },
  itemBarraTexto: { fontSize: 14, fontWeight: "600", color: color.textoSuave },
  chip: { borderRadius: radio.pastilla, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: color.elemento },
  chipTexto: { fontSize: 12.5, color: color.textoSuave },
  modulo: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: color.elemento, paddingHorizontal: espacio.m, paddingVertical: 11,
  },
  moduloTitulo: { fontSize: 13, fontWeight: "600", color: color.texto },
  enVivo: {
    flexDirection: "row", alignItems: "center", gap: 11, margin: espacio.m, padding: 13,
    borderRadius: radio.tarjeta, borderWidth: 1,
    borderColor: "rgba(217,59,59,0.28)", backgroundColor: "rgba(217,59,59,0.06)",
  },
  puntoVivo: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.vivo },
  vivoEtiqueta: { fontSize: 11, fontWeight: "700", color: color.vivo, letterSpacing: 0.6 },
  vivoTitulo: { fontSize: 14, fontWeight: "600", color: color.texto, marginTop: 1 },
  barraColor: { width: 3, height: 34, borderRadius: 2 },
  prosa: { ...tipo.cuerpo, color: color.texto, lineHeight: 22, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
  heroNotas: {
    alignItems: "center", paddingVertical: espacio.l, gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  notaGrande: { fontSize: 44, fontWeight: "600", color: color.texto, letterSpacing: -1 },
  notaFila: { fontSize: 17, fontWeight: "600", color: color.texto },
  proyeccion: {
    margin: espacio.m, padding: 13, borderRadius: radio.tarjeta,
    borderWidth: 1, borderColor: color.borde, backgroundColor: color.elemento,
  },
  proyeccionTitulo: { fontSize: 12.5, fontWeight: "600", color: color.texto, marginBottom: 4 },
  fondoModal: { flex: 1, backgroundColor: "rgba(14,23,38,0.45)" },
  hoja: {
    backgroundColor: color.fondo, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: espacio.l, paddingBottom: espacio.xl,
  },
  asa: { width: 38, height: 4, borderRadius: 2, backgroundColor: color.borde, alignSelf: "center", marginVertical: 9 },
  hojaNombre: { fontSize: 17, fontWeight: "600", color: color.texto, marginTop: 2, marginBottom: espacio.s },
  opcion: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12,
  },
  opcionTexto: { fontSize: 14.5, fontWeight: "600", color: color.texto },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: color.elemento,
    alignItems: "center", justifyContent: "center",
  },
  avatarTexto: { fontSize: 11.5, fontWeight: "700", color: color.textoSuave },
  nuevoHilo: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton, paddingVertical: 12,
  },
  nuevoHiloTexto: { fontSize: 14, fontWeight: "600", color: color.marca },
});
