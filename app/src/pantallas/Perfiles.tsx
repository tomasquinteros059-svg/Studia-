import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icono } from "../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../ui/tema.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { PERFILES_DEMO, entrarComo, type PerfilDemo } from "../lib/perfiles-demo.ts";

const ICONO = {
  estudiante: "documento",
  profesor: "persona",
  administrador: "horario",
} as const;

const TONO: Record<PerfilDemo["rol"], string> = {
  estudiante: color.marca,
  profesor: "#1E8E5A",
  administrador: "#C9701C",
};

// Quien llega sin institución es un estudiante más para la aplicación, pero
// en esta pantalla conviene que se distinga: es la vista más distinta de las
// cinco y confundirla con la del alumno del colegio sería lo fácil.
const tonoDe = (p: PerfilDemo): string =>
  p.institucion ? TONO[p.rol] : "#7A4FD6";
const iconoDe = (p: PerfilDemo) =>
  p.institucion ? ICONO[p.rol] : ("tutor" as const);

/**
 * Con quién entrar, solo en modo demostración.
 *
 * Con Supabase conectado esta pantalla no aparece: quién eres lo decide el
 * inicio de sesión. Sin backend no hay a quién preguntarle, y sin esto no
 * habría manera de ver las cuatro vistas en un aparato sin cuentas.
 */
export default function Perfiles() {
  const { columnas, anchoContenido } = usarDisposicion();

  return (
    <ScrollView style={e.fondo} contentContainerStyle={[e.hoja, { maxWidth: Math.max(anchoContenido, 560) }]}>
      <Text style={tipo.etiqueta}>Modo demostración</Text>
      <Text style={e.titulo}>¿Con quién quieres entrar?</Text>
      <Text style={e.bajada}>
        Cada perfil ve una aplicación distinta. Puedes cambiarte cuando
        quieras desde tu perfil, sin perder nada. El último no pertenece a
        ninguna institución: parte de cero y arma sus propios ramos.
      </Text>

      <View style={[e.grilla, columnas > 1 ? e.grillaAncha : null]}>
        {PERFILES_DEMO.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`Entrar como ${p.nombre}, ${p.titulo}`}
            onPress={() => entrarComo(p.id)}
            style={({ pressed }) => [
              e.tarjeta,
              columnas > 1 ? e.tarjetaAncha : null,
              pressed ? e.apretada : null,
            ]}
          >
            <View style={[e.marca, { backgroundColor: tenue(tonoDe(p)) }]}>
              <Icono nombre={iconoDe(p)} tamano={20} tono={tonoDe(p)} />
            </View>

            <View style={{ flex: 1, gap: 3 }}>
              <View style={e.encabezado}>
                <Text style={e.nombre}>{p.nombre}</Text>
                <View style={[e.pastilla, { backgroundColor: tenue(tonoDe(p)) }]}>
                  <Text style={[e.pastillaTexto, { color: tonoDe(p) }]}>{p.titulo}</Text>
                </View>
              </View>
              <Text style={e.descripcion}>{p.descripcion}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={e.nota}>
        Esto no es un inicio de sesión: no pide clave y los datos son de
        ejemplo, guardados en este aparato. Con el servidor conectado, quién
        eres lo decide tu cuenta y los permisos los aplica la base de datos,
        no la app.
      </Text>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  hoja: { padding: espacio.l, paddingTop: espacio.xl, gap: espacio.s, width: "100%", alignSelf: "center" },
  titulo: { ...tipo.titulo, color: color.texto, marginTop: 2 },
  bajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21, marginBottom: espacio.m },

  grilla: { gap: espacio.s },
  grillaAncha: { flexDirection: "row", flexWrap: "wrap" },

  tarjeta: {
    flexDirection: "row", gap: espacio.m, alignItems: "flex-start",
    padding: espacio.m,
    borderWidth: 1, borderColor: color.borde, borderRadius: radio.tarjeta,
    backgroundColor: color.fondo,
  },
  tarjetaAncha: { flexBasis: "48%", flexGrow: 1 },
  apretada: { backgroundColor: color.elemento },

  marca: {
    width: 40, height: 40, borderRadius: radio.pastilla,
    alignItems: "center", justifyContent: "center",
  },
  encabezado: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nombre: { fontSize: 16, fontWeight: "600", color: color.texto },
  pastilla: { borderRadius: radio.pastilla, paddingHorizontal: 8, paddingVertical: 2 },
  pastillaTexto: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  descripcion: { ...tipo.detalle, lineHeight: 18 },

  nota: {
    ...tipo.detalle, lineHeight: 18, marginTop: espacio.l,
    padding: espacio.m, backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
});
