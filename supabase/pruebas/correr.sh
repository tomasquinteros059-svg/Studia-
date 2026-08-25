#!/usr/bin/env bash
# Levanta un Postgres desechable, aplica migraciones + seed y corre las
# pruebas de acceso. No necesita Supabase ni Docker.
#
#   ./supabase/pruebas/correr.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BASE="${STUDIA_PG_DIR:-/tmp/studia-pg}"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
SOCK="$BASE/sock"

arrancar_si_hace_falta() {
  if [ -S "$SOCK/.s.PGSQL.5432" ]; then return; fi
  rm -rf "$BASE"; mkdir -p "$BASE/datos" "$SOCK"
  # initdb se niega a correr como root.
  if [ "$(id -u)" = 0 ]; then
    chown -R postgres "$BASE"; chmod 755 "$BASE"
    su postgres -c "$BIN/initdb -D $BASE/datos -U postgres --auth=trust" >/dev/null
    su postgres -c "$BIN/pg_ctl -D $BASE/datos -o '-k $SOCK -c listen_addresses=\"\"' -l $BASE/pg.log start" >/dev/null
  else
    "$BIN/initdb" -D "$BASE/datos" -U postgres --auth=trust >/dev/null
    "$BIN/pg_ctl" -D "$BASE/datos" -o "-k $SOCK -c listen_addresses=''" -l "$BASE/pg.log" start >/dev/null
  fi
  sleep 1
}

correr() { psql -h "$SOCK" -U postgres -d studia -v ON_ERROR_STOP=1 -q -f "$1"; }

arrancar_si_hace_falta
psql -h "$SOCK" -U postgres -d postgres -q \
  -c "drop database if exists studia;" -c "create database studia;"

correr "$DIR/supabase/pruebas/andamio.sql"
for m in "$DIR"/supabase/migrations/*.sql; do correr "$m"; done
correr "$DIR/supabase/seed.sql"
correr "$DIR/supabase/pruebas/rls.sql"
