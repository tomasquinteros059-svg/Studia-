# Instalar StudIA en tu tablet Android

El APK no se puede compilar desde el entorno donde trabajo: el proxy bloquea
`dl.google.com` (el SDK de Android) y `expo.dev` (el servicio de compilación).
Pero queda todo configurado para que salga con un comando desde tu máquina.

## Lo que necesitas

- Node 22 o superior
- Una cuenta gratuita en [expo.dev](https://expo.dev)
- Un proyecto de Supabase con las migraciones aplicadas

No necesitas instalar Android Studio ni el SDK: la compilación ocurre en la
nube de Expo y te devuelve un enlace de descarga.

## Pasos

```bash
# 1 · Clonar y entrar
git clone https://github.com/tomasquinteros059-svg/Sitio.ste
cd Sitio.ste/app
npm install

# 2 · Entrar a Expo
npx eas-cli login
npx eas-cli init          # crea el proyecto y escribe su id en app.json

# 3 · Apuntar a tu Supabase
#    Reemplaza los dos valores vacíos de "preview" en eas.json,
#    o pásalos como secretos:
npx eas-cli secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
npx eas-cli secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJhbGciOi...

# 4 · Compilar el APK
npx eas-cli build --platform android --profile preview
```

Al terminar imprime un enlace. Ábrelo **desde la tablet**, descarga el `.apk` y
tócalo para instalarlo. Android va a pedirte permitir la instalación desde esa
fuente: es normal para una app que no viene de Play Store.

El perfil `preview` genera **APK** a propósito. El perfil `production` genera un
`.aab`, que sirve para publicar en Play Store pero **no se puede instalar
directamente** en un aparato.

## Probar el modo tablet

1. Entra con `eduardo@studia.cl` / `clave-demo`
2. Abre una asignatura → menú **⋮** → **Apuntes** → *Nuevo apunte*
3. **Gira la tablet a horizontal**: aparecen las dos columnas, apuntes a la
   izquierda y el tutor a la derecha
4. Escribe unas líneas y toca **Terminar clase y resumir**

En vertical, o en un teléfono, la misma pantalla muestra solo los apuntes con
un botón flotante hacia el tutor.

## Si prefieres no compilar todavía

```bash
cd app && npx expo start
```

Instala **Expo Go** en la tablet y escanea el código. Funciona todo salvo el
audio de las clases, que necesita código nativo y por eso requiere el APK.
