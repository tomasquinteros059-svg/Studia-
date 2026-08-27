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

-- Para poder hablar de un ramo que el usuario en turno NO ve. Se crea acá,
-- mientras todavía somos superusuario, y es SECURITY DEFINER a propósito.
create or replace function pg_temp.id_de(p_codigo text) returns uuid
  language sql stable security definer set search_path = public
  as $$ select id from public.asignaturas where codigo = p_codigo $$;

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
select pg_temp.afirmar('ve los 10 textos para leer',  (select count(*) from materiales where texto is not null)::int, 10);

-- ======================= como el otro estudiante ======================
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';

select pg_temp.afirmar('no ve asignaturas ajenas',    (select count(*) from asignaturas)::int, 0);
select pg_temp.afirmar('no ve tareas ajenas',         (select count(*) from tareas)::int, 0);
select pg_temp.afirmar('no ve notas ajenas',          (select count(*) from notas)::int, 0);
-- El texto de lectura viaja en la misma fila que el material: si la fila no
-- se ve, el texto tampoco. Vale la pena dejarlo afirmado.
select pg_temp.afirmar('no ve textos de ramos ajenos',(select count(*) from materiales where texto is not null)::int, 0);
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

-- ====================== apuntes: míos y de nadie más ======================
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

insert into public.apuntes (estudiante_id, asignatura_id, titulo, contenido)
values ('e0000000-0000-4000-8000-000000000001',
        (select id from public.asignaturas where codigo = 'MAT1610'),
        'Clase del valor medio', 'f continua en [a,b], derivable en (a,b)…');

select pg_temp.afirmar('veo mi apunte', (select count(*) from public.apuntes)::int, 1);

do $$
begin
  insert into public.apuntes (estudiante_id, asignatura_id, contenido)
  values ('e0000000-0000-4000-8000-000000000002',
          (select id from public.asignaturas where codigo = 'MAT1610'), 'ajeno');
  raise exception 'FALLA · pude escribir un apunte a nombre de otro';
exception when insufficient_privilege then
  raise notice 'ok · no puedo escribir apuntes a nombre de otro';
end $$;

do $$
begin
  insert into public.apuntes (estudiante_id, asignatura_id, contenido)
  values ('e0000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000099', 'ramo ajeno');
  raise exception 'FALLA · pude apuntar en un ramo en que no estoy';
exception when insufficient_privilege or foreign_key_violation then
  raise notice 'ok · no puedo apuntar en un ramo en que no estoy';
end $$;

set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('otro no ve mis apuntes', (select count(*) from public.apuntes)::int, 0);

-- El estudiante no puede fabricar un resumen: lo escribe la función.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
do $$
begin
  insert into public.resumenes (apunte_id, cuerpo)
  values ((select id from public.apuntes limit 1), 'resumen inventado');
  raise exception 'FALLA · pude fabricar un resumen';
exception when insufficient_privilege then
  raise notice 'ok · el estudiante no puede fabricar resúmenes';
end $$;

-- La transcripción se lee, no se escribe desde el cliente.
do $$
begin
  insert into public.transcripciones (clase_id, segundo, texto)
  values ((select id from public.clases limit 1), 0, 'texto inventado');
  raise exception 'FALLA · pude escribir en la transcripción';
exception when insufficient_privilege then
  raise notice 'ok · la transcripción no se escribe desde el cliente';
end $$;

select '— también pasaron las pruebas de apuntes —' as resultado;

-- ========================== como la profesora ==========================
-- Ana dicta Cálculo I (MAT1610) y Álgebra (MAT1203). No dicta Física.
set pruebas.uid = 'd0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('ve solo los 2 ramos que dicta',
  (select count(*) from asignaturas)::int, 2);
select pg_temp.afirmar('ve el horario de esos 2 ramos',
  (select count(*) from bloques_horario)::int, 5);
select pg_temp.afirmar('ve a los inscritos de sus ramos',
  (select count(*) from inscripciones)::int, 3);
select pg_temp.afirmar('la lista del curso sale por alumnos_de',
  (select count(*) from public.alumnos_de(pg_temp.id_de('MAT1610')))::int, 2);
select pg_temp.afirmar('no saca la lista de un ramo que no dicta',
  (select count(*) from public.alumnos_de(pg_temp.id_de('FIS1503')))::int, 0);

-- Ve las notas de sus evaluaciones aunque no estén publicadas: es al revés
-- que el estudiante.
select pg_temp.afirmar('ve las notas sin publicar de sus ramos',
  (select count(*) from notas where publicada_en is null)::int, 1);

-- Escribir en lo suyo.
do $$
declare v_modulo uuid;
begin
  insert into public.modulos (asignatura_id, titulo, orden)
  values ((select id from public.asignaturas where codigo = 'MAT1610'), '9 · Módulo de prueba', 9)
  returning id into v_modulo;

  insert into public.materiales (modulo_id, tipo, titulo, detalle, orden, texto)
  values (v_modulo, 'documento', 'Lectura de prueba', 'Lectura · 1 min', 1, 'Un texto cualquiera.');

  insert into public.tareas (asignatura_id, titulo, enunciado, puntos, vence_en)
  values ((select id from public.asignaturas where codigo = 'MAT1610'),
          'Tarea de prueba', 'Resuelve.', 10, now() + interval '7 days');

  raise notice 'ok · el docente carga módulo, material y tarea en su ramo';
end $$;

-- Y no en lo ajeno.
do $$
begin
  insert into public.tareas (asignatura_id, titulo, enunciado, puntos, vence_en)
  values (pg_temp.id_de('FIS1503'),
          'Tarea intrusa', 'No debería entrar.', 10, now() + interval '7 days');
  raise exception 'FALLA · pude publicar una tarea en un ramo que no dicto';
exception when insufficient_privilege then
  raise notice 'ok · no puede publicar tareas en un ramo ajeno';
end $$;

-- Los apuntes del alumno son del alumno.
select pg_temp.afirmar('no ve los apuntes de sus alumnos',
  (select count(*) from apuntes)::int, 0);
select pg_temp.afirmar('no ve lo que sus alumnos le preguntan al tutor',
  (select count(*) from mensajes)::int, 0);
select pg_temp.afirmar('no ve los resúmenes de sus alumnos',
  (select count(*) from resumenes)::int, 0);

-- Corregir es poner puntaje, no reescribir la entrega.
--
-- Estas dos se cuentan por filas y no por excepción: si el docente no viera
-- la entrega, el update tocaría cero filas y terminaría sin quejarse. Contar
-- es lo único que distingue "no pudo" de "no había nada que tocar".
do $$
declare v_tocadas int;
begin
  update public.entregas set puntos_obtenidos = 18
   where id = (select id from public.entregas limit 1);
  get diagnostics v_tocadas = row_count;
  if v_tocadas <> 1 then
    raise exception 'FALLA · el docente corrigió % entregas y debía ser 1', v_tocadas;
  end if;
  raise notice 'ok · el docente pone el puntaje de una entrega';
end $$;

do $$
declare v_tocadas int;
begin
  update public.entregas set entregado_en = now()
   where id = (select id from public.entregas limit 1);
  get diagnostics v_tocadas = row_count;
  raise exception 'FALLA · pude cambiar la fecha de % entregas', v_tocadas;
exception when raise_exception then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok · corregir no permite mover la fecha de entrega';
end $$;

-- Nadie se asciende solo.
do $$
declare v_rol text;
begin
  begin
    update public.perfiles set rol = 'estudiante' where id = auth.uid();
    raise exception 'FALLA · pude cambiarme el rol';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol <> 'profesor' then
    raise exception 'FALLA · el rol quedó en %', v_rol;
  end if;
  raise notice 'ok · el rol no se cambia desde el cliente';
end $$;

-- ========================== como el ayudante ===========================
-- Ignacio ayuda en Cálculo I: corrige y responde, pero no pone notas.
set pruebas.uid = 'd0000000-0000-4000-8000-000000000002';

select pg_temp.afirmar('el ayudante ve el ramo en que ayuda',
  (select count(*) from asignaturas)::int, 1);

do $$
begin
  insert into public.notas (evaluacion_id, estudiante_id, nota)
  values ((select id from public.evaluaciones limit 1),
          'e0000000-0000-4000-8000-000000000001', 7.0);
  raise exception 'FALLA · el ayudante pudo poner una nota';
exception when insufficient_privilege then
  raise notice 'ok · el ayudante no pone notas';
end $$;

do $$
begin
  insert into public.materiales (modulo_id, tipo, titulo, detalle, orden, texto)
  values ((select id from public.modulos limit 1), 'documento', 'Guía del ayudante', 'Lectura · 1 min', 8, 'Texto.');
  raise notice 'ok · el ayudante sí puede cargar material';
end $$;

-- ================== el estudiante sigue sin poder escribir ==================
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

do $$
begin
  insert into public.tareas (asignatura_id, titulo, enunciado, puntos, vence_en)
  values ((select id from public.asignaturas limit 1), 'Tarea falsa', 'No.', 10, now());
  raise exception 'FALLA · un estudiante pudo publicar una tarea';
exception when insufficient_privilege then
  raise notice 'ok · el estudiante no publica tareas';
end $$;

-- Ojo con esta forma: un update que no alcanza ninguna fila NO lanza error,
-- termina tranquilo habiendo cambiado cero. Si esto se escribiera esperando
-- una excepción, la prueba pasaría incluso si el estudiante sí pudiera.
do $$
declare v_tocadas int; v_antes numeric; v_despues numeric;
begin
  select nota into v_antes from public.notas where estudiante_id = auth.uid() limit 1;
  update public.notas set nota = 7.0 where estudiante_id = auth.uid();
  get diagnostics v_tocadas = row_count;
  select nota into v_despues from public.notas where estudiante_id = auth.uid() limit 1;

  if v_tocadas <> 0 then
    raise exception 'FALLA · un estudiante cambió % notas', v_tocadas;
  end if;
  if v_despues is distinct from v_antes then
    raise exception 'FALLA · la nota cambió de % a %', v_antes, v_despues;
  end if;
  raise notice 'ok · el estudiante no se cambia las notas (0 filas)';
end $$;

-- ======================== como la administración ========================
-- La secretaría no dicta nada, y aun así tiene que poder contar el curso.
reset role;
update public.perfiles set rol = 'administrador'
 where id = 'e0000000-0000-4000-8000-000000000002';
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';

select pg_temp.afirmar('la administración ve todas las asignaturas',
  (select count(*) from asignaturas)::int, 6);
select pg_temp.afirmar('la administración saca la lista de un curso que no dicta',
  (select count(*) from public.alumnos_de(pg_temp.id_de('MAT1610')))::int, 2);
select pg_temp.afirmar('la administración no ve apuntes de nadie',
  (select count(*) from apuntes)::int, 0);

do $$
begin
  insert into public.notas (evaluacion_id, estudiante_id, nota)
  values ((select id from public.evaluaciones limit 1),
          'e0000000-0000-4000-8000-000000000001', 7.0);
  raise exception 'FALLA · la administración pudo poner una nota';
exception when insufficient_privilege then
  raise notice 'ok · la administración no pone notas';
end $$;

select '— también pasaron las pruebas de docentes —' as resultado;
