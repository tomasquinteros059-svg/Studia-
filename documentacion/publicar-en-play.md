# Publicar StudIA

Lo que Google Play y el sitio web piden, y lo que ya está resuelto. Escrito
en el orden en que hay que hacerlo.

---

## Lo que falta, en una línea cada uno

| | Qué | Quién |
|---|---|---|
| ⬜ | La clave con que se firma la subida | Tomás — decisión abajo |
| ⬜ | Alojar el sitio para tener URL pública de privacidad y de borrado | Tomás — decisión abajo |
| ⬜ | Una cuenta de prueba para el revisor de Google | Tomás |
| ⬜ | Capturas de pantalla | Tomás |
| ✅ | El `.aab`, que es lo que Play acepta | listo en el flujo |
| ✅ | Reportar contenido de la IA desde adentro | listo |
| ✅ | Borrar la cuenta desde adentro | listo |
| ✅ | Los textos de la ficha | abajo |
| ✅ | Las respuestas del formulario de datos | abajo |

---

## 1 · La clave de firma

Google Play rechaza cualquier cosa firmada con la clave de depuración, y el
mensaje que da no dice que el problema sea la firma. Hace falta una clave
propia, y **esa clave no se puede perder ni cambiar**: es la que demuestra que
una actualización viene de ti.

El flujo ya está preparado: si existen estos cuatro secretos en GitHub, arma el
`.aab` firmado; si no existen, arma solo los APK de prueba y lo dice.

```
ANDROID_KEYSTORE_BASE64    el archivo .jks convertido a base64
ANDROID_KEYSTORE_PASSWORD  la clave del archivo
ANDROID_KEY_ALIAS          el alias de la clave de adentro
ANDROID_KEY_PASSWORD       la clave de esa clave
```

Y comprueba, antes de entregar nada, que el `.aab` no haya quedado firmado con
la de depuración: un `.aab` mal firmado se ve igual que uno bueno y el error
aparece recién al subirlo.

### Cómo se genera

**En un computador**, que es lo recomendable. Con Java instalado:

```bash
keytool -genkeypair -v \
  -keystore studia-subida.jks \
  -alias studia \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storetype PKCS12
```

Pide una clave y algunos datos —nombre, organización, país `CL`—. Después:

```bash
base64 -w0 studia-subida.jks    # esto va en ANDROID_KEYSTORE_BASE64
```

**Guarda el archivo `.jks` en dos lugares distintos** —un gestor de
contraseñas y un disco aparte— y anota las claves. Perderlo significa no poder
volver a actualizar la aplicación nunca, con la cuenta que ya tenga.

### Si no hay computador a mano

La puedo generar yo acá y pasártela. Es más rápido y tiene un costo que
conviene saber: la clave privada existiría por un rato en una sesión que no
controlas tú. Para una aplicación que todavía no está publicada es un riesgo
manejable —y con *Play App Signing* activado, una clave de subida
comprometida se puede reemplazar pidiéndolo a Google—, pero es tu decisión y
no la tomo por ti.

**Activa Play App Signing** al crear la aplicación, en cualquiera de los dos
casos. Deja que Google guarde la clave de firma final; la tuya pasa a ser solo
la de subida, que sí se puede reemplazar si algo pasa.

---

## 2 · El sitio web

Play pide dos direcciones públicas, y las dos páginas ya están escritas:

- **Política de privacidad** → `privacidad.html`
- **Borrar la cuenta** → `borrar-cuenta.html`

El problema es dónde alojarlas. El repositorio es privado, y GitHub Pages no
publica desde un repositorio privado sin plan pagado.

**Lo que recomiendo: Cloudflare Pages.** Se conecta al repositorio privado, lo
compila y publica el sitio, gratis y con dominio propio. El código sigue
privado; lo que queda público es solo lo compilado, que es exactamente lo que
tiene que ser público si la aplicación también va a estar en la web.

Las otras salidas: GitHub Pro por unos cuatro dólares al mes, o un segundo
repositorio público con solo la carpeta `docs/`.

`npm run web` arma el sitio en `docs/`: la aplicación completa más las tres
páginas legales.

---

## 3 · La ficha de Play

### Nombre

```
StudIA
```

### Descripción corta (máximo 80 caracteres)

```
Un tutor que te guía hasta la respuesta en vez de dártela.
```

### Descripción completa

```
StudIA es una plataforma de estudio para colegios y universidades, hecha en
Chile.

EL TUTOR NO TE DA LA RESPUESTA

Le preguntas y te devuelve una pregunta. Te muestra por dónde empezar, te
corrige el paso donde te equivocaste y te deja llegar solo al final. Está
hecho así a propósito: copiar una respuesta no es aprender, y el tutor lo
sabe.

TODO TU RAMO EN UN LUGAR

Tu horario, tus tareas con sus fechas, tus notas con la ponderación de cada
evaluación, el material que sube tu profesor y el foro del curso.

APUNTES QUE ESCRIBES O DIBUJAS

Escribe a máquina o a mano con el dedo o el lápiz. Se guardan solos, y si te
quedas sin señal se guardan igual y suben cuando vuelve.

QUICES Y FICHAS DESDE TU PROPIA MATERIA

Se arman con el material de tu ramo, no con preguntas genéricas. Las fichas
vuelven cuando toca repasarlas.

MODO ESCUCHA

En clase, tu teléfono transcribe lo que se dice para que después tengas el
resumen. El audio no se guarda ni sube a ninguna parte: se transcribe en tu
propio teléfono y se descarta.

PARA QUIEN HACE LA CLASE

Panel con el curso completo: quién no ha entregado, quién viene quedándose
atrás, qué queda por corregir. Registro de notas con ponderaciones,
planificación del mes y material del ramo.

SIN SEÑAL

Con un plan pagado, tus ramos, tareas y apuntes quedan en el teléfono para
seguir estudiando cuando no hay internet.

LO QUE NO HACE

No tiene publicidad. No vende ni cede tus datos. No los usa para entrenar
modelos. Borrar tu cuenta lo haces tú, desde la aplicación, sin pedirle
permiso a nadie.
```

### Categoría

Educación. Etiquetas: educación, estudio, tutor, colegio, universidad.

### Correo de contacto

El que aparece en los términos. **Conviene que sea uno del proyecto y no el
personal**: queda público en la ficha, a la vista de cualquiera.

---

## 4 · Seguridad de los datos

El formulario más largo, y el que hay que llenar con cuidado: lo que se declare
acá tiene que coincidir con la política de privacidad. Está sacado de lo que
guardan de verdad las tablas, no de lo que la aplicación promete.

**Todo lo que se recolecta va cifrado en tránsito, y todo se puede borrar
desde la aplicación** (Perfil → Borrar mi cuenta).

| Categoría | Tipo | ¿Se recolecta? | ¿Obligatorio? | Para qué |
|---|---|---|---|---|
| Información personal | Nombre | Sí | Sí | Funciones de la app, gestión de la cuenta |
| Información personal | Correo | Sí | Sí | Funciones de la app, gestión de la cuenta |
| Información personal | Identificadores de usuario | Sí | Sí | Funciones de la app, gestión de la cuenta |
| Información personal | Otra información | Sí | Sí | Funciones de la app — el rol, el plan y las notas |
| Mensajes | Otros mensajes en la app | Sí | Sí | Funciones de la app — la conversación con el tutor y el foro |
| Fotos y videos | Archivos y documentos | Sí | No | Funciones de la app — lo que se adjunta a una entrega |
| Actividad en la app | Interacciones | Sí | Sí | Funciones de la app — el avance en el material |
| Actividad en la app | Otro contenido del usuario | Sí | Sí | Funciones de la app — apuntes, trazos, transcripciones |
| Información y rendimiento | Registros de fallos | Sí | Sí | Diagnóstico |
| Información y rendimiento | Diagnóstico | Sí | Sí | Diagnóstico |
| Identificadores | ID del dispositivo | Sí | No | Funciones de la app — mandar avisos, solo si se encienden |

**Lo que NO se recolecta, y hay que declararlo así:**

- **Audio.** El modo escucha transcribe en el propio teléfono y descarta el
  audio a medida que lo reconoce. No sube ni queda guardado. Lo que sí se
  guarda es el texto, y va declarado arriba como contenido del usuario.
- Ubicación, contactos, salud, información financiera, historial de
  navegación, historial de búsqueda.

**¿Se comparten datos con terceros?** No, en el sentido que Play le da a
«compartir». Supabase aloja la base de datos y Anthropic procesa lo que se le
manda al tutor, pero los dos lo hacen por encargo y no para fines propios, y
eso Play lo cuenta como recolección y no como compartición. Aun así,
**confirma la definición vigente antes de enviar**: es de las cosas que Google
cambia de redacción.

---

## 5 · Clasificación de contenido

El cuestionario es de IARC y se responde solo. Lo que importa:

- Violencia, sexo, drogas, apuestas, lenguaje soez → **no** en todo.
- **¿Los usuarios pueden interactuar o intercambiar contenido? → SÍ.** Hay foro
  del curso y conversación con el tutor. Responder que no acá es motivo de
  suspensión cuando se descubre.
- ¿Comparte la ubicación del usuario? → no.
- ¿Permite comprar bienes digitales? → no por ahora.

---

## 6 · Público objetivo, y lo que arrastra

StudIA se usa en colegios, así que el público incluye menores de edad. Al
declararlo, la aplicación entra en el **programa de Familias**, que exige:

- Nada de publicidad, o solo con SDK certificados. StudIA no tiene publicidad.
- Cumplir la política de contenido para familias.
- Declarar el manejo de datos de menores, que ya está en la política de
  privacidad: el establecimiento recaba la autorización de los apoderados, no
  se hacen perfiles comerciales y los datos no se ceden.

**Y esto, que es nuevo y aplica desde julio de 2026:** una aplicación que
genera contenido con IA tiene que traer adentro una forma de reportar contenido
ofensivo. StudIA la tiene desde esta versión — la banderita al pie de cada
respuesta del tutor, del asistente, de los quices, de las fichas y del resumen.
Los reportes los lee la operación de StudIA, no el establecimiento: un
reporte trae adentro lo que el alumno estaba conversando con el tutor, y
quien puede hacer algo con él —ajustar el modelo, cambiar la instrucción—
somos nosotros.

---

## 7 · Acceso a la app

La aplicación pide cuenta para todo, así que Play exige credenciales de prueba
o el revisor la rechaza sin poder abrirla.

En **Contenido de la app → Acceso a la app**, marca que requiere credenciales
y entrega una cuenta de estudiante con datos cargados: un ramo, un par de
tareas, algo de material. Una cuenta vacía se ve como una app rota.

Conviene entregar también una de docente, con una nota en el campo de
instrucciones diciendo qué se ve con cada una.

---

## 8 · Capturas

Play pide entre 2 y 8 por tipo de aparato, de al menos 1080 px de lado mayor.

Las que muestran de qué se trata, en este orden:

1. La conversación con el tutor, con una pregunta devuelta
2. El horario de la semana
3. Un apunte escrito a mano
4. Un quiz con la explicación abierta
5. El panel del docente con el curso
6. Las notas con las ponderaciones

Se sacan de la tablet con el APK instalado. **Que no salga ningún nombre real
de estudiante** en ninguna: las capturas quedan públicas para siempre.

---

## 9 · El orden

1. Generar la clave de firma y cargar los cuatro secretos
2. Alojar el sitio y anotar las dos direcciones públicas
3. Compilar: sale el `.aab` firmado
4. Crear la aplicación en Play Console
5. Llenar la ficha con los textos de arriba
6. Seguridad de los datos, con la tabla de arriba
7. Clasificación de contenido
8. Público objetivo → Familias
9. Acceso a la app, con las cuentas de prueba
10. Subir el `.aab` a **pruebas internas** primero, no a producción
11. Instalarlo desde ahí, recorrerlo entero, y recién después promoverlo
