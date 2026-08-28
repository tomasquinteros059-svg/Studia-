import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Boton, Campo, HojaModal } from "../../ui/componentes.tsx";
import { Icono } from "../../ui/Icono.tsx";
import { color, espacio, radio, tenue, tipo } from "../../ui/tema.ts";
import {
  detalleDe, minutosDeLectura, revisar, tituloDesdeNombre,
  type TipoDeMaterial,
} from "../../dominio/adjuntos.ts";
import {
  AVISO_SIN_ALMACENAMIENTO, HAY_ALMACENAMIENTO, elegirArchivo,
  sePuedeElegirArchivo, subir, type AdjuntoElegido,
} from "../../lib/archivos.ts";

export type MaterialArmado = {
  tipo: TipoDeMaterial;
  titulo: string;
  detalle: string;
  texto: string | null;
  url: string | null;
};

/**
 * Cargar material en un ramo propio, de dos maneras.
 *
 * Escribir o pegar el texto funciona hoy y es lo que alimenta el lector.
 * Adjuntar un archivo elige el archivo pero todavía no lo guarda: no hay
 * almacenamiento conectado. El botón está igual, y dice por qué —esconderlo
 * haría que nadie pueda planificar con él.
 */
export default function NuevoMaterial({
  abierto, cerrar, guardar,
}: {
  abierto: boolean;
  cerrar: () => void;
  guardar: (material: MaterialArmado) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [adjunto, setAdjunto] = useState<AdjuntoElegido | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const limpiar = () => {
    setTitulo(""); setTexto(""); setAdjunto(null); setAviso(null); setOcupado(false);
  };

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
  const sePuedeGuardar = titulo.trim().length > 0 && (hayTexto || (adjunto !== null && HAY_ALMACENAMIENTO));

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
        const r = await subir(adjunto, "yo");
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
      });
      limpiar();
      cerrar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <HojaModal abierto={abierto} cerrar={cerrar} titulo="Agregar material">
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
