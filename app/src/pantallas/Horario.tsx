import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Boton, Campo, Cargando, Error, HojaModal, Pantalla,
} from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  FILETE, cifras, color, colorDeRamo, espacio, radio, tenue, tipo,
} from "../ui/tema.ts";
import {
  crearSesion, marcarSesion, borrarSesion, miHorario, misAsignaturas,
  misSesiones, misTareas,
} from "../lib/consultas.ts";
import {
  armarSemana, avisoDeLaSemana, cargaPorRamo, comoDuracion, cuandoEmpieza,
  estaLibre, horaSugerida, leerHoraDelDia, lunesDe, sumarDias,
  totalDeLaSemana, type Cosa, type Dia,
} from "../dominio/semana.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { Asignatura } from "../lib/tipos.ts";
import type { PropsPestana } from "../lib/rutas.ts";

type Props = PropsPestana<"Horario">;

const NOMBRE_DIA = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DURACIONES = [30, 45, 60, 90, 120] as const;

/**
 * El planificador: la semana entera, con lo que pone la institución y lo que
 * pone uno.
 *
 * Antes esta pantalla mostraba un día a la vez y solo las clases. Servía para
 * responder «¿qué tengo ahora?», que es la pregunta fácil. La difícil es
 * «¿cómo viene la semana?», y esa no se puede contestar mirando un día:
 * necesita ver juntas las clases, lo que vence y el tiempo que uno reservó
 * para estudiar, que hasta ahora vivían en tres lugares distintos.
 *
 * Las tres cosas se dibujan igual salvo por una raya de color a la izquierda,
 * que es la del ramo. Es la regla de siempre: el color es del ramo y nada
 * más lleva color, ni siquiera acá donde hay tres tipos de cosa que
 * distinguir. Se distinguen por su forma y por lo que dicen.
 */
export default function Planificador({ navigation }: Props) {
  const { ancho } = usarDisposicion();
  const [corrimiento, setCorrimiento] = useState(0);
  const [agregandoEn, setAgregandoEn] = useState<Dia | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const lunes = useMemo(
    () => sumarDias(lunesDe(new Date()), corrimiento * 7),
    [corrimiento],
  );

  const traer = useCallback(async () => {
    const finDeSemana = sumarDias(lunes, 7);
    const [bloques, asignaturas, tareas, sesiones] = await Promise.all([
      miHorario(), misAsignaturas(), misTareas(), misSesiones(lunes, finDeSemana),
    ]);
    return { bloques, asignaturas, tareas, sesiones };
  }, [lunes]);

  const { datos, cargando, refrescando, error, recargar, refrescar } =
    usarCarga(traer, [lunes.getTime()]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const porId = new Map(datos.asignaturas.map((a) => [a.id, a]));
  const semana = armarSemana(lunes, {
    bloques: datos.bloques,
    entregas: datos.tareas,
    sesiones: datos.sesiones,
  });
  const aviso = avisoDeLaSemana(semana, (id) => porId.get(id)?.nombre);
  const cargas = cargaPorRamo(datos.sesiones);

  // Los siete días de corrido caben recién en una pantalla grande. Antes de
  // eso se reparten en filas: es preferible bajar un poco a leer columnas de
  // cuatro centímetros.
  const columnas = ancho >= 1180 ? 7 : ancho >= 900 ? 4 : ancho >= 620 ? 2 : 1;

  const conSesion = async (que: () => Promise<unknown>, id: string) => {
    setOcupado(id);
    try { await que(); recargar(); } finally { setOcupado(null); }
  };

  return (
    <>
      <Pantalla alRefrescar={refrescar} refrescando={refrescando} sinLimite>
        <View style={e.barra}>
          <Pressable accessibilityRole="button" accessibilityLabel="Semana anterior"
            onPress={() => setCorrimiento((n) => n - 1)} style={e.flecha}>
            <Icono nombre="anterior" tamano={18} tono={color.texto} />
          </Pressable>

          <Text style={e.titulo}>{semana.titulo}</Text>

          <Pressable accessibilityRole="button" accessibilityLabel="Semana siguiente"
            onPress={() => setCorrimiento((n) => n + 1)} style={e.flecha}>
            <Icono nombre="siguiente" tamano={18} tono={color.texto} />
          </Pressable>

          {corrimiento !== 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setCorrimiento(0)} style={e.hoyBoton}>
              <Text style={e.hoyBotonTexto}>Hoy</Text>
            </Pressable>
          ) : null}

          <View style={e.relleno} />
        </View>

        {aviso ? (
          <View style={e.aviso}>
            <Icono nombre="aviso" tamano={18} tono={color.ambar} />
            <Text style={e.avisoTexto}>{aviso}</Text>
          </View>
        ) : null}

        <View style={[e.grilla, columnas > 1 ? e.grillaAncha : null]}>
          {semana.dias.map((d) => (
            <ColumnaDia
              key={d.numero}
              dia={d}
              porId={porId}
              columnas={columnas}
              ocupado={ocupado}
              agregar={() => setAgregandoEn(d)}
              alternar={(c) =>
                void conSesion(() => marcarSesion(c.id, !(c.clase === "sesion" && c.hecha)), c.id)}
              borrar={(c) => void conSesion(() => borrarSesion(c.id), c.id)}
              abrirRamo={(id) => {
                const a = porId.get(id);
                if (a) navigation.navigate("Asignatura", { asignaturaId: a.id });
              }}
            />
          ))}
        </View>

        {cargas.length > 0 ? (
          <View style={e.cargas}>
            {cargas.map((c) => (
              <View key={c.asignaturaId ?? "suelto"} style={e.chip}
                accessibilityLabel={`${c.asignaturaId ? porId.get(c.asignaturaId)?.nombre ?? "Ramo" : "Por mi cuenta"}: ${comoDuracion(c.minutos)} esta semana`}>
                <View style={[e.chipPunto, {
                  backgroundColor: c.asignaturaId
                    ? colorDeRamo(c.asignaturaId, porId.get(c.asignaturaId)?.color)
                    : color.textoTenue,
                }]} />
                <Text style={e.chipTexto}>
                  {c.asignaturaId ? porId.get(c.asignaturaId)?.nombre ?? "Ramo" : "Por mi cuenta"}
                  {"  "}
                  <Text style={cifras}>{comoDuracion(c.minutos)}</Text>
                </Text>
              </View>
            ))}
            <View style={[e.chip, e.chipTotal]}>
              <Text style={e.chipTexto}>
                Total <Text style={cifras}>{comoDuracion(totalDeLaSemana(cargas))}</Text> esta semana
              </Text>
            </View>
          </View>
        ) : (
          <Text style={e.sinNada}>
            Todavía no reservaste tiempo de estudio esta semana. Toca «agregar»
            en cualquier día y aparecerá acá cuánto le estás dando a cada ramo.
          </Text>
        )}
      </Pantalla>

      <NuevaSesion
        dia={agregandoEn}
        asignaturas={datos.asignaturas}
        cerrar={() => setAgregandoEn(null)}
        guardar={async (s) => { await crearSesion(s); setAgregandoEn(null); recargar(); }}
      />
    </>
  );
}

// ── Un día ────────────────────────────────────────────────────────────────

function ColumnaDia({
  dia, porId, columnas, ocupado, agregar, alternar, borrar, abrirRamo,
}: {
  dia: Dia;
  porId: Map<string, Asignatura>;
  columnas: number;
  ocupado: string | null;
  agregar: () => void;
  alternar: (c: Cosa) => void;
  borrar: (c: Cosa) => void;
  abrirRamo: (id: string) => void;
}) {
  const libre = estaLibre(dia);
  return (
    <View style={[
      e.dia,
      columnas > 1 ? { width: `${(100 - (columnas - 1) * 1.6) / columnas}%` as const } : null,
      dia.hoy ? e.diaHoy : null,
    ]}>
      <View style={[e.diaCabeza, dia.hoy ? e.diaCabezaHoy : null]}>
        <Text style={e.diaNombre}>{NOMBRE_DIA[dia.numero]}{dia.hoy ? " · hoy" : ""}</Text>
        <Text style={[e.diaNumero, cifras]}>{dia.delMes}</Text>
      </View>

      <View style={e.diaCuerpo}>
        {dia.cosas.map((c) => (
          <Bloque key={`${c.clase}-${c.id}`} cosa={c} porId={porId}
            ocupado={ocupado === c.id}
            alternar={() => alternar(c)} borrar={() => borrar(c)}
            abrirRamo={abrirRamo} />
        ))}

        {dia.cosas.length === 0 ? (
          <Text style={e.libre}>Día libre</Text>
        ) : libre ? (
          <Text style={e.libre}>Todo al día</Text>
        ) : null}

        <Pressable accessibilityRole="button"
          accessibilityLabel={`Agregar una sesión el ${NOMBRE_DIA[dia.numero]} ${dia.delMes}`}
          onPress={agregar}
          style={({ pressed }) => [e.agregar, pressed ? e.agregarApretado : null]}>
          <Text style={e.agregarTexto}>+ agregar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Bloque({
  cosa, porId, ocupado, alternar, borrar, abrirRamo,
}: {
  cosa: Cosa;
  porId: Map<string, Asignatura>;
  ocupado: boolean;
  alternar: () => void;
  borrar: () => void;
  abrirRamo: (id: string) => void;
}) {
  const ramo = cosa.asignaturaId ? porId.get(cosa.asignaturaId) : undefined;
  const tono = cosa.asignaturaId
    ? colorDeRamo(cosa.asignaturaId, ramo?.color)
    : color.bordeFuerte;
  const apagado = (cosa.clase === "sesion" && cosa.hecha) || (cosa.clase === "entrega" && cosa.lista);

  const cuerpo = (
    <View style={[
      e.bloque,
      { borderLeftColor: tono },
      cosa.clase === "entrega" && !cosa.lista ? { backgroundColor: tenue(color.ambar) } : null,
      apagado ? { opacity: 0.45 } : null,
      ocupado ? { opacity: 0.3 } : null,
    ]}>
      <View style={e.bloqueArriba}>
        {cosa.clase === "sesion" ? (
          <Pressable accessibilityRole="checkbox"
            accessibilityState={{ checked: cosa.hecha }}
            accessibilityLabel={`${cosa.hecha ? "Desmarcar" : "Marcar como hecha"}: ${cosa.titulo}`}
            onPress={alternar} hitSlop={8}
            style={[e.casilla, cosa.hecha ? e.casillaLista : null]}>
            {cosa.hecha ? <Icono nombre="listo" tamano={12} tono="#fff" /> : null}
          </Pressable>
        ) : null}

        <Text style={[e.bloqueTitulo, apagado ? e.bloqueTachado : null]} numberOfLines={2}>
          {cosa.clase === "clase" ? ramo?.nombre ?? "Clase" : cosa.titulo}
        </Text>
      </View>

      <Text style={[e.bloqueDetalle, cifras]}>
        {cosa.clase === "clase"
          ? `${cosa.desde}–${cosa.hasta}${cosa.sala ? ` · ${cosa.sala}` : ""}`
          : cosa.clase === "entrega"
            ? `vence ${cosa.desde}${cosa.lista ? " · entregada" : ""}`
            : `${cosa.desde} · ${comoDuracion(cosa.minutos)}`}
      </Text>
    </View>
  );

  if (cosa.clase === "sesion") {
    return (
      <Pressable accessibilityRole="button"
        accessibilityLabel={`Borrar la sesión ${cosa.titulo}`}
        onLongPress={borrar} delayLongPress={500}>
        {cuerpo}
      </Pressable>
    );
  }
  if (cosa.clase === "clase" && cosa.asignaturaId) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${ramo?.nombre ?? "el ramo"}`}
        onPress={() => abrirRamo(cosa.asignaturaId)}>
        {cuerpo}
      </Pressable>
    );
  }
  return cuerpo;
}

// ── Reservar tiempo ───────────────────────────────────────────────────────

/**
 * La hoja para agregar una sesión.
 *
 * Pide lo mínimo y sugiere el resto: la hora sale de lo que ya hay ese día y
 * la duración parte en 45 minutos, que es lo que dura una sesión de estudio
 * antes de que uno se pare a buscar algo a la cocina.
 */
function NuevaSesion({
  dia, asignaturas, cerrar, guardar,
}: {
  dia: Dia | null;
  asignaturas: Asignatura[];
  cerrar: () => void;
  guardar: (s: {
    asignaturaId: string | null; titulo: string; empiezaEn: Date; minutos: number;
  }) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [ramo, setRamo] = useState<string | null>(null);
  const [hora, setHora] = useState("");
  const [minutos, setMinutos] = useState<number>(45);
  const [falla, setFalla] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Cada vez que se abre en otro día, la hora sugerida es otra.
  const sugerida = dia ? horaSugerida(dia) : "17:00";
  const laHora = hora || sugerida;

  const limpiar = () => {
    setTitulo(""); setRamo(null); setHora(""); setMinutos(45); setFalla(null);
  };

  const enviar = async () => {
    if (!dia) return;
    if (titulo.trim().length === 0) {
      setFalla("Ponle un nombre: «guía 5», «leer el capítulo 4».");
      return;
    }
    const buena = leerHoraDelDia(laHora);
    if (!buena) {
      setFalla("Esa hora no la entiendo. Escríbela como 17:30.");
      return;
    }
    setGuardando(true);
    setFalla(null);
    try {
      await guardar({
        asignaturaId: ramo,
        titulo: titulo.trim(),
        empiezaEn: cuandoEmpieza(dia.fecha, buena),
        minutos,
      });
      limpiar();
    } catch (err) {
      setFalla(err instanceof globalThis.Error ? err.message : "No pude guardarla.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <HojaModal
      abierto={dia !== null}
      cerrar={() => { limpiar(); cerrar(); }}
      titulo={dia ? `${NOMBRE_DIA[dia.numero]} ${dia.delMes}` : ""}
    >
      <Text style={tipo.etiqueta}>Qué vas a hacer</Text>
      <Campo placeholder="Ejercicios de la guía 5" value={titulo} onChangeText={setTitulo}
        accessibilityLabel="Qué vas a hacer" autoFocus />

      {/* Envueltas y no en una fila que se desliza: con seis ramos, la mitad
          quedaría fuera de la pantalla, y elegir el que no se ve es justo lo
          que nadie va a hacer. */}
      <Text style={[tipo.etiqueta, { marginTop: espacio.l }]}>De qué ramo</Text>
      <View style={e.ramos}>
        <Pastilla texto="Por mi cuenta" elegida={ramo === null} tono={color.textoTenue}
          onPress={() => setRamo(null)} />
        {asignaturas.map((a) => (
          <Pastilla key={a.id} texto={a.nombre} elegida={ramo === a.id}
            tono={colorDeRamo(a.id, a.color)} onPress={() => setRamo(a.id)} />
        ))}
      </View>

      <Text style={[tipo.etiqueta, { marginTop: espacio.l }]}>A qué hora</Text>
      <Campo placeholder={sugerida} value={hora} onChangeText={setHora}
        accessibilityLabel="A qué hora" keyboardType="numbers-and-punctuation" />

      <Text style={[tipo.etiqueta, { marginTop: espacio.l }]}>Cuánto rato</Text>
      <View style={e.ramos}>
        {DURACIONES.map((m) => (
          <Pastilla key={m} texto={comoDuracion(m)} elegida={minutos === m}
            tono={color.texto} onPress={() => setMinutos(m)} />
        ))}
      </View>

      {falla ? <Text style={e.falla}>{falla}</Text> : null}

      <View style={{ marginTop: espacio.l }}>
        <Boton texto={guardando ? "Guardando…" : "Reservar el tiempo"}
          onPress={() => void enviar()} deshabilitado={guardando} />
      </View>

      <Text style={e.pieModal}>
        Esto es tuyo y no lo ve nadie más: ni quien dicta el ramo, ni el
        colegio. Para borrar una sesión, mantenla apretada en la semana.
      </Text>
    </HojaModal>
  );
}

function Pastilla({
  texto, elegida, tono, onPress,
}: {
  texto: string; elegida: boolean; tono: string; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: elegida }}
      accessibilityLabel={texto} onPress={onPress}
      style={[e.pastilla, elegida ? { backgroundColor: tono, borderColor: tono } : null]}>
      <Text style={[e.pastillaTexto, elegida ? { color: "#fff" } : null]}>{texto}</Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  barra: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.m,
  },
  flecha: {
    width: 36, height: 36, borderRadius: radio.campo,
    alignItems: "center", justifyContent: "center",
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel,
  },
  titulo: { ...tipo.titulo },
  relleno: { flex: 1 },
  hoyBoton: {
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 6,
    backgroundColor: color.destacador,
  },
  hoyBotonTexto: { fontSize: 13, fontWeight: "700", color: color.texto },

  aviso: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    marginHorizontal: espacio.m, marginBottom: espacio.m,
    padding: espacio.m, borderRadius: radio.tarjeta,
    backgroundColor: tenue(color.ambar),
  },
  avisoTexto: { ...tipo.detalle, color: color.texto, lineHeight: 20, flex: 1 },

  grilla: { paddingHorizontal: espacio.m, gap: espacio.m },
  grillaAncha: { flexDirection: "row", flexWrap: "wrap" },

  dia: {
    borderWidth: FILETE, borderColor: color.borde, borderRadius: radio.tarjeta,
    backgroundColor: color.papel, overflow: "hidden",
  },
  diaHoy: { borderColor: color.bordeFuerte },
  diaCabeza: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingVertical: espacio.s,
    borderBottomWidth: FILETE, borderBottomColor: color.borde,
    backgroundColor: color.fondo,
  },
  diaCabezaHoy: { backgroundColor: color.destacador },
  diaNombre: {
    fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8,
    textTransform: "uppercase", color: color.textoSuave,
  },
  diaNumero: { ...tipo.subtitulo, fontSize: 17 },
  diaCuerpo: { flex: 1, padding: espacio.s, gap: espacio.s },

  bloque: {
    borderWidth: FILETE, borderColor: color.borde, borderLeftWidth: 4,
    borderRadius: radio.campo, backgroundColor: color.papel,
    paddingHorizontal: espacio.m, paddingVertical: espacio.s, gap: 3,
  },
  bloqueArriba: { flexDirection: "row", alignItems: "flex-start", gap: espacio.s },
  bloqueTitulo: { ...tipo.fila, fontSize: 14, flex: 1, lineHeight: 19 },
  bloqueTachado: { textDecorationLine: "line-through" },
  bloqueDetalle: { ...tipo.detalle, fontSize: 12 },

  casilla: {
    width: 18, height: 18, borderRadius: 6, marginTop: 1,
    borderWidth: 1.5, borderColor: color.bordeFuerte,
    alignItems: "center", justifyContent: "center",
  },
  casillaLista: { backgroundColor: color.ok, borderColor: color.ok },

  libre: { ...tipo.detalle, textAlign: "center", paddingVertical: espacio.s },

  agregar: {
    marginTop: "auto",
    borderWidth: FILETE, borderColor: color.borde, borderStyle: "dashed",
    borderRadius: radio.campo, paddingVertical: 7, alignItems: "center",
  },
  agregarApretado: { backgroundColor: color.elemento },
  agregarTexto: { fontSize: 12.5, fontWeight: "600", color: color.textoTenue },

  cargas: {
    flexDirection: "row", flexWrap: "wrap", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingTop: espacio.l,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    borderWidth: FILETE, borderColor: color.borde, borderRadius: radio.pastilla,
    backgroundColor: color.papel, paddingHorizontal: espacio.m, paddingVertical: 6,
  },
  chipTotal: { borderStyle: "dashed", backgroundColor: "transparent" },
  chipPunto: { width: 9, height: 9, borderRadius: 999 },
  chipTexto: { fontSize: 13, fontWeight: "600", color: color.texto },
  sinNada: {
    ...tipo.detalle, lineHeight: 20,
    marginHorizontal: espacio.m, marginTop: espacio.l,
    padding: espacio.m, borderRadius: radio.tarjeta, backgroundColor: color.elemento,
  },

  ramos: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s, paddingTop: espacio.s },
  pastilla: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.pastilla,
    paddingHorizontal: espacio.m, paddingVertical: 7,
  },
  pastillaTexto: { fontSize: 13.5, fontWeight: "600", color: color.texto },
  falla: { ...tipo.detalle, color: color.vivo, marginTop: espacio.m, lineHeight: 19 },
  pieModal: { ...tipo.detalle, lineHeight: 19, marginTop: espacio.l },
});
