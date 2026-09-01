-- Qué pasa de verdad cuando alguien borra su cuenta.
--
-- La política de privacidad promete dos cosas distintas y hay que comprobar
-- las dos, porque una sola sería fácil de cumplir por accidente:
--
--   1. Sus datos se van. Todos: apuntes, notas, entregas, lo que le preguntó
--      al tutor, sus quizzes, sus fichas, lo que su teléfono oyó en clase.
--   2. Lo que publicó en el foro se queda, sin su nombre. Es parte de una
--      conversación de otras personas, y borrarlo dejaría respuestas colgando
--      de preguntas que ya no están.
--
-- El borrado en cascada es lo que lo hace, y una cascada es exactamente la
-- clase de cosa que deja de funcionar cuando alguien agrega una tabla nueva y
-- se olvida del `on delete`. Por eso esto se prueba y no se supone.
\set ON_ERROR_STOP on
\set QUIENSEVA 'e0000000-0000-4000-8000-000000000009'

create or replace function pg_temp.afirmar(p_caso text, p_real anyelement, p_esperado anyelement)
returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLA · % · obtuve % y esperaba %', p_caso, p_real, p_esperado;
  end if;
  raise notice 'ok · %  (%)', p_caso, p_real;
end $$;

-- Alguien con de todo un poco, inscrito en el ramo que ya trae el seed.
insert into auth.users (id, email, raw_user_meta_data)
values (:'QUIENSEVA', 'sevaa@studia.cl', '{"nombre":"Quien Se Va"}'::jsonb);

-- El perfil no se inserta: lo crea solo el disparador que ya hay sobre
-- `auth.users`. Insertarlo a mano chocaría con esa fila.
select pg_temp.afirmar('el alta creó su perfil',
  (select count(*) from public.perfiles where id = :'QUIENSEVA')::int, 1);

insert into public.inscripciones (asignatura_id, estudiante_id)
select id, :'QUIENSEVA' from public.asignaturas limit 1;

insert into public.apuntes (estudiante_id, asignatura_id, titulo, contenido)
select :'QUIENSEVA', id, 'Mis apuntes', 'lo que no entendí' from public.asignaturas limit 1;

insert into public.conversaciones (estudiante_id, asignatura_id)
select :'QUIENSEVA', id from public.asignaturas limit 1;

insert into public.fichas (estudiante_id, asignatura_id, tema, pregunta, respuesta)
select :'QUIENSEVA', id, 'Integrales', '¿Y esto?', 'Así' from public.asignaturas limit 1;

insert into public.notificaciones (estudiante_id, tipo, titulo, detalle)
values (:'QUIENSEVA', 'tarea', 'Una notificación suya', 'lo que sea');

-- Y una pregunta en el foro, con una respuesta de otra persona colgando: es
-- justo el caso donde borrar el texto rompería la conversación de un tercero.
insert into public.hilos (id, asignatura_id, autor_id, autor_nombre, autor_rol, titulo, cuerpo)
select 'a0000000-0000-4000-8000-0000000000f1', id, :'QUIENSEVA', 'Quien Se Va', 'Estudiante',
       'Una duda que dejó escrita', '¿Por qué el signo cambia?'
from public.asignaturas limit 1;

insert into public.respuestas (hilo_id, autor_id, autor_nombre, autor_rol, cuerpo)
values ('a0000000-0000-4000-8000-0000000000f1', :'QUIENSEVA', 'Quien Se Va', 'Estudiante',
        'Me respondo sola: era el cambio de variable.');

select pg_temp.afirmar('antes: tiene apuntes',
  (select count(*) from public.apuntes where estudiante_id = :'QUIENSEVA')::int, 1);
select pg_temp.afirmar('antes: tiene una conversación con el tutor',
  (select count(*) from public.conversaciones where estudiante_id = :'QUIENSEVA')::int, 1);

-- ─────────────────────────── se borra la cuenta ───────────────────────────
-- Es lo mismo que hace `auth.admin.deleteUser` desde la función del servidor.
delete from auth.users where id = :'QUIENSEVA';

select pg_temp.afirmar('el perfil se fue',
  (select count(*) from public.perfiles where id = :'QUIENSEVA')::int, 0);
select pg_temp.afirmar('sus apuntes se fueron',
  (select count(*) from public.apuntes where estudiante_id = :'QUIENSEVA')::int, 0);
select pg_temp.afirmar('lo que le preguntó al tutor se fue',
  (select count(*) from public.conversaciones where estudiante_id = :'QUIENSEVA')::int, 0);
select pg_temp.afirmar('sus fichas se fueron',
  (select count(*) from public.fichas where estudiante_id = :'QUIENSEVA')::int, 0);
select pg_temp.afirmar('su inscripción se fue',
  (select count(*) from public.inscripciones where estudiante_id = :'QUIENSEVA')::int, 0);
select pg_temp.afirmar('sus notificaciones se fueron',
  (select count(*) from public.notificaciones where estudiante_id = :'QUIENSEVA')::int, 0);

-- Lo otro que promete la política: el foro se queda, sin su nombre.
select pg_temp.afirmar('su pregunta del foro sigue ahí',
  (select count(*) from public.hilos where id = 'a0000000-0000-4000-8000-0000000000f1')::int, 1);
select pg_temp.afirmar('pero ya no cuelga de su perfil',
  (select autor_id from public.hilos where id = 'a0000000-0000-4000-8000-0000000000f1'), null::uuid);

-- Y tampoco lleva su nombre escrito, que es lo que la política promete y lo
-- que la cascada por sí sola no hacía: `autor_nombre` es texto suelto y se
-- quedaba tal cual.
select pg_temp.afirmar('ni su nombre escrito al lado',
  (select autor_nombre from public.hilos where id = 'a0000000-0000-4000-8000-0000000000f1'),
  'Cuenta borrada');
select pg_temp.afirmar('lo mismo en sus respuestas',
  (select count(*) from public.respuestas where autor_nombre = 'Quien Se Va')::int, 0);
select pg_temp.afirmar('el texto de la respuesta sigue ahí',
  (select count(*) from public.respuestas
    where hilo_id = 'a0000000-0000-4000-8000-0000000000f1')::int, 1);

-- La red de seguridad de verdad: que no quede ninguna fila apuntando a un
-- perfil que ya no existe. Esto es lo que atrapa la tabla nueva que alguien
-- agregue mañana sin pensar en el borrado.
do $$
declare
  huerfanas int;
  tabla record;
begin
  for tabla in
    select c.relname as nombre, a.attname as columna
    from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
      join pg_class destino on destino.oid = k.confrelid
    where k.contype = 'f' and n.nspname = 'public'
      and destino.relname = 'perfiles' and array_length(k.conkey, 1) = 1
  loop
    execute format(
      'select count(*) from public.%I t where t.%I is not null'
      || ' and not exists (select 1 from public.perfiles p where p.id = t.%I)',
      tabla.nombre, tabla.columna, tabla.columna
    ) into huerfanas;
    if huerfanas > 0 then
      raise exception 'FALLA · %.% quedó con % fila(s) apuntando a un perfil borrado',
        tabla.nombre, tabla.columna, huerfanas;
    end if;
  end loop;
  raise notice 'ok · ninguna tabla quedó apuntando a un perfil que ya no existe';
end $$;
