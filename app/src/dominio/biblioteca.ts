// El material del profesor, junto y buscable.
//
// Dentro de un ramo el material ya se veía, pero un profesor con cuatro cursos
// no piensa por ramo cuando busca algo: piensa «dónde dejé la guía de
// derivadas». Esto lo aplana en una sola lista que se puede recorrer y buscar,
// sin perder de dónde salió cada cosa.

export type Pieza = {
  id: string;
  titulo: string;
  detalle: string;
  tipo: "video" | "documento" | "ejercicios";
  ramoId: string;
  ramo: string;
  unidad: string;
};

type RamoConMateria = {
  id: string;
  nombre: string;
  modulos: readonly {
    id: string;
    titulo: string;
    materiales: readonly {
      id: string; titulo: string; detalle: string;
      tipo: "video" | "documento" | "ejercicios"; orden: number;
    }[];
  }[];
};

/**
 * Aplana la materia de todos los ramos en una sola lista.
 *
 * Se conserva el orden con que el profesor armó el curso —ramo, unidad, y
 * dentro de la unidad el orden que él le dio— porque ese orden es una decisión
 * suya. Reordenar por fecha o por nombre sería reemplazar su criterio por uno
 * nuestro.
 */
export function juntarMaterial(ramos: readonly RamoConMateria[]): Pieza[] {
  const todo: Pieza[] = [];
  for (const ramo of ramos) {
    for (const unidad of ramo.modulos) {
      for (const m of [...unidad.materiales].sort((a, b) => a.orden - b.orden)) {
        todo.push({
          id: m.id, titulo: m.titulo, detalle: m.detalle, tipo: m.tipo,
          ramoId: ramo.id, ramo: ramo.nombre, unidad: unidad.titulo,
        });
      }
    }
  }
  return todo;
}

/** Sin tildes ni mayúsculas: quien busca «calculo» quiere encontrar «Cálculo». */
const plano = (texto: string): string =>
  texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Busca por título, por unidad y por ramo.
 *
 * Por las tres porque las tres son maneras legítimas de acordarse de algo: por
 * cómo se llama, por dónde estaba, o de qué curso era.
 */
export function buscarMaterial(piezas: readonly Pieza[], texto: string): Pieza[] {
  const busca = plano(texto.trim());
  if (!busca) return [...piezas];
  return piezas.filter((p) =>
    plano(`${p.titulo} ${p.unidad} ${p.ramo}`).includes(busca));
}

/** Cuántas piezas hay de cada tipo, para poder decirlo sin contar a mano. */
export function contarPorTipo(piezas: readonly Pieza[]): Record<Pieza["tipo"], number> {
  const cuenta = { video: 0, documento: 0, ejercicios: 0 };
  for (const p of piezas) cuenta[p.tipo] += 1;
  return cuenta;
}

/**
 * Cómo se resume lo que hay.
 *
 * Se nombra en plural o singular según corresponda: «1 videos» es de las cosas
 * que hacen que una pantalla se vea sin terminar.
 */
export function comoSeResume(piezas: readonly Pieza[]): string {
  if (piezas.length === 0) return "Todavía no has subido material.";
  const c = contarPorTipo(piezas);
  const partes = [
    c.video > 0 ? `${c.video} ${c.video === 1 ? "video" : "videos"}` : null,
    c.documento > 0 ? `${c.documento} ${c.documento === 1 ? "lectura" : "lecturas"}` : null,
    c.ejercicios > 0 ? `${c.ejercicios} ${c.ejercicios === 1 ? "guía" : "guías"}` : null,
  ].filter((p): p is string => p !== null);
  return partes.join(" · ");
}
