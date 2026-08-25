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
npm run prueba:bd         # 23 aserciones de acceso contra un Postgres real
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

**La clave anónima de Supabase es pública por diseño.** Lo que protege los
datos son las políticas de acceso, no el secreto de esa clave.

---

## Simplificaciones actuales

Son deliberadas y están acotadas. Cada una tiene su costo anotado.

| Simplificación | Consecuencia |
|---|---|
| Los docentes no tienen cuenta: viven como texto en `asignaturas`, y sus mensajes de foro llevan `autor_id` nulo | Ningún profesor puede entrar a la app todavía. Cuando se necesite, hay que darles perfil y un rol |
| No hay panel docente | Las asignaturas, tareas, notas y avisos entran por el seed o a mano |
| La clase en vivo no tiene audio real | La app muestra que hay clase en vivo, pero no conecta. Falta decidir el transporte (ver spec, §9) |
| Las grabaciones no tienen archivo | `clases.audio_url` existe y está vacío; la app lista las clases pero aún no reproduce |
| Las entregas no aceptan archivos | `entregas.archivo_url` existe; falta Supabase Storage y el selector de archivos |
| No hay notificaciones push | Las notificaciones se leen dentro de la app, no llegan al teléfono |
| No existe la sección "Compañeros" que sí tiene el prototipo | Mostrar el curso implica exponer los nombres de otros estudiantes, y las políticas hoy lo impiden a propósito. Es una decisión de privacidad pendiente, no un olvido |

---

## Mapa del repositorio

| Ruta | Qué es |
|---|---|
| `app/` | La aplicación Expo |
| `app/src/dominio/` | Lógica pura y probada: notas, tareas |
| `app/src/lib/` | Cliente de Supabase, consultas, cliente del tutor, rutas |
| `app/src/ui/` | Tokens de diseño y componentes compartidos |
| `app/src/pantallas/` | Una pantalla por archivo |
| `supabase/migrations/` | Esquema y políticas de acceso |
| `supabase/seed.sql` | Las seis asignaturas con datos realistas |
| `supabase/functions/tutor/` | La función que habla con Claude |
| `supabase/pruebas/` | Andamio y pruebas de acceso |
| `prototipo/` | El prototipo HTML, que sigue siendo la referencia de diseño |
