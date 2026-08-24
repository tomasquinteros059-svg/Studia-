# StudIA

> **Aprende pensando, no copiando.**
> Un tutor con IA que nunca te da la respuesta: te guía para que la descubras.

App móvil de tutoría socrática para estudiantes de Ingeniería Civil Industrial.
El tutor se niega, por diseño, a resolver el ejercicio — su trabajo es hacer las
preguntas que llevan al estudiante a resolverlo.

## Contenido del repositorio

| Ruta | Qué es |
|---|---|
| [`docs/studia-spec.md`](docs/studia-spec.md) | Especificación consolidada: producto, ramos, tono del tutor, pantallas y sistema visual |
| [`prototipo/index.html`](prototipo/index.html) | Prototipo interactivo navegable (HTML standalone, sin dependencias) |

## Ver el prototipo

Abre `prototipo/index.html` en el navegador, o sirve la carpeta:

```bash
python3 -m http.server 8000
# http://localhost:8000/prototipo/
```

Recorrido sugerido: **Comenzar → Iniciar sesión → Conversar con un tutor**.
Elige un ramo y prueba a escribir *"dame la respuesta"* para ver cómo reacciona el tutor.

## Stack previsto

- **App**: Expo (React Native)
- **Backend**: Supabase (auth + datos)
- **IA**: Claude, invocado desde una función segura en el servidor

## Estado

Prototipo de producto listo. La app real todavía no está implementada — ver la sección
*Estado actual y qué falta* de la especificación.
