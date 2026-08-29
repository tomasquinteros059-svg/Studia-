import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Baldosa, Boton } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import {
  COLORES_DE_RAMO, FILETE, color, espacio, radio, tipo,
} from "../ui/tema.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { VERSION_VISIBLE } from "../lib/version.ts";
import { PROVEEDORES, type Proveedor } from "../dominio/acceso-proveedores.ts";
import { entrarCon } from "../lib/proveedores.ts";

/**
 * La portada: lo primero que se ve al abrir StudIA en el navegador.
 *
 * Antes se entraba directo al selector de perfiles o al formulario de la
 * clave, y en una pantalla ancha eso es una columna de teléfono perdida en
 * el medio: no dice qué es esto ni por qué serviría.
 *
 * El diseño sigue la misma regla que el resto de la aplicación —el color es
 * de los ramos y nada más lleva color— y por eso la portada es tinta y
 * papel. Lo único con color son las baldosas de los ramos, que es
 * exactamente lo que el color significa acá adentro: son la muestra de lo
 * que la persona va a tener cuando entre.
 */
export default function Portada({
  entrar, probar, sinServidor,
}: {
  entrar: () => void;
  /** Recorrer con datos de ejemplo. Sin servidor es el único camino. */
  probar?: () => void;
  /**
   * No hay con quién autenticarse. Lo decide quien abre la portada, no ella:
   * así se puede dibujar y probar en los dos casos sin depender de cómo esté
   * configurado el arranque.
   */
  sinServidor?: boolean;
}) {
  const { ancho } = usarDisposicion();
  const margenes = useSafeAreaInsets();
  const [entrando, setEntrando] = useState<Proveedor | null>(null);
  const [falla, setFalla] = useState<string | null>(null);

  const conProveedor = async (id: Proveedor) => {
    // El botón se muestra igual —es parte de cómo se entra— pero dice por
    // qué no puede hacerlo ahora, que es más honesto que desaparecer sin
    // explicación.
    if (sinServidor) {
      setFalla(
        "Esta es la versión de demostración y no tiene servidor detrás. "
        + "Entra con datos de ejemplo para mirarla.",
      );
      return;
    }
    setEntrando(id);
    setFalla(null);
    const r = await entrarCon(id);
    if (!r.ok) setFalla(r.motivo || null);
    setEntrando(null);
  };
  // A partir de acá caben las dos columnas sin apretar ninguna.
  const anchaPantalla = ancho >= 900;

  return (
    <ScrollView
      style={e.fondo}
      contentContainerStyle={{ paddingBottom: espacio.xl + margenes.bottom }}
    >
      <View style={[e.tinta, { paddingTop: espacio.xl + margenes.top }]}>
        <View style={[e.dentro, anchaPantalla ? e.dentroAncho : null]}>
          <View style={e.sello}>
            <Text style={e.selloTexto}>S</Text>
          </View>
          <Text style={[e.marca, anchaPantalla ? e.marcaGrande : null]}>StudIA</Text>
          <Text style={[e.lema, anchaPantalla ? e.lemaGrande : null]}>
            Aprende pensando, no copiando.
          </Text>
          <Text style={e.bajada}>
            Tus clases, tu materia y tus tareas en un solo lugar. Y un tutor
            que te guía para que descubras la respuesta, no para que la copies.
          </Text>

          {/* Los ramos, que son el color de esta aplicación. */}
          <View style={e.ramos}>
            {MUESTRA.map((r, i) => (
              <Baldosa key={r} tono={COLORES_DE_RAMO[i % COLORES_DE_RAMO.length]!}
                texto={r} tamano={anchaPantalla ? 52 : 42} />
            ))}
          </View>
        </View>
      </View>

      <View style={[e.papelera, anchaPantalla ? e.papeleraAncha : null]}>
        <View style={[e.hoja, anchaPantalla ? e.hojaAncha : null]}>
          <View style={anchaPantalla ? e.columna : undefined}>
            <Text style={tipo.etiqueta}>Qué vas a encontrar</Text>
            <View style={{ gap: espacio.m, marginTop: espacio.m }}>
              {LO_QUE_HAY.map((x) => (
                <View key={x.titulo} style={e.punto}>
                  <View style={e.puntoSello}>
                    <Icono nombre={x.icono} tamano={19} tono={color.marca} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={tipo.fila}>{x.titulo}</Text>
                    <Text style={e.puntoTexto}>{x.detalle}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={anchaPantalla ? e.separador : e.separadorTendido} />

          <View style={[anchaPantalla ? e.columnaEntrar : null, { gap: espacio.m }]}>
            <Text style={tipo.etiqueta}>Entrar</Text>
            <Text style={e.entrarBajada}>
              Con el correo de tu institución tus ramos aparecen solos. Con
              cualquier otro, armas los tuyos.
            </Text>

            {/* Primero las cuentas que la persona ya tiene: en un colegio la
                de Google o la de Microsoft ya existe, y es una contraseña
                menos que inventar y que nosotros tengamos que cuidar. */}
            {PROVEEDORES.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button"
                    accessibilityLabel={`Continuar con ${p.nombre}`}
                    onPress={() => void conProveedor(p.id)}
                    disabled={entrando !== null}
                    style={({ pressed }) => [
                      e.proveedor,
                      pressed ? { backgroundColor: color.elemento } : null,
                      entrando !== null && entrando !== p.id ? { opacity: 0.5 } : null,
                    ]}>
                    <View style={e.marcaProveedor}>
                      <Text style={e.marcaProveedorTexto}>{p.marca}</Text>
                    </View>
                    <Text style={e.proveedorTexto}>
                      {entrando === p.id ? "Un momento…" : `Continuar con ${p.nombre}`}
                    </Text>
                  </Pressable>
                ))}

            <View style={e.o}>
              <View style={e.oRaya} />
              <Text style={e.oTexto}>o</Text>
              <View style={e.oRaya} />
            </View>

            {falla ? <Text style={e.falla}>{falla}</Text> : null}

            <Boton texto="Entrar con mi correo" onPress={entrar} />
            {probar ? (
              <>
                <Boton texto="Mirar con datos de ejemplo" variante="suave" onPress={probar} />
                <Text style={e.nota}>
                  Los datos de ejemplo se quedan en este aparato. No hace falta
                  cuenta ni internet.
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[e.pie, anchaPantalla ? e.pieAncho : null]}>
        <Text style={e.pieTexto}>
          StudIA · el tutor guía, no resuelve.
          {VERSION_VISIBLE ? `  ${VERSION_VISIBLE}` : ""}
        </Text>
      </View>
    </ScrollView>
  );
}

/** Las iniciales de seis ramos cualesquiera: es una muestra, no una lista. */
const MUESTRA = ["CI", "ÁL", "FI", "IO", "MI", "PR"];

const LO_QUE_HAY = [
  {
    icono: "escuchar",
    titulo: "Un lector que lee en voz alta",
    detalle: "Pega un texto y lo escuchas mientras sigues la frase con la vista y tomas apuntes.",
  },
  {
    icono: "tutor",
    titulo: "Un tutor que no te da la respuesta",
    detalle: "Te pregunta de vuelta hasta que la encuentres tú. Está hecho así a propósito.",
  },
  {
    icono: "horario",
    titulo: "Tu semestre completo",
    detalle: "Ramos, horario, tareas y notas. Se carga de una vez, no de a uno.",
  },
] as const satisfies readonly {
  icono: Parameters<typeof Icono>[0]["nombre"];
  titulo: string;
  detalle: string;
}[];

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },

  // La tinta: la superficie de la marca. No lleva color de ramo porque no
  // es un ramo, y ese es justamente el pacto del sistema visual.
  tinta: { backgroundColor: color.nocturno, paddingHorizontal: espacio.l, paddingBottom: espacio.xl },
  dentro: { gap: espacio.m, width: "100%", alignSelf: "center", maxWidth: 620 },
  dentroAncho: { maxWidth: 980, alignItems: "flex-start" },

  sello: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  selloTexto: { color: "#fff", fontSize: 27, fontWeight: "800", letterSpacing: -1 },

  marca: { color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -1.4 },
  marcaGrande: { fontSize: 58, letterSpacing: -2.2 },
  lema: { color: "#fff", fontSize: 20, fontWeight: "700", letterSpacing: -0.4, opacity: 0.92 },
  lemaGrande: { fontSize: 26, letterSpacing: -0.7 },
  bajada: {
    color: "#fff", opacity: 0.7, fontSize: 15.5, lineHeight: 24, maxWidth: 560,
  },
  ramos: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s, marginTop: espacio.s },

  // La hoja de papel sube sobre la tinta: es la misma idea de siempre, el
  // contenido es papel encima del fondo.
  papelera: { paddingHorizontal: espacio.m, marginTop: -espacio.l },
  papeleraAncha: { paddingHorizontal: espacio.l },
  hoja: {
    width: "100%", alignSelf: "center", maxWidth: 620,
    backgroundColor: color.papel, borderRadius: radio.tarjeta,
    borderWidth: FILETE, borderColor: color.borde,
    padding: espacio.l, gap: espacio.l,
  },
  hojaAncha: { maxWidth: 980, flexDirection: "row", gap: espacio.xl, padding: espacio.xl },
  columna: { flex: 3 },
  columnaEntrar: { flex: 2 },
  separador: { width: FILETE, backgroundColor: color.borde },
  separadorTendido: { height: FILETE, backgroundColor: color.borde },

  punto: { flexDirection: "row", alignItems: "flex-start", gap: espacio.m },
  puntoSello: {
    width: 40, height: 40, borderRadius: radio.campo,
    alignItems: "center", justifyContent: "center", backgroundColor: color.elemento,
  },
  puntoTexto: { ...tipo.detalle, lineHeight: 20 },

  entrarBajada: { ...tipo.detalle, lineHeight: 20 },

  proveedor: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.boton,
    backgroundColor: color.papel, paddingHorizontal: espacio.m, paddingVertical: 13,
  },
  marcaProveedor: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center", backgroundColor: color.elemento,
  },
  marcaProveedorTexto: { fontSize: 15, fontWeight: "800", color: color.texto },
  proveedorTexto: { ...tipo.fila, flex: 1 },

  o: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  oRaya: { flex: 1, height: FILETE, backgroundColor: color.borde },
  oTexto: { ...tipo.detalle, color: color.textoTenue },

  falla: { ...tipo.detalle, color: color.vivo, lineHeight: 20 },

  pie: { paddingHorizontal: espacio.m, paddingTop: espacio.l, alignItems: "center" },
  pieAncho: { paddingHorizontal: espacio.l },
  pieTexto: { ...tipo.detalle, color: color.textoTenue, textAlign: "center" },
  nota: { ...tipo.detalle, lineHeight: 19 },
});
