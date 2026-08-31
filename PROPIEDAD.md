# La propiedad de StudIA

Qué está protegido, con qué, y qué falta hacer. Este archivo no es un
documento legal: es el mapa para saber dónde está cada cosa y qué queda
pendiente. El documento que manda es [`LICENCIA.md`](LICENCIA.md).

**Titular: Tomás Quinteros.** Persona natural. Todo lo de acá está a su nombre
mientras no exista una sociedad a la que cederle los derechos.

## Las cuatro cosas que hay que proteger, y cómo

| Qué | Con qué se protege | Cómo está hoy |
|---|---|---|
| **El código y el diseño** | Derecho de autor (Ley 17.336) | Protegido desde que se escribió. Sin registro. |
| **El nombre StudIA** | Marca comercial (Ley 19.039) | **Sin registrar.** Es el hueco más grande. |
| **Los datos de los usuarios** | Ley 19.628, y Ley 21.719 desde el 1-dic-2026 | Política escrita; falta el resto. |
| **Lo que no se publica** | Secreto empresarial | Depende de que el repositorio esté privado. |

### El derecho de autor no se pide: nace

El código, el diseño de las pantallas, los textos y las instrucciones del tutor
están protegidos desde el momento en que se escribieron. No hace falta registrar
nada y la falta de registro no debilita el derecho.

Lo que el registro da es **prueba de fecha**. Si mañana alguien afirma que lo
escribió antes, hay que demostrar quién fue primero. Hoy esa prueba existe y es
buena: el historial de git, con fecha y autor en cada commit desde el primero.
No es tan fuerte como un registro, pero no es poco.

**Registrarlo** se hace en el Departamento de Derechos Intelectuales (DDI) del
Servicio Nacional del Patrimonio Cultural. Es barato, se hace en línea, y se
entrega el código fuente en un soporte. Conviene cuando haya una versión estable
o antes de mostrarlo a un tercero que podría copiarlo.

### La marca es lo urgente

«StudIA» no está registrada. Mientras no lo esté:

- cualquiera puede inscribirla antes y, si lo hace, **el que tendría que dejar
  de usarla eres tú**, no él;
- no se puede impedir que otra aplicación de estudio se llame parecido;
- Play Store no exige la marca, pero una disputa de nombre puede bajar la app.

Se registra en INAPI (inapi.cl), en línea. Hay que elegir las clases de Niza:
para esto van la **9** (programas computacionales), la **41** (servicios de
educación y formación) y, si se va a vender como servicio, la **42** (software
como servicio). Antes de pagar conviene buscar en el registro de INAPI si hay
marcas parecidas en esas clases, porque una oposición cuesta más que el trámite.

Vale la pena hacerlo **antes** de publicar en Play Store, no después: publicar
es lo que hace visible el nombre.

### Los datos de los usuarios

StudIA trata datos de estudiantes, muchos menores de edad, y transcribe clases.
La [política de privacidad](legal/privacidad.md) ya dice qué se guarda, para
qué, con quién se comparte y por cuánto tiempo.

Lo que falta:

- Un **contrato de encargo de tratamiento** con cada colegio que la use. El
  colegio es el responsable de los datos de sus alumnos; StudIA los trata por
  encargo suyo, y eso se firma.
- El **consentimiento de los apoderados**, que lo recoge el establecimiento.
- Un **procedimiento escrito** para responder a quien pida ver o borrar sus
  datos, con plazos.
- Revisar todo esto **antes del 1 de diciembre de 2026**, cuando entra en
  vigencia la Ley 21.719 y aparece una autoridad con facultad de multar.

### El secreto

Lo que no está publicado no lo puede copiar nadie. Por eso importa que el
repositorio esté privado: el código, el esquema de la base de datos y la
especificación del producto son el activo, y estuvieron públicos.

Dentro del repositorio, `documentacion/` guarda la especificación y la
arquitectura. Estuvieron en `docs/`, que es la carpeta que GitHub Pages publica
entera: cualquiera que adivinara el nombre del archivo se llevaba el diseño
completo del producto. Ahora `docs/` tiene solo el sitio.

## Lo que ya está hecho en el código

- `LICENCIA.md` y `LICENSE` — licencia propietaria, todos los derechos reservados.
- `legal/terminos.md` y `legal/privacidad.md` — generados desde
  `app/src/dominio/legales.ts`, que es la única fuente. `npm run legales` los
  reescribe y `npm run prueba:legales` avisa si quedaron atrás.
- Pantalla **Legal** dentro de la app, con los tres documentos, alcanzable desde
  el perfil del alumno y del profesor, y desde la portada antes de entrar.
- Aviso de aceptación junto al botón de entrar, con los enlaces al texto
  completo: el consentimiento se pide donde se entra, no escondido en un ajuste.
- Aviso de copyright en el perfil, en el pie de la portada y en el `<head>` del
  sitio.
- `app/src/dominio/terceros.ts` — las 24 bibliotecas con su licencia y su aviso
  de copyright, generado con `npm run licencias`. Viaja dentro del APK porque
  MIT y BSD lo exigen.
- `docs/robots.txt` — le niega el sitio a los rastreadores que arman conjuntos
  de entrenamiento. Lo respetan solo si quieren, pero deja la negativa escrita.
- `terminos.html` y `privacidad.html` en el sitio: Play Store exige una
  dirección web pública para la política de privacidad.

## Lo que falta y no se puede hacer desde el código

| Qué | Dónde | Cuándo |
|---|---|---|
| Poner el repositorio en privado | GitHub → Settings → General → Danger Zone | Ahora |
| Registrar la marca StudIA | inapi.cl, clases 9, 41 y 42 | Antes de publicar |
| Registrar el software | DDI, Servicio Nacional del Patrimonio Cultural | Cuando haya versión estable |
| Un correo de contacto del proyecto | En vez del correo personal en los textos legales | Antes de publicar |
| Contrato de encargo con cada colegio | Con abogado | Antes del primer colegio |
| Revisión legal de los dos textos | Con abogado | Antes de cobrar |
| Llave de firma propia para el APK | Hoy se firma con la llave de depuración de Expo | Antes de Play Store |

Sobre lo último: hoy los APK se firman con la llave de depuración que trae la
plantilla de Expo. Sirve para probar y **no sirve para publicar**, porque es una
llave pública que cualquiera tiene: alguien podría firmar un APK falso que el
teléfono aceptaría como actualización del tuyo. Play Store necesita una llave
propia, guardada donde no se pierda —si se pierde, no se puede volver a
actualizar la aplicación nunca más—.

---

Última revisión: 31 de agosto de 2026.
