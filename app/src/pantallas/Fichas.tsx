import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Boton, Cargando, Error as ErrorUI, Pantalla } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  FILETE, cifras, color, colorDeRamo, espacio, letra, radio, sombra, tipo,
} from "../ui/tema.ts";
import { misFichas, repasarFicha } from "../lib/consultas.ts";
import {
  alDia, contar, cuandoVuelve, enCuanto, tocanAhora, type Ficha,
} from "../dominio/fichas.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import type { PropsPila } from "../lib/rutas.ts";

type Props = PropsPila<"Fichas">;

/**
 * Las fichas de un tema: se leen, se voltean, y se dice si se sabía.
 *
 * La cuadrícula muestra solo las que tocan hoy, no el mazo entero. Es la
 * diferencia entre repasar y hojear: si estuvieran todas, la que uno ya se
 * sabe volvería a aparecer y se llevaría el tiempo de las que no.
 *
 * Y lo que se aprieta después de voltear no es «siguiente» sino «la sabía» o
 * «no la sabía». Cuesta un toque más y es el toque que hace que esto sirva:
 * sin esa respuesta no hay nada que espaciar, y el mazo se vuelve una pila de
 * papeles que se miran en orden.
 */
export default function Fichas({ route }: Props) {
  const { asignaturaId, tema, tono } = route.params;
  const { ancho } = usarDisposicion();
  const [volteadas, setVolteadas] = useState<Set<string>>(new Set());
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [dicho, setDicho] = useState<Record<string, number>>({});

  const traer = useCallback(
    async () => await misFichas(asignaturaId, tema),
    [asignaturaId, tema],
  );
  const { datos, cargando, error, recargar } = usarCarga(traer, [asignaturaId, tema]);

  if (cargando) return <Cargando texto="Buscando tus fichas…" />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;

  const todas = datos ?? [];
  const cuenta = contar(todas);
  const marca = tono ?? colorDeRamo(asignaturaId, undefined);

  // Las que ya se contestaron en esta sesión se quedan a la vista: verlas
  // apagadas es lo que hace sentir que la pila baja.
  const pendientes = tocanAhora(todas).filter((f) => dicho[f.id] === undefined);
  const contestadas = tocanAhora(todas).filter((f) => dicho[f.id] !== undefined);
  const columnas = ancho >= 1100 ? 3 : ancho >= 700 ? 2 : 1;

  const responder = async (f: Ficha, acerto: boolean) => {
    setOcupada(f.id);
    setDicho((d) => ({ ...d, [f.id]: cuandoVuelve(f.aciertos, acerto) }));
    try {
      await repasarFicha(f.id, acerto);
    } catch {
      // Si no se pudo anotar, se deshace: mostrar «vuelve en 3 días» cuando
      // no quedó guardado sería mentirle a alguien sobre su propio repaso.
      setDicho((d) => {
        const { [f.id]: _, ...resto } = d;
        return resto;
      });
    } finally {
      setOcupada(null);
    }
  };

  return (
    <Pantalla alRefrescar={recargar} sinLimite>
      <View style={e.cabeza}>
        <View style={{ flex: 1 }}>
          <Text style={e.tema} numberOfLines={2}>{tema}</Text>
          <Text style={e.cuenta}>
            <Text style={cifras}>{cuenta.sabidas}</Text> de{" "}
            <Text style={cifras}>{cuenta.todas}</Text> asentadas
            {pendientes.length > 0 ? ` · ${pendientes.length} por repasar` : ""}
          </Text>
        </View>
        <View style={e.sello}>
          <Text style={e.selloTexto}>fichas</Text>
        </View>
      </View>

      {pendientes.length === 0 ? (
        <View style={e.terminado}>
          <Icono nombre="listo" tamano={26} tono={color.ok} />
          <Text style={e.terminadoTexto}>{alDia(cuenta)}</Text>
        </View>
      ) : null}

      <View style={[e.grilla, columnas > 1 ? e.grillaAncha : null]}>
        {[...pendientes, ...contestadas].map((f) => (
          <Tarjeta
            key={f.id}
            ficha={f}
            columnas={columnas}
            marca={marca}
            volteada={volteadas.has(f.id)}
            voltear={() => setVolteadas((v) => new Set(v).add(f.id))}
            ocupada={ocupada === f.id}
            enCuantosDias={dicho[f.id]}
            responder={(acerto) => void responder(f, acerto)}
          />
        ))}
      </View>

      <Text style={e.pie}>
        Las que aciertas tardan cada vez más en volver; las que fallas vuelven
        hoy mismo. Esto no es una nota y no lo ve nadie más.
      </Text>
    </Pantalla>
  );
}

// ── Una ficha ─────────────────────────────────────────────────────────────

function Tarjeta({
  ficha, columnas, marca, volteada, voltear, ocupada, enCuantosDias, responder,
}: {
  ficha: Ficha;
  columnas: number;
  marca: string;
  volteada: boolean;
  voltear: () => void;
  ocupada: boolean;
  enCuantosDias: number | undefined;
  responder: (acerto: boolean) => void;
}) {
  const contestada = enCuantosDias !== undefined;
  const ancho = columnas > 1 ? `${(100 - (columnas - 1) * 2) / columnas}%` as const : undefined;

  if (contestada) {
    return (
      <View style={[e.ficha, e.fichaHecha, ancho ? { width: ancho } : null]}>
        <Text style={e.preguntaHecha} numberOfLines={2}>{ficha.pregunta}</Text>
        <Text style={e.vuelve}>Vuelve {enCuanto(enCuantosDias)}</Text>
      </View>
    );
  }

  return (
    <View style={[
      e.ficha,
      volteada ? e.fichaVolteada : null,
      ancho ? { width: ancho } : null,
      ocupada ? { opacity: 0.5 } : null,
    ]}>
      {volteada ? (
        <>
          <Text style={e.pregunta} numberOfLines={2}>{ficha.pregunta}</Text>
          <Text style={e.respuesta}>{ficha.respuesta}</Text>
          <View style={e.decidir}>
            <Pressable accessibilityRole="button"
              accessibilityLabel={`No la sabía: ${ficha.pregunta}`}
              disabled={ocupada} onPress={() => responder(false)}
              style={({ pressed }) => [e.decision, pressed ? e.decisionApretada : null]}>
              <Text style={e.decisionTexto}>No la sabía</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel={`La sabía: ${ficha.pregunta}`}
              disabled={ocupada} onPress={() => responder(true)}
              style={({ pressed }) => [
                e.decision, { backgroundColor: color.ok, borderColor: color.ok },
                pressed ? e.decisionApretada : null,
              ]}>
              <Text style={[e.decisionTexto, { color: "#fff" }]}>La sabía</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable accessibilityRole="button"
          accessibilityLabel={`Voltear: ${ficha.pregunta}`}
          onPress={voltear} style={e.frente}>
          <Text style={e.pregunta}>{ficha.pregunta}</Text>
          <Text style={[e.pista, { color: marca }]}>toca para voltear ↻</Text>
        </Pressable>
      )}
    </View>
  );
}

const e = StyleSheet.create({
  cabeza: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    paddingHorizontal: espacio.m, paddingTop: espacio.l, paddingBottom: espacio.m,
  },
  tema: { ...tipo.titulo },
  cuenta: { ...tipo.detalle, marginTop: 2 },
  sello: {
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.pastilla,
    backgroundColor: color.destacador, paddingHorizontal: 10, paddingVertical: 2,
  },
  selloTexto: { fontSize: 11.5, fontWeight: "700", color: color.texto, letterSpacing: 0.3 },

  terminado: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    marginHorizontal: espacio.m, marginBottom: espacio.m,
    padding: espacio.m, borderRadius: radio.tarjeta,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel,
  },
  terminadoTexto: { ...tipo.cuerpo, flex: 1, lineHeight: 22 },

  grilla: { paddingHorizontal: espacio.m, gap: espacio.m },
  grillaAncha: { flexDirection: "row", flexWrap: "wrap" },

  ficha: {
    minHeight: 150, justifyContent: "center",
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.tarjeta,
    backgroundColor: color.papel, padding: espacio.l, gap: espacio.s,
    boxShadow: sombra(3),
  },
  // Volteada se raya con destacador: es la cara de atrás, la que ya se leyó.
  fichaVolteada: { backgroundColor: color.destacadoSuave },
  fichaHecha: { minHeight: 0, backgroundColor: color.fondo, boxShadow: sombra(0), opacity: 0.7 },

  frente: { flex: 1, justifyContent: "center", gap: espacio.s },
  pregunta: { ...tipo.subtitulo, fontSize: 16.5, lineHeight: 23 },
  pista: { fontFamily: letra.mano, fontSize: 18, textAlign: "right" },
  respuesta: { ...tipo.cuerpo, fontSize: 15, lineHeight: 22 },

  preguntaHecha: { ...tipo.fila, fontSize: 14, color: color.textoSuave },
  vuelve: { ...tipo.detalle, fontSize: 12.5 },

  decidir: { flexDirection: "row", gap: espacio.s, marginTop: espacio.s },
  decision: {
    flex: 1, alignItems: "center", paddingVertical: 9,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.campo,
    backgroundColor: color.papel,
  },
  decisionApretada: { transform: [{ translateX: 1 }, { translateY: 1 }] },
  decisionTexto: { fontSize: 13.5, fontWeight: "700", color: color.texto },

  pie: {
    ...tipo.detalle, lineHeight: 20,
    marginHorizontal: espacio.m, marginTop: espacio.l,
  },
});
