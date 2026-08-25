# Instalar StudIA en tu tablet Android

El APK no se puede compilar desde el entorno donde trabajo: el proxy bloquea
`dl.google.com` (el SDK de Android) y `expo.dev` (el servicio de compilación).
Pero queda todo configurado para que salga con un comando desde tu máquina.

## Lo que necesitas

- Node 22 o superior
- Una cuenta gratuita en [expo.dev](https://expo.dev)

**No necesitas Supabase para probarla.** Sin credenciales configuradas, la app
arranca en **modo demostración**: datos de ejemplo en el propio teléfono, con
las seis asignaturas, una clase en vivo, tareas, foro, notas y el tutor
respondiendo con guiones. Se recorre entera. Lleva una cinta arriba que lo dice,
para que nadie confunda los datos de ejemplo con los de verdad.

Tampoco necesitas Android Studio ni el SDK: la compilación ocurre en la nube de
Expo y te devuelve un enlace de descarga.

## Pasos

```bash
# 1 · Clonar y entrar
git clone https://github.com/tomasquinteros059-svg/Sitio.ste
cd Sitio.ste/app
npm install

# 2 · Entrar a Expo
npx eas-cli login
npx eas-cli init          # crea el proyecto y escribe su id en app.json

# 3 · Compilar el APK
npx eas-cli build --platform android --profile preview
```

Eso ya da un APK en modo demostración. **Cuando tengas Supabase**, agrega las
credenciales como secretos y vuelve a compilar; la app las detecta sola y deja
de estar en demo:

```bash
npx eas-cli secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
npx eas-cli secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJhbGciOi...
npx eas-cli build --platform android --profile preview
```

Al terminar imprime un enlace. Ábrelo **desde la tablet**, descarga el `.apk` y
tócalo para instalarlo. Android va a pedirte permitir la instalación desde esa
fuente: es normal para una app que no viene de Play Store.

El perfil `preview` genera **APK** a propósito. El perfil `production` genera un
`.aab`, que sirve para publicar en Play Store pero **no se puede instalar
directamente** en un aparato.

## Probar el modo tablet

1. En demostración entras directo, sin contraseña. Con Supabase configurado,
   entra con `eduardo@studia.cl` / `clave-demo`
2. Ve a la pestaña **Apuntes**: es el tablero, con las tarjetas repartidas en
   varias columnas. Toca **Nuevo apunte** y elige un ramo
3. **Gira la tablet a horizontal**: aparecen las dos columnas, apuntes a la
   izquierda y el tutor a la derecha
4. Escribe unas líneas y toca **Terminar clase y resumir**
5. Vuelve al tablero y prueba **fijar** una tarjeta y **buscar** por una palabra

En vertical, o en un teléfono, la misma pantalla muestra solo los apuntes con
un botón flotante hacia el tutor.

## Qué se puede y qué no en demostración

Se recorre toda la app con datos de ejemplo. **Lo que no hace** es hablar con
Claude: el tutor responde con guiones —los mismos del prototipo, fieles a la
regla de no dar la respuesta— y el resumen de clase se arma con tus propias
líneas. Eso necesita el servidor.

Un ramo aparece bajo 4,0 a propósito, para que se vea la proyección de "qué
necesitas para aprobar".

## Si prefieres no compilar todavía

```bash
cd app && npx expo start
```

Instala **Expo Go** en la tablet y escanea el código. Funciona todo salvo el
audio de las clases, que necesita código nativo y por eso requiere el APK.
