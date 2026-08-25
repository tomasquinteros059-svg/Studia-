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
npm run prueba            # 34 pruebas del dominio y del núcleo del tutor
npm run prueba:bd         # 29 aserciones de acceso contra un Postgres real
npm run prueba:sintaxis   # las funciones de Deno son TypeScript válido
npm run tipos             # tsc en modo estricto sobre la app
```

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

## Pantallas

| Pantalla | Qué hace |
|---|---|
| Sesión | Entrar y crear cuenta |
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
| `app/src/pantallas/` | Una pantalla por archivo — catorce |
| `supabase/migrations/` | Esquema y políticas de acceso |
| `supabase/seed.sql` | Las seis asignaturas con datos realistas |
| `supabase/functions/tutor/` | La función que habla con Claude |
| `supabase/pruebas/` | Andamio y pruebas de acceso |
| `prototipo/` | El prototipo HTML, que sigue siendo la referencia de diseño |
