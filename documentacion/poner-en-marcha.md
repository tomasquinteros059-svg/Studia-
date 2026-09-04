# Poner StudIA en marcha

De un repositorio a una aplicación que funciona de verdad. Es la única parte
que no se puede automatizar desde acá: hay que crear cuentas, pegar claves y
apretar botones en dos sitios web.

Son unas dos horas la primera vez. El orden importa: cada paso supone hecho el
anterior.

> **Lo que hay hoy.** El APK que se descarga funciona en **modo demostración**:
> datos de ejemplo que viven en el teléfono, sin cuentas y sin nada que se
> guarde en un servidor. Todo lo de esta guía existe para cambiar eso.

---

## Lo que necesitas antes de empezar

| Qué | Dónde | Cuesta |
|---|---|---|
| Cuenta de Supabase | supabase.com | Gratis para empezar |
| La CLI de Supabase | `npm i -g supabase` | — |
| Clave de la API de Anthropic | console.anthropic.com | Se paga por uso |
| Cuenta de desarrollador de Google Play | play.google.com/console | US$25, una vez |

La clave de Anthropic es la única que hace falta para que el tutor responda. Sin
ella la app entra, muestra los ramos y guarda apuntes; lo que no hace es
conversar.

---

## 1 · Crear el proyecto en Supabase

En supabase.com → **New project**. Elige la región más cercana —para Chile,
`South America (São Paulo)`— y guarda la contraseña de la base que te pide: no
se puede volver a ver.

Cuando termine de crearse, en **Project Settings → API** vas a ver tres cosas.
Cópialas a un lugar seguro:

| Dato | Para qué | ¿Es secreto? |
|---|---|---|
| **Project URL** | La app y el flujo del APK | No |
| **anon public** | La app | **No.** Va dentro del APK, que cualquiera puede abrir. Lo que protege los datos son las políticas de acceso, no esta clave |
| **service_role** | Solo el servidor | **Sí, mucho.** Se salta todas las políticas. Nunca en el APK, nunca en el repositorio |

El identificador del proyecto (el `abcdefgh` de `abcdefgh.supabase.co`) lo vas a
necesitar en el paso siguiente.

---

## 2 · Subir la base de datos

Desde la carpeta del proyecto:

```bash
supabase login
supabase link --project-ref <el-identificador-de-tu-proyecto>
supabase db push
```

`db push` aplica las migraciones en orden: las tablas, las políticas de acceso,
el bucket de archivos, la tabla de aparatos, la de caídas y la columna del plan.

**No subas `seed.sql`.** Son los datos de ejemplo —Eduardo, Ana Ríos, Cálculo I—
y sirven para probar en tu computador, no para un colegio de verdad.

Para comprobar que quedó: en el panel de Supabase, **Table Editor** tiene que
mostrar `perfiles`, `asignaturas`, `tareas`, `aparatos`, `errores` y unas
veinte más.

### Sin consola, desde una tablet

`db push` necesita un computador con la consola de Supabase instalada. Si no lo
tienes a mano, el panel sirve igual: **SQL Editor → New query**, pegar todo el
contenido de `supabase/todo-de-una-vez.sql` y **Run**.

Ese archivo son las mismas migraciones concatenadas en orden, y lo genera:

```bash
npm run juntar-migraciones
```

Supabase corre el texto entero como una sola operación, así que si una línea
falla deshace las anteriores y la base queda como estaba: no hay manera de
dejarla a medio armar. Al final el archivo anota las migraciones como aplicadas
en `supabase_migrations.schema_migrations`, para que un `db push` posterior
desde un computador no intente repetirlas.

---

## 2.5 · La nómina de una institución

Cuando una universidad o un colegio contrata StudIA, lo que entrega es una
planilla. Eso se carga desde la aplicación, con una cuenta de administración:
**El colegio → Cargar**.

Son cinco planillas y ninguna es obligatoria:

| Planilla | Qué lleva |
|---|---|
| `asignaturas.csv` | los ramos |
| `horario.csv` | los bloques de cada ramo |
| `personas.csv` | correo, nombre y rol de cada quien |
| `dictados.csv` | quién dicta qué, y con qué papel |
| `inscripciones.csv` | quién está en qué ramo |

Lo que hay que entender de las tres últimas: **casi nadie de esa lista va a
tener cuenta cuando se carga, y no hace falta que la tenga.** Cada fila queda
esperando a nombre de un correo. El día que esa persona se registra con ese
mismo correo, entra con su rol, su plan de institución y sus ramos ya puestos.
A quien ya se había registrado se le aplica en el momento de cargar.

Los ramos se cargan antes que la gente, porque una inscripción a un ramo que
todavía no existe no se puede convertir en nada. La pantalla lo hace en ese
orden sola.

Una planilla mal armada no baja de rol a quien ya es administración: si eso
pasara, la institución quedaría sin nadie que pueda arreglarlo. Y una planilla
con el correo de alguien que ya pertenece a otra institución no se lo lleva.

La nómina puede tener más filas que cupos contratados —eso no es un error—,
pero el encabezado del panel avisa cuántos faltan antes de que esa gente se
registre y quede en el plan gratis sin que nadie se entere.

---

## 3 · Desplegar las funciones del servidor

Son ocho y ninguna sobra:

```bash
supabase functions deploy
```

| Función | Qué hace | Sin ella |
|---|---|---|
| `tutor` | El tutor que guía | No responde |
| `asistente` | El asistente de quien dicta | No responde |
| `quiz` | Arma los quizzes | «Crear quiz» falla |
| `fichas` | Arma las fichas de repaso | No se generan |
| `resumen` | Resume la clase y el apunte | No se genera |
| `sala` | El token del audio en vivo | La clase en vivo no entra |
| `borrar-cuenta` | Borra la cuenta y todo lo suyo | **Play Store rechaza la app** |
| `avisar` | Manda los avisos al teléfono | Los avisos no salen |

Después, las claves que necesitan:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las pone
Supabase sola: no hay que cargarlas.

Las de LiveKit —`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`— son solo
para el audio en vivo. Sin ellas, esa pantalla dice que no está configurado y el
resto de la aplicación funciona igual.

### Sin consola, desde una tablet

En **Edge Functions → Deploy a new function → Via Editor**, una por una, con el
nombre exacto de la tabla de arriba, y pegando el archivo que le corresponde de
`supabase/funciones-de-una-vez/`.

Las ocho comparten código —`_compartido/cors.ts` y el núcleo de cada una—, y en
el editor del panel cada función es su propia raíz: ese `../_compartido/` no
lleva a ninguna parte. Los archivos de esa carpeta son las mismas funciones con
lo compartido incrustado arriba, para que cada una se baste sola. Los genera:

```bash
npm run juntar-funciones
```

Cada función es un despliegue aparte, con su propio nombre y su propia
dirección: la aplicación llama a cada una por el suyo. No se pegan las ocho
juntas ni se agregan archivos —cada archivo de esa carpeta ya trae adentro lo
que la función necesita, y por eso son largos—.

*Verify JWT* se deja como viene, activado: las ocho lo esperan así.

Antes de subirlas, si tienes Deno instalado:

```bash
npm run prueba:funciones-deno
```

Las compila las dieciséis —las ocho de `supabase/functions` y las ocho
pegables— con el compilador que de verdad las corre. Sin Deno no falla: lo
dice y se salta.

Las claves van en **Edge Functions → Secrets**, con los mismos nombres.

---

## 4 · Configurar la entrada

En **Authentication → URL Configuration**, agrega a *Redirect URLs*:

```
studia://recuperar
```

Sin esto, el correo de «olvidé mi clave» llega igual y el enlace no abre nada.
Es de las cosas que solo se descubren cuando a alguien se le olvida la clave.

En **Authentication → Providers**, si quieres los botones de Google y Microsoft,
actívalos ahí. Sin activarlos, la app lo dice y ofrece entrar con correo.

En **Authentication → Emails**, revisa que la confirmación por correo esté como
la quieres. Si está activada —lo normal—, al crear cuenta la app avisa que hay
que ir a leer el correo.

---

## 5 · Que el APK salga conectado

En GitHub → el repositorio → **Settings → Secrets and variables → Actions →
New repository secret**, dos:

| Nombre | Valor |
|---|---|
| `SUPABASE_URL` | El Project URL del paso 1 |
| `SUPABASE_ANON_KEY` | La clave `anon public` |

Con las dos puestas, la próxima compilación sale conectada. Sin ellas el APK se
sigue armando, pero **el archivo se llama `-demo`** y la versión lo dice: no se
pueden confundir.

Para compilar: pestaña **Actions → «APK para probar» → Run workflow**.

---

## 6 · Abrir la primera institución

Es el paso que nadie adivina, porque tiene un problema del huevo y la gallina:
todo en StudIA pertenece a una institución, y al principio no hay ninguna.

Hay dos papeles distintos y conviene no confundirlos:

| Quién | Qué ve | Cómo se marca |
|---|---|---|
| **Operación de StudIA** (nosotros) | las caídas de la aplicación y los reportes de contenido de todo el servicio | `public.hacer_operador` |
| **Administración de una institución** (su secretaría académica) | sus ramos, su horario, su gente y su contrato — y nada de otra institución | rol `administrador` + pertenecer a esa institución |

No es un rol más porque quien opera el servicio también puede estar estudiando
o dictando en alguna parte: un rol que hay que dejar de ser para poder estudiar
es un rol mal puesto.

### 6.1 · Marcarte como operación

1. Crea tu cuenta desde la app, normal, con tu correo.
2. En Supabase → **SQL Editor**, corre:

```sql
select public.hacer_operador('tu@correo.cl');
```

Desde el editor sí se puede: la función deja pasar cuando no hay sesión —ahí
quien escribe tiene la clave de servicio y ya podía hacer cualquier cosa— y con
sesión exige ser operador. Es la única vez que hace falta tocar SQL.

### 6.2 · Abrir la institución que contrató

Una línea, con el nombre, cuántas personas cubre el contrato y el correo de
quien va a administrarlo del lado de ellos:

```sql
select public.crear_institucion('Universidad de Chile', 4000,
                                'secretaria.academica@uchile.cl');
```

Eso deja la institución abierta y a esa persona **esperando en la nómina**. El
día que se registre con ese correo, entra con el panel armado: no hay que
volver a tocar SQL ni pedirle a nadie que le cambie el rol.

Si el contrato tiene fecha de término, va como cuarto argumento:

```sql
select public.crear_institucion('Colegio San Marcos', 400, 'secre@sanmarcos.cl',
                                '2027-03-01'::timestamptz);
```

Vencido el contrato **no se entregan cupos nuevos**, y a quien ya tenía el suyo
no se le quita de golpe. Renovarlo es correr un `update` sobre `vence_en`.

### 6.3 · Los cupos

El plan ya no se pone persona por persona: **se contratan N cupos y la nómina
los ocupa.** Cada persona de la institución que se registra toma uno, si queda.
Si no queda, entra igual —con sus ramos y su rol— pero en el plan gratis, y el
encabezado del panel lo dice antes de que eso pase: «faltan 12 para la gente de
la nómina que aún no entra».

La administración de la institución da y quita cupos desde **El colegio →
Personas**, con el botón **Cupo**. Quitárselo a alguien que ya no está devuelve
el cupo a la bolsa.

Lo que ese botón **no** hace es tocar el plan Personal: ese lo pone Google Play
cuando alguien lo paga, y bajárselo desde el panel no le devolvería el dinero.

### 6.4 · Lo que una institución no puede ver de otra

Vale la pena saberlo antes de vender la segunda, porque es lo que se promete en
una reunión:

- El registro de personas —el único lugar de StudIA donde se lee el correo de
  alguien más— trae **solo** a la gente de su institución.
- Sus ramos, su horario, sus inscripciones y su nómina, también solo los suyos.
  Dos universidades pueden tener las dos un ramo `MAT1610` y no son el mismo.
- No puede ascender ni cambiarle el plan a nadie de otra institución.
- No puede quedarse con alguien que ya pertenece a otra: si escribe ese correo
  en su planilla, no pasa nada.
- Las caídas de la aplicación y los reportes de contenido de la IA **no** los ve
  ninguna institución. Son del servicio y los revisamos nosotros.

Todo eso está probado en `supabase/pruebas/instituciones.sql`, que arma dos
instituciones en la misma base y afirma una por una cada cosa que la segunda no
puede hacer.

---

## 7 · Que los avisos salgan solos

La función `avisar` no se dispara sola: hay que llamarla cada pocos minutos. En
Supabase → **Database → Extensions**, activa `pg_cron` y `pg_net`, y después en
el SQL Editor:

```sql
select cron.schedule(
  'avisar-cada-5-min',
  '*/5 * * * *',
  $$ select net.http_post(
       url     := 'https://<tu-proyecto>.supabase.co/functions/v1/avisar',
       headers := '{"Authorization": "Bearer <tu-service-role>", "Content-Type": "application/json"}'::jsonb
     ) $$
);
```

Nada sale entre las diez de la noche y las ocho de la mañana: eso lo decide la
función, no el horario de la tarea. Lo que cae fuera de hora sale a la mañana
siguiente.

De paso, conviene una segunda tarea que limpie las caídas viejas:

```sql
select cron.schedule('limpiar-errores', '0 4 * * *',
  $$ select public.limpiar_errores_viejos() $$);
```

---

## 8 · Antes de publicar en Play Store

| Qué | Por qué |
|---|---|
| **Llave de firma propia** | Hoy el APK se firma con la llave de depuración de Expo, que es pública: cualquiera podría firmar una actualización falsa. Play Store no la acepta. **Si la pierdes, no puedes volver a actualizar la app nunca más** |
| **Registrar «StudIA» en INAPI** | Mientras no esté inscrita, cualquiera puede hacerlo antes y el que tendría que cambiar de nombre eres tú |
| **La política de privacidad publicada** | Play Store pide una dirección web. Está en `docs/privacidad.html` |
| **La página de borrado de cuenta** | También la pide. Está en `docs/borrar-cuenta.html` |
| **Un correo del proyecto** | Hoy los textos legales llevan un correo personal |

---

## Sobre iOS

Nunca se ha compilado, y **hace falta un Mac**: no es una limitación de Expo
sino de Apple, que solo firma desde macOS. Lo que sí está listo es todo lo que
se puede dejar hecho de antemano.

```bash
npx expo prebuild --platform ios
cd ios && pod install
open StudIA.xcworkspace
```

Lo que ya está resuelto para que el primer intento no se caiga por algo tonto:

- El ícono, la pantalla de arranque y el esquema `studia://`, que es el que usa
  el enlace de recuperar la clave.
- El permiso de micrófono, con su texto en castellano. Apple rechaza una app
  que pida un permiso sin explicar para qué.
- **`ITSAppUsesNonExemptEncryption` en falso.** Sin esto, Apple pregunta en cada
  subida si la app usa cifrado no exento y la compilación no le llega a nadie
  hasta que alguien conteste. StudIA solo usa HTTPS, que es de lo exento.
- **El número de compilación**, que ahora se numera junto con el de Android. La
  App Store rechaza una subida cuyo número no sea mayor que el anterior, y
  descubrirlo en el momento del rechazo es tarde.

Dos cosas que hay que saber antes de mandarla a revisión:

- **El modo escucha no funciona en iOS.** El módulo que transcribe está escrito
  para Android. La aplicación no se cae: la pantalla dice que este aparato no
  puede dictar. Escribir la versión de iOS es un trabajo aparte.
- **Apple va a preguntar por el audio en segundo plano.** La app lo declara
  para poder seguir reproduciendo una clase grabada con la pantalla apagada,
  que es un uso legítimo y hay que saber explicarlo en la revisión.

---

## Comprobar que quedó todo bien

```bash
npm run comprobar-servidor
```

Revisa contra el proyecto de verdad qué está y qué falta: las tablas, las
políticas activas, el bucket, las funciones que responden y la dirección de
retorno. Es más rápido que descubrirlo con la app en la mano.

---

## Si algo no anda

| Lo que ves | Casi siempre es |
|---|---|
| La cinta «Modo demostración» en un APK nuevo | Faltan los dos secretos del paso 5 |
| Crear cuenta no hace nada | Está la confirmación por correo: hay que ir a leerlo |
| El enlace de recuperar clave no abre la app | Falta `studia://recuperar` en Redirect URLs |
| El tutor no responde | Falta `ANTHROPIC_API_KEY`, o no se desplegó `tutor` |
| «No tienes permiso» al abrir algo | La cuenta no está inscrita en ese ramo. Es correcto |
| Los avisos no llegan | Falta la tarea del paso 7, o la persona no los encendió en Perfil |
| Una pantalla se cae | Mira la tabla `errores`: dice qué falló, en qué pantalla y con qué versión |
