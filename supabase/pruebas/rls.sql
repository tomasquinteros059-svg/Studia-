-- Pruebas de las políticas de acceso. Se corren contra una base con el
-- andamio, las migraciones y el seed ya aplicados.
\set ON_ERROR_STOP on
\set EDUARDO 'e0000000-0000-4000-8000-000000000001'
\set OTRO    'e0000000-0000-4000-8000-000000000002'

-- Un segundo estudiante, inscrito en nada.
insert into auth.users (id, email, raw_user_meta_data)
values (:'OTRO', 'otra@studia.cl', '{"nombre":"Otra Persona"}'::jsonb)
on conflict do nothing;

create or replace function pg_temp.afirmar(p_caso text, p_real anyelement, p_esperado anyelement)
returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLA · % · obtuve % y esperaba %', p_caso, p_real, p_esperado;
  end if;
  raise notice 'ok · %  (%)', p_caso, p_real;
end $$;

-- ============================ como Eduardo ============================
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('ve sus 6 asignaturas',        (select count(*) from asignaturas)::int, 6);
select pg_temp.afirmar('ve su horario completo',      (select count(*) from bloques_horario)::int, 14);
select pg_temp.afirmar('ve los 18 módulos',           (select count(*) from modulos)::int, 18);
select pg_temp.afirmar('ve las 9 tareas',             (select count(*) from tareas)::int, 9);
select pg_temp.afirmar('ve 1 clase en vivo',          (select count(*) from clases where estado='en_vivo')::int, 1);
select pg_temp.afirmar('ve sus 13 notas publicadas',  (select count(*) from notas)::int, 13);
select pg_temp.afirmar('ve los 13 hilos del foro',    (select count(*) from hilos)::int, 13);
select pg_temp.afirmar('ve 3 notificaciones sin leer',(select count(*) from notificaciones where not leida)::int, 3);
select pg_temp.afirmar('ve sus 2 entregas',           (select count(*) from entregas)::int, 2);

-- ======================= como el otro estudiante ======================
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';

select pg_temp.afirmar('no ve asignaturas ajenas',    (select count(*) from asignaturas)::int, 0);
select pg_temp.afirmar('no ve tareas ajenas',         (select count(*) from tareas)::int, 0);
select pg_temp.afirmar('no ve notas ajenas',          (select count(*) from notas)::int, 0);
select pg_temp.afirmar('no ve el foro ajeno',         (select count(*) from hilos)::int, 0);
select pg_temp.afirmar('no ve notificaciones ajenas', (select count(*) from notificaciones)::int, 0);
select pg_temp.afirmar('ve solo su propio perfil',    (select count(*) from perfiles)::int, 1);
select pg_temp.afirmar('no ve el perfil de Eduardo',
  (select count(*) from perfiles where id = 'e0000000-0000-4000-8000-000000000001')::int, 0);

-- ================== la nota sin publicar no se ve =====================
reset role;
insert into public.notas (evaluacion_id, estudiante_id, nota, publicada_en)
select e.id, 'e0000000-0000-4000-8000-000000000001', 5.9, null
  from public.evaluaciones e
  join public.asignaturas a on a.id = e.asignatura_id
 where a.codigo = 'MAT1610' and e.orden = 4;

set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('la nota sin publicar sigue oculta', (select count(*) from notas)::int, 13);

reset role;
select pg_temp.afirmar('pero existe en la tabla', (select count(*) from public.notas)::int, 14);

-- ============ no puedo escribir en el foro a nombre de otro ===========
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
do $$
begin
  insert into public.respuestas (hilo_id, autor_id, autor_nombre, autor_rol, cuerpo)
  values ((select id from public.hilos limit 1),
          'e0000000-0000-4000-8000-000000000002', 'Otra Persona', 'Estudiante', 'suplantación');
  raise exception 'FALLA · pude responder haciéndome pasar por otro';
exception when insufficient_privilege then
  raise notice 'ok · no puedo responder haciéndome pasar por otro';
end $$;

do $$
begin
  insert into public.respuestas (hilo_id, autor_id, autor_nombre, autor_rol, cuerpo)
  values ((select id from public.hilos limit 1),
          'e0000000-0000-4000-8000-000000000001', 'Eduardo Q.', 'Profesor', 'me hago pasar por docente');
  raise exception 'FALLA · pude publicar como profesor';
exception when insufficient_privilege then
  raise notice 'ok · no puedo publicar con rol de profesor';
end $$;

insert into public.respuestas (hilo_id, autor_id, autor_nombre, autor_rol, cuerpo)
values ((select id from public.hilos where titulo = '¿Diccionario o lista de tuplas?'),
        'e0000000-0000-4000-8000-000000000001', 'Eduardo Q.', 'Estudiante', 'Yo iría con diccionario.');
select pg_temp.afirmar('sí puedo responder como yo mismo',
  (select count(*) from respuestas r join hilos h on h.id = r.hilo_id
    where h.titulo = '¿Diccionario o lista de tuplas?')::int, 1);

-- ============== el estudiante no puede hablar por el tutor ============
do $$
declare v_conv uuid;
begin
  insert into public.conversaciones (estudiante_id, asignatura_id)
  values ('e0000000-0000-4000-8000-000000000001',
          (select id from public.asignaturas where codigo = 'MAT1610'))
  returning id into v_conv;

  insert into public.mensajes (conversacion_id, rol, contenido)
  values (v_conv, 'tutor', 'La respuesta es 42.');
  raise exception 'FALLA · el estudiante pudo escribir en boca del tutor';
exception when insufficient_privilege then
  raise notice 'ok · el estudiante no puede escribir mensajes del tutor';
end $$;

-- ================== los pesos no pueden pasar de 100 ==================
reset role;
do $$
begin
  insert into public.evaluaciones (asignatura_id, titulo, peso, orden)
  values ((select id from public.asignaturas where codigo = 'MAT1610'), 'Extra', 10, 9);
  raise exception 'FALLA · acepté pesos que suman más de 100';
exception when raise_exception then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok · rechaza pesos que suman más de 100';
end $$;

select '— todas las pruebas de acceso pasaron —' as resultado;

-- ================== compañeros: solo nombres, solo del curso ==============
reset role;
insert into public.inscripciones (estudiante_id, asignatura_id)
values ('e0000000-0000-4000-8000-000000000002',
        (select id from public.asignaturas where codigo = 'MAT1610'))
on conflict do nothing;

set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('veo a mis compañeros de Cálculo',
  (select count(*) from public.companeros_de(
     (select id from public.asignaturas where codigo = 'MAT1610')))::int, 2);

select pg_temp.afirmar('no veo compañeros de un ramo en que no estoy',
  (select count(*) from public.companeros_de('00000000-0000-4000-8000-000000000099'))::int, 0);

set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('el otro solo ve el ramo que comparte',
  (select count(*) from public.companeros_de(
     (select id from public.asignaturas where codigo = 'MAT1610')))::int, 2);
select pg_temp.afirmar('y nada del ramo que no comparte',
  (select count(*) from public.companeros_de(
     (select id from public.asignaturas where codigo = 'FIS1503')))::int, 0);

do $$
begin
  perform correo from public.perfiles limit 1;
  raise exception 'FALLA · pude leer el correo de un perfil';
exception when insufficient_privilege then
  raise notice 'ok · el correo no se puede leer desde el cliente';
end $$;

select pg_temp.afirmar('pero el nombre sí',
  (select count(*) from (select nombre from public.perfiles) x)::int, 1);

select '— también pasaron las pruebas de compañeros —' as resultado;
