# StudIA — Especificación consolidada

> Documento de recopilación. Todo lo que hay acá está **extraído del prototipo interactivo**
> (`prototipo/index.html`, originalmente publicado como artifact "StudIA — Prototipo",
> última actualización 2026-07-10). No hay otras fuentes: al momento de escribir esto no
> existía código previo en el repositorio ni material en Drive.

---

## 1. Producto

**StudIA** es una app móvil de tutoría con IA para estudiantes universitarios.

| Campo | Valor |
|---|---|
| Nombre | StudIA |
| Tagline | *Aprende pensando, no copiando.* |
| Promesa | "Tu tutor nunca te da la respuesta: te guía para que la descubras." |
| Público | Estudiantes de **Ingeniería Civil Industrial** (según los ramos del prototipo) |
| Mercado | Chile (el usuario demo es `eduardo@studia.cl`) |

### El diferenciador

El tutor **se niega explícitamente a resolver el ejercicio**. Es la regla central del
producto, no una limitación técnica. Cuando el estudiante pide la respuesta, el tutor
responde con una negativa pedagógica y reconduce a una pregunta:

> "Sé que sería cómodo que te la diera, pero mi misión es que la descubras tú: así de
> verdad aprendes. Vamos por partes. ¿Qué es lo primero que sabes que debes calcular?"

Esa negativa se dispara con las expresiones: `respuesta`, `dame`, `resultado`, `solución`,
`cuánto es`, `resuélvelo`, `hazlo por mí`.

---

## 2. Stack declarado

Del pie del prototipo:

- **App**: Expo (React Native)
- **Backend / auth / datos**: Supabase
- **IA**: Claude, invocado desde **una función segura en el servidor** (nunca con la API
  key en el cliente)

En el prototipo las respuestas del tutor son guiones estáticos; la integración real está
pendiente.

---

## 3. Ramos

Seis ramos, seleccionables como chips horizontales en el chat. El primero es el activo por defecto.

| Ramo | Pregunta de apertura del tutor |
|---|---|
| Cálculo I | "Cuéntame en qué problema de cálculo estás. ¿Qué te piden encontrar y qué datos tienes?" |
| Álgebra Lineal | "¿En qué andas? Antes de operar: ¿qué esperas de la solución del sistema, única, infinitas o ninguna?" |
| Física I | "Partamos por el diagrama de cuerpo libre. ¿Qué fuerzas actúan sobre el cuerpo?" |
| Investigación de Operaciones | "Modelemos juntos. ¿Cuáles serían tus variables de decisión, en palabras?" |
| Microeconomía | "Vamos con un ejemplo concreto. ¿Qué cambia en el mercado y por qué crees que se mueve?" |
| Programación | "Descríbeme el algoritmo en palabras. ¿Cuál sería el primer paso antes de escribir código?" |

Cada apertura ya modela el método: parte por la **representación del problema**, no por el cálculo.

---

## 4. Repertorio de guía

Respuestas genéricas del tutor, rotadas en ciclo. Todas terminan en pregunta abierta:

1. "Buena intuición. ¿Qué paso crees que viene ahora, y por qué ese?"
2. "Vas bien. Antes de seguir, ¿cómo podrías verificar si eso funciona?"
3. "Interesante. ¿Qué dato del enunciado todavía no has usado?"
4. "Casi. ¿Qué pasaría si lo pruebas con un caso simple para comprobarlo?"
5. "Vas encaminado. ¿Qué regla o concepto crees que aplica aquí, con tus palabras?"

**Patrón de tono**: validación breve → reconducción a pregunta. Nunca afirma un resultado.
Trato de **tú**, español de Chile, sin tecnicismos innecesarios.

---

## 5. Pantallas

Cinco pantallas, navegación lineal por atributo `data-go`.

```
welcome ──> login ──┬──> home ──> chat
              │     │      └──> welcome (cerrar sesión)
              └── signup ─┘
```

| Pantalla | Contenido |
|---|---|
| **Welcome** | Logo (birrete), "StudIA", tagline, promesa, botón "Comenzar" |
| **Login** | "Hola de nuevo" · correo + contraseña · "Iniciar sesión" · link a crear cuenta |
| **Signup** | "Crear cuenta" · correo + contraseña (mín. 6) · link a iniciar sesión |
| **Home** | "StudIA", saludo personalizado ("Hola, Eduardo"), "Elige un ramo y conversa con tu tutor", botón a chat, cerrar sesión |
| **Chat** | Header con volver + "Tutor · {ramo}" · chips de ramos · burbujas · indicador "El tutor está pensando…" · composer con input + Enviar |

**Detalles de comportamiento del chat**
- Cambiar de ramo **reinicia la conversación** y muestra la apertura del ramo nuevo.
- Delay simulado de 700 ms con spinner antes de cada respuesta.
- Enter envía. Input vacío no hace nada.
- Auto-scroll al final en cada mensaje.

---

## 6. Sistema visual

### Paleta

| Token | Valor | Uso |
|---|---|---|
| `--brand` | `#208AEF` | Azul de marca: botones primarios, chip activo, burbuja del usuario, links |
| `--brand-ink` | `#0C447C` | Azul oscuro: eyebrow, foco |
| `--amber` | `#C9701C` | Acento (declarado, sin uso aún) |
| `--ink` | `#0E1726` | Texto de la página contenedora |
| `--muted` | `#5A6473` | Texto secundario de la página |
| `--ground` / `--ground-2` | `#EAEEF3` / `#E1E7EE` | Fondo de la página con patrón de puntos |
| `--app-bg` | `#ffffff` | Fondo de la app |
| `--app-text` | `#0b1220` | Texto de la app |
| `--app-sec` | `#60646C` | Texto secundario de la app |
| `--app-el` | `#F1F1F4` | Elementos: chips inactivos, burbuja del tutor |
| `--app-sel` | `#E1E2E7` | Bordes y separadores |
| `--on-brand` | `#ffffff` | Texto sobre azul |

### Tipografía

- **Sans** (interfaz): system stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui`
- **Serif** (títulos de la landing): `Georgia, "Iowan Old Style", "Times New Roman"`

### Forma

- Radios: botones `12px`, campos `11px`, burbujas `15px` (con la esquina del lado del emisor a `5px`), chips `999px`, logo `19px`
- Marco del dispositivo: `348px × 696px`, radio `40px`, notch de `126×26`
- Burbujas: máximo `84%` de ancho

### Accesibilidad ya presente en el prototipo

- `aria-label` en cada pantalla, campo y botón de ícono
- `role="tablist"` / `role="tab"` en los chips de ramos
- `:focus-visible` visible en todos los interactivos
- `@media (prefers-reduced-motion: reduce)` desactiva transición y spinner

---

## 7. Estado actual y qué falta

**Hecho**
- Prototipo navegable completo con las 5 pantallas, sistema visual definido y tono del tutor establecido.

**Pendiente**
- App real en Expo (React Native) — el prototipo es HTML, no código de la app.
- Supabase: auth con correo/contraseña, persistencia de conversaciones.
- Función de servidor que llame a Claude con el *system prompt* socrático (la regla de
  "no dar la respuesta" debe vivir en el servidor, no en el cliente).
- Definir qué pasa al pedir la respuesta de forma insistente, historial de sesiones,
  y si el estudiante puede subir el enunciado (foto/texto).
