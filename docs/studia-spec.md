# StudIA — Especificación consolidada

> Documento vivo. La fuente es el prototipo interactivo (`prototipo/index.html`), que
> hace las veces de definición de producto mientras no exista la app en Expo.

---

## 1. Producto

**StudIA** es la plataforma de un ramo completo para estudiantes universitarios: asignaturas,
materia, horario, tareas y clases —en vivo y grabadas— con un tutor de IA en el centro.

| Campo | Valor |
|---|---|
| Nombre | StudIA |
| Tagline | *Aprende pensando, no copiando.* |
| Promesa | "Tus clases, tu materia y tus tareas en un solo lugar. Y un tutor que te guía para que descubras la respuesta." |
| Público | Estudiantes de **Ingeniería Civil Industrial** |
| Mercado | Chile (usuario demo: `eduardo@studia.cl`) |
| Referente de UX | Canvas (Instructure) para la capa LMS |

### El diferenciador

El tutor **se niega explícitamente a resolver el ejercicio**. Es la regla central del
producto, no una limitación técnica. Cuando el estudiante pide la respuesta, responde con
una negativa pedagógica y reconduce a una pregunta:

> "Sé que sería cómodo que te la diera, pero mi misión es que la descubras tú: así de
> verdad aprendes. Vamos por partes. ¿Qué es lo primero que sabes que debes calcular?"

Disparadores de la negativa: `respuesta`, `dame`, `resultado`, `solución`, `cuánto es`,
`resuélvelo`, `hazlo por mí`.

Hay un segundo caso: cuando el estudiante se declara perdido (`no sé`, `no entiendo`,
`estoy perdido`, `ni idea`), el tutor **retrocede** en vez de avanzar:

> "Tranquilo, empecemos más atrás. Cuéntame con tus palabras qué dice el enunciado:
> ¿qué te dan y qué te piden?"

---

## 2. Stack declarado

- **App**: Expo (React Native)
- **Backend / auth / datos**: Supabase
- **IA**: Claude, invocado desde **una función segura en el servidor**
- **Audio en vivo**: pendiente de decidir (ver §9)

En el prototipo, las respuestas del tutor son guiones estáticos y el audio está simulado.

---

## 3. Modelo de datos

Estructura que usa el prototipo y que debería trasladarse al esquema de Supabase.

```
Asignatura
  id, nombre, código, profesor, color, progreso (%)
  intro          — pregunta de apertura del tutor para ese ramo
  horario[]      — { día 1-5, inicio, fin, sala, tipo? }
  vivo           — { tema, minutos desde el inicio } | null
  modulos[]      — { título, items[] }
      item       — { tipo: video|documento|ejercicios, título, detalle, completado }
  grabadas[]     — { título, fecha, duración (s) }
  tareas[]       — { id, título, vence, días restantes, puntos, estado, nota?, descripción, criterios[] }
```

**Estados de tarea**: `pendiente` · `entregada` · `atrasada`.

### Las seis asignaturas

| Asignatura | Código | Profesor | Color | Progreso |
|---|---|---|---|---|
| Cálculo I | MAT1610 | Ana Ríos | `#208AEF` | 62 % |
| Álgebra Lineal | MAT1203 | Diego Fuentes | `#7A4FD6` | 48 % |
| Física I | FIS1503 | Carla Núñez | `#C9701C` | 55 % |
| Investigación de Operaciones | ICS2123 | Rodrigo Salas | `#1E8E5A` | 35 % |
| Microeconomía | EAE1110 | Paula Vergara | `#D93B6B` | 71 % |
| Programación | IIC1103 | Matías Leiva | `#0C447C` | 80 % |

Cada asignatura tiene su color y lo usa en todas partes: franja de la tarjeta, cabecera del
curso, barra vertical en el horario, punto junto a la tarea, íconos de la materia. Es la
convención de Canvas y es lo que permite reconocer el ramo de un vistazo.

### Preguntas de apertura del tutor

| Asignatura | Apertura |
|---|---|
| Cálculo I | "Cuéntame en qué problema de cálculo estás. ¿Qué te piden encontrar y qué datos tienes?" |
| Álgebra Lineal | "¿En qué andas? Antes de operar: ¿qué esperas de la solución del sistema, única, infinitas o ninguna?" |
| Física I | "Partamos por el diagrama de cuerpo libre. ¿Qué fuerzas actúan sobre el cuerpo?" |
| Investigación de Operaciones | "Modelemos juntos. ¿Cuáles serían tus variables de decisión, en palabras?" |
| Microeconomía | "Vamos con un ejemplo concreto. ¿Qué cambia en el mercado y por qué crees que se mueve?" |
| Programación | "Descríbeme el algoritmo en palabras. ¿Cuál sería el primer paso antes de escribir código?" |

Todas parten por **representar el problema**, nunca por calcular.

### Repertorio de guía

Respuestas genéricas, rotadas en ciclo, todas terminadas en pregunta abierta:

1. "Buena intuición. ¿Qué paso crees que viene ahora, y por qué ese?"
2. "Vas bien. Antes de seguir, ¿cómo podrías verificar si eso funciona?"
3. "Interesante. ¿Qué dato del enunciado todavía no has usado?"
4. "Casi. ¿Qué pasaría si lo pruebas con un caso simple para comprobarlo?"
5. "Vas encaminado. ¿Qué regla o concepto crees que aplica aquí, con tus palabras?"

**Patrón de tono**: validación breve → reconducción a pregunta. Nunca afirma un resultado.
Trato de **tú**, español de Chile.

---

## 4. Navegación

Cuatro pestañas fijas abajo (patrón de la app de Canvas) más pantallas apiladas encima.

```
Bienvenida → Login / Registro → [ Inicio · Horario · Tareas · Tutor ]
                                     │
     ┌───────────────────────────────┼──────────────────────┐
     ↓                               ↓                      ↓
  Asignatura                    Detalle de tarea        Clase en vivo
  (Materia · Clases ·                │                      │
   Tareas · Horario)                 └──> Tutor <───────────┘
     │
     └──> Clase grabada ──> Tutor
```

El **Tutor es alcanzable desde todo**: desde la pestaña, desde la cabecera de la asignatura,
desde un ítem de materia, desde una grabación y desde una tarea. Cuando se entra desde un
contexto, el chat abre con ese ramo preseleccionado y muestra una línea de contexto
(*"Estoy con «Guía 4 · Optimización»"*). Entrar por la pestaña lo abre limpio, sin contexto.

---

## 5. Pantallas

### Inicio (tablero)

Saludo y fecha · banner **EN VIVO AHORA** si hay clase en curso · bloques de **hoy** ·
**próximas entregas** (las 3 más urgentes) · tarjetas de las seis asignaturas con franja de
color, código, profesor, barra de progreso y conteo de pendientes.

### Asignatura

Cabecera del color del ramo con código, nombre, profesor, progreso y acceso al tutor.
Cuatro secciones:

- **Materia** — módulos plegables al estilo Canvas. El primero abre por defecto. Cada módulo
  muestra `completados/total` y sus ítems: video, documento o ejercicios, con visto cuando
  está hecho. Tocar un ítem abre el tutor con ese ítem como contexto.
- **Clases** — banner de la clase en vivo si la hay, y la lista de grabaciones con fecha y duración.
- **Tareas** — las tareas del ramo, la más urgente arriba.
- **Horario** — los bloques semanales del ramo con día, hora, sala y tipo (cátedra, ayudantía, laboratorio).

### Clase en vivo (audio)

Pantalla oscura, a pantalla completa, deliberadamente distinta del resto: estás *en* algo.

- Insignia **EN VIVO** con punto pulsante · ramo y código · tema de la clase · cronómetro que corre
- **Ecualizador animado** que indica quién habla; se apaga cuando no hay voz
- Fila de participantes con iniciales; el profesor va destacado en azul y con anillo
- Tres controles: **micrófono** (silenciado por defecto), **pedir la palabra** (avisa que el
  profesor dará el turno) y **salir** (rojo)
- El chevron de arriba sale a la asignatura sin colgar

### Clase grabada

Reproductor de audio: ramo, título, fecha, duración y profesor · barra de avance
manipulable (clic y flechas del teclado) · −15 s / reproducir / +15 s · velocidades
1× 1.25× 1.5× 2× · **capítulos** con marca de tiempo que saltan a su posición ·
botón "Preguntar al tutor sobre esta clase".

### Horario

Selector de día Lun–Vie con número. Cada bloque muestra hora de inicio y término, barra
vertical del color del ramo, nombre, tipo, sala y profesor. Si el bloque está en vivo lleva
la insignia y entra directo a la clase. Debajo, las **entregas que vencen ese día**.

### Tareas

Filtros **Pendientes · Entregadas · Todas**. Orden: pendientes primero —la más urgente
arriba, las atrasadas antes que todo— y las entregadas al final, la más reciente primero.
Cada fila lleva el punto de color del ramo, el vencimiento, la insignia de estado y el
tiempo restante en lenguaje natural ("Mañana", "En 3 días", "Venció").

### Detalle de tarea

Título, ramo, entrega, puntos y estado · enunciado con sus criterios de evaluación ·
calificación si ya fue evaluada · **Entregar tarea** · **Pedir guía al tutor**, con el
recordatorio de que el tutor no la resuelve.

### Tutor

Chips de las seis asignaturas · línea de contexto cuando se entra desde algún lugar ·
burbujas · indicador "El tutor está pensando…" · composer. Cambiar de ramo reinicia la
conversación con la apertura del ramo nuevo.

---

## 6. Sistema visual

### Paleta

| Token | Valor | Uso |
|---|---|---|
| `--brand` | `#208AEF` | Azul de marca: primarios, chip activo, burbuja del usuario, pestaña activa |
| `--brand-ink` | `#0C447C` | Azul oscuro: eyebrow, foco |
| `--amber` | `#C9701C` | Tareas pendientes |
| `--live` | `#D93B3B` | En vivo, atrasado, colgar |
| `--ok` | `#1E8E5A` | Entregado |
| `--ink` / `--muted` | `#0E1726` / `#5A6473` | Texto de la página contenedora |
| `--ground` / `--ground-2` | `#EAEEF3` / `#E1E7EE` | Fondo con patrón de puntos |
| `--app-bg` / `--app-text` / `--app-sec` | `#ffffff` / `#0b1220` / `#60646C` | Superficie y texto de la app |
| `--app-el` / `--app-sel` | `#F1F1F4` / `#E1E2E7` | Elementos y bordes |
| `--on-brand` | `#ffffff` | Texto sobre azul |

La clase en vivo invierte todo: fondo `#0E1726` y texto blanco.

### Tipografía y forma

- **Sans** (interfaz): system stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui`
- **Serif** (títulos de la landing): `Georgia, "Iowan Old Style", "Times New Roman"`
- Radios: botones `12px`, campos `11px`, tarjetas `14px`, burbujas `15px` (esquina del emisor a `5px`), chips y píldoras `999px`
- Marco del dispositivo: `348 × 696`, radio `40px`, notch `126 × 26`

### Accesibilidad

- `aria-label` en cada pantalla, campo y botón de ícono
- `role="tablist"` / `role="tab"` con `aria-selected` en chips, segmentos y días
- `aria-expanded` en los módulos plegables; `aria-pressed` en micrófono y pedir palabra
- `aria-current="page"` en la pestaña activa
- La barra de avance de la grabación es un `slider` operable con flechas
- `:focus-visible` visible en todos los interactivos
- `prefers-reduced-motion` desactiva transición, spinner, ecualizador y pulso del punto en vivo

---

## 7. Reglas de producto

1. **El tutor nunca entrega la respuesta.** Esta regla debe vivir en el prompt de la función
   de servidor. Si está en el bundle de la app, se lee y se evade — y con eso se cae el
   único diferenciador del producto.
2. **El micrófono entra silenciado.** Nadie se une a una clase transmitiendo sin querer.
3. **El color es del ramo**, no de la pantalla. Se mantiene en todas las vistas.
4. **Las tareas atrasadas van primero**, no escondidas al final de la lista.
5. **Salir de una clase en vivo es explícito.** El chevron minimiza; solo el botón rojo cuelga.

---

## 8. Estado

**Hecho** — prototipo navegable completo: 11 pantallas, seis asignaturas con datos
realistas, clases en vivo y grabadas, horario, tareas y tutor, con el sistema visual y el
tono definidos.

**Pendiente**
- App real en Expo. El prototipo es HTML: define el producto, no lo implementa.
- Supabase: auth, esquema del §3, y las políticas de acceso por estudiante.
- Función de servidor que llame a Claude con el *system prompt* socrático.
- Audio en vivo de verdad (ver §9).
- Entrega de tareas con archivos adjuntos.
- Notificaciones: clase por empezar, tarea por vencer, nota publicada.

## 9. Decisiones abiertas

- **Transporte de audio en vivo**: LiveKit, Daily, Agora o WebRTC propio. Define costo por
  minuto, límite de participantes y qué tan factible es grabar automáticamente.
- **De dónde salen las grabaciones**: ¿se graba la clase en vivo automáticamente, o el
  profesor sube el archivo? Lo primero conecta las dos pantallas y es lo que sugiere el diseño.
- **Transcripción**: si se transcribe el audio, el tutor podría responder sobre lo que se
  dijo en clase, y los capítulos dejarían de ser fijos. Es la función que une el LMS con la IA.
- **Quién carga la materia**: ¿el profesor, la institución vía integración, o el propio estudiante?
- **Insistencia**: qué hace el tutor cuando el estudiante pide la respuesta cinco veces seguidas.
- **Modo offline**: si las grabaciones se descargan para escuchar sin conexión.
