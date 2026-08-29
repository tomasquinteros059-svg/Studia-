import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Boton, Hoja, HojaModal } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import {
  FILETE, cifras, color, espacio, radio, tenue, tipo,
} from "../../ui/tema.ts";
import {
  resumenDeCarga, revisar, type Colegio, type Problema,
} from "../../dominio/planilla.ts";

const EJEMPLO_ASIGNATURAS = `codigo,nombre,profesor,ayudante,color,creditos,descripcion,requisitos,bibliografia,intro_tutor
MAT1610,Cálculo I,Ana Ríos,Ignacio Soto,#2563C9,10,,,,¿En qué parte de Cálculo estás?`;

const EJEMPLO_HORARIO = `codigo,dia,hora_inicio,hora_fin,sala,tipo
MAT1610,lunes,08:30,10:00,B-104,Cátedra`;

/**
 * Cargar el semestre entero desde el navegador.
 *
 * Esto ya existía como comando —`npm run importar`— pero terminaba en un
 * archivo .sql que alguien tenía que pegar en el editor de la base. Quien
 * arma el semestre es una secretaría académica con una planilla abierta, y
 * ese último tramo la dejaba fuera.
 *
 * La revisión es exactamente la misma de siempre: el mismo módulo del
 * dominio que usa el comando. No hay una segunda versión que pueda
 * discrepar.
 *
 * Con mil ramos nadie revisa fila por fila, así que la pantalla se ordena en
 * torno a dos preguntas: qué está mal, y qué va a pasar si aplico.
 */
export default function CargarCatalogo({
  abierto, cerrar, cargar, yaCargados,
}: {
  abierto: boolean;
  cerrar: () => void;
  cargar: (colegio: Pick<Colegio, "asignaturas" | "horario">) => Promise<void>;
  /** Lo que ya está en la base, para decir qué entra y qué se actualiza. */
  yaCargados: readonly { codigo: string }[];
}) {
  const [asignaturas, setAsignaturas] = useState("");
  const [horario, setHorario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const hayAlgo = asignaturas.trim().length > 0;

  const { colegio, problemas } = useMemo(
    () => revisar({ asignaturas, horario }),
    [asignaturas, horario],
  );
  const resumen = useMemo(
    () => resumenDeCarga(colegio, yaCargados),
    [colegio, yaCargados],
  );

  const sePuede = hayAlgo && problemas.length === 0
    && colegio.asignaturas.length > 0 && !ocupado;

  const aplicar = async () => {
    setOcupado(true);
    setFalla(null);
    try {
      await cargar({ asignaturas: colegio.asignaturas, horario: colegio.horario });
      setAsignaturas(""); setHorario("");
      cerrar();
    } catch (err) {
      setFalla(err instanceof globalThis.Error ? err.message : "No pude cargar el catálogo.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <HojaModal abierto={abierto} cerrar={cerrar} titulo="Cargar el semestre">
      <Text style={e.bajada}>
        Pega acá las dos planillas, tal como salen de Excel o de Google Sheets,
        con su fila de cabecera. Se revisan enteras antes de tocar nada.
      </Text>

      <Text style={tipo.etiqueta}>Ramos · asignaturas.csv</Text>
      <TextInput
        style={e.planilla} value={asignaturas} onChangeText={setAsignaturas}
        multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false}
        placeholder={EJEMPLO_ASIGNATURAS} placeholderTextColor={color.textoTenue}
        accessibilityLabel="Planilla de ramos"
      />

      <Text style={tipo.etiqueta}>Horario · horario.csv</Text>
      <TextInput
        style={e.planilla} value={horario} onChangeText={setHorario}
        multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false}
        placeholder={EJEMPLO_HORARIO} placeholderTextColor={color.textoTenue}
        accessibilityLabel="Planilla de horario"
      />

      {problemas.length > 0 ? <Problemas problemas={problemas} /> : null}

      {hayAlgo && problemas.length === 0 ? (
        <>
          <Text style={tipo.etiqueta}>Si aplicas, esto es lo que pasa</Text>
          <Hoja>
            <Cuenta n={resumen.nuevos.length} que="ramos nuevos" />
            <Cuenta n={resumen.actualizados.length} que="ramos que se actualizan"
              nota="ya existen: se corrigen, no se duplican" />
            <Cuenta n={resumen.bloques} que="bloques de horario"
              nota="el horario de esos ramos se rehace entero" />
            {resumen.intactos.length > 0 ? (
              <Cuenta n={resumen.intactos.length} que="ramos que no se tocan"
                nota={`no vienen en la planilla: ${resumen.intactos.slice(0, 6).join(", ")}${
                  resumen.intactos.length > 6 ? "…" : ""}`} />
            ) : null}
          </Hoja>
        </>
      ) : null}

      {falla ? <Text style={e.falla}>{falla}</Text> : null}

      <Boton
        texto={ocupado ? "Cargando…" : "Aplicar la carga"}
        onPress={() => void aplicar()}
        deshabilitado={!sePuede}
      />
    </HojaModal>
  );
}

/**
 * Todos los problemas juntos, con archivo y línea.
 *
 * Enteros y no de a uno: avisar del primero, hacer corregir, y recién ahí
 * descubrir el segundo es la manera de hacerle perder la tarde a alguien que
 * está cargando mil filas.
 */
function Problemas({ problemas }: { problemas: Problema[] }) {
  return (
    <View style={e.problemas}>
      <View style={e.problemasTitulo}>
        <Icono nombre="aviso" tamano={18} tono={color.ambar} />
        <Text style={tipo.fila}>
          {problemas.length === 1
            ? "Hay un problema que corregir"
            : `Hay ${problemas.length} problemas que corregir`}
        </Text>
      </View>
      {problemas.slice(0, 40).map((p, i) => (
        <Text key={i} style={e.problema}>
          <Text style={e.donde}>
            {p.archivo}{p.linea > 0 ? ` · línea ${p.linea}` : ""}:{" "}
          </Text>
          {p.mensaje}
        </Text>
      ))}
      {problemas.length > 40 ? (
        <Text style={e.problema}>…y {problemas.length - 40} más.</Text>
      ) : null}
      <Text style={e.problemaPie}>
        Mientras haya algo mal no se aplica nada. Corrige la planilla y vuelve
        a pegarla.
      </Text>
    </View>
  );
}

function Cuenta({ n, que, nota }: { n: number; que: string; nota?: string }) {
  return (
    <View style={e.cuenta}>
      <Text style={e.numero}>{n}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={tipo.fila}>{que}</Text>
        {nota ? <Text style={tipo.detalle}>{nota}</Text> : null}
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  bajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 22 },
  planilla: {
    minHeight: 130, padding: espacio.m, fontSize: 13.5, lineHeight: 21,
    color: color.texto, backgroundColor: color.papel,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.campo,
  },

  problemas: {
    backgroundColor: tenue(color.ambar), borderRadius: radio.tarjeta,
    padding: espacio.m, gap: espacio.s,
  },
  problemasTitulo: { flexDirection: "row", alignItems: "center", gap: espacio.s },
  problema: { ...tipo.detalle, color: color.texto, lineHeight: 20 },
  donde: { fontWeight: "700" },
  problemaPie: { ...tipo.detalle, lineHeight: 19 },

  cuenta: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  numero: {
    ...cifras, fontSize: 26, fontWeight: "800", color: color.texto,
    minWidth: 52, textAlign: "right", letterSpacing: -1,
  },

  falla: { ...tipo.detalle, color: color.vivo, lineHeight: 20 },
});
