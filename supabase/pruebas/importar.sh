#!/usr/bin/env bash
# Comprueba que lo que sale de datos/ se pueda aplicar de verdad.
#
# Generar SQL que se ve bien y no corre es fácil. Esto lo aplica dos veces
# sobre una base nueva: la primera prueba que es válido, la segunda que es
# idempotente —un colegio corrige una planilla y vuelve a importar, y eso no
# puede duplicar el horario ni pisar lo que los alumnos ya escribieron.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BASE="${STUDIA_PG_DIR:-/tmp/studia-pg}"
SOCK="$BASE/sock"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"

"$BIN/pg_isready" -h "$SOCK" -q 2>/dev/null || {
  echo "Levanta primero la base con ./supabase/pruebas/correr.sh"; exit 1;
}

npm --prefix "$DIR" run --silent importar >/dev/null

correr() { psql -h "$SOCK" -U postgres -d importado -v ON_ERROR_STOP=1 -q -f "$1"; }

psql -h "$SOCK" -U postgres -d postgres -q \
  -c "drop database if exists importado;" -c "create database importado;"

correr "$DIR/supabase/pruebas/andamio.sql"
for m in "$DIR"/supabase/migrations/*.sql; do correr "$m"; done

# Las personas de la planilla existen como usuarios antes de tener perfil:
# el colegio las invita por correo y la importación solo les pone el rol.
psql -h "$SOCK" -U postgres -d importado -q -c "
  insert into auth.users (id, email)
  select gen_random_uuid(), correo from (
    select distinct trim(split_part(linea, ',', 1)) as correo
      from regexp_split_to_table(pg_read_file('$DIR/datos/personas.csv'), E'\n') as linea
     where linea like '%@%'
  ) v;"

correr "$DIR/datos/importado.sql"
correr "$DIR/datos/importado.sql"

psql -h "$SOCK" -U postgres -d importado -v ON_ERROR_STOP=1 -q -c "
do \$\$
declare
  v_bloques int; v_materiales int; v_textos int; v_dictados int;
begin
  select count(*) into v_bloques     from public.bloques_horario;
  select count(*) into v_materiales  from public.materiales;
  select count(*) into v_textos      from public.materiales where texto is not null;
  select count(*) into v_dictados    from public.dictados;

  if v_bloques <> 8 then
    raise exception 'FALLA · quedaron % bloques de horario y debían ser 8 (¿se duplicó?)', v_bloques;
  end if;
  if v_materiales <> 5 then
    raise exception 'FALLA · quedaron % materiales y debían ser 5', v_materiales;
  end if;
  if v_textos <> 3 then
    raise exception 'FALLA · quedaron % lecturas con texto y debían ser 3', v_textos;
  end if;
  if v_dictados <> 4 then
    raise exception 'FALLA · quedaron % dictados y debían ser 4', v_dictados;
  end if;
  raise notice 'ok · la importación se aplica dos veces sin duplicar nada';
end \$\$;"

echo "— la carpeta datos/ se puede importar —"
