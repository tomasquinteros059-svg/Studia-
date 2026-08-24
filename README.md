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
| [`prototipo/index.html`](prototipo/index.html) | Prototipo interactivo navegable — 14 pantallas, sin dependencias |
| [`prototipo/build-artifact.sh`](prototipo/build-artifact.sh) | Genera la versión publicable como Artifact a partir del prototipo |
| [`docs/studia-spec.md`](docs/studia-spec.md) | Especificación: producto, modelo de datos, navegación, pantallas, sistema visual y decisiones abiertas |

## Ver el prototipo

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

Prototipo de producto completo. La app real todavía no está implementada: el prototipo
define el producto, no lo construye.
