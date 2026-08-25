# StudIA

> **Aprende pensando, no copiando.**
> Tus clases, tu materia y tus tareas en un solo lugar. Y un tutor que te guía para que
> descubras la respuesta.

Plataforma de estudio para universitarios de Ingeniería Civil Industrial: asignaturas,
materia, horario, tareas y clases —en vivo por audio y grabadas— con un tutor de IA que,
por diseño, **nunca resuelve el ejercicio**.

## Contenido del repositorio

| Ruta | Qué es |
|---|---|
| [`app/`](app) | La aplicación en Expo (React Native) |
| [`supabase/`](supabase) | Esquema, políticas de acceso, datos de ejemplo y la función del tutor |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Cómo levantarlo, cómo se verifica y qué está simplificado |
| [`docs/instalar-en-tablet.md`](docs/instalar-en-tablet.md) | Compilar el APK y probarlo en una tablet Android |
| [`docs/studia-spec.md`](docs/studia-spec.md) | Especificación de producto: navegación, pantallas, sistema visual y decisiones abiertas |
| [`prototipo/index.html`](prototipo/index.html) | Prototipo interactivo — sigue siendo la referencia de diseño |

## Levantarlo

```bash
supabase start && supabase db reset
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions serve tutor

cd app && cp .env.example .env && npm install && npm start
```

Cuenta de ejemplo: **eduardo@studia.cl / clave-demo**.
Los detalles y lo que falta están en [`docs/arquitectura.md`](docs/arquitectura.md).

## Verificación

```bash
npm run prueba:todo     # todo junto

npm run prueba          # 87 pruebas del dominio y de los núcleos del tutor
npm run prueba:ui       # 56 pruebas que renderizan las pantallas de verdad
npm run prueba:bd       # 35 aserciones de acceso contra un Postgres real
npm run tipos           # tsc en modo estricto
```

## Ver el prototipo (referencia de diseño)

Abre `prototipo/index.html` en el navegador, o sirve la carpeta:

```bash
python3 -m http.server 8000
# http://localhost:8000/prototipo/
```

**Recorrido sugerido**

1. *Comenzar* → *Iniciar sesión*
2. Entra a la clase **en vivo** desde el banner rojo: silencia y activa el micrófono, pide la palabra
3. Vuelve con el chevron: caes en **Cálculo I** → recorre *Materia*, *Clases*, *Tareas*, *Horario*
4. Abre una **clase grabada** y usa el reproductor y los capítulos
5. Toca los **tres puntitos (⋮)** de la asignatura: ahí están Notas, Programa, Compañeros y Archivos
6. Toca la **campana**: cada notificación te deja en el lugar exacto
7. *Ver notas* → entra a **Investigación de Operaciones**: vas con 4,2 y te dice cuánto necesitas
8. En una asignatura, entra al **Foro** y responde un hilo
9. En **Tareas**, abre una y toca *Pedir guía al tutor*
10. Escríbele **"dame la respuesta"** y observa qué hace

## Qué hay dentro

- **Inicio** — clase en vivo, bloques de hoy, próximas entregas y las seis asignaturas
- **Asignatura** — nueve secciones tras los tres puntitos: materia, clases, tareas, foro, notas, horario, programa, compañeros y archivos
- **Clase en vivo** — audio con ecualizador, participantes, micrófono, pedir la palabra
- **Clase grabada** — reproductor con velocidades y capítulos
- **Horario** — semana Lun–Vie con salas, tipos de bloque y entregas del día
- **Tareas** — pendientes, entregadas y todas, con criterios de evaluación
- **Foro** — hilos por asignatura, avisos del profesor fijados, respuestas
- **Notas** — escala 1,0–7,0, ponderación por evaluación y cuánto necesitas para aprobar
- **Notificaciones** — clase en vivo, avisos, vencimientos y notas publicadas
- **Tutor** — accesible desde cualquier pantalla, con el contexto de dónde venías

## Stack previsto

- **App**: Expo (React Native)
- **Backend**: Supabase (auth + datos)
- **IA**: Claude, invocado desde una función segura en el servidor
- **Audio en vivo**: por decidir — ver *Decisiones abiertas* en la especificación

## Estado

La app tiene sus catorce pantallas y las nueve secciones por asignatura, sobre un
backend verificado. Falta conectar el audio de las clases en vivo, subir los archivos
de las grabaciones y las entregas, las notificaciones push y el panel docente — todo
detallado en [`docs/arquitectura.md`](docs/arquitectura.md).
