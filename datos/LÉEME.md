# Carga de datos del colegio

Esta carpeta es por donde entra todo a StudIA. Se llena con planillas —las
mismas que el colegio ya tiene en Excel— y un comando las revisa y las
convierte en SQL listo para aplicar.

```
npm run importar
```

Si algo está mal **no escribe nada** y enumera todos los problemas de una vez,
con archivo y línea. No hay que corregir de a uno.

---

## Quién carga qué

La división no es burocrática: sigue quién es dueño de cada dato.

| Lo carga | Qué | Por qué |
|---|---|---|
| **El colegio** | Ramos, horario, quién dicta, quién está inscrito | Son hechos que tienen que ser iguales para todos. Si cada profesor pudiera mover una sala, dos cursos terminarían citados en el mismo lugar. |
| **El profesor** | Módulos, material, lecturas, tareas, evaluaciones, notas | Es el contenido de *su* ramo, y cambia durante el semestre. |
| **El alumno** | Sus entregas, sus apuntes, sus preguntas | Nadie más escribe por él. |

El profesor **también** puede cargar material por esta carpeta si prefiere
trabajar en planilla — la fila `materia.csv` es exactamente eso. Lo que no
puede es tocar el horario ni la lista del curso.

---

## Los archivos

Todos son CSV con cabecera. Se pueden abrir y guardar desde Excel, Numbers o
Google Sheets sin ningún cuidado especial: las comas dentro de una celda, los
acentos y los saltos de línea de Windows están contemplados.

### `personas.csv`
```
correo,nombre,rol
ana.rios@colegio.cl,Ana Ríos,profesor
eduardo.q@colegio.cl,Eduardo Q.,estudiante
```
`rol` es `estudiante`, `profesor` o `administrador`. La contraseña no va acá:
cada persona la define desde el correo de invitación.

### `asignaturas.csv`
```
codigo,nombre,profesor,ayudante,color,creditos,descripcion,requisitos,bibliografia,intro_tutor
```
- `color` en formato `#RRGGBB`. Es el que identifica al ramo en toda la app.
- `bibliografia`: varios libros en una celda, **separados por barra** `|`.
- `intro_tutor`: la pregunta con que el tutor abre la conversación en ese
  ramo. Si se deja vacía se arma una por defecto, pero vale la pena
  escribirla: es lo primero que el alumno lee.

### `horario.csv`
```
codigo,dia,hora_inicio,hora_fin,sala,tipo
MAT1610,Lunes,08:30,10:00,A-201,Cátedra
```
El día se puede escribir con nombre o con número (1 = lunes). Las horas van
como `08:30`.

**El importador avisa los choques**: dos ramos en la misma sala a la misma
hora, o un profesor citado en dos partes a la vez. Es el error que más caro
sale, porque si no se descubre el primer día de clases.

### `dictados.csv`
```
correo,codigo,papel
ana.rios@colegio.cl,MAT1610,profesor
ignacio.soto@colegio.cl,MAT1610,ayudante
```
`papel` es `profesor` o `ayudante`. **El ayudante corrige entregas, carga
material y responde el foro; publicar notas es del profesor.**

### `inscripciones.csv`
```
correo,codigo
eduardo.q@colegio.cl,MAT1610
```

### `materia.csv` y `lecturas/`
```
codigo,modulo,orden_modulo,tipo,titulo,detalle,orden,lectura,url
MAT1610,1 · Límites,1,documento,Apunte: límites laterales,Lectura · 4 min,2,limites-laterales.txt,
MAT1610,1 · Límites,1,video,Idea intuitiva de límite,Video · 14 min,1,,https://…
```
- `tipo`: `video`, `documento` o `ejercicios`.
- `modulo` es el título de la unidad; las filas con el mismo título quedan
  agrupadas. `orden_modulo` decide en qué posición va la unidad, `orden` en
  qué posición va el material dentro de ella.
- `lectura` apunta a un archivo de texto en **`lecturas/`**. Ese texto es el
  que el alumno puede **leer y escuchar** dentro de la app, con el lector
  inmersivo.
- `url` es para lo que vive afuera (un video, un PDF).

Un `documento` sin `lectura` ni `url` se rechaza: aparecería en la lista del
alumno sin llevar a ninguna parte.

**Sobre las lecturas**: son archivos de texto plano, un párrafo por bloque
separado por una línea en blanco. Se leen en voz alta, así que conviene
escribirlas para ser escuchadas: frases completas, y las fórmulas dichas con
palabras donde se pueda. La app ya traduce los signos —`f(x)` se lee "f de x",
un paréntesis se vuelve una pausa— pero un texto pensado para el oído se
entiende mejor que uno lleno de notación.

---

## Aplicar el resultado

`npm run importar` deja `datos/importado.sql`. Se revisa y se aplica:

```
psql "$DATABASE_URL" -f datos/importado.sql
```

o pegándolo en el editor SQL de Supabase.

Es **idempotente**: corregir una planilla y volver a importar actualiza lo que
cambió sin duplicar nada y sin tocar lo que los alumnos ya escribieron. El
horario es lo único que se rehace entero, para que un bloque borrado de la
planilla desaparezca de verdad.
