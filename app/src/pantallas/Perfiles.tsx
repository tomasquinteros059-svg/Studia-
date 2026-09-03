import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Boton, Campo } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { FILETE, cifras, color, espacio, radio, tenue, tipo } from "../ui/tema.ts";
import { usarDisposicion } from "../lib/pantalla.ts";
import { VERSION_VISIBLE } from "../lib/version.ts";
import { caminoDe, comoSePresenta } from "../dominio/acceso.ts";
import { nombreDesde } from "../dominio/registro-demo.ts";
import {
  PERFILES_DEMO, entrarComo, registrarse, type PerfilDemo,
} from "../lib/perfiles-demo.ts";

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
 * SOLO EN DEMOSTRACIÓN. Esta pantalla la monta `Entrada.tsx` únicamente
 * cuando no hay servidor configurado; con Supabase conectado se entra por
 * `Sesion.tsx` y nada de lo de acá se carga.
 *
 * La puerta cuando no hay servidor: el correo primero, siempre.
 *
 * Con Supabase conectado esta pantalla no aparece y quién eres lo decide el
 * inicio de sesión. Sin backend no hay a quién preguntarle, pero la regla no
 * cambia: nadie entra sin correo. Antes esto era un selector de perfiles que
 * se abría de par en par, y esa entrada anónima no existe en la aplicación de
 * verdad; tenerla acá enseñaba algo falso.
 *
 * Los perfiles de ejemplo siguen estando —son la única manera de ver las
 * cinco vistas en un aparato sin cuentas— pero recién después del correo.
 */
export default function Perfiles() {
  const { columnas, anchoContenido } = usarDisposicion();
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const camino = caminoDe(correo);
  const identificado = camino.tipo !== "invalido";

  const entrar = () => {
    try {
      registrarse(correo, nombre);
    } catch (err) {
      setError(err instanceof globalThis.Error ? err.message : "No pude entrar.");
    }
  };

  return (
    <ScrollView style={e.fondo} contentContainerStyle={[e.hoja, { maxWidth: Math.max(anchoContenido, 560) }]}>
      <Text style={tipo.etiqueta}>Modo demostración</Text>
      <Text style={e.titulo}>Entra con tu correo</Text>
      <Text style={e.bajada}>
        StudIA no se abre sin correo, tampoco acá. Escribe el tuyo y quedas
        registrado en este aparato: los datos son de ejemplo y no salen de él.
      </Text>

      <View style={e.puerta}>
        <Campo
          placeholder="tucorreo@ejemplo.cl" value={correo}
          onChangeText={(t) => { setCorreo(t); setError(null); }}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          accessibilityLabel="Correo"
        />
        {correo.trim().length > 0 ? (
          <View style={[e.aviso, identificado ? null : e.avisoMalo]}>
            <Text style={[e.avisoTexto, identificado ? null : e.avisoTextoMalo]}>
              {comoSePresenta(camino)}
            </Text>
          </View>
        ) : null}

        {identificado ? (
          <Campo
            placeholder={`Tu nombre (${nombreDesde(correo) || "opcional"})`}
            value={nombre} onChangeText={setNombre}
            autoCapitalize="words" accessibilityLabel="Tu nombre"
          />
        ) : null}

        {error ? <Text style={e.error}>{error}</Text> : null}

        <Boton texto="Entrar" onPress={entrar} deshabilitado={!identificado} />
      </View>

      {!identificado ? (
        <Text style={e.nota}>
          Esto no es un inicio de sesión: no pide clave y no verifica nada.
          Con el servidor conectado, quién eres lo decide tu cuenta y los
          permisos los aplica la base de datos, no la app.
        </Text>
      ) : null}

      {identificado ? (
        <>
        <Text style={[tipo.etiqueta, e.aparte]}>O mira cómo se ve para otros</Text>
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
          Ninguno de estos es un inicio de sesión: no piden clave y los datos son
          de ejemplo, guardados en este aparato. Con el servidor conectado, quién
          eres lo decide tu cuenta y los permisos los aplica la base de datos,
          no la app.
        </Text>
        </>
      ) : null}

      {/* Se ve antes de entrar: es la forma más rápida de comprobar que se
          instaló el APK nuevo y no se abrió el viejo de Descargas. */}
      {VERSION_VISIBLE ? <Text style={e.version}>{VERSION_VISIBLE}</Text> : null}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  hoja: { padding: espacio.l, paddingTop: espacio.xl, gap: espacio.s, width: "100%", alignSelf: "center" },
  titulo: { ...tipo.portada, marginTop: 2 },
  puerta: { gap: espacio.s, marginBottom: espacio.m },
  aparte: { marginTop: espacio.l, paddingTop: espacio.l, borderTopWidth: FILETE, borderTopColor: color.bordeFuerte },
  aviso: { backgroundColor: color.elemento, borderRadius: radio.tarjeta, padding: espacio.m },
  avisoMalo: { backgroundColor: tenue(color.vivo) },
  avisoTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20 },
  avisoTextoMalo: { color: color.vivo },
  error: { color: color.vivo, fontSize: 13.5 },
  bajada: { ...tipo.cuerpo, color: color.textoSuave, lineHeight: 21, marginBottom: espacio.m },

  grilla: { gap: espacio.s },
  grillaAncha: { flexDirection: "row", flexWrap: "wrap" },

  tarjeta: {
    flexDirection: "row", gap: espacio.m, alignItems: "flex-start",
    padding: espacio.m,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.tarjeta,
    backgroundColor: color.papel,
  },
  tarjetaAncha: { flexBasis: "48%", flexGrow: 1 },
  apretada: { backgroundColor: color.elemento },

  marca: {
    width: 46, height: 46, borderRadius: radio.campo,
    alignItems: "center", justifyContent: "center",
  },
  encabezado: { flexDirection: "row", alignItems: "center", gap: espacio.s, flexWrap: "wrap" },
  nombre: { ...tipo.subtitulo, fontSize: 17 },
  pastilla: { borderRadius: radio.pastilla, paddingHorizontal: espacio.s, paddingVertical: 3 },
  pastillaTexto: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.3 },
  descripcion: { ...tipo.detalle, lineHeight: 19 },

  version: {
    ...tipo.detalle, ...cifras, color: color.textoTenue,
    textAlign: "center", paddingTop: espacio.m,
  },
  nota: {
    ...tipo.detalle, lineHeight: 19, marginTop: espacio.l,
    padding: espacio.m, backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
});
