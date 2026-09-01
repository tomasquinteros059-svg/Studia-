import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Baldosa, Boton, Campo, HojaModal } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import {
  FILETE, color, colorDeRamo, espacio, inicialesDeRamo, radio, tenue, tipo,
} from "../../ui/tema.ts";
import {
  detalleDe, minutosDeLectura, revisar, tituloDesdeNombre,
  type TipoDeMaterial,
} from "../../dominio/adjuntos.ts";
import {
  AVISO_SIN_ALMACENAMIENTO, HAY_ALMACENAMIENTO, elegirArchivo,
  miEspacio, sePuedeElegirArchivo, subir, type AdjuntoElegido,
} from "../../lib/archivos.ts";
import type { Destino } from "../../dominio/almacen.ts";

export type MaterialArmado = {
  tipo: TipoDeMaterial;
  titulo: string;
  detalle: string;
  texto: string | null;
  url: string | null;
  /**
   * En qué unidad va. Nulo significa «la que decida la capa de datos», que es
   * lo que corresponde en un ramo propio: ahí las unidades no las armó nadie y
   * hacer elegir una sería preguntar por algo que no existe.
   */
  moduloId: string | null;
};

/**
 * A qué ramo va el material, cuando se sube desde el inicio y no desde
 * adentro de un ramo. Puede ser uno que ya existe o uno que se crea en el
 * momento: quien todavía no tiene ninguno no debería tener que salir a
 * crear un ramo y volver.
 */
export type DestinoDelMaterial =
  | { tipo: "ramo"; id: string }
  | { tipo: "nuevo"; nombre: string };

/**
 * Cargar material en un ramo propio, de dos maneras.
 *
 * Escribir o pegar el texto funciona hoy y es lo que alimenta el lector.
 * Adjuntar un archivo elige el archivo pero todavía no lo guarda: no hay
 * almacenamiento conectado. El botón está igual, y dice por qué —esconderlo
 * haría que nadie pueda planificar con él.
 */
export default function NuevoMaterial({
  abierto, cerrar, guardar, ramos, unidades, dondeGuardar,
}: {
  abierto: boolean;
  cerrar: () => void;
  guardar: (material: MaterialArmado, destino: DestinoDelMaterial | null) => Promise<void>;
  /**
   * Los ramos entre los que elegir. Sin esto —abierto desde un ramo— no se
   * pregunta nada, porque ya se sabe dónde va.
   */
  ramos?: { id: string; nombre: string; color: string | null }[];
  /**
   * Las unidades del ramo, cuando las hay. Un ramo del colegio tiene un
   * programa con unidades y el material va en una de ellas; un ramo propio no,
   * y ahí esto no se muestra.
   */
  unidades?: { id: string; titulo: string }[];
  /**
   * Dónde queda el archivo. Por omisión, el espacio propio de quien lo sube.
   * Un docente carga material del ramo, y ahí va a la carpeta del ramo: lo
   * tiene que poder abrir el curso entero, no solo él.
   */
  dondeGuardar?: Destino;
}) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  // null = ramo nuevo, con el nombre que se escriba.
  const [destino, setDestino] = useState<string | null>(null);
  const [ramoNuevo, setRamoNuevo] = useState("");
  const [adjunto, setAdjunto] = useState<AdjuntoElegido | null>(null);
  // La unidad elegida. Por omisión la primera, que es la que casi siempre es.
  const [unidad, setUnidad] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const limpiar = () => {
    setTitulo(""); setTexto(""); setAdjunto(null); setAviso(null); setOcupado(false);
    setDestino(null); setRamoNuevo(""); setUnidad(null);
  };

  const hayQueElegir = ramos !== undefined;
  // Se elige un ramo de la lista, o se escribe el nombre de uno nuevo.
  const destinoElegido: DestinoDelMaterial | null =
    !hayQueElegir ? null
      : destino !== null ? { tipo: "ramo", id: destino }
        : ramoNuevo.trim() ? { tipo: "nuevo", nombre: ramoNuevo.trim() }
          : null;

  const elegir = async () => {
    setAviso(null);
    const elegido = await elegirArchivo();
    if (!elegido) return;

    const revision = revisar(elegido);
    if (!revision.ok) { setAviso(revision.motivo); setAdjunto(null); return; }

    setAdjunto(elegido);
    if (!titulo.trim()) setTitulo(tituloDesdeNombre(elegido.nombre));
    // Se dice de inmediato, no al tocar Guardar: descubrir que no se puede
    // después de haber elegido el archivo es la peor manera de enterarse.
    if (!HAY_ALMACENAMIENTO) setAviso(AVISO_SIN_ALMACENAMIENTO);
  };

  const hayTexto = texto.trim().length > 0;
  const hayDonde = !hayQueElegir || destinoElegido !== null;
  const sePuedeGuardar = titulo.trim().length > 0 && hayDonde
    && (hayTexto || (adjunto !== null && HAY_ALMACENAMIENTO));

  /**
   * Un texto escrito es siempre una lectura. Un archivo vale lo que diga su
   * extensión: un .mp4 no puede quedar archivado como documento, porque el
   * ramo lo muestra con el ícono y el orden equivocados.
   */
  const tipoDelMaterial = (): TipoDeMaterial => {
    if (hayTexto || !adjunto) return "documento";
    const revision = revisar(adjunto);
    return revision.ok ? revision.tipo : "documento";
  };

  const enviar = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      let url: string | null = null;
      if (adjunto && HAY_ALMACENAMIENTO) {
        // Sin un destino dicho, va al espacio propio de quien lo sube: el
        // ramo puede ser uno que todavía no existe —se crea junto con el
        // material— y en ese momento no hay identificador con el que armar
        // la ruta.
        const donde = dondeGuardar ?? await miEspacio();
        if (!donde) { setAviso("Tu sesión venció. Vuelve a entrar."); return; }
        const r = await subir(adjunto, donde);
        if (!r.ok) { setAviso(r.motivo); return; }
        url = r.url;
      }
      await guardar({
        tipo: tipoDelMaterial(),
        titulo: titulo.trim(),
        detalle: hayTexto
          ? `Lectura · ${minutosDeLectura(texto)} min`
          : adjunto ? detalleDe(adjunto) : "",
        texto: hayTexto ? texto.trim() : null,
        url,
        moduloId: unidad ?? unidades?.[0]?.id ?? null,
      }, destinoElegido);
      limpiar();
      cerrar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <HojaModal abierto={abierto} cerrar={cerrar} titulo="Agregar material">
        {/* Solo cuando se sube desde el inicio: adentro de un ramo ya se sabe
            de cuál es y preguntarlo sería un paso de más. */}
        {hayQueElegir ? (
          <>
            <Text style={tipo.etiqueta}>¿De qué ramo es?</Text>
            <View style={e.ramos}>
              {ramos!.map((r) => {
                const activo = destino === r.id;
                const tono = colorDeRamo(r.id, r.color);
                return (
                  <Pressable key={r.id} accessibilityRole="radio"
                    accessibilityState={{ selected: activo }}
                    accessibilityLabel={r.nombre}
                    onPress={() => { setDestino(r.id); setRamoNuevo(""); }}
                    style={({ pressed }) => [
                      e.ramo,
                      activo ? { borderColor: tono, backgroundColor: tenue(tono) } : null,
                      pressed && !activo ? { backgroundColor: color.elemento } : null,
                    ]}>
                    <Baldosa tono={tono} texto={inicialesDeRamo(r.nombre)} tamano={32} />
                    <Text style={e.ramoNombre} numberOfLines={1}>{r.nombre}</Text>
                    {activo ? <Icono nombre="listo" tamano={18} tono={tono} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Campo
              placeholder={ramos!.length ? "…o escribe un ramo nuevo" : "¿De qué ramo es?"}
              value={ramoNuevo}
              onChangeText={(t) => { setRamoNuevo(t); if (t.trim()) setDestino(null); }}
              autoCapitalize="sentences" accessibilityLabel="Ramo nuevo"
            />
          </>
        ) : null}

        {/* Las unidades solo existen en un ramo con programa. En uno propio no
            las armó nadie, y preguntar por una sería preguntar por algo que no
            existe. */}
        {unidades && unidades.length > 1 ? (
          <>
            <Text style={tipo.etiqueta}>¿En qué unidad va?</Text>
            <View style={e.unidades}>
              {unidades.map((u) => {
                const activa = (unidad ?? unidades[0]!.id) === u.id;
                return (
                  <Pressable key={u.id} accessibilityRole="radio"
                    accessibilityState={{ selected: activa }}
                    accessibilityLabel={u.titulo}
                    onPress={() => setUnidad(u.id)}
                    style={({ pressed }) => [
                      e.unidad,
                      activa ? e.unidadElegida : null,
                      pressed && !activa ? { backgroundColor: color.elemento } : null,
                    ]}>
                    {/* Sin numerarlas acá: el título de la unidad ya trae su
                        número, y ponerle otro delante daba «1. 1 · Límites». */}
                    <Text style={[e.unidadTexto, activa ? e.unidadTextoElegida : null]}
                      numberOfLines={1}>
                      {u.titulo}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={tipo.etiqueta}>El material</Text>
        <Campo placeholder="¿Cómo se llama?" value={titulo} onChangeText={setTitulo}
          autoCapitalize="sentences" accessibilityLabel="Título del material" />

        {/* El botón de adjuntar existe aunque el almacenamiento no. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Adjuntar un archivo"
          onPress={() => void elegir()} disabled={!sePuedeElegirArchivo}
          style={({ pressed }) => [
            e.adjuntar, pressed ? { backgroundColor: color.elemento } : null,
            !sePuedeElegirArchivo ? e.apagado : null,
          ]}>
          <Icono nombre="descargar" tamano={20} tono={color.marca} />
          <View style={{ flex: 1 }}>
            <Text style={e.adjuntarTitulo}>
              {adjunto ? adjunto.nombre : "Adjuntar un archivo"}
            </Text>
            <Text style={tipo.detalle}>
              {adjunto ? detalleDe(adjunto) : "PDF, Word, imágenes, audio o video"}
            </Text>
          </View>
          {adjunto ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Quitar el archivo"
              onPress={() => { setAdjunto(null); setAviso(null); }} hitSlop={10}>
              <Icono nombre="cerrar" tamano={18} />
            </Pressable>
          ) : null}
        </Pressable>

        {aviso ? (
          <View style={e.nota}>
            <Text style={e.notaTexto}>{aviso}</Text>
          </View>
        ) : null}

        <Text style={tipo.etiqueta}>O escribe el texto</Text>
        <TextInput
          style={e.papel}
          value={texto}
          onChangeText={setTexto}
          multiline
          textAlignVertical="top"
          placeholder={"Pega o escribe acá lo que quieras estudiar.\n\nEl lector lo va a leer en voz alta, resaltando cada frase."}
          placeholderTextColor="#9AA0A6"
          accessibilityLabel="Texto del material"
        />
        {hayTexto ? (
          <Text style={tipo.detalle}>
            {minutosDeLectura(texto)} min de lectura en voz alta.
          </Text>
        ) : null}

        <Boton
          texto={ocupado ? "Guardando…" : "Guardar"}
          onPress={() => void enviar()}
          deshabilitado={!sePuedeGuardar || ocupado}
        />
    </HojaModal>
  );
}

const e = StyleSheet.create({
  unidades: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s },
  unidad: {
    borderWidth: FILETE, borderColor: color.borde, borderRadius: radio.pastilla,
    paddingHorizontal: espacio.m, paddingVertical: 8, maxWidth: "100%",
  },
  unidadElegida: { borderColor: color.bordeFuerte, backgroundColor: color.elemento },
  unidadTexto: { ...tipo.detalle, color: color.textoSuave },
  unidadTextoElegida: { color: color.texto, fontWeight: "700" },

  ramos: { gap: espacio.s },
  ramo: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    borderWidth: FILETE, borderColor: color.bordeFuerte, borderRadius: radio.tarjeta,
    backgroundColor: color.papel, padding: espacio.s + 2,
  },
  ramoNombre: { ...tipo.fila, flex: 1 },

  pantalla: { flex: 1, backgroundColor: color.fondo },
  barra: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: espacio.m, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  barraTitulo: { fontSize: 16, fontWeight: "600", color: color.texto },
  hoja: { padding: espacio.l, gap: espacio.m },

  adjuntar: {
    flexDirection: "row", alignItems: "center", gap: espacio.m,
    borderWidth: 1, borderColor: color.borde, borderStyle: "dashed",
    borderRadius: radio.tarjeta, padding: espacio.m,
  },
  apagado: { opacity: 0.5 },
  adjuntarTitulo: { fontSize: 15, fontWeight: "600", color: color.texto },

  nota: { backgroundColor: tenue(color.ambar), borderRadius: radio.tarjeta, padding: espacio.m },
  notaTexto: { ...tipo.cuerpo, color: color.texto, lineHeight: 20 },

  papel: {
    minHeight: 190, padding: espacio.m, fontSize: 15, lineHeight: 24,
    color: color.texto, borderWidth: 1, borderColor: color.borde,
    borderRadius: radio.campo,
  },
});
