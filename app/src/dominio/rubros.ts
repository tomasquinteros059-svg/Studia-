// Los rubros y su equipo de tres.
//
// Una reunión de directorio, una asamblea de copropietarios y una reunión de
// obra se parecen en la forma —gente hablando por turnos— y en nada más. Lo
// que hay que escuchar, cómo se escribe y qué conclusión se saca cambia por
// completo. Por eso el equipo no es uno solo con instrucciones genéricas: son
// tres papeles, y cada rubro los instruye distinto.
//
//   escucha   transcribe y separa quién habló. Lo que cambia por rubro es el
//             vocabulario: "prorrateo" no es "por rateo", y una transcripción
//             que escribe mal los términos hace inservible todo lo demás.
//   redacta   arma el documento. Un acta de asamblea lleva quórum y acuerdos
//             numerados; una minuta de directorio, no. La forma importa
//             porque en varios de estos rubros el documento tiene valor.
//   entiende  es quien sabe del tema. Lee lo redactado y saca la conclusión:
//             qué se hizo, qué falta, qué hay que hacer y quién lo debe.
//
// Ninguno de los tres reemplaza a la persona. El tercero, sobre todo, propone
// y no decide: se dice explícito en cada instrucción.

export type Rubro = "legal" | "edificios" | "salud" | "obras" | "gerencia";

export type Papel = "escucha" | "redacta" | "entiende";

export const PAPELES: readonly Papel[] = ["escucha", "redacta", "entiende"];

export type Agente = {
  papel: Papel;
  /** Cómo se llama en pantalla. */
  nombre: string;
  /** Una línea, para que se entienda qué hizo cada uno sin explicaciones. */
  hace: string;
  /** Lo que se le dice al modelo. Es lo único que cambia de verdad. */
  instruccion: string;
};

export type Equipo = {
  id: Rubro;
  nombre: string;
  /** Qué reuniones son de este rubro, para que la persona se reconozca. */
  ejemplos: string[];
  /** Términos que la transcripción tiene que escribir bien. */
  vocabulario: string[];
  /** Qué persigue quien entiende del tema. */
  loQueImporta: string[];
  /**
   * Un aviso que la persona ve antes de grabar. Null si no hace falta.
   * No es letra chica: en salud y en legal, grabar tiene consecuencias.
   */
  cuidado: string | null;
  /** Cómo se llama el documento que sale. */
  documento: string;
  agentes: [Agente, Agente, Agente];
};

/* ------------------------------------------------------------------ base */

/**
 * Lo que los tres comparten, digan lo que digan de su rubro. Está acá y no
 * repetido cinco veces porque son las reglas que no pueden variar: si una se
 * afloja en un rubro, se afloja en todos sin que nadie lo note.
 */
export const REGLAS_COMUNES = [
  "No inventes. Si algo no se dijo en la reunión, no va en el documento.",
  "Cuando algo se dijo a medias o no se entendió, márcalo como tal en vez de completarlo.",
  "Distingue siempre lo que se acordó de lo que solo se propuso o se conversó.",
  "No emitas juicios sobre las personas. Sobre los hechos y los plazos, sí.",
].join(" ");

const escucha = (vocabulario: string[], quienes: string): Agente => ({
  papel: "escucha",
  nombre: "Relator",
  hace: "Escucha la reunión y anota quién dijo qué.",
  instruccion: [
    "Transcribe la reunión separando las intervenciones por persona.",
    `En este tipo de reunión participan, normalmente, ${quienes}.`,
    "Cuando no sepas quién habla, ponle una etiqueta estable (Voz 1, Voz 2) en vez de adivinar un nombre.",
    `Escribe correctamente estos términos, que en este rubro se usan seguido: ${vocabulario.join(", ")}.`,
    "Marca con [inaudible] lo que no se entienda. No lo completes.",
    "Anota la hora aproximada de los momentos importantes.",
  ].join(" "),
});

const redacta = (documento: string, forma: string[]): Agente => ({
  papel: "redacta",
  nombre: "Actuario",
  hace: `Arma ${documento} con lo que se dijo.`,
  instruccion: [
    `Con la transcripción, redacta ${documento}.`,
    `Debe llevar, en este orden: ${forma.join("; ")}.`,
    "Escribe en español de Chile, en frases cortas y sin adornos.",
    "Cada acuerdo va numerado, con su responsable y su plazo cuando se hayan dicho.",
    "Si un acuerdo quedó sin responsable o sin plazo, escríbelo igual y déjalo marcado como pendiente de definir.",
    REGLAS_COMUNES,
  ].join(" "),
});

const entiende = (oficio: string, loQueImporta: string[]): Agente => ({
  papel: "entiende",
  nombre: "Analista",
  hace: `Sabe de ${oficio} y saca la conclusión.`,
  instruccion: [
    `Eres una persona con experiencia en ${oficio}. Lees el documento de la reunión y sacas conclusiones útiles para quien tiene que actuar mañana.`,
    `En este rubro, lo que hay que mirar es: ${loQueImporta.join("; ")}.`,
    "Entrega cuatro cosas separadas: qué se hizo; qué quedó sin cerrar; qué hay que hacer, con responsable y plazo; y qué conviene aportar o preguntar en la próxima reunión.",
    "Señala también las contradicciones: algo que se acordó hoy y que choca con lo acordado antes, o dos personas que entendieron cosas distintas.",
    "Propones, no decides. Cuando algo requiera criterio profesional o una firma, dilo en vez de resolverlo.",
    REGLAS_COMUNES,
  ].join(" "),
});

/* ---------------------------------------------------------------- rubros */

export const EQUIPOS: Equipo[] = [
  {
    id: "legal",
    nombre: "Estudios y asesoría jurídica",
    ejemplos: [
      "Reunión con cliente",
      "Directorio o junta de accionistas",
      "Comité de partes",
      "Coordinación de causas del estudio",
    ],
    vocabulario: [
      "mandato", "poder", "comparendo", "avenimiento", "transacción",
      "prescripción", "notificación", "medida precautoria", "escritura pública",
      "junta de accionistas", "quórum", "acta", "cláusula", "finiquito",
    ],
    loQueImporta: [
      "plazos que corren y desde cuándo",
      "quién quedó facultado para firmar y con qué poder",
      "compromisos que obligan al cliente aunque no se hayan escrito",
      "puntos donde las partes entendieron cosas distintas",
      "documentos que hay que pedir o acompañar",
    ],
    cuidado:
      "Grabar una reunión con un cliente exige avisarle y que acepte. Lo que se diga acá puede estar cubierto por el secreto profesional: revisa antes de compartir el documento.",
    documento: "una minuta de la reunión",
    agentes: [
      escucha(
        ["mandato", "comparendo", "avenimiento", "medida precautoria", "prescripción", "quórum"],
        "abogadas y abogados, el cliente, y a veces la contraparte o su representante",
      ),
      redacta("una minuta de la reunión", [
        "fecha, hora y quiénes participaron",
        "materia tratada",
        "lo que expuso cada parte",
        "acuerdos, numerados",
        "plazos y sus fechas",
        "documentos comprometidos y quién los aporta",
        "puntos sin resolver",
      ]),
      entiende("derecho y gestión de estudios jurídicos", [
        "plazos que corren y desde cuándo",
        "quién quedó facultado para firmar y con qué poder",
        "compromisos que obligan al cliente aunque no se hayan escrito",
        "puntos donde las partes entendieron cosas distintas",
        "documentos que hay que pedir o acompañar",
      ]),
    ],
  },
  {
    id: "edificios",
    nombre: "Administración de edificios y condominios",
    ejemplos: [
      "Asamblea de copropietarios",
      "Reunión de comité de administración",
      "Reunión con la empresa de aseo o conserjería",
      "Revisión de gastos comunes",
    ],
    vocabulario: [
      "copropietario", "gastos comunes", "prorrateo", "alícuota", "quórum",
      "comité de administración", "fondo de reserva", "bien común",
      "reglamento de copropiedad", "conserjería", "cotización", "mantención",
      "primera citación", "segunda citación", "morosidad", "acta", "tabla",
    ],
    loQueImporta: [
      "si hubo quórum y de qué tipo, porque sin eso el acuerdo no vale",
      "qué gastos se aprobaron y con cargo a qué fondo",
      "cotizaciones pendientes y cuántas faltan para decidir",
      "plazos de mantención y certificaciones que vencen",
      "morosidad y qué se acordó hacer con ella",
    ],
    cuidado:
      "En una asamblea, un acuerdo sin el quórum que exige el reglamento no obliga a nadie. El documento deja constancia de quiénes estaban, pero la validez la revisa la administración.",
    documento: "un acta de la reunión",
    agentes: [
      escucha(
        ["prorrateo", "alícuota", "gastos comunes", "fondo de reserva", "quórum", "primera citación"],
        "la administración, el comité, copropietarios y a veces proveedores",
      ),
      redacta("un acta de la reunión", [
        "fecha, hora, lugar y si es primera o segunda citación",
        "quiénes asistieron y el quórum alcanzado",
        "tabla tratada",
        "acuerdos, numerados, con su votación",
        "gastos aprobados y con cargo a qué fondo",
        "encargos a la administración, con plazo",
        "puntos que quedaron para la próxima",
      ]),
      entiende("administración de edificios y copropiedad inmobiliaria", [
        "si hubo quórum y de qué tipo, porque sin eso el acuerdo no vale",
        "qué gastos se aprobaron y con cargo a qué fondo",
        "cotizaciones pendientes y cuántas faltan para decidir",
        "plazos de mantención y certificaciones que vencen",
        "morosidad y qué se acordó hacer con ella",
      ]),
    ],
  },
  {
    id: "salud",
    nombre: "Equipos clínicos y de salud",
    ejemplos: [
      "Reunión clínica del equipo",
      "Comité de calidad o de infecciones",
      "Coordinación de turnos y derivaciones",
      "Reunión de jefatura de servicio",
    ],
    vocabulario: [
      "protocolo", "derivación", "interconsulta", "pabellón", "turno",
      "ficha clínica", "consentimiento informado", "comité de ética",
      "indicador", "adherencia", "pauta", "auditoría de casos",
    ],
    loQueImporta: [
      "acuerdos sobre protocolos y desde cuándo rigen",
      "derivaciones y coordinaciones comprometidas, con quién responde",
      "brechas de turno o de insumos que quedaron sin resolver",
      "lo que requiere pasar por comité y no puede decidirse en la reunión",
      "indicadores que se acordó medir y quién los levanta",
    ],
    cuidado:
      "Acá se hablan datos de pacientes. El documento no debe llevar nombres, RUT ni número de ficha: cuando aparezcan, se reemplazan por una referencia (Paciente 1). Grabar en un espacio clínico requiere el permiso de la jefatura.",
    documento: "una nota de reunión clínica",
    agentes: [
      {
        papel: "escucha",
        nombre: "Relator",
        hace: "Escucha la reunión y anota quién dijo qué, sin datos de pacientes.",
        instruccion: [
          "Transcribe la reunión separando las intervenciones por persona.",
          "En este tipo de reunión participan, normalmente, médicas y médicos, enfermería, jefaturas de servicio y a veces calidad o gestión.",
          "Escribe correctamente estos términos, que en este rubro se usan seguido: protocolo, interconsulta, derivación, pabellón, adherencia, consentimiento informado.",
          "Nunca escribas nombres, RUT ni número de ficha de un paciente. Reemplázalos por Paciente 1, Paciente 2, en el orden en que aparezcan, y mantén esa correspondencia en toda la transcripción.",
          "Marca con [inaudible] lo que no se entienda. No lo completes.",
          "Anota la hora aproximada de los momentos importantes.",
        ].join(" "),
      },
      redacta("una nota de reunión clínica", [
        "fecha, hora y quiénes participaron, por su cargo",
        "temas tratados",
        "acuerdos, numerados",
        "protocolos o pautas que cambian y desde cuándo",
        "derivaciones y coordinaciones, con responsable y plazo",
        "lo que queda pendiente de comité o de jefatura",
      ]),
      entiende("gestión clínica y trabajo en equipos de salud", [
        "acuerdos sobre protocolos y desde cuándo rigen",
        "derivaciones y coordinaciones comprometidas, con quién responde",
        "brechas de turno o de insumos que quedaron sin resolver",
        "lo que requiere pasar por comité y no puede decidirse en la reunión",
        "indicadores que se acordó medir y quién los levanta",
      ]),
    ],
  },
  {
    id: "obras",
    nombre: "Ingeniería y obras",
    ejemplos: [
      "Reunión de obra semanal",
      "Coordinación entre especialidades",
      "Revisión de avance con el mandante",
      "Reunión de prevención de riesgos",
    ],
    vocabulario: [
      "partida", "avance físico", "estado de pago", "cubicación", "RDI",
      "interferencia", "subcontrato", "carta Gantt", "ruta crítica",
      "recepción provisoria", "libro de obra", "prevención de riesgos",
      "especialidad", "plano as built", "orden de cambio",
    ],
    loQueImporta: [
      "partidas atrasadas y qué arrastran de la ruta crítica",
      "interferencias entre especialidades y quién las resuelve",
      "RDI y órdenes de cambio abiertas, con su plazo de respuesta",
      "estados de pago y lo que los está frenando",
      "riesgos de seguridad levantados y qué se hizo con ellos",
    ],
    cuidado: null,
    documento: "un acta de reunión de obra",
    agentes: [
      escucha(
        ["partida", "cubicación", "RDI", "interferencia", "estado de pago", "ruta crítica"],
        "la inspección técnica, el jefe de obra, especialistas, subcontratos y el mandante",
      ),
      redacta("un acta de reunión de obra", [
        "fecha, obra y quiénes participaron",
        "avance por partida",
        "interferencias detectadas y su responsable",
        "RDI y órdenes de cambio, con su estado",
        "acuerdos, numerados, con responsable y plazo",
        "temas de seguridad",
        "compromisos para la próxima reunión",
      ]),
      entiende("ingeniería de proyectos y administración de obra", [
        "partidas atrasadas y qué arrastran de la ruta crítica",
        "interferencias entre especialidades y quién las resuelve",
        "RDI y órdenes de cambio abiertas, con su plazo de respuesta",
        "estados de pago y lo que los está frenando",
        "riesgos de seguridad levantados y qué se hizo con ellos",
      ]),
    ],
  },
  {
    id: "gerencia",
    nombre: "Gerencia y equipos de trabajo",
    ejemplos: [
      "Comité de gerencia",
      "Reunión de equipo semanal",
      "Revisión de presupuesto",
      "Reunión con un proveedor o un cliente",
    ],
    vocabulario: [
      "presupuesto", "meta", "indicador", "margen", "flujo de caja",
      "dotación", "proveedor", "propuesta", "hito", "plazo", "prioridad",
    ],
    loQueImporta: [
      "decisiones tomadas y quién queda a cargo de cada una",
      "compromisos con fecha y los que quedaron sin fecha",
      "temas de la tabla que no alcanzaron a tratarse",
      "dependencias entre áreas que pueden trabar lo acordado",
      "cifras que se mencionaron sin respaldo y hay que confirmar",
    ],
    cuidado: null,
    documento: "una minuta de la reunión",
    agentes: [
      escucha(
        ["presupuesto", "margen", "flujo de caja", "dotación", "hito", "indicador"],
        "gerencias, jefaturas de área y a veces proveedores o clientes",
      ),
      redacta("una minuta de la reunión", [
        "fecha, hora y quiénes participaron",
        "temas tratados",
        "decisiones, numeradas, con quién queda a cargo",
        "compromisos con su plazo",
        "cifras mencionadas y de dónde salieron",
        "temas que quedaron para la próxima",
      ]),
      entiende("gestión y dirección de equipos", [
        "decisiones tomadas y quién queda a cargo de cada una",
        "compromisos con fecha y los que quedaron sin fecha",
        "temas de la tabla que no alcanzaron a tratarse",
        "dependencias entre áreas que pueden trabar lo acordado",
        "cifras que se mencionaron sin respaldo y hay que confirmar",
      ]),
    ],
  },
];

export const equipoDe = (rubro: Rubro): Equipo => {
  const e = EQUIPOS.find((x) => x.id === rubro);
  if (!e) throw new Error(`No hay equipo para el rubro ${rubro}.`);
  return e;
};

export const agenteDe = (rubro: Rubro, papel: Papel): Agente => {
  const a = equipoDe(rubro).agentes.find((x) => x.papel === papel);
  if (!a) throw new Error(`El equipo de ${rubro} no tiene ${papel}.`);
  return a;
};

/**
 * Adivina el rubro por lo que se dijo. No es para decidir por la persona
 * —el rubro lo elige ella al crear la reunión— sino para proponérselo cuando
 * no lo eligió, y para avisarle si eligió uno y la reunión parece de otro.
 *
 * Devuelve null cuando ninguno destaca: proponer a ciegas es peor que callarse.
 */
export function rubroPorLoQueSeDijo(texto: string): Rubro | null {
  const limpio = normalizar(texto);
  if (limpio.length === 0) return null;

  const puntajes = EQUIPOS.map((equipo) => ({
    id: equipo.id,
    puntos: equipo.vocabulario.filter((t) => contiene(limpio, normalizar(t))).length,
  })).sort((a, b) => b.puntos - a.puntos);

  const [mejor, siguiente] = puntajes;
  if (!mejor || mejor.puntos < 2) return null;
  // Empate técnico: dos rubros comparten palabras (quórum, acta, plazo) y
  // quedarse con el primero sería quedarse con el orden de la lista.
  if (siguiente && mejor.puntos === siguiente.puntos) return null;
  return mejor.id;
}

const normalizar = (t: string): string =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Con bordes de palabra, para que "acta" no se cuele dentro de "contacta". */
const contiene = (donde: string, que: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${que.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`)
    .test(donde);
