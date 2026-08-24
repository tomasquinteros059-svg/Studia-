#!/usr/bin/env sh
# Genera la versión para publicar como Artifact a partir del prototipo standalone.
# El anfitrión aporta <!doctype>, <head> y <body>, así que aquí solo va el contenido.
set -e
src="$(dirname "$0")/index.html"
sed -n '/^<body>$/,/^<\/body>$/p' "$src" \
  | sed '1d;$d' \
  | sed '1i <title>StudIA — Prototipo</title>'
