import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Campo, Cargando, Encabezado, Error as ErrorUI, Fila, Vacio } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import {
  FILETE, color, colorDeRamo, espacio, radio, tenue, tipo,
} from "../../ui/tema.ts";
import { materiaDe, misAsignaturas } from "../../lib/consultas.ts";
import { usarCarga } from "../../lib/usarCarga.ts";
import { usarQuienSoy } from "../../lib/quien-soy.ts";
import { buscarMaterial, comoSeResume, juntarMaterial, type Pieza } from "../../dominio/biblioteca.ts";
import type { PropsPestanaDocente } from "../../lib/rutas.ts";

/**
 * Todo el material del profesor, junto.
 *
 * Dentro de un ramo la materia ya se veía. Esto existe porque quien dicta
 * cuatro cursos no piensa por ramo cuando busca algo: piensa «dónde dejé la
 * guía de derivadas», y hasta ahora tenía que entrar ramo por ramo a
 * acordarse.
 *
 * Se puede filtrar por ramo y buscar por texto, y la búsqueda mira el título,
 * la unidad y el ramo, porque las tres son maneras legítimas de acordarse de
 * algo: por cómo se llama, por dónde estaba, o de qué curso era.
 */
export default function MaterialDocente({ navigation }: PropsPestanaDocente<"Material">) {
  const { yo } = usarQuienSoy();
  const dicta = yo?.dicta ?? [];
  const [busqueda, setBusqueda] = useState("");
  const [soloRamo, setSoloRamo] = useState<string | null>(null);

  const traer = useCallback(async () => {
    const asignaturas = await misAsignaturas();
    const mios = asignaturas.filter((a) => dicta.includes(a.id));
    const conMateria = await Promise.all(mios.map(async (ramo) => ({
      id: ramo.id, nombre: ramo.nombre, color: ramo.color,
      modulos: await materiaDe(ramo.id),
    })));
    return { ramos: conMateria };
  }, [dicta.join(",")]);

  const { datos, cargando, error, recargar, refrescar, refrescando } = usarCarga(traer, [dicta.join(",")]);

  if (cargando) return <Cargando />;
  if (error) return <ErrorUI mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  const todo = juntarMaterial(datos.ramos);
  const delRamo = soloRamo ? todo.filter((p) => p.ramoId === soloRamo) : todo;
  const visibles = buscarMaterial(delRamo, busqueda);

  // Se agrupa por ramo y unidad para no perder de dónde salió cada cosa: una
  // lista plana de sesenta títulos no dice nada.
  const porUnidad: { clave: string; ramo: string; ramoId: string; unidad: string; piezas: Pieza[] }[] = [];
  for (const p of visibles) {
    const clave = `${p.ramoId}·${p.unidad}`;
    const grupo = porUnidad.find((g) => g.clave === clave);
    if (grupo) grupo.piezas.push(p);
    else porUnidad.push({ clave, ramo: p.ramo, ramoId: p.ramoId, unidad: p.unidad, piezas: [p] });
  }

  return (
    <View style={e.pantalla}>
      <View style={e.arriba}>
        <Campo
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar en todo mi material"
          accessibilityLabel="Buscar material"
        />
        <Text style={tipo.detalle}>{comoSeResume(delRamo)}</Text>

        {datos.ramos.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={e.ramos}>
            <Pressable accessibilityRole="button"
              accessibilityState={{ selected: soloRamo === null }}
              accessibilityLabel="Todos mis ramos"
              onPress={() => setSoloRamo(null)}
              style={[e.pastilla, soloRamo === null ? e.pastillaPuesta : null]}>
              <Text style={[e.pastillaTexto, soloRamo === null ? { color: color.sobreMarca } : null]}>
                Todos
              </Text>
            </Pressable>
            {datos.ramos.map((r) => {
              const puesto = soloRamo === r.id;
              const tono = colorDeRamo(r.id, r.color);
              return (
                <Pressable key={r.id} accessibilityRole="button"
                  accessibilityState={{ selected: puesto }}
                  accessibilityLabel={`Solo ${r.nombre}`}
                  onPress={() => setSoloRamo(puesto ? null : r.id)}
                  style={[
                    e.pastilla,
                    puesto ? { backgroundColor: tenue(tono), borderColor: tono } : null,
                  ]}>
                  <Text style={[e.pastillaTexto, puesto ? { color: tono } : null]} numberOfLines={1}>
                    {r.nombre}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: espacio.xl }}>
        {visibles.length === 0 ? (
          <Vacio texto={
            busqueda.trim()
              ? `Nada que diga «${busqueda.trim()}» en tu material.`
              : "Todavía no hay material en este ramo."
          } />
        ) : porUnidad.map((g) => (
          <View key={g.clave}>
            <Encabezado texto={`${g.ramo} · ${g.unidad}`} />
            {g.piezas.map((p) => (
              <Fila key={p.id}
                izquierda={<Icono
                  nombre={p.tipo === "video" ? "video" : p.tipo === "documento" ? "documento" : "ejercicios"}
                  tono={colorDeRamo(g.ramoId, undefined)} />}
                titulo={p.titulo}
                detalle={p.detalle}
                onPress={() => navigation.navigate("RamoDocente", { asignaturaId: g.ramoId })}
              />
            ))}
          </View>
        ))}

        <Text style={e.pie}>
          Esto es lo que ve tu curso. Para agregar o sacar material, entra al
          ramo: ahí está junto a las tareas y las notas.
        </Text>
      </ScrollView>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  arriba: {
    padding: espacio.m, gap: espacio.s,
    borderBottomWidth: FILETE, borderBottomColor: color.bordeFuerte,
    backgroundColor: color.papel,
  },
  ramos: { gap: espacio.s, paddingTop: 2 },
  pastilla: {
    borderRadius: radio.pastilla, paddingHorizontal: espacio.m, paddingVertical: 7,
    borderWidth: FILETE, borderColor: color.bordeFuerte, backgroundColor: color.papel,
    maxWidth: 190,
  },
  pastillaPuesta: { backgroundColor: color.marca, borderColor: color.marca },
  pastillaTexto: { fontSize: 13.5, fontWeight: "600", color: color.textoSuave },
  pie: { ...tipo.detalle, lineHeight: 19, padding: espacio.l },
});
