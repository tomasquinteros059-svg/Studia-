import { useCallback, useEffect, useState } from "react";
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Boton, Cargando, Encabezado, Error as ErrorUI, Fila, Vacio } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import {
  FILETE, cifras, color, colorDeRamo, espacio, fechaCorta, radio, tenue, tipo,
} from "../../ui/tema.ts";
import {
  clasesDe, corregir, crearEvaluacion, cursoDe, entregasDeVarias, evaluacionesDe,
  materiaDe, misAsignaturas,
  misTareas, notasDeVarias, permitirEscucha, ponerNota, publicarNotas,
} from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { usarDisposicion } from "../../lib/pantalla.ts";
import { usarQuienSoy } from "../../lib/quien-soy.ts";
import {
  agrupadasPor, aprobacion, distribucion, estadoDeTarea, porRevisar, promedioDelCurso, puedePublicarNotas, sinPublicar, type EntregaDeCurso, type NotaDeCurso,
} from "../../dominio/curso.ts";
import { formatearNota } from "../../dominio/notas.ts";
import PlanMensual from "./PlanMensual.tsx";
import NuevoMaterial, { type MaterialArmado } from "../propio/NuevoMaterial.tsx";
import {
  armarRegistro, cabe, comoVaElRegistro, pesoLibre,
} from "../../dominio/registro.ts";
import type { PropsPilaDocente } from "../../lib/rutas.ts";
import { crearMaterial, moduloParaMaterial } from "../../lib/consultas.ts";
import * as WebBrowser from "expo-web-browser";
import { direccionFirmada } from "../../lib/archivos.ts";

const SECCIONES = ["Tareas", "Notas", "Registro", "Plan", "Material", "Curso"] as const;
type Seccion = (typeof SECCIONES)[number];

export default function RamoDocente({ route, navigation }: PropsPilaDocente<"RamoDocente">) {
  const { asignaturaId } = route.params;
  const { yo } = usarQuienSoy();
  const { dosPaneles } = usarDisposicion();
  const [seccion, setSeccion] = useState<Seccion>("Tareas");
  const [cambiandoPermiso, setCambiandoPermiso] = useState(false);
  const papel = yo?.papel ?? "ayudante";

  const traer = useCallback(async () => {
    const curso = await cursoDe(asignaturaId);
    const [asignaturas, tareas, evaluaciones, modulos, clases] = await Promise.all([
      misAsignaturas(), misTareas(asignaturaId), evaluacionesDe(asignaturaId),
      materiaDe(asignaturaId), clasesDe(asignaturaId),
    ]);
    // Dos consultas para todo el ramo. De a una, cada tarea y cada evaluación
    // sumaba un viaje al servidor, y eso crece solo durante el semestre.
    const [entregas, notas] = await Promise.all([
      entregasDeVarias(tareas.map((t) => t.id), curso),
      notasDeVarias(evaluaciones.map((ev) => ev.id), curso),
    ]);
    const porTarea = agrupadasPor(entregas, (e) => e.tarea_id, tareas.map((t) => t.id));
    const porEvaluacion = agrupadasPor(notas, (n) => n.evaluacion_id, evaluaciones.map((e) => e.id));

    const conEntregas = tareas.map((tarea) => ({ tarea, entregas: porTarea.get(tarea.id) ?? [] }));
    const conNotas = evaluaciones.map((ev) => ({ ev, filas: porEvaluacion.get(ev.id) ?? [] }));
    return {
      ramo: asignaturas.find((a) => a.id === asignaturaId) ?? null,
      curso, modulos, clases, tareas: conEntregas, evaluaciones: conNotas,
    };
  }, [asignaturaId]);

  const { datos, cargando, error, recargar } = usarCarga(traer, [asignaturaId]);
  const [agregando, setAgregando] = useState(false);

  const [corrigiendo, setCorrigiendo] = useState<{ tareaId: string; entrega: EntregaDeCurso; max: number } | null>(null);
  const [editandoNota, setEditandoNota] = useState<{ evaluacionId: string; fila: NotaDeCurso } | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: datos?.ramo?.nombre ?? "Curso" });
  }, [navigation, datos?.ramo?.nombre]);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos?.ramo) return <ErrorUI mensaje="No encontré ese ramo." />;

  const ramo = datos.ramo;
  const tono = colorDeRamo(ramo.id, ramo.color);
  const inscritos = datos.curso.length;

  // La clase que está ocurriendo en la sala. Solo las presenciales: una clase
  // por pantalla ya lleva su audio por la aplicación y no hay nada que oír
  // desde el aire.
  const enSala = datos.clases.find((c) => c.estado === "en_vivo" && c.presencial) ?? null;

  const permitir = async (permitida: boolean) => {
    setCambiandoPermiso(true);
    try {
      await permitirEscucha(enSala!.id, permitida);
      await recargar();
    } catch (falla) {
      Alert.alert("No pude cambiarlo",
        falla instanceof globalThis.Error ? falla.message : "Inténtalo de nuevo.");
    } finally {
      setCambiandoPermiso(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      {enSala ? (
        <View style={e.grabar}>
          <View style={e.grabarCabeza}>
            <Icono nombre="microfono" tamano={19} tono={color.texto} />
            <Text style={e.grabarTitulo} numberOfLines={1}>{enSala.titulo}</Text>
          </View>

          {enSala.escucha_permitida ? (
            <>
              <Text style={e.grabarTexto}>
                El curso puede oír esta clase. Cada teléfono la escribe en el
                propio aparato y de todas esas versiones sale una sola clase.
              </Text>
              <Boton texto="Entrar a la grabación"
                onPress={() => navigation.navigate("Escucha", {
                  claseId: enSala.id, titulo: enSala.titulo, asignaturaId: ramo.id,
                })} />
              <Pressable accessibilityRole="button" disabled={cambiandoPermiso}
                onPress={() => void permitir(false)} style={e.dejar}>
                <Text style={e.dejarTexto}>Dejar de permitirlo</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/*
                Permitir y grabar son dos cosas y conviene que se lean como dos.
                Quien dicta decide si la clase puede quedar escrita —es su voz
                la que más se oye— y recién después alguien la oye. Un solo
                botón que hiciera las dos escondería la decisión que importa.
              */}
              <Text style={e.grabarTexto}>
                Nadie del curso puede grabar esta clase mientras tú no lo
                permitas. Tu voz es la que más se oye acá.
              </Text>
              <Boton
                texto={cambiandoPermiso ? "Un momento…" : "Permitir y empezar a grabar"}
                deshabilitado={cambiandoPermiso}
                onPress={() => {
                  void permitir(true).then(() => navigation.navigate("Escucha", {
                    claseId: enSala.id, titulo: enSala.titulo, asignaturaId: ramo.id,
                  }));
                }} />
            </>
          )}
        </View>
      ) : null}

      <View style={e.pestanas}>
        {SECCIONES.map((s) => (
          <Pressable key={s} accessibilityRole="button"
            accessibilityState={{ selected: seccion === s }}
            onPress={() => setSeccion(s)}
            style={[e.pestana, seccion === s ? { borderBottomColor: tono } : null]}>
            <Text style={[e.pestanaTexto, seccion === s ? { color: color.texto } : null]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: espacio.xl }}>

        {seccion === "Tareas" ? (
          datos.tareas.length === 0 ? <Vacio texto="Todavía no publicas tareas en este ramo." /> :
          datos.tareas.map(({ tarea, entregas }) => {
            const est = estadoDeTarea(entregas, inscritos);
            const pendientes = porRevisar(entregas);
            return (
              <View key={tarea.id} style={e.tarea}>
                <View style={e.tareaCabecera}>
                  <Text style={e.tareaTitulo}>{tarea.titulo}</Text>
                  <Text style={tipo.detalle}>{tarea.puntos} pts</Text>
                </View>
                <Text style={tipo.detalle}>
                  {est.entregadas} de {est.inscritos} entregaron · {est.corregidas} corregidas
                  {est.sinEntregar > 0 ? ` · faltan ${est.sinEntregar}` : ""}
                </Text>
                <Barra hecho={est.corregidas} total={est.inscritos} tono={tono} />

                {pendientes.length === 0 ? (
                  <Text style={[e.aviso, { color: color.ok }]}>Todo corregido.</Text>
                ) : (
                  pendientes.map((en) => (
                    <Fila key={en.id}
                      izquierda={<Icono nombre="documento" tono={color.ambar} />}
                      titulo={en.estudiante}
                      detalle={en.entregado_en ? `Entregó el ${fechaCorta(en.entregado_en)}` : ""}
                      derecha={<Text style={e.corregir}>Corregir</Text>}
                      onPress={() => setCorrigiendo({ tareaId: tarea.id, entrega: en, max: tarea.puntos })}
                    />
                  ))
                )}
              </View>
            );
          })
        ) : null}

        {seccion === "Notas" ? (
          datos.evaluaciones.map(({ ev, filas }) => {
            const promedio = promedioDelCurso(filas);
            const { aprobados, conNota } = aprobacion(filas);
            const faltanPublicar = sinPublicar(filas);
            return (
              <View key={ev.id} style={e.tarea}>
                <View style={e.tareaCabecera}>
                  <Text style={e.tareaTitulo}>{ev.titulo}</Text>
                  <Text style={tipo.detalle}>{ev.peso}%</Text>
                </View>

                {conNota === 0 ? (
                  <Text style={tipo.detalle}>Todavía sin notas puestas.</Text>
                ) : (
                  <>
                    <Text style={tipo.detalle}>
                      Promedio {formatearNota(promedio)} · aprueban {aprobados} de {conNota}
                    </Text>
                    <Histograma filas={filas} tono={tono} />
                  </>
                )}

                {faltanPublicar > 0 ? (
                  <View style={e.publicar}>
                    <Text style={e.publicarTexto}>
                      {faltanPublicar} {faltanPublicar === 1 ? "nota puesta que el curso" : "notas puestas que el curso"} todavía no ve.
                    </Text>
                    {puedePublicarNotas(papel) ? (
                      <Boton texto="Publicar al curso" onPress={() => {
                        Alert.alert(
                          "Publicar notas",
                          `El curso va a ver ${faltanPublicar} ${faltanPublicar === 1 ? "nota" : "notas"} de ${ev.titulo}. Esto no se puede deshacer desde acá.`,
                          [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Publicar", onPress: () => { void publicarNotas(ev.id).then(recargar); } },
                          ],
                        );
                      }} />
                    ) : (
                      <Text style={e.soloProfesor}>
                        Publicar notas es del profesor. Tú puedes corregir y ponerlas.
                      </Text>
                    )}
                  </View>
                ) : null}

                {filas.map((f) => (
                  <Fila key={f.estudiante_id}
                    izquierda={<Icono nombre="persona" tono={f.nota === null ? color.textoSuave : tono} />}
                    titulo={f.estudiante}
                    detalle={f.nota === null ? "Sin nota" : f.publicada ? "Publicada" : "Sin publicar"}
                    derecha={<Text style={[e.nota, f.nota !== null && f.nota < 4 ? { color: color.vivo } : null]}>
                      {formatearNota(f.nota)}
                    </Text>}
                    onPress={() => setEditandoNota({ evaluacionId: ev.id, fila: f })}
                  />
                ))}
              </View>
            );
          })
        ) : null}

        {seccion === "Registro" ? (
          <Registro
            curso={datos.curso}
            evaluaciones={datos.evaluaciones.map(({ ev }) => ev)}
            notas={datos.evaluaciones.flatMap(({ filas }) => filas)}
            tono={tono}
            puedePublicar={puedePublicarNotas(papel)}
            asignaturaId={ramo.id}
            recargar={recargar}
            editarNota={(evaluacionId, fila) => setEditandoNota({ evaluacionId, fila })}
          />
        ) : null}

        {seccion === "Plan" ? (
          <PlanMensual
            asignaturaId={ramo.id}
            ramo={ramo.nombre}
            alConsultar={(pregunta) => navigation.navigate("PrincipalDocente", {
              screen: "Asistente", params: { pregunta },
            })}
          />
        ) : null}

        {seccion === "Material" ? (
          <>
            {datos.modulos.map((m) => (
              <View key={m.id}>
                <Encabezado texto={m.titulo} />
                {m.materiales.map((mat) => (
                  <Fila key={mat.id}
                    izquierda={<Icono nombre={mat.tipo === "video" ? "video" : mat.tipo === "documento" ? "documento" : "ejercicios"}
                      tono={tono} />}
                    titulo={mat.titulo}
                    detalle={mat.detalle + (mat.leible ? " · se puede escuchar" : "")}
                  />
                ))}
              </View>
            ))}
            <View style={{ padding: espacio.m }}>
              <Boton texto="Agregar material" onPress={() => setAgregando(true)} />
            </View>
            <Text style={e.pieMaterial}>
              Lo que subas acá lo ve tu curso. Para cargar un ramo entero de una
              vez sigue estando la planilla, en la carpeta
              <Text style={e.mono}> datos/</Text>.
            </Text>
          </>
        ) : null}

        {seccion === "Curso" ? (
          <>
            <Encabezado texto={`${inscritos} inscritos`} />
            {datos.curso.map((a) => (
              <Fila key={a.id}
                izquierda={<Icono nombre="persona" tono={tono} />}
                titulo={a.nombre}
              />
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* El mismo modal que usa el espacio propio. Lo que cambia son dos
          cosas: acá el archivo va a la carpeta del ramo —lo tiene que poder
          abrir el curso entero, no solo quien lo subió— y se puede elegir en
          qué unidad del programa queda. */}
      <NuevoMaterial
        abierto={agregando}
        cerrar={() => setAgregando(false)}
        unidades={datos.modulos.map((m) => ({ id: m.id, titulo: m.titulo }))}
        dondeGuardar={{ tipo: "ramo", asignaturaId }}
        guardar={async ({ moduloId, ...resto }: MaterialArmado) => {
          await crearMaterial({
            ...resto,
            moduloId: moduloId ?? await moduloParaMaterial(asignaturaId),
          });
          recargar();
        }}
      />

      <Corregir
        abierto={corrigiendo}
        cerrar={() => setCorrigiendo(null)}
        guardar={async (puntos) => {
          if (!corrigiendo) return;
          await corregir(corrigiendo.tareaId, corrigiendo.entrega.id, puntos);
          setCorrigiendo(null);
          recargar();
        }}
      />

      <EditarNota
        abierto={editandoNota}
        cerrar={() => setEditandoNota(null)}
        guardar={async (valor) => {
          if (!editandoNota) return;
          await ponerNota(editandoNota.evaluacionId, editandoNota.fila.estudiante_id, valor);
          setEditandoNota(null);
          recargar();
        }}
      />
    </View>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────

function Barra({ hecho, total, tono }: { hecho: number; total: number; tono: string }) {
  const parte = total === 0 ? 0 : Math.min(1, hecho / total);
  return (
    <View style={e.riel}>
      <View style={[e.avance, { width: `${parte * 100}%`, backgroundColor: tono }]} />
    </View>
  );
}

function Histograma({ filas, tono }: { filas: NotaDeCurso[]; tono: string }) {
  const tramos = distribucion(filas);
  const maximo = Math.max(1, ...tramos.map((t) => t.cuantos));
  return (
    <View style={e.histograma}>
      {tramos.map((t) => (
        <View key={t.desde} style={e.columna}>
          <View style={e.columnaFondo}>
            <View style={[e.columnaBarra, {
              height: `${(t.cuantos / maximo) * 100}%`,
              backgroundColor: t.desde < 4 ? color.vivo : tono,
            }]} />
          </View>
          <Text style={e.columnaTexto}>{t.desde.toFixed(0)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Abre lo que entregó un alumno, con una dirección firmada que vence. */
async function abrirEntrega(ruta: string | null) {
  const donde = await direccionFirmada(ruta);
  if (!donde) {
    Alert.alert("No pude abrirlo", "El archivo ya no está disponible.");
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(donde);
  } catch {
    Alert.alert("No pude abrirlo", "Tu teléfono no encontró con qué abrirlo.");
  }
}

function Corregir({
  abierto, cerrar, guardar,
}: {
  abierto: { tareaId: string; entrega: EntregaDeCurso; max: number } | null;
  cerrar: () => void;
  guardar: (puntos: number | null) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  useEffect(() => { setTexto(abierto?.entrega.puntos_obtenidos?.toString() ?? ""); }, [abierto]);
  if (!abierto) return null;

  const valor = texto.trim() === "" ? null : Number(texto.replace(",", "."));
  const valido = valor === null || (Number.isFinite(valor) && valor >= 0 && valor <= abierto.max);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cerrar}>
      <Pressable style={e.velo} onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
      <View style={e.hoja}>
        <Text style={tipo.etiqueta}>Corregir entrega</Text>
        <Text style={e.hojaTitulo}>{abierto.entrega.estudiante}</Text>
        <Text style={tipo.detalle}>
          {abierto.entrega.entregado_en ? `Entregó el ${fechaCorta(abierto.entrega.entregado_en)}` : ""}
        </Text>

        {/* Corregir sin poder leer lo que se entregó es poner un número a
            ciegas. Lo que se abre es una dirección firmada que vence: el
            archivo no queda accesible a quien tenga el enlace. */}
        {abierto.entrega.archivo ? (
          <Pressable accessibilityRole="button" style={e.verEntrega}
            accessibilityLabel={`Ver lo que entregó ${abierto.entrega.estudiante}`}
            onPress={() => void abrirEntrega(abierto.entrega.archivo)}>
            <Icono nombre="documento" tamano={18} tono={color.marca} />
            <Text style={e.verEntregaTexto}>Ver lo que entregó</Text>
          </Pressable>
        ) : (
          <Text style={tipo.detalle}>Entregó sin adjuntar ningún archivo.</Text>
        )}

        <View style={e.campoFila}>
          <TextInput
            style={e.campoPuntaje}
            value={texto}
            onChangeText={setTexto}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#9AA0A6"
            accessibilityLabel="Puntaje"
            autoFocus
          />
          <Text style={e.deCuanto}>de {abierto.max}</Text>
        </View>

        {!valido ? (
          <Text style={e.malo}>El puntaje va entre 0 y {abierto.max}.</Text>
        ) : (
          <Text style={tipo.detalle}>
            Dejar vacío lo devuelve a la lista de por revisar.
          </Text>
        )}

        <Boton texto="Guardar" deshabilitado={!valido}
          onPress={() => { void guardar(valor); }} />
      </View>
    </Modal>
  );
}

function EditarNota({
  abierto, cerrar, guardar,
}: {
  abierto: { evaluacionId: string; fila: NotaDeCurso } | null;
  cerrar: () => void;
  guardar: (nota: number | null) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  useEffect(() => { setTexto(abierto?.fila.nota?.toString() ?? ""); }, [abierto]);
  if (!abierto) return null;

  const valor = texto.trim() === "" ? null : Number(texto.replace(",", "."));
  const valido = valor === null || (Number.isFinite(valor) && valor >= 1 && valor <= 7);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cerrar}>
      <Pressable style={e.velo} onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
      <View style={e.hoja}>
        <Text style={tipo.etiqueta}>Poner nota</Text>
        <Text style={e.hojaTitulo}>{abierto.fila.estudiante}</Text>
        <Text style={tipo.detalle}>
          {abierto.fila.publicada
            ? "Esta nota ya la vio el curso: cambiarla se nota."
            : "El curso todavía no ve esta nota."}
        </Text>

        <View style={e.campoFila}>
          <TextInput
            style={e.campoPuntaje}
            value={texto}
            onChangeText={setTexto}
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor="#9AA0A6"
            accessibilityLabel="Nota"
            autoFocus
          />
          <Text style={e.deCuanto}>de 1,0 a 7,0</Text>
        </View>

        {!valido ? <Text style={e.malo}>La nota va entre 1,0 y 7,0.</Text> : null}

        <Boton texto="Guardar" deshabilitado={!valido}
          onPress={() => { void guardar(valor); }} />
      </View>
    </Modal>
  );
}

// ── El registro ───────────────────────────────────────────────────────────

/**
 * La tabla completa: cada alumno con sus notas y cómo va ponderado.
 *
 * Es lo que un profesor mira en su libro antes de subir nada. La sección
 * «Notas» muestra una evaluación a la vez, y ahí se ve cómo estuvo la prueba;
 * acá se ve quién viene arrastrando un problema desde marzo, que es otra
 * pregunta y la que se contesta antes de publicar.
 *
 * Se desliza a lo ancho porque tiene que: con seis evaluaciones no cabe en un
 * teléfono, y achicar la letra hasta que quepa haría ilegible justo lo que se
 * viene a leer.
 */
function Registro({
  curso, evaluaciones, notas, tono, puedePublicar, asignaturaId, recargar, editarNota,
}: {
  curso: { id: string; nombre: string }[];
  evaluaciones: { id: string; titulo: string; peso: number; orden: number }[];
  notas: NotaDeCurso[];
  tono: string;
  puedePublicar: boolean;
  asignaturaId: string;
  recargar: () => Promise<void> | void;
  editarNota: (evaluacionId: string, fila: NotaDeCurso) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [peso, setPeso] = useState("");
  const [guardando, setGuardando] = useState(false);

  const evs = [...evaluaciones].sort((a, b) => a.orden - b.orden);
  const enTabla = armarRegistro(curso, evs, notas as never);
  const libre = pesoLibre(evs);

  const crear = async () => {
    const cuanto = Number(peso.replace(",", "."));
    if (!titulo.trim()) { Alert.alert("Ponle un nombre", "Por ejemplo, «Control 3»."); return; }
    if (!cabe(evs, cuanto)) {
      Alert.alert("Esa ponderación no cabe",
        libre === 0
          ? "El semestre ya está repartido al 100%."
          : `Queda ${libre}% por repartir.`);
      return;
    }
    setGuardando(true);
    try {
      await crearEvaluacion(asignaturaId, titulo.trim(), cuanto);
      setTitulo(""); setPeso(""); setCreando(false);
      await recargar();
    } catch (falla) {
      Alert.alert("No pude crearla",
        falla instanceof globalThis.Error ? falla.message : "Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={e.registro}>
      <Text style={e.registroEstado}>{comoVaElRegistro(evs, enTabla)}</Text>

      {evs.length === 0 ? (
        <Vacio texto="Crea la primera evaluación para empezar el registro." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator
          contentContainerStyle={e.tabla}>
          <View>
            <View style={[e.filaTabla, e.cabeceraTabla]}>
              <Text style={[e.celdaNombre, e.celdaCabecera]}>Alumno</Text>
              {evs.map((ev) => (
                <View key={ev.id} style={e.celda}>
                  <Text style={e.celdaCabecera} numberOfLines={1}>{ev.titulo}</Text>
                  <Text style={e.celdaPeso}>{ev.peso}%</Text>
                </View>
              ))}
              <View style={e.celda}>
                <Text style={e.celdaCabecera}>Va con</Text>
                <Text style={e.celdaPeso}>ponderado</Text>
              </View>
            </View>

            {enTabla.map((f) => (
              <View key={f.estudiante_id} style={e.filaTabla}>
                <Text style={e.celdaNombre} numberOfLines={1}>{f.estudiante}</Text>
                {evs.map((ev, i) => {
                  const puesta = notas.find(
                    (n) => n.evaluacion_id === ev.id && n.estudiante_id === f.estudiante_id);
                  const valor = f.notas[i] ?? null;
                  return (
                    <Pressable key={ev.id} accessibilityRole="button"
                      accessibilityLabel={`${f.estudiante}, ${ev.titulo}`}
                      onPress={() => puesta && editarNota(ev.id, puesta)}
                      style={({ pressed }) => [e.celda, pressed ? { backgroundColor: color.elemento } : null]}>
                      <Text style={[
                        e.celdaNota,
                        valor !== null && valor < 4 ? { color: color.vivo } : null,
                      ]}>{formatearNota(valor)}</Text>
                      {puesta && puesta.nota !== null && !puesta.publicada ? (
                        <Text style={e.sinVer}>sin ver</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                <View style={e.celda}>
                  <Text style={[
                    e.celdaNota, { fontWeight: "800", color: tono },
                    f.hastaAhora !== null && f.hastaAhora < 4 ? { color: color.vivo } : null,
                  ]}>{formatearNota(f.hastaAhora)}</Text>
                  <Text style={e.celdaPeso}>{f.cubierto}%</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {evs.length > 0 ? (
        <Text style={e.registroPie}>
          «Va con» es el promedio ponderado de lo que ya rindió, no del semestre
          completo: lo que todavía no se hace no cuenta como cero. Toca una nota
          para ajustarla antes de publicarla.
        </Text>
      ) : null}

      {!puedePublicar ? (
        <Text style={e.soloProfesor}>
          Puedes poner y ajustar notas. Publicarlas al curso es del profesor.
        </Text>
      ) : null}

      {creando ? (
        <View style={e.nuevaEv}>
          <Text style={tipo.etiqueta}>Nueva evaluación</Text>
          <TextInput style={e.campo} value={titulo} onChangeText={setTitulo}
            placeholder="Control 3" placeholderTextColor={color.textoTenue}
            accessibilityLabel="Nombre de la evaluación" />
          <TextInput style={e.campo} value={peso} onChangeText={setPeso}
            placeholder={`Ponderación — queda ${libre}%`} placeholderTextColor={color.textoTenue}
            keyboardType="numeric" accessibilityLabel="Ponderación" />
          <View style={e.nuevaEvBotones}>
            <Pressable accessibilityRole="button" onPress={() => setCreando(false)}
              style={e.dejar}>
              <Text style={e.dejarTexto}>Cancelar</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Boton texto={guardando ? "Creando…" : "Crear"} deshabilitado={guardando}
                onPress={() => void crear()} />
            </View>
          </View>
        </View>
      ) : libre > 0 ? (
        <View style={{ padding: espacio.m }}>
          <Boton texto="Crear una evaluación" variante="suave"
            onPress={() => setCreando(true)} />
        </View>
      ) : null}
    </View>
  );
}


const e = StyleSheet.create({
  registro: { gap: espacio.s },
  registroEstado: { ...tipo.detalle, paddingHorizontal: espacio.m, paddingTop: espacio.m },
  registroPie: {
    ...tipo.detalle, lineHeight: 19, paddingHorizontal: espacio.m, paddingTop: espacio.s,
  },
  tabla: { paddingHorizontal: espacio.m, paddingVertical: espacio.s },
  filaTabla: {
    flexDirection: "row", alignItems: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  cabeceraTabla: { borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte },
  celdaNombre: {
    width: 132, paddingVertical: 10, paddingRight: espacio.s,
    ...tipo.fila, fontSize: 14, alignSelf: "center",
  },
  celda: { width: 76, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  celdaCabecera: { fontSize: 12.5, fontWeight: "700", color: color.texto, textAlign: "center" },
  celdaPeso: { fontSize: 11, color: color.textoTenue },
  celdaNota: { ...cifras, fontSize: 15.5, fontWeight: "700", color: color.texto },
  sinVer: { fontSize: 10, color: color.ambar },

  nuevaEv: {
    margin: espacio.m, padding: espacio.m, gap: espacio.s,
    borderRadius: radio.tarjeta, borderWidth: FILETE, borderColor: color.bordeFuerte,
    backgroundColor: color.papel,
  },
  nuevaEvBotones: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  campo: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.campo,
    paddingHorizontal: espacio.m, paddingVertical: 10, fontSize: 15, color: color.texto,
    backgroundColor: color.papel,
  },

  grabar: {
    margin: espacio.m, marginBottom: 0, padding: espacio.m, gap: espacio.s,
    borderRadius: radio.tarjeta, borderWidth: FILETE, borderColor: color.bordeFuerte,
    backgroundColor: color.destacadoSuave,
  },
  grabarCabeza: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  grabarTitulo: { ...tipo.subtitulo, flex: 1, fontSize: 16 },
  grabarTexto: { ...tipo.detalle, lineHeight: 20 },
  dejar: { alignSelf: "center", paddingVertical: espacio.s },
  dejarTexto: { fontSize: 13.5, fontWeight: "600", color: color.anotacion },

  pestanas: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  pestana: {
    flex: 1, paddingVertical: 12, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  pestanaTexto: { fontSize: 13.5, fontWeight: "600", color: color.textoSuave },

  tarea: {
    paddingHorizontal: espacio.l, paddingTop: espacio.l, paddingBottom: espacio.s,
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  tareaCabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.s },
  tareaTitulo: { flex: 1, fontSize: 16, fontWeight: "600", color: color.texto },
  aviso: { fontSize: 13, fontWeight: "600", paddingVertical: 6 },
  corregir: { fontSize: 13, fontWeight: "700", color: color.marca },
  verEntrega: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.boton,
    paddingVertical: 12, paddingHorizontal: espacio.m, marginTop: espacio.s,
  },
  verEntregaTexto: { fontSize: 15, fontWeight: "600", color: color.marca },

  riel: { height: 5, borderRadius: 3, backgroundColor: color.elemento, marginVertical: 5, overflow: "hidden" },
  avance: { height: 5, borderRadius: 3 },

  // Acotado: estirado a lo ancho de una tablet deja de leerse como
  // distribución y parece una fila de bloques.
  histograma: { flexDirection: "row", gap: 5, height: 84, alignItems: "flex-end", marginTop: espacio.s, maxWidth: 380 },
  columna: { flex: 1, gap: 3, alignItems: "center" },
  columnaFondo: { width: "100%", height: 66, justifyContent: "flex-end", backgroundColor: color.elemento, borderRadius: 4, overflow: "hidden" },
  columnaBarra: { width: "100%", borderRadius: 4 },
  columnaTexto: { ...tipo.detalle, fontSize: 10 },

  publicar: {
    backgroundColor: tenue(color.marca), borderRadius: radio.tarjeta,
    padding: espacio.m, gap: espacio.s, marginTop: espacio.s,
  },
  publicarTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 19 },
  soloProfesor: { ...tipo.detalle, lineHeight: 17 },

  nota: { fontSize: 15, fontWeight: "700", color: color.texto, fontVariant: ["tabular-nums"] },

  pieMaterial: {
    ...tipo.detalle, lineHeight: 18, margin: espacio.l,
    padding: espacio.m, backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
  mono: { fontWeight: "700", color: color.texto },

  velo: { flex: 1, backgroundColor: "rgba(11,18,32,0.35)" },
  hoja: {
    backgroundColor: color.fondo, padding: espacio.l, gap: espacio.s,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  hojaTitulo: { fontSize: 20, fontWeight: "600", color: color.texto },
  campoFila: { flexDirection: "row", alignItems: "center", gap: espacio.m, marginTop: espacio.s },
  campoPuntaje: {
    width: 110, fontSize: 30, fontWeight: "700", color: color.texto,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.campo,
    paddingHorizontal: espacio.m, paddingVertical: 8, textAlign: "center",
  },
  deCuanto: { ...tipo.cuerpo, color: color.textoSuave },
  malo: { ...tipo.detalle, color: color.vivo },
});
