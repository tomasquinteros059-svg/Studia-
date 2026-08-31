import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Boton, Cargando, Error as ErrorUI, Fila } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { FILETE, color, espacio, radio, tipo } from "../../ui/tema.ts";
import { borrarDelPlan, materiaDe, planDe, planificar } from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import {
  comoQuedaElMes, comoSeLee, comoTexto, deLaSemana, nombreDelMes, proponer,
  semanasDelMes, type Bloque,
} from "../../dominio/planificacion.ts";

const enISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * El mes de una asignatura, semana por semana.
 *
 * La propuesta sale de una cuenta y no de un modelo: se toman las unidades que
 * el profesor ya cargó y se reparten en las semanas que hay. Eso importa
 * porque una propuesta que sale de una cuenta se puede explicar, da lo mismo
 * dos veces seguidas, y él la puede corregir sabiendo de dónde salió.
 *
 * El asistente entra después: se le pasa el plan ya armado para conversarlo,
 * que es donde un modelo sí aporta —mirar si es realista, qué falta, cómo
 * ordenarlo— y donde equivocarse no borra el trabajo de nadie.
 */
export default function PlanMensual({
  asignaturaId, ramo, alConsultar,
}: {
  asignaturaId: string;
  ramo: string;
  alConsultar: (pregunta: string) => void;
}) {
  const hoy = new Date();
  const [ano, setAno] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [guardando, setGuardando] = useState(false);

  const semanas = semanasDelMes(ano, mes);
  const desde = semanas[0] ? enISO(semanas[0].empieza) : "";
  const hasta = semanas[semanas.length - 1] ? enISO(semanas[semanas.length - 1]!.empieza) : "";

  const traer = useCallback(async () => {
    const [modulos, plan] = await Promise.all([
      materiaDe(asignaturaId),
      desde ? planDe(asignaturaId, desde, hasta) : Promise.resolve([]),
    ]);
    return { modulos, plan };
  }, [asignaturaId, desde, hasta]);

  const { datos, cargando, error, recargar } = usarCarga(traer, [asignaturaId, desde, hasta]);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  // Lo guardado manda; la propuesta solo aparece donde todavía no hay nada.
  const guardados: Bloque[] = datos.plan.map((b) => {
    const lunes = new Date(`${b.semana}T00:00:00`);
    const semana = semanas.findIndex((s) => enISO(s.empieza) === enISO(lunes)) + 1;
    return {
      id: b.id, semana, titulo: b.titulo, detalle: b.detalle, modulo_id: b.modulo_id,
    };
  }).filter((b) => b.semana > 0);

  const propuesta = proponer(datos.modulos, semanas);
  const hayPlan = guardados.length > 0;

  const mover = (cuanto: number) => {
    const d = new Date(ano, mes + cuanto, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  };

  const aceptar = async () => {
    setGuardando(true);
    try {
      await planificar(asignaturaId, propuesta.map((b, i) => ({
        semana: enISO(semanas[b.semana - 1]!.empieza),
        titulo: b.titulo, detalle: b.detalle, modulo_id: b.modulo_id, orden: i + 1,
      })));
      await recargar();
    } catch (falla) {
      Alert.alert("No pude guardar el plan",
        falla instanceof globalThis.Error ? falla.message : "Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const sacar = async (id: string) => {
    try {
      await borrarDelPlan(id);
      await recargar();
    } catch {
      Alert.alert("No pude sacarlo", "Inténtalo de nuevo.");
    }
  };

  const aLaVista = hayPlan ? guardados : propuesta;

  return (
    <View style={e.plan}>
      <View style={e.mes}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior"
          onPress={() => mover(-1)} hitSlop={10}>
          <Icono nombre="anterior" tamano={20} tono={color.texto} />
        </Pressable>
        <Text style={e.mesTexto}>{nombreDelMes(mes)} de {ano}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente"
          onPress={() => mover(1)} hitSlop={10}>
          <Icono nombre="siguiente" tamano={20} tono={color.texto} />
        </Pressable>
      </View>

      <Text style={e.comoQueda}>
        {comoQuedaElMes(datos.modulos.length, semanas.length)}
      </Text>

      {!hayPlan && propuesta.length > 0 ? (
        <View style={e.aviso}>
          <Text style={e.avisoTexto}>
            Esto es una propuesta, no tu plan: reparte las unidades que ya
            cargaste en las semanas que hay. Guárdala y ajústala, o escribe la
            tuya.
          </Text>
          <Boton texto={guardando ? "Guardando…" : "Guardar esta propuesta"}
            deshabilitado={guardando} onPress={() => void aceptar()} />
        </View>
      ) : null}

      {semanas.map((s) => {
        const suyos = deLaSemana(aLaVista, s.numero);
        return (
          <View key={s.numero} style={e.semana}>
            <View style={e.semanaCabeza}>
              <Text style={e.semanaTitulo}>Semana {s.numero}</Text>
              <Text style={tipo.detalle}>{comoSeLee(s)}</Text>
            </View>
            {suyos.length === 0 ? (
              <Text style={e.libre}>Libre</Text>
            ) : suyos.map((b) => (
              <Fila key={b.id}
                izquierda={<Icono nombre="documento" tono={color.textoSuave} />}
                titulo={b.titulo}
                detalle={b.detalle}
                derecha={hayPlan ? (
                  <Pressable accessibilityRole="button"
                    accessibilityLabel={`Sacar ${b.titulo} del plan`}
                    onPress={() => void sacar(b.id)} hitSlop={10}>
                    <Icono nombre="cerrar" tamano={18} tono={color.textoSuave} />
                  </Pressable>
                ) : undefined}
              />
            ))}
          </View>
        );
      })}

      <View style={{ padding: espacio.m }}>
        <Boton texto="Conversarlo con el asistente" variante="suave"
          onPress={() => alConsultar(
            `${comoTexto(ramo, ano, mes, semanas, aLaVista)}\n\n`
            + "¿Te parece realista este reparto? Dime qué moverías y por qué.",
          )} />
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  plan: { gap: espacio.s },
  mes: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingTop: espacio.m,
  },
  mesTexto: { ...tipo.subtitulo, fontSize: 17, textTransform: "capitalize" },
  comoQueda: { ...tipo.detalle, paddingHorizontal: espacio.m, lineHeight: 20 },

  aviso: {
    margin: espacio.m, padding: espacio.m, gap: espacio.s,
    borderRadius: radio.tarjeta, borderWidth: FILETE, borderColor: color.bordeFuerte,
    backgroundColor: color.destacadoSuave,
  },
  avisoTexto: { ...tipo.detalle, lineHeight: 20 },

  semana: { marginTop: espacio.s },
  semanaCabeza: {
    flexDirection: "row", alignItems: "baseline", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingBottom: 4,
  },
  semanaTitulo: { fontSize: 13, fontWeight: "700", color: color.texto },
  libre: { ...tipo.detalle, paddingHorizontal: espacio.m, paddingBottom: espacio.s },
});
