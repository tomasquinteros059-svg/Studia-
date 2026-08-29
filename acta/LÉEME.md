# Acta, aparte

Acta es la aplicación de reuniones. Vive en el commit `7b2f048` de este
mismo repositorio, justo antes de "Volver a StudIA": son la misma
aplicación en dos momentos de su historia, no dos proyectos.

Acá no está su código, sino lo que se le agrega al compilarla:

- `reunion-en-linea.patch` — entrar a la reunión de Meet, Zoom o Teams
  desde la app, pegando el enlace o la invitación completa.

El flujo `.github/workflows/apk-acta.yml` saca Acta de ese commit, le
aplica estos parches, corre sus pruebas y compila el APK.

## Por qué un parche y no una rama

Porque el trabajo del día vive en la rama de StudIA, y traer Acta de vuelta
para tocarle un archivo significaría sacar StudIA de en medio. Un parche
versionado se lee como cualquier otro cambio, se aplica sobre un commit
fijo, y no obliga a elegir cuál de las dos aplicaciones está "puesta".

El precio es que el parche envejece: si algún día hay que tocar Acta de
verdad, conviene revivirla en su propia rama y dejar esto de lado.

## Cómo se trabaja un parche de estos

    git worktree add --detach /tmp/acta 7b2f048
    cd /tmp/acta && npm ci --prefix app
    git apply ../ruta/al/repo/acta/reunion-en-linea.patch   # los que ya hay
    # …tocar, y probar de verdad:
    npm run prueba && npm run prueba:ui && npm run tipos
    git add -A && git diff --cached --binary > .../acta/lo-nuevo.patch

## Lo que Acta no puede hacer, y no es un descuido

Acta **no graba a los participantes remotos** de una reunión en línea. Ni
Android ni iOS dejan que una aplicación capture el audio de otra —el de una
llamada, nunca—, así que el micrófono solo oye lo que suene en la sala donde
uno está. El enlace sirve para entrar a la reunión, no para grabarla por
dentro; para lo dicho en línea está pegar la transcripción que entregan Meet
o Teams, que es lo que hace la pantalla de grabar.

Por lo mismo el micrófono tampoco se enciende solo a una hora: se agenda un
aviso y la grabación empieza con un toque.
