// StudIA · el asistente del docente
//
// Es el reverso del tutor y conviene tener clara la diferencia. Al alumno no
// se le da nunca la respuesta, porque el objetivo es que la encuentre. Al
// docente se le da derecho: su problema no es aprender, es no perder media
// hora cruzando planillas para saber a quién le escribe.
//
// Puede buscar en internet, y por eso hay una regla que no se negocia: lo que
// venga de una búsqueda se dice con su fuente y se separa de lo que salió del
// curso. Un dato del curso es verificable; uno de internet, no necesariamente.

export type Papel = "profesor" | "ayudante" | "administrador";

export type RamoResumido = {
  codigo: string;
  nombre: string;
  inscritos: number;
  /** Una línea por tarea: título, cuántos entregaron, cuántos sin corregir. */
  tareas: string[];
  /** Una línea por evaluación: título, peso, promedio, aprobados, publicada. */
  evaluaciones: string[];
  /** Una línea por alumno rezagado: nombre, avance, último acceso. */
  rezagados: string[];
  /** Una línea por bloque: día, hora, sala. */
  horario: string[];
};

export const LARGO_MAXIMO = 2000;
export const PREGUNTAS_POR_MINUTO = 20;
export const TURNOS_DE_CONTEXTO = 20;

/** Cuántas búsquedas puede hacer en una respuesta. */
export const BUSQUEDAS_MAXIMAS = 5;

export function promptAsistente(
  nombre: string,
  papel: Papel,
  ramos: RamoResumido[],
): string {
  const quien = papel === "administrador"
    ? "la administración académica del colegio"
    : papel === "ayudante"
      ? "ayudante de cátedra"
      : "profesora o profesor";

  const partes = [
    `Eres el asistente de StudIA para ${quien}. Hablas con ${nombre}. StudIA es una aplicación de estudio para estudiantes de Ingeniería Civil Industrial en Chile.`,

    `Tu trabajo es responder rápido y derecho preguntas sobre sus cursos: quién no ha entregado, quién viene quedándose atrás, qué falta por corregir, cómo le fue al curso en una evaluación, a quién conviene escribirle. Cuando la respuesta es una lista de personas, dala como lista de nombres, no como prosa.`,

    `REGLA PRIMERA: no inventas datos. Todo lo que digas sobre el curso sale de los DATOS DEL CURSO que vienen más abajo. Si algo no está ahí, dices que no lo tienes y qué haría falta para tenerlo. Nunca estimas un número, nunca completas una lista "probable", nunca supones que un alumno entregó porque sería raro que no.`,

    `REGLA SEGUNDA: puedes buscar en internet, y cuando lo hagas separas claramente las dos cosas. Los datos del curso son verificables; lo que encuentres afuera no necesariamente. Di de dónde viene lo que traes de una búsqueda. Usa la búsqueda para lo que sirve —material de apoyo, cómo se enseña un tema, referencias bibliográficas, normativa— y no para adivinar datos de tus alumnos, que no están en internet.`,

    `REGLA TERCERA: no tienes los apuntes de los alumnos, ni sus resúmenes de clase, ni lo que le preguntan al tutor. No es un olvido: ese material es privado y la base de datos no te lo entrega. Si te lo piden, dilo en una frase y ofrece lo que sí tienes, que es su actividad en el curso. No especules sobre lo que un alumno "estaría" pensando o entendiendo.`,

    `Cuidado con una distinción que importa: "no entregó" no es lo mismo que "no ha estudiado". Lo primero es un hecho registrado; lo segundo es una interpretación de cuánto material marcó como visto y hace cuánto no entra. Cuando hables de avance, di el dato y deja la conclusión al docente.`,

    papel === "ayudante"
      ? `Eres ayudante: puedes corregir, cargar material y responder el foro, pero publicar notas es del profesor. Si te preguntan por publicar, dilo.`
      : ``,

    `Cómo escribes: en español de Chile, tratando de tú. Directo y corto. Sin encabezados ni relleno. Si la respuesta cabe en una frase, es una frase.`,
  ].filter(Boolean);

  partes.push(datosParaElPrompt(ramos));

  return partes.join("\n\n");
}

/**
 * Los datos del curso, en texto plano. Van al final del prompt a propósito:
 * es la parte que cambia en cada pregunta, y dejarla al final permite que
 * todo lo anterior se sirva desde la caché.
 */
export function datosParaElPrompt(ramos: RamoResumido[]): string {
  if (ramos.length === 0) {
    return "DATOS DEL CURSO\n\nEsta persona no tiene ramos asignados.";
  }

  const bloques = ramos.map((r) => {
    const lineas = [`## ${r.nombre} (${r.codigo}) · ${r.inscritos} inscritos`];

    const seccion = (titulo: string, filas: string[], vacio: string) => {
      lineas.push(`\n### ${titulo}`);
      lineas.push(filas.length > 0 ? filas.map((f) => `- ${f}`).join("\n") : `- ${vacio}`);
    };

    seccion("Tareas", r.tareas, "Sin tareas publicadas.");
    seccion("Evaluaciones", r.evaluaciones, "Sin evaluaciones cargadas.");
    seccion("Quién viene quedándose atrás", r.rezagados, "Nadie: el curso viene al día.");
    seccion("Horario", r.horario, "Sin bloques cargados.");

    return lineas.join("\n");
  });

  return `DATOS DEL CURSO\n\nEs todo lo que tienes. No hay más.\n\n${bloques.join("\n\n")}`;
}

export type Validacion = { ok: true; texto: string } | { ok: false; motivo: string };

export function validarPregunta(entrada: unknown): Validacion {
  if (typeof entrada !== "string") return { ok: false, motivo: "La pregunta debe ser texto." };
  const texto = entrada.trim();
  if (texto.length === 0) return { ok: false, motivo: "Escribe una pregunta." };
  if (texto.length > LARGO_MAXIMO) {
    return { ok: false, motivo: `La pregunta no puede pasar de ${LARGO_MAXIMO} caracteres.` };
  }
  return { ok: true, texto };
}

export type Turno = { role: "user" | "assistant"; content: string };

/**
 * Claude exige que los turnos alternen y que el primero sea del usuario. Un
 * historial guardado puede no cumplirlo si algo falló a mitad de camino.
 */
export function normalizarTurnos(turnos: Turno[]): Turno[] {
  const limpios = turnos.filter((t) => t.content.trim().length > 0);
  const salida: Turno[] = [];
  for (const t of limpios) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.role === t.role) {
      ultimo.content = `${ultimo.content}\n\n${t.content}`;
      continue;
    }
    if (salida.length === 0 && t.role !== "user") continue;
    salida.push({ ...t });
  }
  return salida;
}

export const RESPUESTA_DE_RESPALDO =
  "No pude responderte ahora. Vuelve a intentarlo en un momento; si sigue fallando, los datos del curso están igual en la pantalla de tu ramo.";
