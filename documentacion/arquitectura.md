# StudIA — arquitectura

Cómo está construido y cómo levantarlo. Para el qué y el porqué del producto,
ver [`studia-spec.md`](studia-spec.md).

---

## Las tres piezas

```
  app/                     Expo (React Native) — lo que ve el estudiante
    │
    │  clave anónima + sesión del usuario
    ↓
  Supabase                 auth · Postgres con políticas de acceso
    │
    │  la app NUNCA llama a Claude directamente
    ↓
  supabase/functions/tutor Deno — la única puerta hacia Claude
    │
    ↓
  Claude (claude-opus-5)
```

**Por qué el tutor pasa por el servidor.** La regla de no dar la respuesta es
el único diferenciador del producto. Si viviera en el cliente, estaría en el
bundle de la app: cualquiera la leería y la evadiría en una tarde. Por eso el
*system prompt* y la clave de la API viven en la función y nunca bajan al
teléfono.

---

## Levantarlo

Necesitas [Supabase CLI](https://supabase.com/docs/guides/cli), Node 22.6+ y
una clave de la API de Anthropic.

```bash
# 1 · Base de datos local, con migraciones y datos de ejemplo
supabase start
supabase db reset          # aplica migrations/ y seed.sql

# 2 · Secretos de la función del tutor
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions serve tutor

# 3 · La app
cd app
cp .env.example .env       # completar con lo que imprimió `supabase start`
npm install
npm start
```

La cuenta de ejemplo es **eduardo@studia.cl / clave-demo**, inscrita en las
seis asignaturas con notas, tareas, foro y una clase en vivo.

Para desplegar: `supabase db push` y `supabase functions deploy tutor` contra
el proyecto remoto.

---

## Verificación

```bash
npm run prueba:todo       # todo lo de abajo, en orden

npm run prueba            # 87 pruebas del dominio y de los núcleos del tutor
npm run prueba:ui         # 56 pruebas que renderizan las pantallas de verdad
npm run prueba:sintaxis   # las funciones de Deno son TypeScript válido
npm run tipos             # tsc en modo estricto sobre la app
npm run prueba:paquete    # el bundle de la app compila de verdad
npm run prueba:bd         # 35 aserciones de acceso contra un Postgres real
```

`prueba:paquete` es el que atrapa lo que los tipos no ven: dependencias que
faltan, versiones que no calzan con las que fija el SDK de Expo, imports que
no resuelven en tiempo de ejecución. Si este pasa, la compilación en EAS tiene
muchas más probabilidades de pasar también.

### Las pruebas de pantalla

Montan los componentes con `jest-expo` y los operan como lo haría una persona:
tocar, escribir, esperar. Supabase y Claude están dobladas —lo que se comprueba
es que la pantalla reaccione, no la red— y `pruebas/dobles.tsx` reúne los datos
de ejemplo y una navegación de mentira que registra a dónde se quiso ir.

Cubren las nueve secciones de una asignatura, el tablero de apuntes con su
búsqueda, el guardado automático del editor, las dos columnas en tablet, y los
tres caminos del permiso de micrófono.

Dos cosas que hay que saber al escribirlas:

- **`render` es asíncrono** en la versión 14 de la biblioteca: sin `await` no
  hay nada que consultar.
- **Todo toque va dentro de `act`.** Un `fireEvent` suelto deja el renderizador
  a medias y hace fallar la prueba *siguiente*, no la propia — cuesta caro
  encontrarlo.

Quedan avisos de React sobre actualizaciones fuera de `act` en tres archivos.
Son del arnés al probar cargas asíncronas, no defectos de la app: las pruebas
afirman el comportamiento correcto y pasan.

`prueba:bd` levanta un Postgres desechable y aplica migraciones y seed sobre un
andamio que imita lo mínimo de Supabase (`supabase/pruebas/andamio.sql`): el
esquema `auth` y `auth.uid()`. No necesita Docker ni el CLI de Supabase.

---

## Decisiones que vale la pena conocer

**La nota parcial pondera solo lo rendido.** Contar como cero una prueba que
todavía no ocurre hundiría el promedio y desinformaría al estudiante justo
cuando más necesita saber dónde está. `app/src/dominio/notas.ts`.

**Una nota sin publicar existe pero no se ve.** La columna `publicada_en`
gobierna la visibilidad desde las políticas de acceso, no desde el cliente. El
profesor puede cargar notas y publicarlas después.

**El estudiante no puede escribir mensajes del tutor.** No hay política de
`insert` sobre `mensajes`: los escribe la función con la clave de servicio. Sin
esto, cualquiera podría fabricar un historial donde el tutor ya dio la
respuesta y luego pedirle que "continúe".

**Tampoco puede publicar en el foro como otra persona ni como docente.** Las
políticas exigen `autor_id = auth.uid()` y `autor_rol = 'Estudiante'`.

**Los compañeros se ven por una función, no por una política amplia.**
`companeros_de(asignatura)` devuelve solo nombres, y solo si quien pregunta
está inscrito en esa asignatura. Las inscripciones siguen siendo privadas: no
se puede averiguar en qué otros ramos está alguien.

**El micrófono se pide al hablar, no al entrar.** Escuchar una clase no
necesita permiso; solo hablar. Pedirlo al entrar, sin motivo visible, hace que
se rechace más — y un permiso rechazado para siempre solo se arregla en los
Ajustes del teléfono. Por eso el diálogo aparece recién cuando el estudiante
toca el micrófono. `app/src/dominio/microfono.ts`.

**El correo no se puede leer desde el cliente.** La columna `perfiles.correo`
no está en el `grant`: el propio usuario obtiene el suyo de la sesión, y el de
los demás no sale nunca de la base.

**La clave anónima de Supabase es pública por diseño.** Lo que protege los
datos son las políticas de acceso, no el secreto de esa clave.

---

## Simplificaciones actuales

Son deliberadas y están acotadas. Cada una tiene su costo anotado.

| Simplificación | Consecuencia |
|---|---|
| Los docentes no tienen cuenta: viven como texto en `asignaturas`, y sus mensajes de foro llevan `autor_id` nulo | Ningún profesor puede entrar a la app todavía. Cuando se necesite, hay que darles perfil y un rol |
| No hay panel docente | Las asignaturas, tareas, notas y avisos entran por el seed o a mano |
| La clase en vivo no tiene audio real | La pantalla, sus controles y **el permiso de micrófono ya funcionan**; falta el transporte que lleve la voz a la sala (ver spec, §9) |
| Las grabaciones no tienen archivo | El reproductor está completo —avance, ±15 s, velocidades, capítulos— y suena en cuanto `clases.audio_url` tenga una URL. Con la columna vacía muestra el aviso y deja navegar los capítulos |
| Las entregas no aceptan archivos | `entregas.archivo_url` existe; falta Supabase Storage y el selector de archivos |
| No hay notificaciones push | Las notificaciones se leen dentro de la app, no llegan al teléfono |
| Solo se ven nombres de compañeros, no correos ni en qué otros ramos están | Fue la exposición mínima que permite mostrar el curso. Si más adelante se quiere foto o perfil público, es una decisión aparte |

---

## Sobre grabar la clase desde el teléfono

Surgió la idea de usar el micrófono del estudiante durante la clase en vivo
para no tener que guardar grabaciones y ahorrar espacio. No funciona, por tres
razones que conviene dejar escritas:

**El teléfono no puede grabar la clase.** iOS y Android no dejan que una app
capture el audio que reproduce el sistema u otra app. El micrófono captura la
sala donde está el estudiante, no la voz del profesor, que llega como
reproducción. Lo que se grabaría es su pieza, no la clase.

**Grabar el ambiente de un estudiante es un problema de privacidad**, no una
función. Capturaría a quien esté cerca, sin que nadie haya consentido.

**El espacio no es el costo.** Una clase de hora y media en Opus mono ronda los
20 MB, y es **un archivo para todo el curso**, no uno por estudiante. Un
semestre completo de seis ramos cabe en unos pocos gigabytes. Lo caro del audio
en vivo es el transporte, que se cobra por participante y por minuto: quitar las
grabaciones ahorra lo barato y deja intacto lo caro.

**Lo que sí conviene hacer**: casi todos los transportes de audio en vivo
(LiveKit, Daily, Agora) pueden grabar del lado del servidor. Si se activa esa
opción, la grabación sale como subproducto de la clase en vivo y no hay que
construir un segundo sistema. Ese es el ahorro real — no en almacenamiento, sino
en no mantener dos caminos para el mismo audio.

Y hay una razón de producto para no tocarlas: la clase en vivo sirve para estar;
la grabada, para no haber estado. Un estudiante que se enfermó o que repasa para
el examen depende de la segunda.

## El tablero de apuntes

Los apuntes tienen pestaña propia: un muro de tarjetas al estilo Google Keep,
que es donde el estudiante entra a buscar lo que escribió. Se reparte en una a
cuatro columnas según el ancho, de modo que en una tablet en horizontal se ven
cuatro y en un teléfono una sola.

Las tarjetas se reparten **por columnas, no por filas**: así las de distinto
alto encajan sin dejar huecos, como en un muro de notas de verdad.

- **Fijar** deja un apunte arriba de todo; dentro de cada grupo manda la fecha.
- **Buscar** ignora acentos y mayúsculas —buscar "calculo" encuentra "Cálculo"—
  y exige que aparezcan todas las palabras, en cualquier orden.
- **El color es del ramo**, no del apunte. En Keep el color lo elige quien
  escribe; acá ya significa algo, y dos convenciones de color peleando hacen que
  ninguna se lea.

Todo eso vive en `app/src/dominio/tablero.ts`, aparte de la pantalla y probado.

## Una sola app para teléfono y tablet

No hay dos aplicaciones ni se pregunta al arrancar de qué aparato se trata.
**Todo se decide por el ancho disponible**, en `app/src/dominio/disposicion.ts`,
y por tres razones:

- Una **tablet en vertical** tiene el mismo espacio útil que un teléfono grande
  y debe verse igual. Preguntar por el aparato daría la respuesta equivocada.
- **Girar la tablet** cambia la disposición sin reiniciar nada. Una pregunta al
  arrancar tendría una respuesta que deja de ser cierta a los diez segundos.
- Dos aplicaciones serían dos compilaciones que mantener sincronizadas, y el
  usuario podría instalar la que no le corresponde.

Tres cortes, con lo que cambia en cada uno:

| Ancho | Ejemplo | Qué cambia |
|---|---|---|
| menos de 620 | teléfono vertical | una columna en todo |
| 620 a 899 | tablet vertical, teléfono de lado | tarjetas de asignatura en dos columnas |
| 900 o más | tablet horizontal | dos paneles, y las secciones a la vista |

Además, en pantalla ancha la columna de texto **se limita a 760 puntos y se
centra**: un párrafo que cruza una tablet entera es incómodo de leer.

### Qué gana la tablet en horizontal

- **Apuntes y tutor lado a lado**, para preguntar sin salir de la clase.
- **Las nueve secciones de una asignatura a la vista**, en una barra lateral.
  El menú de los tres puntitos desaparece: existe porque en un teléfono no
  caben, no como preferencia de diseño.
- **Tarjetas de asignatura en dos o tres columnas**, y el tablero de apuntes
  hasta en cuatro.

Los apuntes **se guardan solos** un segundo y medio después de dejar de
escribir. Nadie debería perder apuntes de clase por olvidar tocar un botón.

Al terminar, **Terminar clase y resumir** llama a la función `resumen`, que
devuelve tres cosas: el resumen de lo que el estudiante escribió, los temas del
temario que su apunte no menciona, y consejos para estudiar ese contenido.

**La regla del tutor sigue en pie ahí también.** Resumir lo que el propio
estudiante escribió está permitido: eso no es hacerle la tarea. Terminarle un
ejercicio que dejó a medias, no — el prompt lo dice explícitamente.

### Lo que falta para que el tutor "escuche al profesor"

Hoy el resumen se hace con los apuntes y el temario del ramo, y lo dice en
pantalla en vez de aparentar que oyó la clase.

Para cruzarlo con lo que se dijo en la sala hace falta la **transcripción**, y
esa no puede salir del teléfono del estudiante por la misma razón que no puede
salir de ahí la grabación: el sistema operativo no deja capturar el audio que
reproduce otra app. Tiene que producirse del lado del servidor, sobre el mismo
audio del transporte.

La tabla `transcripciones` ya existe y la función `resumen` la usa **cuando hay
filas**. El día que el transporte alimente esa tabla, el resumen mejora solo,
sin tocar la app.

## Dos asistentes, con reglas opuestas

El alumno tiene el **tutor**: nunca le da la respuesta, porque el objetivo es
que la encuentre. El docente y la administración tienen el **asistente**: le
responde derecho, porque su problema no es aprender, es no perder media hora
cruzando planillas para saber a quién escribirle.

Son dos funciones distintas —`tutor/` y `asistente/`— y no comparten prompt.
Meterlas en una sola con un `if` sería la forma más rápida de que la regla del
tutor se filtre o se pierda.

El asistente **puede buscar en internet** (`web_search`), y por eso el prompt
carga una regla de separación: lo que sale de una búsqueda se dice con su
fuente y aparte de lo que salió del curso. Un dato del curso es verificable;
uno de internet, no necesariamente.

**De dónde salen sus datos.** El asistente lee el curso con el **token de
quien pregunta**, igual que el tutor. Un ramo ajeno no aparece aunque se pida
por su identificador, y los apuntes, resúmenes y conversaciones con el tutor
no vuelven nunca — no porque el prompt lo prohíba, sino porque las políticas
de la base no los entregan. Un prompt se da vuelta con insistencia; una
política, no.

**"Quién ha estudiado" se responde sin abrir un apunte.** El dato es
`progreso_material`: cuánto del material marcó como visto cada alumno y cuándo
fue la última vez. Eso contesta la pregunta operativa —a quién le escribo—
sin tocar contenido privado. El prompt además obliga a separar el hecho de la
interpretación: "no entregó" está registrado, "no ha estudiado" es una lectura
del avance, y la conclusión la saca el docente.

Sin backend el asistente responde igual, calculando de los datos del aparato
(`dominio/asistente-demo.ts`). Cuando no entiende una pregunta lo dice y
enumera lo que sí sabe responder, en vez de inventar.

## Dos públicos, una sola aplicación

StudIA sirve a quien estudia en una institución y a quien se baja la app para
estudiar por su cuenta. La diferencia la decide **el dominio del correo**, y
por eso vive en `dominio/acceso.ts` y no en la pantalla: es una regla de
negocio. El día que se conecten las APIs de cada universidad, lo que cambia es
de dónde salen los ramos, no esta decisión.

La pantalla de acceso pide **el correo antes que la clave**, a propósito: el
dominio decide por dónde entra la persona, y conviene decírselo antes de que
se haga una idea equivocada. A quien viene de una institución **sin convenio**
no se le promete que sus ramos aparecerán: se le explica que entra por su
cuenta mientras tanto. Prometer ramos que no llegan es peor que no
reconocerlo.

Una trampa que vale la pena recordar: reconocer el dominio con `endsWith` a
secas daría acceso institucional a `nouc.cl`, que cualquiera puede comprar. La
comparación exige el dominio exacto **o** un punto delante.

### El espacio propio

Quien llega solo no necesita un segundo sistema: necesita una columna.
`asignaturas.creador_id` dice quién es dueño de un ramo — null significa que
lo cargó la institución. Si tiene dueño, esa persona manda ahí adentro: crea
sus módulos, sube sus lecturas, se pone su horario y sus plazos. El lector,
los apuntes y el tutor funcionan igual sin enterarse de la diferencia.

Dos límites deliberados. La política de creación exige que el ramo quede **a
nombre propio**, porque si no cualquiera podría crear un ramo del colegio y
colgarle material. Y un espacio propio **no lleva evaluaciones ni notas**:
ponerse uno mismo un 6,5 no significa nada, y sería una puerta más que vigilar
a cambio de nada.

## Con quién se entra

Todo lo que la app necesita saber de quien la usa sale de `lib/quien-soy.ts`:
nombre, rol, papel y qué ramos dicta. Con Supabase conectado eso viene de
`perfiles.rol` y de `dictados`; sin backend, del perfil que se eligió al
entrar. **Las pantallas no saben cuál de los dos es**, y esa es la idea: si lo
supieran, habría que acordarse de tocar las dos ramas cada vez.

Con Supabase conectado, quién eres lo decide el inicio de sesión y el rol que
trae tu perfil. Sin backend no hay a quién preguntarle, así que en modo
demostración la app **ofrece elegir** entre cuatro perfiles al arrancar. No es
un inicio de sesión de mentira y lo dice en pantalla: confundir eso con
seguridad sería peor que no tenerlo.

Cada rol abre una aplicación distinta sobre los mismos datos:

| Perfil | Qué abre |
|---|---|
| Estudiante | Las pestañas de siempre: inicio, horario, tareas, apuntes, tutor |
| Profesor | Sus cursos, con entregas por revisar y notas por publicar |
| Ayudante | Lo mismo, sin el botón de publicar notas |
| Administración | Los ramos, el horario y las personas del colegio |

La diferencia entre profesor y ayudante aparece en la pantalla porque también
existe en la base: `dicta_como_profesor` es lo que gobierna `evaluaciones` y
`notas`. La app no decide el permiso, solo evita ofrecer un botón que el
servidor va a rechazar — y hay una prueba de pantalla que lo fija.

La pantalla de administración vuelve a correr **la misma** detección de
choques que corre el importador: `dominio/horario.ts` la tiene una sola vez.
Dos copias de esa regla es la manera de que discrepen.

## Tres capas de escritura

Quien manda sobre cada dato es distinto, y el diseño lo sigue:

| Quién | Sobre qué | Por qué esa frontera |
|---|---|---|
| El colegio | Ramos, horario, dictados, inscripciones | Son hechos que deben ser iguales para todos. Si cada profesor pudiera mover una sala, dos cursos quedarían citados en el mismo lugar. |
| El docente | Módulos, material, lecturas, tareas, evaluaciones, notas, clases, foro de **su** ramo | Es contenido, y cambia durante el semestre. |
| El alumno | Entregas, apuntes, avance, preguntas al tutor | Nadie escribe por él. |

**El camino normal del colegio no es una pantalla: es una planilla.** Nadie va
a tipear un semestre en un formulario, y lo que el colegio ya tiene está en
Excel. Por eso la carga entra por `datos/` y `npm run importar`: seis CSV, una
carpeta de lecturas, y un comando que revisa todo antes de escribir una sola
fila. Las políticas de administración existen igual, para corregir una fila
suelta desde la app el día que haga falta.

El importador revisa lo que una planilla no puede ver sola: que los códigos y
correos referenciados existan, que un `documento` tenga algo que abrir, y
**los choques de horario** —misma sala a la misma hora, o un profesor citado
en dos partes a la vez—, que es el error que más caro sale porque se descubre
el primer día de clases. Informa todos los problemas juntos, con archivo y
línea: hacer corregir de a uno le hace perder la tarde a alguien.

Y es idempotente. Un colegio corrige la planilla y vuelve a importar; eso
actualiza lo que cambió sin duplicar nada y sin pisar lo que los alumnos ya
escribieron. El horario es lo único que se rehace entero, para que un bloque
borrado de la planilla desaparezca de verdad.

### Un candado que también encerraba al colegio

El trigger que impide cambiarse el rol se escribió pensando en el cliente,
pero corría para todos. La primera importación de un semestre —que justamente
asigna roles— se caía sola. Los dos triggers de este tipo ahora miran
`current_user` y solo vigilan a `authenticated`. Apareció al aplicar el SQL
generado de punta a punta, no leyéndolo.

## Docentes: quién puede escribir qué

Hasta hace poco el profesor era una cadena de texto en `asignaturas.profesor`
—un nombre para mostrar, sin cuenta y sin permisos— y todo el contenido venía
del seed. La app funcionaba, pero nadie podía cargar nada.

La regla nueva es el espejo exacto de la del estudiante. `inscripciones` dice
qué ve un alumno; `dictados` dice qué ve **y escribe** un docente. Las dos se
consultan con una función `SECURITY DEFINER` —`esta_inscrito` y `dicta`— por
la misma razón: no volver a pasar por las políticas y no entrar en recursión.

Las políticas de docente se **suman** a las de estudiante en vez de
reemplazarlas: Postgres une las políticas permisivas con OR, así que agregar
las nuevas no le quitó nada a nadie. Las 37 aserciones de estudiante que ya
existían siguen pasando sin tocarse.

**Profesor y ayudante no son lo mismo.** El ayudante corrige entregas, carga
material y responde el foro. Publicar notas es del profesor: hay una segunda
función, `dicta_como_profesor`, y las políticas de `evaluaciones` y `notas`
usan esa.

**Corregir es poner un puntaje, no reescribir la entrega.** La política sola
dejaría a un docente cambiar el archivo entregado o la fecha, y el alumno se
quedaría sin cómo demostrar qué entregó y cuándo. Como RLS no puede comparar
contra la fila anterior, eso lo cierra un trigger.

**La línea que el docente no cruza.** Los apuntes, las transcripciones, los
resúmenes y la conversación con el tutor son material de estudio privado del
alumno, y no hay ninguna política que se los abra. No es un descuido: un
alumno que sabe que su profesor le lee los apuntes deja de escribir lo que no
entiende, y eso es justo lo que hace útil al tutor.

**Nadie se asciende solo.** El rol sale de los metadatos con que se creó la
cuenta y un trigger rechaza cualquier `update` que lo cambie. El cliente sí
puede leer su propio rol —lo necesita para saber qué pantalla abrir— pero
`perfiles` sigue cerrado por columnas y el correo no se lee desde el cliente.

### Una trampa de las pruebas que vale la pena recordar

Un `update` que no alcanza ninguna fila **no lanza error**: termina tranquilo
habiendo cambiado cero. Una prueba escrita como "esperaba una excepción"
pasaría igual si el permiso estuviera abierto de par en par. Las pruebas de
escritura cuentan filas con `get diagnostics` y además releen el valor.

## El lector inmersivo

El material de tipo documento ya no es un PDF que hay que bajar: trae el texto
adentro, en la columna `materiales.texto`. Eso permite abrirlo dentro de la app
y escucharlo mientras se toman apuntes, que es como se estudia en la casa.

**Se lee frase por frase, no de una.** El texto se corta con
`dominio/lectura.ts` y se le entrega al sintetizador una frase a la vez,
esperando a que termine para mandar la siguiente. Cuesta más que mandar el
texto entero, pero es lo único que permite las tres cosas que hacen falta:
resaltar exactamente lo que suena, retroceder una sola frase, y cambiar la
velocidad sin volver al principio. De paso esquiva el límite de largo del
motor de Android, que trunca las frases largas sin avisar.

Cortar en frases castellano no es partir por los puntos. Un punto entre
dígitos es un decimal (`3.1416`), un punto detrás de un tratamiento nunca
cierra (`el Dr. Salas`), y una abreviatura como `etc.` cierra o no según lo
que venga después: minúscula sigue, mayúscula corta. Todo eso está probado.

**Lo que se ve no es lo que se oye.** Los motores de voz leen los signos en
voz alta: un paréntesis se convierte en la palabra "paréntesis" y arruina la
frase. Borrarlos y ya tampoco sirve, porque un paréntesis *significa* algo —un
inciso— y ese significado se conserva mejor como una pausa. `paraVoz()` hace
esa traducción antes de mandar la frase al sintetizador: los incisos se vuelven
comas, las comillas desaparecen, `f(x)` se dice "f de x" y `a/b` se dice "a
sobre b", que es como se lee en el pizarrón. En pantalla el texto queda intacto.
Una línea que era pura decoración —una raya, un separador— no tiene nada que
decir y se salta sin dejar un silencio raro en medio.

**El toque va en el párrafo, no en la frase.** Un `Text` con `onPress` deja de
fluir en línea y el párrafo termina partido en una frase por renglón. Para
saltar a una frase puntual están los mandos de la barra.

**Los ajustes viven en el aparato.** Tamaño, interlineado, fondo, velocidad y
dónde quedó se guardan en `AsyncStorage`, no en la base: dependen de la
pantalla que tiene en la mano, no de su cuenta, y así el lector abre sin
esperar a la red. Lo guardado se normaliza al leerlo: unas preferencias de una
versión anterior no pueden impedir que el lector abra.

**La voz es opcional.** `lib/voz.ts` carga `expo-speech` con la misma puerta
que `lib/audio.ts` usa para `expo-audio`: si el cliente no lo trae, el texto se
lee igual y se dice por qué no suena. Si el aparato no tiene voces en español,
se avisa antes de que el estudiante crea que la app está rota: el motor leería
castellano con fonética inglesa.

Lo que se anota mientras se escucha va a los apuntes del ramo, al mismo apunte
cada vez que se vuelve a esa lectura. El botón "Anotar esta frase" la copia
entrecomillada.

## Consejos de estudio: dos clases distintas

**Sobre la materia** los da Claude, dentro del resumen de la clase.

**Sobre cómo estudia** los calcula la app con sus propios datos, en
`app/src/dominio/habitos.ts`: un ramo bajo 4,0, tareas atrasadas con nombre y
apellido, un ramo que se queda atrás del resto, la costumbre de entregar sobre
la hora, un ramo que avanza sin dejar apuntes. Y cuando no hay nada que avisar,
lo dice también.

Se calculan localmente a propósito: si la app afirma "sueles entregar sobre la
hora", tiene que poder mostrar cuáles. Un consejo que no se puede justificar con
un dato concreto no se muestra.

## Audio en vivo: lo que ya está y lo que falta

**Hecho: la función `sala`.** Entrega el token para entrar al audio de una
clase. La clave y el secreto de LiveKit viven en el servidor; el teléfono
recibe un JWT acotado a una sala.

Tres decisiones que quedaron en el diseño del token:

- **El nombre de sala se deriva de la clase**, nunca de lo que mande el
  cliente. Si viniera del cuerpo de la petición, cualquiera podría pedir entrar
  a la sala de otro curso.
- **La clase se lee con el token del estudiante**, así que las políticas de
  acceso deciden: si no está inscrito, no hay token que entregar.
- **El estudiante entra sin permiso para publicar.** Dar la palabra implica
  pedir otro token con `canPublish`. Así, abrir el micrófono no depende de la
  app —que se puede modificar— sino de un permiso que el token no trae.

Sin `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` configuradas, la
función responde 503 con un mensaje claro en vez de fallar de forma rara.

**Falta: el cliente.** Conectar la pantalla de clase en vivo requiere
`@livekit/react-native` y su plugin de Expo, que traen código nativo. No los
instalé todavía a propósito: es una dependencia que no puedo ejecutar ni probar
desde acá, y agregarla justo antes de la primera compilación del APK arriesga
romperla. Conviene hacerlo cuando el APK en modo demostración ya esté
funcionando en la tablet.

## Elegir el transporte de audio en vivo

Escenario real: **20 inscritos por ramo, asistencia típica ~14**, clases de 90
minutos. Seis ramos, dos cátedras por semana, quince semanas: **180 clases y
226.800 minutos-participante por semestre**. Se graba una pista por clase
—16.200 minutos—, no una por estudiante.

| | Conexión | Grabación | Total por semestre |
|---|---|---|---|
| **LiveKit** | $91–113 | $65 | **$156–178** |
| Agora | $225 | aparte | $225 + grabación |
| Daily | $225 | $219 + $49 almacén | $492 |

Precios de audio: LiveKit $0,0004–0,0005 por minuto-participante y $0,004 por
minuto de egress de audio; Agora y Daily $0,99 por cada 1.000 minutos; Daily
cobra la grabación a $0,01349 por minuto grabado más $0,0030 de almacenamiento.

**Recomendación: LiveKit.** Es entre dos y tres veces más barato, su egress de
audio produce la grabación como subproducto de la clase —una sola tubería, no
dos—, tiene plugin propio de Expo (`@livekit/react-native-expo-plugin`), y es
código abierto y autoalojable: si el costo crece, se puede mover a un servidor
propio sin reescribir el cliente. Esa salida no la dan los otros dos.

**Nota sobre las cifras.** Las páginas de precios de los tres proveedores están
bloqueadas desde este entorno, así que los valores vienen de resúmenes de
búsqueda y de páginas de terceros. Sirven para comparar órdenes de magnitud;
hay que confirmarlos en la fuente antes de firmar nada.

**Para un piloto**, un solo ramo consume unos 10.800 minutos-participante al
mes, apenas por sobre los 10.000 gratuitos de Agora y Daily. Con un curso más
chico o una cátedra semanal, el piloto sale gratis en cualquiera de los tres.

**Almacenamiento**: las grabaciones en Opus mono ocupan unos 14 MB por hora,
3,9 GB por semestre para todo el programa. No es un costo relevante.

## Pantallas

| Pantalla | Qué hace |
|---|---|
| Sesión | Entrar y crear cuenta |
| Apuntes | El tablero: muro de tarjetas, con fijar y buscar |
| Apunte | Escribir en clase; en tablet horizontal, con el tutor al lado |
| Lectura | El lector inmersivo: escuchar el material y anotar al lado |
| Consejos | Cómo va estudiando, calculado de sus propios datos |
| Inicio | Clase en vivo, bloques de hoy, próximas entregas y las asignaturas |
| Asignatura | Nueve secciones tras los tres puntitos |
| Tarea | Enunciado, criterios de evaluación, entrega y acceso al tutor |
| Clase en vivo | Cronómetro, ecualizador, participantes, micrófono y pedir la palabra |
| Grabación | Reproductor con ±15 s, velocidades y capítulos que saltan |
| Horario | La semana, día por día |
| Tareas | Pendientes, entregadas y todas |
| Notas | Promedio ponderado por créditos y nota de cada ramo |
| Notificaciones | Cada una lleva al lugar exacto |
| Foro: hilo y hilo nuevo | Leer, responder y abrir un tema |
| Tutor | El chat, con el ramo y el contexto de dónde venías |
| Perfil | Nombre, correo y cerrar sesión |

Las nueve secciones de una asignatura: **Materia, Clases, Tareas, Foro, Notas,
Horario, Programa, Compañeros y Archivos**.

## Mapa del repositorio

| Ruta | Qué es |
|---|---|
| `app/` | La aplicación Expo |
| `app/src/dominio/` | Lógica pura y probada: notas, tareas |
| `app/src/lib/` | Cliente de Supabase, consultas, cliente del tutor, rutas |
| `app/src/ui/` | Tokens de diseño y componentes compartidos |
| `app/src/pantallas/` | Una pantalla por archivo — quince |
| `supabase/migrations/` | Esquema y políticas de acceso |
| `supabase/seed.sql` | Las seis asignaturas con datos realistas |
| `datos/` | Las planillas del colegio y las lecturas (ver `datos/LÉEME.md`) |
| `herramientas/` | El importador de planillas y su validación |
| `supabase/functions/tutor/` | La función que habla con Claude |
| `supabase/pruebas/` | Andamio y pruebas de acceso |
| `prototipo/` | El prototipo HTML, que sigue siendo la referencia de diseño |
