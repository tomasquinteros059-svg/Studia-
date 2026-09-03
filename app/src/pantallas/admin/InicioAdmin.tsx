import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Campo, Cargando, Encabezado, Error as ErrorUI, Fila } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import {
  FILETE, color, colorDeRamo, espacio, fechaCorta, hora, nombreDia, radio,
  tenue, tipo,
} from "../../ui/tema.ts";
import {
  cambiarRol, cargarCatalogo, cursoDe, miHorario, misAsignaturas, quienDicta, registros,
} from "../../lib/consultas.ts";
import { NOMBRE_DEL_ROL, buscar, cuentaPorRol } from "../../dominio/personas.ts";
import type { Registro as RegistroDePersona } from "../../lib/tipos.ts";
import CargarCatalogo from "./CargarCatalogo.tsx";
import { usarCarga } from "../../lib/usarCarga.ts";
import {
  choquesDeHorario, porHora, type BloqueDeClase,
} from "../../dominio/horario.ts";
import { comoSeDice } from "../../dominio/fallas.ts";

const SECCIONES = ["Ramos", "Horario", "Personas"] as const;
type Seccion = (typeof SECCIONES)[number];

/** "08:30:00" a minutos del día, que es como los compara el validador. */
const enMinutos = (t: string): number => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

export default function InicioAdmin() {
  const [seccion, setSeccion] = useState<Seccion>("Ramos");
  const [cargandoCatalogo, setCargando] = useState(false);

  const traer = useCallback(async () => {
    const [asignaturas, horario, registro, dictados] = await Promise.all([
      misAsignaturas(), miHorario(), registros(), quienDicta(),
    ]);
    const cursos = await Promise.all(asignaturas.map((a) => cursoDe(a.id)));
    return {
      asignaturas, horario, registro, dictados,
      inscritos: cursos.reduce((n, c) => n + c.length, 0),
    };
  }, []);

  const { datos, cargando, error, recargar } = usarCarga(traer, []);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  // Con reintentar: esta es una pestaña, así que no hay flecha para volver.
  // Sin salida y sin reintento, quedaba una pantalla que solo se abandona
  // cerrando la aplicación.
  if (!datos) return <ErrorUI mensaje="No pude cargar los datos del colegio." reintentar={recargar} />;

  // La misma revisión que corre el importador, ahora sobre lo que está
  // cargado: si alguien movió una sala desde la app, se ve acá.
  const porId = new Map(datos.asignaturas.map((a) => [a.id, a.codigo]));
  const bloques: BloqueDeClase[] = datos.horario.map((b) => ({
    codigo: porId.get(b.asignatura_id) ?? b.asignatura_id,
    dia: b.dia,
    inicio: enMinutos(b.hora_inicio),
    fin: enMinutos(b.hora_fin),
    sala: b.sala,
  }));
  // Quién dicta cada ramo sale del servidor. Durante un tiempo salió de los
  // perfiles de ejemplo: con el servidor conectado, esta revisión se hacía
  // contra profesores inventados y salía siempre limpia, y no porque el
  // horario estuviera bien.
  const problemas = choquesDeHorario(bloques, datos.dictados);

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <View style={e.cabecera}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={e.titulo}>El colegio</Text>
          <Text style={tipo.detalle}>
            {datos.asignaturas.length} ramos · {datos.horario.length} bloques · {datos.inscritos} inscripciones
          </Text>
        </View>
        {/* Un semestre no se arma ramo por ramo: se pega la planilla. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Cargar el semestre"
          onPress={() => setCargando(true)}
          style={({ pressed }) => [e.cargar, pressed ? { opacity: 0.85 } : null]}>
          <Icono nombre="descargar" tamano={17} tono={color.sobreMarca} />
          <Text style={e.cargarTexto}>Cargar</Text>
        </Pressable>
      </View>

      <CargarCatalogo
        abierto={cargandoCatalogo}
        cerrar={() => setCargando(false)}
        yaCargados={datos.asignaturas}
        cargar={async (colegio) => {
          await cargarCatalogo(colegio);
          recargar();
        }}
      />

      {problemas.length > 0 ? (
        <View style={e.alerta}>
          <Icono nombre="campana" tamano={16} tono={color.ambar} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={e.alertaTitulo}>
              {problemas.length === 1 ? "Un choque de horario" : `${problemas.length} choques de horario`}
            </Text>
            {problemas.slice(0, 3).map((p, i) => (
              <Text key={i} style={e.alertaTexto}>{p.mensaje}</Text>
            ))}
          </View>
        </View>
      ) : (
        <View style={e.ok}>
          <Icono nombre="listo" tamano={16} tono={color.ok} />
          <Text style={e.okTexto}>
            Sin choques: ninguna sala ni docente está citado en dos partes a la vez.
          </Text>
        </View>
      )}

      <View style={e.pestanas}>
        {SECCIONES.map((s) => (
          <Pressable key={s} accessibilityRole="button"
            accessibilityState={{ selected: seccion === s }}
            onPress={() => setSeccion(s)}
            style={[e.pestana, seccion === s ? e.pestanaViva : null]}>
            <Text style={[e.pestanaTexto, seccion === s ? { color: color.texto } : null]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: espacio.xl }}>
        {seccion === "Ramos" ? datos.asignaturas.map((a) => (
          <Fila key={a.id}
            izquierda={<View style={[e.punto, { backgroundColor: colorDeRamo(a.id, a.color) }]} />}
            titulo={`${a.codigo} · ${a.nombre}`}
            detalle={`${a.profesor}${a.ayudante ? ` · ayudante ${a.ayudante}` : ""} · ${a.creditos} créditos`}
          />
        )) : null}

        {seccion === "Horario" ? [1, 2, 3, 4, 5].map((dia) => {
          const delDia = porHora(datos.horario.filter((b) => b.dia === dia));
          if (delDia.length === 0) return null;
          return (
            <View key={dia}>
              <Encabezado texto={nombreDia(dia)} />
              {delDia.map((b) => {
                const ramo = datos.asignaturas.find((a) => a.id === b.asignatura_id);
                return (
                  <Fila key={b.id}
                    izquierda={<Text style={e.horaFila}>{hora(b.hora_inicio)}</Text>}
                    titulo={ramo?.nombre ?? b.asignatura_id}
                    detalle={`${b.tipo} · ${b.sala} · hasta ${hora(b.hora_fin)}`}
                  />
                );
              })}
            </View>
          );
        }) : null}

        {seccion === "Personas" ? (
          <Registro
            gente={datos.registro}
            recargar={recargar}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Quiénes están registrados en StudIA.
 *
 * Es el único lugar de la aplicación donde se ve el correo de otra persona.
 * No es un descuido: la administración necesita saber quién entró y con qué
 * cuenta, y la base lo abre por una función con guardia en vez de aflojar el
 * permiso para todo el mundo. Para cualquier otro rol esta lista llega vacía.
 */
function Registro({
  gente, recargar,
}: {
  gente: RegistroDePersona[];
  recargar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [cambiando, setCambiando] = useState<string | null>(null);

  const vistos = buscar(gente, texto);
  const cuenta = cuentaPorRol(gente);

  const cambiar = async (persona: RegistroDePersona, rol: RegistroDePersona["rol"]) => {
    setCambiando(persona.id);
    try {
      await cambiarRol(persona.id, rol);
      recargar();
    } catch (err) {
      Alert.alert(
        "No pude cambiar el rol",
        comoSeDice(err),
      );
    } finally {
      setCambiando(null);
    }
  };

  if (gente.length === 0) {
    return (
      <Text style={e.pie}>
        Todavía no hay nadie registrado, o esta cuenta no es de administración.
        El registro solo lo ve quien administra.
      </Text>
    );
  }

  return (
    <>
      <View style={e.buscador}>
        <Campo
          placeholder="Buscar por nombre o correo…"
          value={texto} onChangeText={setTexto}
          autoCapitalize="none" autoCorrect={false}
          accessibilityLabel="Buscar en el registro"
        />
        <Text style={tipo.detalle}>
          {cuenta.estudiante} estudiantes · {cuenta.profesor} docentes ·{" "}
          {cuenta.administrador} de administración
        </Text>
      </View>

      {vistos.length === 0 ? (
        <Text style={e.pie}>Nadie calza con «{texto.trim()}».</Text>
      ) : vistos.map((p) => (
        <Fila key={p.id}
          izquierda={<Icono nombre="persona" tono={color.textoSuave} />}
          titulo={p.nombre}
          detalle={`${p.correo} · desde ${fechaCorta(p.creado_en)}`}
          derecha={
            <View style={e.roles}>
              {ROLES.map((rol) => {
                const suyo = p.rol === rol;
                return (
                  <Pressable key={rol} accessibilityRole="button"
                    accessibilityState={{ selected: suyo }}
                    accessibilityLabel={`${NOMBRE_DEL_ROL[rol]} para ${p.nombre}`}
                    disabled={suyo || cambiando !== null}
                    onPress={() => void cambiar(p, rol)}
                    style={({ pressed }) => [
                      e.rol, suyo ? e.rolSuyo : null,
                      pressed && !suyo ? { backgroundColor: color.elemento } : null,
                      cambiando === p.id ? { opacity: 0.5 } : null,
                    ]}>
                    <Text style={[e.rolTexto, suyo ? e.rolTextoSuyo : null]}>
                      {NOMBRE_DEL_ROL[rol]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          }
        />
      ))}

      <Text style={e.pie}>
        Cambiar un rol cambia la aplicación que esa persona abre la próxima vez.
        Tu propio rol no se toca desde acá: pídeselo a otra persona de
        administración.
      </Text>
    </>
  );
}

const ROLES = ["estudiante", "profesor", "administrador"] as const;

const e = StyleSheet.create({
  buscador: { paddingHorizontal: espacio.l, paddingTop: espacio.m, gap: espacio.s },
  roles: { flexDirection: "row", gap: 4 },
  rol: {
    borderRadius: radio.pastilla, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel,
  },
  rolSuyo: { backgroundColor: color.marca, borderColor: color.marca },
  rolTexto: { fontSize: 11.5, fontWeight: "700", color: color.textoSuave },
  rolTextoSuyo: { color: color.sobreMarca },

  cargar: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    backgroundColor: color.marca, borderRadius: radio.pastilla,
    paddingHorizontal: espacio.m, paddingVertical: 10,
  },
  cargarTexto: { color: color.sobreMarca, fontSize: 14, fontWeight: "700" },
  cabecera: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.l, paddingTop: espacio.l, paddingBottom: espacio.s,
  },
  titulo: { ...tipo.titulo, color: color.texto },

  alerta: {
    flexDirection: "row", gap: espacio.s, alignItems: "flex-start",
    marginHorizontal: espacio.l, marginBottom: espacio.s,
    padding: espacio.m, borderRadius: radio.tarjeta, backgroundColor: tenue(color.ambar),
  },
  alertaTitulo: { fontSize: 13.5, fontWeight: "700", color: color.ambar },
  alertaTexto: { ...tipo.detalle, color: color.texto, lineHeight: 17 },

  ok: {
    flexDirection: "row", gap: espacio.s, alignItems: "center",
    marginHorizontal: espacio.l, marginBottom: espacio.s,
    padding: espacio.m, borderRadius: radio.tarjeta, backgroundColor: tenue(color.ok),
  },
  okTexto: { flex: 1, ...tipo.detalle, color: color.texto, lineHeight: 17 },

  pestanas: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  pestana: {
    flex: 1, paddingVertical: 12, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  pestanaViva: { borderBottomColor: color.marca },
  pestanaTexto: { fontSize: 13.5, fontWeight: "600", color: color.textoSuave },

  punto: { width: 10, height: 10, borderRadius: 5 },
  horaFila: { ...tipo.fila, color: color.texto, fontVariant: ["tabular-nums"] },

  pie: {
    ...tipo.detalle, lineHeight: 18, margin: espacio.l,
    padding: espacio.m, backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
  fuerte: { fontWeight: "700", color: color.texto },
});
