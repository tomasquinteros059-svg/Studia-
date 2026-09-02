// Deja el proyecto Android listo para firmar con la clave de subida.
//
// Uso:  node herramientas/firmar-android.mjs [ruta/a/build.gradle]
//
// `expo prebuild` genera un build.gradle donde la compilación de release se
// firma con el keystore de depuración. Para probar en una tablet da lo mismo
// —lo importante es que el JavaScript vaya adentro— pero Google Play rechaza
// cualquier subida firmada así, y el mensaje que da no dice que el problema
// sea la firma.
//
// El proyecto nativo se regenera en cada compilación, así que el arreglo no
// puede vivir en un archivo comiteado: tiene que volver a aplicarse después de
// cada prebuild. Eso es esto.
//
// La firma queda condicionada a que exista la propiedad `STUDIA_KEYSTORE`: sin
// clave se sigue firmando con la de depuración, que es lo que corresponde para
// un APK de prueba. Lo que no puede pasar es lo contrario —creer que se firmó
// con la de subida cuando no— y de eso se encarga `--exigir-firma`.

import { readFileSync, writeFileSync } from "node:fs";

// Cualquier argumento que no sea una opción es la ruta. Buscar por el nombre
// del archivo dejaba pasar en silencio una ruta escrita a medias, y el aviso
// que salía era el del archivo de siempre.
const RUTA = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "app/android/app/build.gradle";
const EXIGIR = process.argv.includes("--exigir-firma");

const original = readFileSync(RUTA, "utf8");

// Lo que se agrega. Va entre comillas simples en Groovy: las propiedades
// llegan como strings desde `-P` o desde gradle.properties.
const CONFIG = `        subida {
            // La clave con que se sube a Google Play. Llega por propiedades,
            // nunca en el repositorio.
            if (project.hasProperty('STUDIA_KEYSTORE')) {
                storeFile file(STUDIA_KEYSTORE)
                storePassword STUDIA_KEYSTORE_PASSWORD
                keyAlias STUDIA_KEY_ALIAS
                keyPassword STUDIA_KEY_PASSWORD
            }
        }
`;

const FIRMA = "            signingConfig project.hasProperty('STUDIA_KEYSTORE') ? signingConfigs.subida : signingConfigs.debug";

function fallar(motivo) {
  console.error(`No pude preparar la firma en ${RUTA}: ${motivo}`);
  console.error("La plantilla de Expo cambió. Hay que mirar el archivo a mano antes de subir nada a Play.");
  process.exit(1);
}

let texto = original;

if (texto.includes("signingConfigs.subida")) {
  console.log(`${RUTA} ya estaba preparado.`);
} else {
  // 1 · el bloque de configuración, después del de depuración
  const anclaDebug = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;
  if (!texto.includes(anclaDebug)) fallar("no encontré el bloque de firma de depuración");
  texto = texto.replace(anclaDebug, anclaDebug + CONFIG);

  // 2 · que release la use. La línea aparece dos veces —en debug y en
  //     release—; acá solo se toca la de release, que es la que va después del
  //     comentario que la propia plantilla deja.
  const anclaRelease = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
  if (!texto.includes(anclaRelease)) fallar("no encontré la firma de la compilación de release");
  texto = texto.replace(anclaRelease, FIRMA);

  writeFileSync(RUTA, texto, "utf8");
  console.log(`${RUTA} preparado para firmar con la clave de subida.`);
}

// ── Comprobar que quedó como tiene que quedar ────────────────────────────

const listo = readFileSync(RUTA, "utf8");
const problemas = [];

if (!listo.includes("signingConfigs.subida")) problemas.push("la firma de subida no quedó puesta");
// En release no puede quedar ninguna referencia suelta a la de depuración.
const enRelease = listo.slice(listo.indexOf("        release {"));
if (/signingConfig\s+signingConfigs\.debug\s*$/m.test(enRelease.split("\n").slice(0, 12).join("\n"))) {
  problemas.push("release sigue firmando con la clave de depuración");
}
if (EXIGIR && !process.env.STUDIA_KEYSTORE_PRESENTE) {
  problemas.push("se exigió firma de subida y no hay clave: no se puede armar algo para Play");
}

if (problemas.length) {
  for (const p of problemas) console.error(`  · ${p}`);
  process.exit(1);
}
