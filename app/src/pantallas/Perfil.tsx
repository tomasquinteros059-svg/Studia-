import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Boton, Campo, Cargando, Encabezado, Error, Fila, Pantalla } from "../ui/componentes.tsx";
import { Icono } from "../ui/Icono.tsx";
import { cifras, color, espacio, tipo } from "../ui/tema.ts";
import { cambiarNombre, miPerfil } from "../lib/consultas.ts";
import { usarCarga } from "../lib/usarCarga.ts";
import { supabase } from "../lib/supabase.ts";
import { MODO_DEMO } from "../lib/config.ts";
import { salir } from "../lib/perfiles-demo.ts";
import { inicialesDePersona } from "../dominio/personas.ts";
import { VERSION_VISIBLE } from "../lib/version.ts";
import { aviso } from "../dominio/legales.ts";
import { PALABRA_PARA_BORRAR, borrarMiCuenta } from "../lib/cuenta.ts";
import { apagarAvisos, avisosEncendidos, encenderAvisos, sePuedeAvisar } from "../lib/avisos.ts";
import { olvidarTodasLasCopias } from "../lib/copia.ts";
import { comoSeCuentaElPlan, NOMBRE_DEL_PLAN } from "../dominio/planes.ts";
import type { PropsPila } from "../lib/rutas.ts";
import { comoSeDice } from "../dominio/fallas.ts";

export default function Perfil({ navigation }: PropsPila<"Perfil">) {
  const { datos, cargando, error, recargar } = usarCarga(miPerfil, []);
  const [nombre, setNombre] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // El borrado se abre en dos pasos: primero se despliega, después se escribe.
  // Un botón rojo suelto en una pantalla se aprieta sin querer.
  const [abriendoBorrado, setAbriendoBorrado] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [borrando, setBorrando] = useState(false);
  // Null mientras no se sabe: preguntarle al sistema toma un momento y pintar
  // el interruptor en «no» antes de saberlo lo hace parpadear.
  const [avisos, setAvisos] = useState<boolean | null>(null);
  const [cambiandoAvisos, setCambiandoAvisos] = useState(false);

  useEffect(() => {
    if (!sePuedeAvisar) { setAvisos(false); return; }
    let vigente = true;
    void avisosEncendidos().then((si) => { if (vigente) setAvisos(si); });
    return () => { vigente = false; };
  }, []);

  const cambiarAvisos = useCallback(async (encender: boolean) => {
    setCambiandoAvisos(true);
    try {
      const r = encender ? await encenderAvisos() : await apagarAvisos();
      if (!r.ok) { Alert.alert("Los avisos quedaron como estaban", r.motivo); return; }
      setAvisos(encender);
    } finally {
      setCambiandoAvisos(false);
    }
  }, []);

  const guardar = useCallback(async () => {
    const limpio = (nombre ?? "").trim();
    if (!limpio) { Alert.alert("El nombre no puede quedar vacío."); return; }
    setGuardando(true);
    try {
      await cambiarNombre(limpio);
      setNombre(null);
      recargar();
      Alert.alert("Listo", "Tu nombre quedó actualizado.");
    } catch (err) {
      Alert.alert("No pude guardarlo", comoSeDice(err));
    } finally {
      setGuardando(false);
    }
  }, [nombre, recargar]);

  const borrar = useCallback(async () => {
    setBorrando(true);
    try {
      await borrarMiCuenta(confirmacion);
      // No hace falta navegar: al cerrarse la sesión, la aplicación vuelve
      // sola a la portada.
    } catch (err) {
      Alert.alert("No pude borrarla", comoSeDice(err));
    } finally {
      setBorrando(false);
    }
  }, [confirmacion]);

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const valor = nombre ?? datos.nombre;
  const cambio = valor.trim() !== datos.nombre;

  return (
    <Pantalla>
      <View style={e.hero}>
        <View style={e.avatar}>
          <Text style={e.iniciales}>{inicialesDePersona(datos.nombre)}</Text>
        </View>
        <Text style={e.nombre}>{datos.nombre}</Text>
        <Text style={tipo.detalle}>{datos.correo}</Text>
      </View>

      <Encabezado texto="Tu nombre" />
      <View style={{ paddingHorizontal: espacio.m, gap: 9 }}>
        <Campo value={valor} onChangeText={setNombre} accessibilityLabel="Tu nombre"
          autoCapitalize="words" />
        <Text style={tipo.detalle}>
          Es el nombre con el que apareces en el foro de tus asignaturas.
        </Text>
        {cambio ? (
          <Boton texto={guardando ? "Guardando…" : "Guardar"} onPress={guardar} deshabilitado={guardando} />
        ) : null}
      </View>

      <Encabezado texto="Sesión" />
      <View style={{ paddingHorizontal: espacio.m }}>
        {/* Las copias guardadas se van con la sesión. Lo de una persona no
            puede quedar en el teléfono esperando a la siguiente. */}
        <Boton texto="Cerrar sesión" variante="suave" onPress={() => {
          void olvidarTodasLasCopias().finally(() => void supabase.auth.signOut());
        }} />
      </View>

      <Text style={e.pie}>
        Tu correo no se guarda en la base de datos de la app: sale de tu sesión.
        Nadie más puede verlo.
      </Text>

      {/* Qué plan tiene, y qué cambia eso. Una función que funciona en
          silencio es una función que nadie sabe que pagó. */}
      <Encabezado texto="Tu plan" />
      <View style={{ paddingHorizontal: espacio.m, gap: 6 }}>
        <Text style={tipo.fila}>{NOMBRE_DEL_PLAN[datos.plan]}</Text>
        <Text style={tipo.detalle}>{comoSeCuentaElPlan(datos.plan)}</Text>
      </View>

      {/* Los avisos, antes de lo legal: es lo único de esta pantalla que
          alguien viene a cambiar de verdad. */}
      <Encabezado texto="Avisos" />
      <View style={{ paddingHorizontal: espacio.m, gap: espacio.s }}>
        <View style={e.filaAviso}>
          <View style={{ flex: 1 }}>
            <Text style={tipo.fila}>Avisarme en el teléfono</Text>
            <Text style={tipo.detalle}>
              {sePuedeAvisar
                ? "La clase que empieza, la entrega que vence y las notas publicadas. Los anuncios del profesor no suenan: los ves al abrir la app."
                : "Este aparato no puede recibir avisos."}
            </Text>
          </View>
          <Switch
            value={avisos === true}
            onValueChange={(v) => void cambiarAvisos(v)}
            disabled={!sePuedeAvisar || avisos === null || cambiandoAvisos}
            accessibilityLabel="Avisarme en el teléfono"
            trackColor={{ true: color.marca, false: color.elemento }}
          />
        </View>
      </View>

      {/* Los textos legales se leen desde acá y no desde un enlace a la web:
          quien aceptó unos términos tiene derecho a leerlos, y en la sala
          donde no hay señal un enlace no sirve de nada. */}
      <Encabezado texto="Legal" />
      <Fila titulo="Términos de uso" detalle="Las reglas de StudIA"
        derecha={<Icono nombre="siguiente" tamano={18} tono={color.textoTenue} />}
        onPress={() => navigation.navigate("Legal", { que: "terminos" })} />
      <Fila titulo="Política de privacidad" detalle="Qué se guarda y qué no"
        derecha={<Icono nombre="siguiente" tamano={18} tono={color.textoTenue} />}
        onPress={() => navigation.navigate("Legal", { que: "privacidad" })} />
      <Fila titulo="Licencias de terceros" detalle="Las bibliotecas sobre las que está hecha"
        derecha={<Icono nombre="siguiente" tamano={18} tono={color.textoTenue} />}
        onPress={() => navigation.navigate("Legal", { que: "terceros" })} />

      {/* Borrar la cuenta va acá, al final y sin adornos.
          Play Store lo exige desde 2024 a toda aplicación con registro, y la
          política de privacidad lo promete. Pero además es lo correcto: quien
          entregó sus apuntes a una aplicación tiene que poder llevárselos de
          vuelta sin escribirle a nadie ni esperar respuesta. */}
      <Encabezado texto="Borrar mi cuenta" />
      <View style={{ paddingHorizontal: espacio.m, gap: espacio.s }}>
        {!abriendoBorrado ? (
          <>
            <Text style={tipo.detalle}>
              Se borra tu perfil y todo lo tuyo: apuntes, notas, entregas, fichas,
              quizzes y lo que le preguntaste al tutor. No se puede deshacer.
            </Text>
            <Boton texto="Borrar mi cuenta" variante="suave"
              onPress={() => setAbriendoBorrado(true)} />
          </>
        ) : (
          <>
            <Text style={e.avisoBorrado}>
              Esto no se puede deshacer. Lo que hayas escrito en el foro se queda,
              porque es parte de la conversación de tu curso, pero deja de llevar
              tu nombre.
            </Text>
            <Text style={tipo.detalle}>
              Para confirmar, escribe {PALABRA_PARA_BORRAR} aquí abajo.
            </Text>
            <Campo value={confirmacion} onChangeText={setConfirmacion}
              autoCapitalize="characters" autoCorrect={false}
              accessibilityLabel={`Escribe ${PALABRA_PARA_BORRAR} para confirmar`}
              placeholder={PALABRA_PARA_BORRAR} />
            <Boton
              texto={borrando ? "Borrando…" : "Borrar mi cuenta para siempre"}
              onPress={borrar}
              deshabilitado={borrando || confirmacion.trim().toUpperCase() !== PALABRA_PARA_BORRAR}
            />
            <Boton texto="Mejor no" variante="suave"
              onPress={() => { setAbriendoBorrado(false); setConfirmacion(""); }} />
          </>
        )}
      </View>

      <Text style={e.copyright}>{aviso(new Date().getFullYear())}</Text>

      {/* Para saber qué versión estás probando sin tener que adivinar. */}
      {VERSION_VISIBLE ? <Text style={e.version}>{VERSION_VISIBLE}</Text> : null}

      {MODO_DEMO ? (
        <View style={{ paddingHorizontal: espacio.l, paddingBottom: espacio.l }}>
          <Boton texto="Cambiar de perfil" onPress={salir} />
        </View>
      ) : null}
    </Pantalla>
  );
}

const e = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: espacio.xl, gap: espacio.s },
  avatar: {
    width: 84, height: 84, borderRadius: 28, backgroundColor: color.marca,
    alignItems: "center", justifyContent: "center",
  },
  iniciales: { color: color.sobreMarca, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  nombre: { ...tipo.titulo },
  pie: { ...tipo.detalle, textAlign: "center", padding: espacio.l, lineHeight: 19 },
  version: {
    ...tipo.detalle, ...cifras, color: color.textoTenue,
    textAlign: "center", paddingBottom: espacio.l,
  },
  copyright: {
    ...tipo.detalle, color: color.textoTenue,
    textAlign: "center", paddingTop: espacio.l,
  },
  filaAviso: { flexDirection: "row", alignItems: "center", gap: espacio.m },
  avisoBorrado: {
    ...tipo.cuerpo, color: color.texto, lineHeight: 21,
    backgroundColor: `${color.vivo}14`, borderRadius: 14, padding: espacio.m,
  },
});
