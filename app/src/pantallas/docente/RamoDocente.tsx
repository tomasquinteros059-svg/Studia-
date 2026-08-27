import { useCallback, useEffect, useState } from "react";
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Boton, Cargando, Encabezado, Error as ErrorUI, Fila, Vacio } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, fechaCorta, radio, tenue, tipo } from "../../ui/tema.ts";
import { evaluacionesDe, materiaDe, misAsignaturas, misTareas } from "../../lib/consultas.ts";
import {
  corregir, cursoDe, entregasDe, notasDe, ponerNota, publicarNotas,
} from "../../lib/datos-docente.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { usarDisposicion } from "../../lib/pantalla.ts";
import { usarPerfilDemo } from "../../lib/perfiles-demo.ts";
import {
  aprobacion, distribucion, estadoDeTarea, porRevisar, promedioDelCurso,
  puedePublicarNotas, sinPublicar, type EntregaDeCurso, type NotaDeCurso,
} from "../../dominio/curso.ts";
import { formatearNota } from "../../dominio/notas.ts";
import type { PropsPilaDocente } from "../../lib/rutas.ts";

const SECCIONES = ["Tareas", "Notas", "Material", "Curso"] as const;
type Seccion = (typeof SECCIONES)[number];

export default function RamoDocente({ route, navigation }: PropsPilaDocente<"RamoDocente">) {
  const { asignaturaId } = route.params;
  const { perfil } = usarPerfilDemo();
  const { dosPaneles } = usarDisposicion();
  const [seccion, setSeccion] = useState<Seccion>("Tareas");
  const papel = perfil?.papel ?? "ayudante";

  const traer = useCallback(async () => {
    const [asignaturas, tareas, evaluaciones, curso, modulos] = await Promise.all([
      misAsignaturas(), misTareas(asignaturaId), evaluacionesDe(asignaturaId),
      cursoDe(asignaturaId), materiaDe(asignaturaId),
    ]);
    const conEntregas = await Promise.all(
      tareas.map(async (t) => ({ tarea: t, entregas: await entregasDe(t.id) })),
    );
    const conNotas = await Promise.all(
      evaluaciones.map(async (ev) => ({ ev, filas: await notasDe(ev.id) })),
    );
    return {
      ramo: asignaturas.find((a) => a.id === asignaturaId) ?? null,
      curso, modulos, tareas: conEntregas, evaluaciones: conNotas,
    };
  }, [asignaturaId]);

  const { datos, cargando, error, recargar } = usarCarga(traer, [asignaturaId]);

  const [corrigiendo, setCorrigiendo] = useState<{ tareaId: string; entrega: EntregaDeCurso; max: number } | null>(null);
  const [editandoNota, setEditandoNota] = useState<{ evaluacionId: string; fila: NotaDeCurso } | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: datos?.ramo?.nombre ?? "Curso" });
  }, [navigation, datos?.ramo?.nombre]);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos?.ramo) return <ErrorUI mensaje="No encontré ese ramo." />;

  const ramo = datos.ramo;
  const inscritos = datos.curso.length;

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={e.pestanas}>
        {SECCIONES.map((s) => (
          <Pressable key={s} accessibilityRole="button"
            accessibilityState={{ selected: seccion === s }}
            onPress={() => setSeccion(s)}
            style={[e.pestana, seccion === s ? { borderBottomColor: ramo.color } : null]}>
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
                <Barra hecho={est.corregidas} total={est.inscritos} tono={ramo.color} />

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
                    <Histograma filas={filas} tono={ramo.color} />
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
                    izquierda={<Icono nombre="persona" tono={f.nota === null ? color.textoSuave : ramo.color} />}
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

        {seccion === "Material" ? (
          <>
            {datos.modulos.map((m) => (
              <View key={m.id}>
                <Encabezado texto={m.titulo} />
                {m.materiales.map((mat) => (
                  <Fila key={mat.id}
                    izquierda={<Icono nombre={mat.tipo === "video" ? "video" : mat.tipo === "documento" ? "documento" : "ejercicios"}
                      tono={ramo.color} />}
                    titulo={mat.titulo}
                    detalle={mat.detalle + (mat.leible ? " · se puede escuchar" : "")}
                  />
                ))}
              </View>
            ))}
            <Text style={e.pieMaterial}>
              El material se carga desde la planilla del ramo, en la carpeta
              <Text style={e.mono}> datos/</Text>. Cargarlo desde acá es lo
              próximo que falta.
            </Text>
          </>
        ) : null}

        {seccion === "Curso" ? (
          <>
            <Encabezado texto={`${inscritos} inscritos`} />
            {datos.curso.map((a) => (
              <Fila key={a.id}
                izquierda={<Icono nombre="persona" tono={ramo.color} />}
                titulo={a.nombre}
              />
            ))}
          </>
        ) : null}
      </ScrollView>

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
      <Pressable style={e.velo} onPress={cerrar} accessibilityLabel="Cerrar" />
      <View style={e.hoja}>
        <Text style={tipo.etiqueta}>Corregir entrega</Text>
        <Text style={e.hojaTitulo}>{abierto.entrega.estudiante}</Text>
        <Text style={tipo.detalle}>
          {abierto.entrega.entregado_en ? `Entregó el ${fechaCorta(abierto.entrega.entregado_en)}` : ""}
        </Text>

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
      <Pressable style={e.velo} onPress={cerrar} accessibilityLabel="Cerrar" />
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

const e = StyleSheet.create({
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
