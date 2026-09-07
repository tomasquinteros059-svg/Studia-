# StudIA — ficha técnica de la obra

Generado por `npm run expediente` el 2026-09-07.
No se edita a mano: se vuelve a generar y los números siguen siendo ciertos.

---

## 1 · Identificación de la obra

| | |
|---|---|
| **Título** | StudIA |
| **Tipo de obra** | Programa computacional (software), inédito |
| **Versión** | 1.4.0 |
| **Fecha de inicio** | 2026-08-24 |
| **Última modificación** | 2026-09-04 |
| **Idioma** | Español (código, comentarios e interfaz) |
| **País de creación** | Chile |
| **Huella SHA-256 de la obra** | `092ebd74b04a20c71722a686b37a03a1d2ec9ab1981a250bcdf831f5aca3251a` |

La huella identifica **esta** versión y ninguna otra. Se recalcula corriendo
`npm run expediente`: si da el mismo número, la copia es la misma.

## 2 · Titular

| | |
|---|---|
| **Nombre** | Tomás Quinteros |
| **RUT** | ____________________ |
| **Nacionalidad** | ____________________ |
| **Domicilio** | ____________________ |
| **Correo** | equinterosm33@gmail.com |

## 3 · Qué hace

StudIA es una plataforma de estudio para instituciones educativas y para
personas. Reúne en una sola aplicación el horario, el material, las tareas y
las notas de cada ramo; un tutor conversacional que responde con el contexto
del curso; generación de quices y fichas de repaso a partir del material;
apuntes escritos a mano o a máquina; lectura en voz alta; y un panel para el
docente y otro para la administración de cada institución.

Funciona en Android y en navegador, con la misma base de código.

## 4 · De qué está hecha

| | |
|---|---|
| **Archivos** | 348 |
| **Líneas** | 60.950 |
| **Páginas del listado** | 1.146 (a 55 líneas por página) |
| **Peso del código fuente** | 2.5 MB |
| **Lenguajes** | TypeScript, TSX, SQL, JavaScript |
| **Plataformas** | Android (React Native / Expo), navegador |
| **Base de datos** | PostgreSQL (Supabase) |

Composición, por carpeta:

| Carpeta | Archivos | Líneas |
|---|---:|---:|
| `app/src` | 206 | 35.376 |
| `supabase/(otros)` | 3 | 4.492 |
| `supabase/migrations` | 34 | 3.660 |
| `supabase/funciones-de-una-vez` | 8 | 2.846 |
| `supabase/functions` | 22 | 2.840 |
| `herramientas/` | 18 | 2.831 |
| `supabase/pruebas` | 11 | 2.584 |
| `prototipo/` | 2 | 2.099 |
| `documentacion/` | 5 | 1.894 |
| `app/(otros)` | 9 | 529 |
| `(raíz)` | 5 | 406 |
| `app/modules` | 5 | 405 |
| `.github/` | 1 | 350 |
| `app/pruebas` | 2 | 230 |
| `datos/` | 10 | 206 |
| `legal/` | 2 | 202 |

No entran en el listado la aplicación ya compilada (`docs/`), los archivos
que genera el instalador de paquetes, ni la carpeta que genera Expo al armar
el proyecto de Android: son resultado de la obra, no la obra.

## 5 · Lo que hay dentro y no es propio

26 bibliotecas de terceros usadas directamente, 775 contando todo el árbol.

| Licencia | Paquetes |
|---|---:|
| MIT | 664 |
| ISC | 37 |
| BSD-3-Clause | 22 |
| BSD-2-Clause | 18 |
| Apache-2.0 | 14 |
| BlueOak-1.0.0 | 6 |
| MPL-2.0 | 3 |
| Unlicense | 2 |
| 0BSD | 2 |
| (MIT OR CC0-1.0) | 2 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| (MIT OR Apache-2.0) | 1 |
| CC0-1.0 | 1 |
| (BSD-3-Clause OR GPL-2.0) | 1 |

Todas son licencias permisivas: dejan usar, modificar y **vender** el software
que las incorpora, y a cambio piden que su aviso de copyright viaje adentro.
La aplicación lo cumple: trae la pantalla *Perfil → Licencias de terceros*, que
se genera sola desde los paquetes instalados.

Las que un abogado querría mirar con calma, y por qué no bloquean:

- `lightningcss-linux-x64-gnu@1.33.0 → MPL-2.0`
- `lightningcss-linux-x64-musl@1.33.0 → MPL-2.0`
- `lightningcss@1.33.0 → MPL-2.0`
- `node-forge@1.4.0 → (BSD-3-Clause OR GPL-2.0)`

`lightningcss` entra por `@expo/metro-config` y `node-forge` por
`@expo/cli`: las dos son herramientas de compilación y de línea de comandos,
**no viajan dentro de la aplicación**. Además, MPL-2.0 es copyleft por archivo
—alcanza a los archivos de esa biblioteca, no al programa que la usa— y
`node-forge` es de licencia doble: se toma BSD-3-Clause y la GPL no aplica.
No hay ninguna licencia contagiosa en lo que se distribuye.

## 6 · Autoría

| Quién | Commits |
|---|---:|
| Claude | 92 |
| Tomás Quinteros | 18 |

**Declaración, para que no la descubra una auditoría:** la mayor parte del
código fue escrita por Claude, el asistente de programación de Anthropic,
trabajando bajo la dirección de Tomás Quinteros —quien definió el producto,
decidió la arquitectura, revisó y aceptó cada cambio—. Los términos de
Anthropic ceden al usuario los derechos sobre lo que la herramienta produce.

Lo que conviene conversar con quien lleve el trámite: la ley chilena
(Ley 17.336) define al autor como persona natural, y **si una obra generada
con asistencia de IA tiene protección de derecho de autor, y quién figura como
autor, es una pregunta que todavía no tiene respuesta pacífica**. Esto no
impide inscribir ni comercializar, pero es un hecho material y es mejor que
salga aquí y no después.

## 7 · Lo que NO es parte de la obra, y no se entrega

- Las claves de acceso al proyecto de Supabase y a la API de Anthropic.
- La clave de firma de Google Play, que todavía no existe.
- Los datos de personas. La base se entrega vacía: no hay ningún alumno.
- El nombre «StudIA» no está inscrito en INAPI. **Es un trámite aparte del
  derecho de autor y sigue pendiente.**

## 8 · Qué contiene este expediente

| Archivo | Qué es |
|---|---|
| `ficha-tecnica.md` | esta hoja |
| `codigo-fuente.txt` | el listado completo, 1.146 páginas |
| `extracto.txt` | primeras y últimas 25 páginas, para depósito en papel |
| `inventario.csv` | cada archivo con su tamaño y su huella |
| `huellas.txt` | solo las huellas, para verificar la copia |
| `terceros.csv` | las 26 bibliotecas usadas directamente |
| `terceros-arbol.csv` | las 775 del árbol completo |
| `historial.txt` | cuándo se escribió cada cosa |
| `resumen.json` | todo lo anterior en números, para procesar |
