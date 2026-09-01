#!/usr/bin/env bash
# Compila las funciones del servidor con Deno, que es quien de verdad las corre.
#
#   npm run prueba:funciones-deno
#
# `prueba:sintaxis` solo comprueba que sean TypeScript bien escrito: parsea, no
# resuelve nada. Esto es el compilador de verdad, con las dependencias de npm
# bajadas y los tipos de Supabase y de Anthropic puestos, y es lo que separa
# «se escribe bien» de «funciona».
#
# Revisa las dos versiones: las de supabase/functions, que son las que sube la
# consola, y las de supabase/funciones-de-una-vez, que son las que se pegan en
# el panel. Que la segunda compile es lo que dice que incrustar lo compartido
# no rompió nada.
#
# Deno no viene con el proyecto. Si no está, esto no falla: lo dice y se va,
# para que no bloquee a quien no lo tiene instalado.
set -uo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DENO="${DENO:-$(command -v deno || true)}"

if [ -z "$DENO" ]; then
  echo "Deno no está instalado; me salto la compilación de las funciones."
  echo "Para tenerla:  curl -fsSL https://deno.land/install.sh | sh"
  exit 0
fi

# Sin esto Deno busca las dependencias en el node_modules de la aplicación, que
# es de React Native y no las tiene.
export DENO_NO_PACKAGE_JSON=1

fallas=0

revisar() {
  local archivo="$1" etiqueta="$2"
  local salida
  if salida="$("$DENO" check "$archivo" 2>&1)"; then
    printf '  ok  %s\n' "$etiqueta"
  else
    printf '  FALLA %s\n' "$etiqueta"
    printf '%s\n' "$salida" | grep -vE '^(Download|Check|Initialize)' | head -12
    fallas=$((fallas + 1))
  fi
}

echo "Las ocho, como las sube la consola:"
for f in "$DIR"/supabase/functions/*/index.ts; do
  revisar "$f" "$(basename "$(dirname "$f")")"
done

echo
echo "Las ocho, como se pegan en el panel:"
for f in "$DIR"/supabase/funciones-de-una-vez/*.ts; do
  revisar "$f" "$(basename "$f" .ts)"
done

echo
if [ "$fallas" -gt 0 ]; then
  echo "$fallas función(es) que Deno no compila."
  exit 1
fi
echo "16 compilaciones sin errores."
