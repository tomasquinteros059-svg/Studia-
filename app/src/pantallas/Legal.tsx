import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Encabezado, Pantalla } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { FILETE, color, espacio, letra, radio, tipo } from "../ui/tema.ts";
import { aviso, comoFecha, documento, trozos, type Documento } from "../dominio/legales.ts";
import { TERCEROS, textoDe } from "../dominio/terceros.ts";
import type { PropsPila } from "../lib/rutas.ts";

/** Cuál de los tres documentos se está mirando. */
export type Cual = "terminos" | "privacidad" | "terceros";

/** El título de la barra, que también usa la portada al abrirlos en un modal. */
export const TITULO_LEGAL: Record<Cual, string> = {
  terminos: "Términos de uso",
  privacidad: "Política de privacidad",
  terceros: "Licencias de terceros",
};

/**
 * Los términos, la privacidad y las licencias de terceros.
 *
 * Van dentro de la aplicación y no en un enlace a una página web por dos
 * razones. Quien acepta unos términos tiene derecho a leerlos, y un enlace no
 * sirve en la sala donde no hay señal. Y las licencias MIT de las bibliotecas
 * obligan a que su aviso viaje con el software: si viviera en un servidor, el
 * día que el servidor se cayera el APK quedaría incumpliéndolas.
 *
 * El contenido va aparte de la pantalla —`VistaLegal`— porque se mira desde
 * dos lados: desde el perfil, donde hay navegación, y desde la portada, donde
 * todavía no la hay y se abre en un modal.
 */
export default function Legal({ route }: PropsPila<"Legal">) {
  return (
    <Pantalla>
      <VistaLegal que={route.params?.que ?? "terminos"} />
    </Pantalla>
  );
}

/** El contenido, sin envoltorio: quien lo use pone el suyo. */
export function VistaLegal({ que }: { que: Cual }) {
  if (que === "terceros") return <Terceros />;
  return <Texto doc={documento(que)} />;
}

function Texto({ doc }: { doc: Documento }) {
  return (
    <View>
      {/* Sin repetir el título: los dos lugares desde donde se llega —la pila
          de navegación y el modal de la portada— ya lo llevan en su barra, y
          dos veces la misma frase a dos centímetros se lee como un error. */}
      <View style={e.cabeza}>
        <Text style={[tipo.cuerpo, e.bajada]}>{doc.bajada}</Text>
        <Text style={tipo.detalle}>Actualizado el {comoFecha(doc.actualizado)}.</Text>
      </View>

      {doc.secciones.map((s) => (
        <View key={s.titulo} style={e.seccion}>
          <Text style={[tipo.subtitulo, e.tituloSeccion]}>{s.titulo}</Text>
          {s.parrafos.map((p, i) => (
            <Text key={i} style={e.parrafo}>
              {trozos(p).map((t, j) => (
                <Text key={j} style={t.fuerte ? e.fuerte : undefined}>{t.texto}</Text>
              ))}
            </Text>
          ))}
        </View>
      ))}

      <Text style={e.pie}>{aviso(new Date().getFullYear())}</Text>
    </View>
  );
}

function Terceros() {
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <View>
      <View style={e.cabeza}>
        <Text style={[tipo.cuerpo, e.bajada]}>
          StudIA está construida sobre estas bibliotecas de código abierto. El aviso de
          cada una viaja con la aplicación porque sus licencias lo exigen.
        </Text>
      </View>

      <Encabezado texto={`${TERCEROS.length} bibliotecas`} />
      {TERCEROS.map((t) => {
        const texto = textoDe(t);
        const esta = abierto === t.nombre;
        return (
          <View key={t.nombre} style={e.tercero}>
            <Pressable
              onPress={() => setAbierto(esta ? null : t.nombre)}
              disabled={!texto}
              accessibilityRole="button"
              accessibilityLabel={`${t.nombre}, licencia ${t.licencia}`}
              style={e.filaTercero}
            >
              <View style={{ flex: 1 }}>
                <Text style={tipo.fila}>{t.nombre}</Text>
                <Text style={tipo.detalle}>{t.version} · {t.licencia}</Text>
                {t.copyright ? <Text style={e.copyright}>{t.copyright}</Text> : null}
              </View>
              {texto ? <Icono nombre={esta ? "arriba" : "abajo"} tamano={18} tono={color.textoTenue} /> : null}
            </Pressable>
            {esta && texto ? <Text style={e.licencia}>{texto}</Text> : null}
          </View>
        );
      })}

      <Text style={e.pie}>
        El árbol completo de dependencias, incluidas las indirectas, sale de «npm ls»
        en el repositorio.
      </Text>
    </View>
  );
}

const e = StyleSheet.create({
  cabeza: { paddingHorizontal: espacio.m, paddingTop: espacio.l, gap: 6 },
  bajada: { color: color.textoSuave, lineHeight: 22 },

  seccion: { paddingHorizontal: espacio.m, paddingTop: espacio.l, gap: 10 },
  tituloSeccion: { fontSize: 16.5 },
  parrafo: { ...tipo.cuerpo, lineHeight: 23 },
  fuerte: { fontWeight: "700" },

  tercero: {
    marginHorizontal: espacio.m, marginTop: espacio.s,
    backgroundColor: color.papel, borderWidth: FILETE, borderColor: color.borde,
    borderRadius: radio.tarjeta, overflow: "hidden",
  },
  filaTercero: {
    flexDirection: "row", alignItems: "center", gap: espacio.s,
    paddingHorizontal: espacio.m, paddingVertical: 12,
  },
  copyright: { ...tipo.detalle, color: color.textoTenue, marginTop: 2 },
  licencia: {
    fontSize: 11.5, lineHeight: 17, color: color.textoSuave, fontFamily: letra.cuerpo,
    paddingHorizontal: espacio.m, paddingBottom: espacio.m,
  },

  pie: {
    ...tipo.detalle, color: color.textoTenue,
    paddingHorizontal: espacio.m, paddingTop: espacio.xl,
  },
});
