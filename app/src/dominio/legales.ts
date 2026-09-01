// Los textos legales de StudIA: una sola fuente para la app y para el sitio.
//
// Están acá y no en un archivo .md por una razón concreta: la aplicación tiene
// que poder mostrarlos sin conexión —quien acepta unos términos tiene derecho a
// leerlos— y React Native no importa markdown. Si el texto viviera en `legal/`
// y además en una pantalla, en la tercera corrección uno de los dos quedaría
// atrás, y el que quedara atrás sería el que la gente lee.
//
// Así que el texto vive acá, estructurado, y `herramientas/legales.mjs` escribe
// desde acá los archivos de `legal/`. La pantalla y el repositorio no pueden
// discrepar porque son el mismo texto.

/** Un tramo con su título; los párrafos van sueltos para poder pintarlos. */
export type Seccion = { titulo: string; parrafos: string[] };

export type Documento = {
  id: "terminos" | "privacidad";
  titulo: string;
  bajada: string;
  /** En formato ISO, que es el que ordena bien. */
  actualizado: string;
  secciones: Seccion[];
};

/** Quién es el dueño. Cambiarlo acá lo cambia en todas partes. */
export const TITULAR = "Tomás Quinteros";

/** A dónde escribir. Conviene reemplazarlo por una dirección del proyecto. */
export const CORREO = "equinterosm33@gmail.com";

/** El primer año de la obra: el aviso se escribe «2026-2029» cuando pasa tiempo. */
export const DESDE = 2026;

/**
 * El aviso de copyright, tal como se pinta al pie.
 *
 * Recibe el año en vez de mirar el reloj para que la prueba pueda comprobarlo
 * y para que no cambie sola a mitad de una pantalla.
 */
export function aviso(ano: number): string {
  const rango = ano > DESDE ? `${DESDE}-${ano}` : `${DESDE}`;
  return `© ${rango} ${TITULAR}. Todos los derechos reservados.`;
}

const ACTUALIZADO = "2026-08-31";

export const TERMINOS: Documento = {
  id: "terminos",
  titulo: "Términos de uso",
  bajada: "Las reglas de StudIA, en castellano y sin letra chica.",
  actualizado: ACTUALIZADO,
  secciones: [
    {
      titulo: "1. Qué es esto",
      parrafos: [
        `StudIA es una plataforma de estudio: reúne tus asignaturas, tu materia, tu horario y tus tareas, y te acompaña con un tutor que te guía para que llegues tú a la respuesta.`,
        `Estos términos son el acuerdo entre tú y ${TITULAR}, dueño de StudIA. Al crear una cuenta o usar la aplicación, los aceptas. Si no estás de acuerdo con alguno, no la uses.`,
        `StudIA no reemplaza a tu profesor, a tu colegio ni a tu universidad. No es una fuente oficial de notas, de asistencia ni de nada que tenga efectos académicos.`,
      ],
    },
    {
      titulo: "2. Quién puede usarla",
      parrafos: [
        `Estudiantes, docentes y establecimientos educacionales.`,
        `Si eres menor de 18 años, necesitas la autorización de tu madre, padre o de quien te tenga a cargo. Cuando el que entrega StudIA es tu colegio, esa autorización la gestiona el colegio.`,
        `Tu cuenta es tuya y no se presta. Lo que se haga desde tu cuenta se entiende hecho por ti.`,
      ],
    },
    {
      titulo: "3. De quién es cada cosa",
      parrafos: [
        `**La aplicación es de ${TITULAR}.** El código, el diseño de las pantallas, los íconos, los textos, la forma en que el tutor conversa y el nombre StudIA están protegidos por la Ley N.º 17.336 sobre Propiedad Intelectual y por la legislación de marcas. Usar StudIA no te da ningún derecho sobre nada de eso.`,
        `**Lo que tú escribes es tuyo.** Tus apuntes, tus preguntas, tus tareas, tus fichas y lo que digas en el foro siguen siendo tuyos. No los reclamamos ni los vendemos.`,
        `Para poder mostrártelos, guardarlos, buscarlos y dárselos al tutor cuando tú se lo pides, necesitamos un permiso técnico sobre ellos: nos autorizas a alojarlos y procesarlos **solo para hacer funcionar StudIA para ti**. Ese permiso dura lo que dure tu cuenta y termina cuando borras el contenido o la cierras.`,
        `Ese permiso no incluye publicarlos, cederlos a terceros con fines comerciales, ni usarlos para entrenar modelos de inteligencia artificial.`,
      ],
    },
    {
      titulo: "4. Lo que no se puede hacer",
      parrafos: [
        `Copiar, modificar o distribuir el código o el diseño de StudIA; hacer obras derivadas; revenderla, arrendarla o publicarla en una tienda.`,
        `Descompilar el paquete de la aplicación o hacer ingeniería inversa, salvo donde la ley lo permita sin poder renunciarse.`,
        `Extraer contenido de forma automática —raspado, robots, cuentas falsas— o usar la aplicación por fuera de su interfaz.`,
        `Usar el contenido de StudIA, o el de otros usuarios, para entrenar, ajustar o evaluar modelos de inteligencia artificial.`,
        `Usar el nombre StudIA, su logotipo o algo confundible con ellos.`,
        `Subir material del que no tengas derechos, contenido ilegal, o datos de otras personas sin su permiso.`,
        `Intentar acceder a datos de otros usuarios, saltarse las políticas de acceso o interferir con el servicio.`,
      ],
    },
    {
      titulo: "5. El tutor y la honestidad académica",
      parrafos: [
        `El tutor está hecho para no resolverte el ejercicio: te devuelve preguntas, pistas y el paso que sigue. Eso es a propósito y no es una limitación que vayamos a quitar.`,
        `Aun así, es un modelo de lenguaje y puede equivocarse. Revisa lo que te diga antes de darlo por cierto, sobre todo en materias evaluadas.`,
        `Usar StudIA para hacer trampa en una evaluación es asunto tuyo con tu establecimiento, y va contra el sentido de la herramienta.`,
      ],
    },
    {
      titulo: "6. El modo escucha",
      parrafos: [
        `En una clase presencial, los teléfonos de la sala pueden transcribir lo que se dice para armar después un resumen único de la clase.`,
        `Solo funciona si quien dicta la clase lo permite. Puede retirar el permiso en cualquier momento y ahí nadie más puede oír.`,
        `El audio no sale de tu teléfono: se transcribe ahí mismo y se descarta. Lo que se sube es texto.`,
        `El resumen es material de estudio del curso. No lo publiques fuera de él ni lo uses para exponer a nadie: en una sala se dicen cosas que no están pensadas para quedar escritas.`,
      ],
    },
    {
      titulo: "7. Precio",
      parrafos: [
        `Hoy StudIA no cobra. Si algún día cobra, se avisará antes y nunca se cobrará por algo que ya usaste gratis sin haberlo aceptado.`,
      ],
    },
    {
      titulo: "8. Cambios, suspensión y cierre",
      parrafos: [
        `StudIA está en desarrollo: pueden aparecer funciones, cambiar otras y haber interrupciones. No garantizamos que esté disponible siempre ni que no tenga fallas.`,
        `Podemos suspender una cuenta que use la plataforma contra estos términos, o que ponga en riesgo a otros usuarios.`,
        `Tú puedes cerrar la tuya cuando quieras, escribiendo a ${CORREO}.`,
        `Si estos términos cambian, se avisa dentro de la aplicación. Seguir usándola después del aviso es aceptarlos.`,
      ],
    },
    {
      titulo: "9. Responsabilidad",
      parrafos: [
        `StudIA se entrega «tal cual». En la medida en que la ley lo permita, no respondemos por pérdida de datos, por decisiones que tomes a partir de lo que diga el tutor, ni por daños indirectos.`,
        `Nada de esto limita los derechos que la ley chilena te da como consumidor y que no se pueden renunciar.`,
      ],
    },
    {
      titulo: "10. Ley aplicable",
      parrafos: [
        `Estos términos se rigen por la ley de la República de Chile. Cualquier disputa se ve ante los tribunales ordinarios de justicia de Chile.`,
        `Dudas, permisos y reclamos: ${CORREO}.`,
      ],
    },
  ],
};

export const PRIVACIDAD: Documento = {
  id: "privacidad",
  titulo: "Política de privacidad",
  bajada: "Qué datos guarda StudIA, para qué, y qué no guarda.",
  actualizado: ACTUALIZADO,
  secciones: [
    {
      titulo: "1. Quién responde",
      parrafos: [
        `${TITULAR} es el responsable del tratamiento de los datos personales de StudIA. Contacto: ${CORREO}.`,
        `Esta política se rige por la Ley N.º 19.628 sobre Protección de la Vida Privada y, desde el 1 de diciembre de 2026, por la Ley N.º 21.719, que la reemplaza y crea la Agencia de Protección de Datos Personales.`,
      ],
    },
    {
      titulo: "2. Qué se guarda",
      parrafos: [
        `**De tu cuenta:** tu correo, tu nombre y tu rol —estudiante, docente o administración—. El correo sale de tu sesión; no lo pedimos aparte.`,
        `**De tu estudio:** tus asignaturas, horario, tareas, notas, apuntes —escritos y a mano—, material, quizzes, fichas y lo que escribes en el foro.`,
        `**De tus conversaciones con el tutor:** las preguntas que le haces y lo que responde, para que la conversación tenga memoria.`,
        `**Del modo escucha:** los tramos de texto que tu teléfono transcribió, con el segundo de la clase en que se dijeron y una medida de qué tan seguro estaba el reconocedor.`,
        `**Técnicos:** los mínimos para que la sesión funcione.`,
        `**Para avisarte:** si enciendes los avisos, se guarda un identificador de tu teléfono —el que da Expo, no tu número— para poder mandártelos. Apagarlos en Perfil borra ese identificador.`,
        `**De las caídas:** si la aplicación se cierra sola o una pantalla falla, se guarda qué falló, en qué pantalla, con qué versión y en qué clase de teléfono. Antes de guardarlo se le quitan los correos, las claves de sesión y las direcciones de archivos: eso está escrito en el código y probado, no es una promesa suelta. Sirve para arreglar el problema y se borra a los 30 días.`,
      ],
    },
    {
      titulo: "3. Qué no se guarda",
      parrafos: [
        `**El audio de las clases no se guarda.** En el modo escucha se transcribe en tu propio teléfono y se descarta a medida que se reconoce. No sube, no queda en la base de datos y no se puede recuperar.`,
        `No se guarda tu ubicación, tu lista de contactos ni tus fotos.`,
        `No hay publicidad, no hay rastreadores de terceros y **los datos no se venden ni se ceden a nadie con fines comerciales**.`,
        `Tus datos no se usan para entrenar modelos de inteligencia artificial.`,
      ],
    },
    {
      titulo: "4. Para qué se usan",
      parrafos: [
        `Para prestarte el servicio: mostrarte tus ramos, guardar tus apuntes, corregir tus quizzes, armar el resumen de la clase.`,
        `Para que el tutor pueda responderte con el contexto de tu materia.`,
        `Para mantener la plataforma segura y arreglar fallas.`,
        `La base para tratarlos es el contrato que aceptas al usar StudIA y, donde corresponde, tu consentimiento —el micrófono, por ejemplo, se pide y se puede negar—.`,
      ],
    },
    {
      titulo: "5. Con quién se comparten",
      parrafos: [
        `**Supabase** aloja la base de datos y la autenticación. Los datos viven ahí.`,
        `**Anthropic** procesa lo que le mandas al tutor, para poder responderte. Se le manda tu pregunta y el contexto de la materia, no tu identidad.`,
        `**Google o Microsoft**, si eliges entrar con una de esas cuentas: ellos verifican quién eres y nos devuelven tu correo.`,
        `**El reconocedor de voz de tu teléfono.** StudIA le pide a Android que transcriba sin conexión, pero eso depende del aparato: si el tuyo no tiene el modelo instalado, el reconocedor del sistema —normalmente el de Google— puede procesar el audio en sus servidores, según su propia política. Si eso te preocupa, no uses el modo escucha en ese aparato.`,
        `Dentro de tu establecimiento, lo que ve cada quien lo definen las políticas de acceso: tu docente ve el trabajo de su curso; los demás estudiantes ven lo que publicas en el foro; tus apuntes son solo tuyos.`,
        `Nada más. Solo se entregarían datos a una autoridad si una orden judicial lo exigiera.`,
      ],
    },
    {
      titulo: "6. Menores de edad",
      parrafos: [
        `StudIA se usa en colegios, así que trata datos de niñas, niños y adolescentes, y la ley los protege con especial cuidado.`,
        `Cuando el establecimiento entrega StudIA a su curso, es el establecimiento el que debe recabar la autorización de los apoderados.`,
        `No se hacen perfiles comerciales de menores, no se les muestra publicidad y sus datos no se ceden.`,
        `Un apoderado puede pedir en cualquier momento ver o borrar los datos de su pupilo escribiendo a ${CORREO}.`,
      ],
    },
    {
      titulo: "7. Cuánto tiempo se guardan",
      parrafos: [
        `Tu contenido se guarda mientras tengas la cuenta abierta.`,
        `Los tramos del modo escucha se guardan hasta que se arma el resumen de la clase; después queda el resumen, que es de todo el curso, y no los tramos sueltos de cada teléfono.`,
        `Si borras tu cuenta, tus datos personales se eliminan al instante. Lo que hayas publicado en el foro queda, sin tu nombre, porque es parte de una conversación de otros.`,
      ],
    },
    {
      titulo: "8. Tus derechos",
      parrafos: [
        `Puedes pedir acceso a tus datos, corregirlos, eliminarlos, oponerte a un tratamiento y pedir una copia para llevártela.`,
        `**Borrar tu cuenta lo haces tú, sin pedir permiso:** en la aplicación, en Perfil → Borrar mi cuenta. Es inmediato y no se puede deshacer.`,
        `Lo demás se pide escribiendo a ${CORREO}. La respuesta llega dentro de los plazos que fija la ley.`,
        `Si crees que no se respetó tu derecho, puedes reclamar ante la autoridad de protección de datos personales de Chile.`,
      ],
    },
    {
      titulo: "9. Seguridad",
      parrafos: [
        `El acceso a los datos está controlado en la propia base de datos con políticas por fila: no depende de que la aplicación se porte bien.`,
        `Las conexiones van cifradas. Las claves de los servicios no viven en el código de la aplicación.`,
        `Ningún sistema es infalible. Si ocurriera una filtración que te afecte, se avisará a quienes corresponda y a la autoridad, como manda la ley.`,
      ],
    },
    {
      titulo: "10. Cambios",
      parrafos: [
        `Si esta política cambia, se avisa dentro de la aplicación y cambia la fecha de arriba. Vale la pena volver a leerla cuando eso pase.`,
      ],
    },
  ],
};

/**
 * Cómo borrar la cuenta, como página aparte.
 *
 * No entra en DOCUMENTOS —no es un documento legal, y en la aplicación el
 * camino es el botón, no un texto— pero Play Store exige una dirección web
 * pública que explique cómo se pide el borrado, alcanzable **sin** instalar la
 * aplicación. De ahí que exista esta página.
 */
export const COMO_BORRAR: Documento = {
  id: "terminos",
  titulo: "Borrar tu cuenta de StudIA",
  bajada: "Cómo borrarla tú mismo, y qué se borra exactamente.",
  actualizado: ACTUALIZADO,
  secciones: [
    {
      titulo: "Desde la aplicación, en un minuto",
      parrafos: [
        `Abre StudIA → **Perfil** → baja hasta **Borrar mi cuenta**. Te va a pedir que escribas la palabra BORRAR para confirmar, y con eso queda hecho al instante.`,
        `No hay que escribirle a nadie ni esperar respuesta.`,
      ],
    },
    {
      titulo: "Si no tienes la aplicación a mano",
      parrafos: [
        `Escribe a ${CORREO} desde el correo con el que entras a StudIA. La cuenta se borra dentro de los plazos que fija la ley.`,
        `Si eres apoderado y quieres borrar la cuenta de tu pupilo, escribe a la misma dirección diciendo quién eres.`,
      ],
    },
    {
      titulo: "Qué se borra",
      parrafos: [
        `Tu perfil, tu nombre y tu correo.`,
        `Tus apuntes —escritos y a mano—, tus notas, tus entregas, tus fichas, tus quizzes y tus sesiones de estudio.`,
        `Todo lo que le preguntaste al tutor.`,
        `Tus inscripciones en ramos y tus notificaciones.`,
      ],
    },
    {
      titulo: "Qué no se borra, y por qué",
      parrafos: [
        `**Lo que publicaste en el foro se queda, pero deja de llevar tu nombre.** Es parte de una conversación de otras personas: borrarlo dejaría respuestas colgando de preguntas que ya no existen.`,
        `**El resumen de una clase presencial se queda.** Es del curso entero, no de un alumno, y se arma cruzando lo que oyeron muchos teléfonos. No dice quién dijo qué.`,
        `Nada de esto permite volver a identificarte.`,
      ],
    },
    {
      titulo: "Se borra, no se esconde",
      parrafos: [
        `El borrado es inmediato y no se puede deshacer. No queda una copia «por si acaso»: las tablas están encadenadas para que al irse la cuenta se vaya con ella todo lo suyo, y hay una prueba automática que lo comprueba en cada cambio de la base de datos.`,
        `Si algo de esto no calza con lo que ves, escribe a ${CORREO}.`,
      ],
    },
  ],
};

export const DOCUMENTOS: Documento[] = [TERMINOS, PRIVACIDAD];

/** El documento que se pidió, o el de términos si el nombre no existe. */
export function documento(id: string): Documento {
  return DOCUMENTOS.find((d) => d.id === id) ?? TERMINOS;
}

/** «31 de agosto de 2026», que es como se lee una fecha acá. */
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function comoFecha(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d || m < 1 || m > 12) return iso;
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/**
 * El documento como markdown, para escribir los archivos de `legal/`.
 *
 * Los asteriscos del texto ya son markdown: acá pasan tal cual, y la pantalla
 * es la que tiene que saber quitarlos.
 */
export function comoMarkdown(d: Documento): string {
  const cabeza = [
    `# StudIA — ${d.titulo}`,
    ``,
    `> ${d.bajada}`,
    ``,
    `**Actualizado el ${comoFecha(d.actualizado)}.**`,
    ``,
    `<!-- Generado por herramientas/legales.mjs desde app/src/dominio/legales.ts.`,
    `     No editar a mano: el archivo se reescribe. -->`,
  ];
  const cuerpo = d.secciones.flatMap((s) => [``, `## ${s.titulo}`, ``, ...s.parrafos.flatMap((p) => [p, ``])]);
  return [...cabeza, ...cuerpo].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Un trozo de párrafo: el texto y si va en negrita. */
export type Trozo = { texto: string; fuerte: boolean };

/**
 * Parte un párrafo en trozos para pintarlo en un teléfono.
 *
 * La negrita en markdown se escribe con asteriscos, y en una pantalla los
 * asteriscos se ven como asteriscos: peor que no tener negrita. Acá se
 * traducen a algo que la pantalla sí sabe pintar, en vez de borrarlos.
 */
export function trozos(parrafo: string): Trozo[] {
  const partes: Trozo[] = [];
  // El separador queda en el resultado por el paréntesis, y por eso los
  // impares son siempre lo que iba entre asteriscos.
  parrafo.split(/\*\*(.+?)\*\*/g).forEach((texto, i) => {
    if (texto) partes.push({ texto, fuerte: i % 2 === 1 });
  });
  return partes;
}
