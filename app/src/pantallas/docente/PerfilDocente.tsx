import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Boton, Encabezado, Fila } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tipo } from "../../ui/tema.ts";
import { salir } from "../../lib/perfiles-demo.ts";
import { usarQuienSoy } from "../../lib/quien-soy.ts";
import { MODO_DEMO } from "../../lib/config.ts";
import { puedePublicarNotas } from "../../dominio/curso.ts";
import { aviso } from "../../dominio/legales.ts";
import type { PropsPestanaDocente } from "../../lib/rutas.ts";

/**
 * Quién soy y qué puedo hacer. Lo segundo importa más de lo que parece: un
 * ayudante que no sabe que no puede publicar notas va a buscar el botón.
 */
export default function PerfilDocente({ navigation }: PropsPestanaDocente<"Perfil">) {
  const { yo } = usarQuienSoy();
  if (!yo) return null;
  const papel = yo.papel ?? "ayudante";
  const esColegio = yo.rol === "administrador";

  const puede = esColegio ? [
    { texto: "Definir qué ramos existen", si: true },
    { texto: "Armar el horario y asignar salas", si: true },
    { texto: "Decir quién dicta cada ramo", si: true },
    { texto: "Inscribir alumnos", si: true },
    { texto: "Cargar material de un ramo", si: false },
    { texto: "Poner o publicar notas", si: false },
  ] : [
    { texto: "Ver el curso completo y sus entregas", si: true },
    { texto: "Corregir entregas y poner puntaje", si: true },
    { texto: "Cargar material y lecturas", si: true },
    { texto: "Responder el foro como docente", si: true },
    { texto: "Poner notas", si: true },
    { texto: "Publicar las notas al curso", si: puedePublicarNotas(papel) },
  ];

  const noPuede = esColegio ? [
    "Ver los apuntes de ningún alumno",
    "Ver lo que le preguntan al tutor",
    "Ver los resúmenes de clase",
    "Poner o cambiar una nota",
  ] : [
    "Ver los apuntes de sus alumnos",
    "Ver lo que le preguntan al tutor",
    "Ver los resúmenes de clase de un alumno",
    "Tocar un ramo que no dicta",
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.fondo }}
      contentContainerStyle={{ paddingBottom: espacio.xl }}>
      <View style={e.ficha}>
        <View style={e.avatar}><Icono nombre="persona" tamano={26} tono={color.marca} /></View>
        <View style={{ flex: 1 }}>
          <Text style={e.nombre}>{yo.nombre}</Text>
          <Text style={tipo.detalle}>
            {esColegio ? "Administración" : papel === "profesor" ? "Profesora o profesor" : "Ayudante"}
            {" · "}{yo.correo}
          </Text>
        </View>
      </View>

      <Encabezado texto="Lo que puedes hacer" />
      {puede.map((x) => (
        <Fila key={x.texto}
          izquierda={<Icono nombre={x.si ? "listo" : "cerrar"} tamano={17}
            tono={x.si ? color.ok : color.textoSuave} />}
          titulo={x.texto}
          detalle={x.si ? undefined : "Es del profesor, no del ayudante"}
        />
      ))}

      <Encabezado texto={esColegio ? "Lo que no alcanza" : "Lo que no ve nadie más que el alumno"} />
      {noPuede.map((t) => (
        <Fila key={t}
          izquierda={<Icono nombre="cerrar" tamano={17} tono={color.textoSuave} />}
          titulo={t}
        />
      ))}
      <Text style={e.nota}>
        Un alumno que sabe que lo leen deja de escribir lo que no entiende, y
        eso es justo lo que hace útil al tutor. No es un ajuste de la app: lo
        impide la base de datos, con tres pruebas que lo verifican.
      </Text>

      {/* Los mismos textos que ve el curso: el acuerdo es uno solo, y quien
          dicta también lo aceptó. */}
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

      {MODO_DEMO ? (
        <View style={{ padding: espacio.l }}>
          <Boton texto="Cambiar de perfil" onPress={salir} />
        </View>
      ) : null}

      <Text style={e.copyright}>{aviso(new Date().getFullYear())}</Text>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  ficha: { flexDirection: "row", alignItems: "center", gap: espacio.m, padding: espacio.l },
  avatar: {
    width: 52, height: 52, borderRadius: radio.pastilla, backgroundColor: color.elemento,
    alignItems: "center", justifyContent: "center",
  },
  nombre: { fontSize: 19, fontWeight: "600", color: color.texto },
  nota: {
    ...tipo.detalle, lineHeight: 18, margin: espacio.l,
    padding: espacio.m, backgroundColor: color.elemento, borderRadius: radio.tarjeta,
  },
  copyright: {
    ...tipo.detalle, color: color.textoTenue,
    textAlign: "center", paddingTop: espacio.l,
  },
});
