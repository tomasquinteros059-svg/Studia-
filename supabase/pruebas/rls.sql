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

-- ── Escribir a mano ──────────────────────────────────────────────────────
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

update public.apuntes
   set trazos = '{"v":1,"trazos":[{"id":"t1","util":"lapiz","color":"#171C3F","grosor":3,
                  "puntos":[{"x":1,"y":1,"t":0},{"x":9,"y":9,"t":8}]}]}'::jsonb;

select pg_temp.afirmar('puedo dibujar en mi propio apunte',
  (select count(*) from public.apuntes where trazos is not null)::int, 1);

-- La columna la calcula la base: nadie tiene que acordarse de mantenerla.
select pg_temp.afirmar('el apunte queda marcado como escrito a mano',
  (select tiene_trazos from public.apuntes limit 1), true);

do $$
begin
  update public.apuntes set tiene_trazos = false;
  raise exception 'FALLA · pude mentir sobre si el apunte tiene dibujo';
exception when generated_always then
  raise notice 'ok · la marca de escrito a mano la decide la base';
end $$;

-- Medio mega de puntos desde un cliente modificado dejaría la lista de
-- apuntes de esa persona lenta para siempre.
do $$
begin
  update public.apuntes
     set trazos = jsonb_build_object('v', 1, 'trazos',
           (select jsonb_agg(jsonb_build_object('id', 'x', 'util', 'lapiz',
              'color', '#171C3F', 'grosor', 3, 'puntos',
              jsonb_build_array(jsonb_build_object('x', g, 'y', g, 't', g))))
            from generate_series(1, 20000) g));
  raise exception 'FALLA · pude guardar un tablero sin límite de tamaño';
exception when check_violation then
  raise notice 'ok · el tamaño del dibujo está acotado';
end $$;

set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
do $$
begin
  update public.apuntes set trazos = null;
  if found then raise exception 'FALLA · pude borrarle el dibujo a otro'; end if;
  raise notice 'ok · no puedo tocar el dibujo de otro';
end $$;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

-- ── El modo escucha ──────────────────────────────────────────────────────
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

-- Por omisión ninguna clase se puede oír: el permiso lo da quien dicta.
do $$
declare c uuid;
begin
  select id into c from public.clases limit 1;
  begin
    insert into public.escuchas (clase_id, persona_id, aparato)
    values (c, 'e0000000-0000-4000-8000-000000000001', 'tel-1');
    raise exception 'FALLA · pude oír una clase sin permiso de quien la dicta';
  exception when insufficient_privilege then
    raise notice 'ok · sin permiso de quien dicta, nadie oye';
  end;
end $$;

-- Con permiso, y siendo presencial, sí.
set role postgres;
update public.clases set presencial = true, escucha_permitida = true;
set role authenticated;

insert into public.escuchas (clase_id, persona_id, aparato)
values ((select id from public.clases limit 1),
        'e0000000-0000-4000-8000-000000000001', 'tel-1');
select pg_temp.afirmar('con permiso puedo ponerme a oír',
  (select count(*) from public.escuchas)::int, 1);

-- Una clase por pantalla no se oye desde el aire: su audio ya pasa por la app.
set role postgres;
update public.clases set presencial = false;
set role authenticated;
do $$
begin
  insert into public.escuchas (clase_id, persona_id, aparato)
  values ((select id from public.clases limit 1),
          'e0000000-0000-4000-8000-000000000001', 'tel-2');
  raise exception 'FALLA · pude oír una clase que no es presencial';
exception when insufficient_privilege then
  raise notice 'ok · una clase por pantalla no se oye desde la sala';
end $$;
set role postgres;
update public.clases set presencial = true;
set role authenticated;

insert into public.tramos_oidos (clase_id, escucha_id, segundo, texto, confianza)
values ((select id from public.clases limit 1),
        (select id from public.escuchas limit 1), 12, 'el teorema del valor medio', 0.8);

-- Los tramos crudos son treinta versiones a medio entender de lo mismo: cada
-- quien ve los suyos, y lo que lee el curso es la clase ya armada.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('otro no lee lo que oyó mi aparato',
  (select count(*) from public.tramos_oidos)::int, 0);

do $$
begin
  insert into public.tramos_oidos (clase_id, escucha_id, segundo, texto)
  values ((select id from public.clases limit 1),
          (select id from public.escuchas limit 1), 30, 'texto ajeno');
  raise exception 'FALLA · pude poner texto a nombre de otro aparato';
exception when insufficient_privilege then
  raise notice 'ok · no puedo escribir en la escucha de otro';
end $$;

-- La clase armada la escribe la función, no el cliente: si cualquiera pudiera
-- escribir ahí, podría poner en boca de un profesor algo que no dijo y quedar
-- como la versión oficial de la clase para todo el curso.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
do $$
begin
  insert into public.transcripciones (clase_id, segundo, texto)
  values ((select id from public.clases limit 1), 0, 'la profesora dijo que no hay control');
  raise exception 'FALLA · pude fabricar la clase oficial';
exception when insufficient_privilege then
  raise notice 'ok · el cliente no escribe la clase, la escribe la función';
end $$;

-- Y al armarla, los tramos crudos se van: son lo único que se parece a una
-- grabación de la sala, y con la clase escrita ya no hacen falta.
select public.armar_la_clase(
  (select id from public.clases limit 1),
  '[{"segundo":12,"texto":"el teorema del valor medio"}]'::jsonb);

select pg_temp.afirmar('la clase queda escrita',
  (select count(*) from public.transcripciones)::int, 1);
select pg_temp.afirmar('y los tramos crudos se borran solos',
  (select count(*) from public.tramos_oidos)::int, 0);

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

-- Lo primero que hace la aplicación al entrar es preguntar qué dicta esta
-- persona: de ahí sale si le muestra el panel docente o no. Se cuenta acá
-- porque durante un tiempo esta lectura estaba caída y ninguna prueba lo
-- decía: la política existía, el permiso de tabla no, y todo lo demás del
-- panel pregunta por `dicta()`, que es security definer y no lo necesita.
select pg_temp.afirmar('lee sus propios dictados, que es de donde sale el panel',
  (select count(*) from dictados)::int, 2);

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

-- Nadie se asciende solo. Lo niegan dos cosas a la vez y da igual cuál conteste
-- primero: el permiso, que sobre `perfiles` solo alcanza la columna `nombre`, y
-- el disparador `al_editar_perfil`, que además revisa el valor. Lo que se
-- comprueba acá es que no se pueda, no por cuál de las dos.
do $$
declare v_rol text;
begin
  begin
    update public.perfiles set rol = 'estudiante' where id = auth.uid();
    raise exception 'FALLA · pude cambiarme el rol';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'FALLA%' then raise; end if;
  end;
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol <> 'profesor' then
    raise exception 'FALLA · el rol quedó en %', v_rol;
  end if;
  raise notice 'ok · el rol no se cambia desde el cliente';
end $$;

-- Y del perfil propio no se toca nada más que el nombre. El correo es la copia
-- que ve la administración en `registros()`: si se pudiera escribir, cualquiera
-- podría dejar ahí el correo de otra persona.
do $$
begin
  begin
    update public.perfiles set correo = 'otro@studia.cl' where id = auth.uid();
    raise exception 'FALLA · pude cambiarme el correo del perfil';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'FALLA%' then raise; end if;
  end;
  raise notice 'ok · el correo del perfil no se escribe desde el cliente';
end $$;

do $$
begin
  begin
    insert into public.perfiles (id, nombre, correo)
    values (gen_random_uuid(), 'Perfil fantasma', 'fantasma@studia.cl');
    raise exception 'FALLA · pude crear un perfil a mano';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'FALLA%' then raise; end if;
  end;
  raise notice 'ok · los perfiles solo los crea el alta de la cuenta';
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

-- ================== reportar una respuesta de la IA ==================
-- Google Play exige que se pueda avisar desde adentro cuando la IA responde
-- algo ofensivo. Lo que se comprueba acá es que ese aviso llegue y que no se
-- convierta en una manera de leer lo que reportaron los demás.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

do $$
begin
  insert into public.reportes (persona_id, origen, contenido, motivo)
  values (auth.uid(), 'tutor', 'una respuesta que no correspondía', 'ofensivo');
  raise notice 'ok · el estudiante puede reportar una respuesta de la IA';
end $$;

do $$
begin
  insert into public.reportes (persona_id, origen, contenido, motivo)
  values ('e0000000-0000-4000-8000-000000000002', 'tutor', 'a nombre de otro', 'falso');
  raise exception 'FALLA · pude reportar a nombre de otra persona';
exception when insufficient_privilege or check_violation then
  raise notice 'ok · no se reporta a nombre de otro';
end $$;

-- Quien reporta no necesita volver a verlo; lo que necesita es que alguien lo
-- mire. Y sobre todo no puede ver lo que reportaron los demás.
select pg_temp.afirmar('un reporte no se lee de vuelta desde el aparato',
  (select count(*) from public.reportes)::int, 0);

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
select pg_temp.afirmar('la administración sí lee los reportes de la IA',
  (select count(*) from public.reportes)::int, 1);
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

-- El tope de uso del asistente no se toca desde el cliente.
do $$
begin
  perform 1 from public.usos_asistente;
  raise exception 'FALLA · pude leer el registro de uso del asistente';
exception when insufficient_privilege then
  raise notice 'ok · el registro de uso del asistente no se lee desde el cliente';
end $$;

do $$
begin
  delete from public.usos_asistente;
  raise exception 'FALLA · pude borrar el registro de uso, y con eso el tope';
exception when insufficient_privilege then
  raise notice 'ok · el registro de uso del asistente no se borra desde el cliente';
end $$;

-- ========================= el espacio propio ==========================
-- Alguien que se bajó la app para estudiar por su cuenta, sin institución.
reset role;
insert into auth.users (id, email, raw_user_meta_data)
values ('c0000000-0000-4000-8000-000000000001', 'porsucuenta@gmail.com',
        '{"nombre":"Paula Solo"}'::jsonb)
on conflict do nothing;

set role authenticated;
set pruebas.uid = 'c0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('llega sin ver ningún ramo',
  (select count(*) from asignaturas)::int, 0);

-- Se arma su espacio: crea el ramo, se inscribe, y le cuelga una lectura.
do $$
declare v_ramo uuid; v_modulo uuid;
begin
  insert into public.asignaturas (codigo, nombre, color, creditos, intro_tutor, creador_id)
  values ('PROPIO-1', 'Estadística por mi cuenta', '#208AEF', 1,
          '¿Qué parte estás estudiando?', auth.uid())
  returning id into v_ramo;

  insert into public.inscripciones (estudiante_id, asignatura_id)
  values (auth.uid(), v_ramo);

  insert into public.modulos (asignatura_id, titulo, orden)
  values (v_ramo, '1 · Lo que estoy viendo', 1) returning id into v_modulo;

  insert into public.materiales (modulo_id, tipo, titulo, detalle, orden, texto)
  values (v_modulo, 'documento', 'Mis apuntes de probabilidad', 'Lectura · 2 min', 1,
          'La probabilidad de un suceso es la proporción de veces que ocurre.');

  raise notice 'ok · arma su propio ramo, se inscribe y le carga una lectura';
end $$;

select pg_temp.afirmar('ahora ve su ramo, y solo el suyo',
  (select count(*) from asignaturas)::int, 1);
select pg_temp.afirmar('y su lectura se puede abrir',
  (select count(*) from materiales where texto is not null)::int, 1);

-- Lo que no puede hacer.
do $$
begin
  insert into public.asignaturas (codigo, nombre, color, creditos, intro_tutor)
  values ('COLEGIO-X', 'Ramo del colegio', '#208AEF', 10, '¿?');
  raise exception 'FALLA · creó un ramo sin dueño, como si fuera el colegio';
exception when insufficient_privilege then
  raise notice 'ok · no puede crear un ramo a nombre del colegio';
end $$;

do $$
begin
  insert into public.inscripciones (estudiante_id, asignatura_id)
  values (auth.uid(), pg_temp.id_de('MAT1610'));
  raise exception 'FALLA · se inscribió solo en un ramo del colegio';
exception when insufficient_privilege then
  raise notice 'ok · no se mete solo a un curso del colegio';
end $$;

do $$
begin
  insert into public.evaluaciones (asignatura_id, titulo, peso, orden)
  values ((select id from public.asignaturas limit 1), 'Mi propio control', 100, 1);
  raise exception 'FALLA · pudo crear evaluaciones en su espacio propio';
exception when insufficient_privilege then
  raise notice 'ok · un espacio propio no lleva evaluaciones ni notas';
end $$;

-- Dos personas pueden estudiar lo mismo: el código de un ramo propio no es
-- único en la tabla, solo lo es entre los ramos del colegio.
reset role;
insert into auth.users (id, email, raw_user_meta_data)
values ('c0000000-0000-4000-8000-000000000002', 'otra@gmail.com',
        '{"nombre":"Rosa Sola"}'::jsonb)
on conflict do nothing;

set role authenticated;
set pruebas.uid = 'c0000000-0000-4000-8000-000000000002';

do $$
begin
  insert into public.asignaturas (codigo, nombre, color, creditos, intro_tutor, creador_id)
  values ('PROPIO-1', 'Estadística por mi cuenta', '#208AEF', 1, '¿?', auth.uid());
  raise notice 'ok · otra persona puede tener un ramo con el mismo código';
exception when unique_violation then
  raise exception 'FALLA · el código de un ramo propio choca con el de otra persona';
end $$;

-- Pero no puede tocar el ramo de la primera, aunque se llame igual.
do $$
declare v_tocadas int;
begin
  update public.asignaturas set nombre = 'Se lo cambio'
   where creador_id = 'c0000000-0000-4000-8000-000000000001';
  get diagnostics v_tocadas = row_count;
  if v_tocadas > 0 then
    raise exception 'FALLA · le cambió el nombre al ramo de otra persona';
  end if;
  raise notice 'ok · no alcanza el ramo propio de otra persona';
end $$;

select pg_temp.afirmar('cada una ve un solo ramo, el suyo',
  (select count(*) from asignaturas)::int, 1);

set pruebas.uid = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('y el de la primera sigue llamándose como ella lo puso',
  (select count(*) from asignaturas where nombre = 'Estadística por mi cuenta')::int, 1);

-- Y el resto sigue sin verlo a él.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('el alumno del colegio no ve el ramo propio de otro',
  (select count(*) from asignaturas where codigo = 'PROPIO-1')::int, 0);

set pruebas.uid = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('la profesora tampoco ve el ramo propio de otro',
  (select count(*) from asignaturas where codigo = 'PROPIO-1')::int, 0);

select '— también pasaron las pruebas de docentes —' as resultado;

-- ==================== cargar el catálogo del semestre ====================
-- La carga masiva es una función, pero la seguridad no se muda ahí adentro:
-- es `security invoker`, así que las mismas políticas siguen decidiendo.

-- Un alumno cualquiera no puede cargar el semestre.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
do $$
declare v_falló boolean := false;
begin
  begin
    perform public.cargar_catalogo(
      '[{"codigo":"COLADO-1","nombre":"Colado","profesor":"X","ayudante":null,
         "color":"#2563C9","creditos":10,"descripcion":null,"requisitos":null,
         "bibliografia":[],"intro_tutor":"¿?"}]'::jsonb,
      '[]'::jsonb);
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('un alumno no puede cargar el catálogo', v_falló, true);
end $$;

select pg_temp.afirmar('y no dejó nada escrito',
  (select count(*) from public.asignaturas where codigo = 'COLADO-1')::int, 0);

-- La administración sí, y en una sola llamada.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('la administración carga ramos y horario de una vez',
  (public.cargar_catalogo(
    '[{"codigo":"NUE1001","nombre":"Ramo Nuevo","profesor":"Ana Ríos","ayudante":null,
       "color":"#2563C9","creditos":10,"descripcion":null,"requisitos":null,
       "bibliografia":["Un libro"],"intro_tutor":"¿En qué estás?"}]'::jsonb,
    '[{"codigo":"NUE1001","dia":1,"hora_inicio":"08:30","hora_fin":"10:00",
       "sala":"B-104","tipo":"Cátedra"},
      {"codigo":"NUE1001","dia":3,"hora_inicio":"08:30","hora_fin":"10:00",
       "sala":"B-104","tipo":"Cátedra"}]'::jsonb)
  ->> 'bloques')::int, 2);

select pg_temp.afirmar('el ramo quedó con su bibliografía',
  (select bibliografia[1] from asignaturas where codigo = 'NUE1001'), 'Un libro');

-- Volver a cargar corregido: actualiza, no duplica. Es lo que pasa de verdad
-- cuando el colegio se equivoca en una celda y vuelve a importar.
select public.cargar_catalogo(
  '[{"codigo":"NUE1001","nombre":"Ramo Nuevo Corregido","profesor":"Ana Ríos","ayudante":null,
     "color":"#2563C9","creditos":10,"descripcion":null,"requisitos":null,
     "bibliografia":[],"intro_tutor":"¿En qué estás?"}]'::jsonb,
  '[{"codigo":"NUE1001","dia":1,"hora_inicio":"09:00","hora_fin":"10:30",
     "sala":"B-105","tipo":"Cátedra"}]'::jsonb);

select pg_temp.afirmar('reimportar no duplica el ramo',
  (select count(*) from asignaturas where codigo = 'NUE1001')::int, 1);
select pg_temp.afirmar('y le deja el nombre corregido',
  (select nombre from asignaturas where codigo = 'NUE1001'), 'Ramo Nuevo Corregido');
select pg_temp.afirmar('el horario se rehace entero, no se suma al anterior',
  (select count(*) from bloques_horario where asignatura_id = pg_temp.id_de('NUE1001'))::int, 1);

-- Una planilla parcial no puede llevarse por delante el resto del semestre.
-- Los tres bloques de MAT1610 vienen del seed y ninguna de las cargas de
-- arriba lo nombra: tienen que seguir ahí, contados a mano y no comparados
-- consigo mismos, que sería una prueba que no puede fallar.
select pg_temp.afirmar('los ramos que la planilla no menciona conservan su horario',
  (select count(*) from bloques_horario where asignatura_id = pg_temp.id_de('MAT1610'))::int, 3);
select pg_temp.afirmar('y siguen existiendo',
  (select count(*) from asignaturas where codigo = 'MAT1610')::int, 1);

-- Un horario que nombra un ramo inexistente no puede quedar a medias.
do $$
declare v_falló boolean := false;
begin
  begin
    perform public.cargar_catalogo(
      '[{"codigo":"NUE1002","nombre":"Otro","profesor":"X","ayudante":null,
         "color":"#2563C9","creditos":10,"descripcion":null,"requisitos":null,
         "bibliografia":[],"intro_tutor":"¿?"}]'::jsonb,
      '[{"codigo":"NO-EXISTE","dia":1,"hora_inicio":"08:30","hora_fin":"10:00",
         "sala":"X","tipo":"Cátedra"}]'::jsonb);
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('un horario con un código que no existe detiene la carga', v_falló, true);
end $$;

select '— también pasaron las pruebas de carga masiva —' as resultado;

-- ======================= el registro de las personas =======================
-- El correo ajeno no es legible desde el cliente, y esa promesa se mantiene.
-- La administración lo ve por una función con guardia, no por un permiso
-- nuevo para todo el mundo.

set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('un alumno no ve el registro de nadie',
  (select count(*) from public.registros())::int, 0);

set pruebas.uid = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('una profesora tampoco ve el registro',
  (select count(*) from public.registros())::int, 0);

set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';

-- Leyendo la tabla, ni la administración ve más que su propia fila: la
-- política de perfiles es "cada quien ve el suyo" y no tiene excepción. Esto
-- es exactamente por lo que la función existe, y conviene que quede probado
-- y no solo comentado.
select pg_temp.afirmar('por la tabla, la administración solo se ve a sí misma',
  (select count(*) from public.perfiles)::int, 1);

select pg_temp.afirmar('por la función ve a las seis personas registradas',
  (select count(*) from public.registros())::int, 6);
select pg_temp.afirmar('y ve el correo, que es lo que identifica a cada una',
  (select count(*) from public.registros() where correo like '%@%')::int, 6);

-- ---------------------------------------------------------------- roles
-- Un alumno no puede ascenderse, ni por la tabla ni por la función.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
do $$
declare v_falló boolean := false;
begin
  begin
    update public.perfiles set rol = 'administrador'
     where id = 'e0000000-0000-4000-8000-000000000001';
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('un alumno no se asciende por la tabla', v_falló, true);
end $$;

do $$
declare v_falló boolean := false;
begin
  begin
    perform public.cambiar_rol('e0000000-0000-4000-8000-000000000001', 'administrador');
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('ni por la función', v_falló, true);
end $$;

-- Comprobado desde la administración, que es quien puede mirar: el alumno no
-- puede verificar su propio rol en la tabla sin verse solo a sí mismo.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('y sigue siendo estudiante',
  (select rol from public.registros() where id = 'e0000000-0000-4000-8000-000000000001'),
  'estudiante');

-- La administración sí cambia el de otra persona.
select public.cambiar_rol('e0000000-0000-4000-8000-000000000001', 'profesor');
select pg_temp.afirmar('la administración cambia el rol de otra persona',
  (select rol from public.registros() where id = 'e0000000-0000-4000-8000-000000000001'),
  'profesor');

-- Pero no el suyo: ascenderse o degradarse a uno mismo es justo lo que abriría
-- la puerta, y dejar al colegio sin administración es el otro lado del mismo
-- problema.
do $$
declare v_falló boolean := false;
begin
  begin
    perform public.cambiar_rol('e0000000-0000-4000-8000-000000000002', 'estudiante');
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('ni la administración se cambia el rol a sí misma', v_falló, true);
end $$;

select pg_temp.afirmar('y sigue habiendo administración',
  (select count(*) from public.registros() where rol = 'administrador')::int, 1);

-- Un rol que no existe no entra.
do $$
declare v_falló boolean := false;
begin
  begin
    perform public.cambiar_rol('e0000000-0000-4000-8000-000000000001', 'rector');
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('un rol inventado se rechaza', v_falló, true);
end $$;

-- Dejar todo como estaba, que abajo no hay nada pero mañana puede haberlo.
select public.cambiar_rol('e0000000-0000-4000-8000-000000000001', 'estudiante');

select '— también pasaron las pruebas del registro —' as resultado;

-- ================= las sesiones de estudio son de quien las escribe ========
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

insert into public.sesiones_estudio (estudiante_id, asignatura_id, titulo, empieza_en, minutos)
values ('e0000000-0000-4000-8000-000000000001', pg_temp.id_de('MAT1610'),
        'Ejercicios guía N°5', '2026-09-01 17:00-04', 60),
       ('e0000000-0000-4000-8000-000000000001', pg_temp.id_de('MAT1610'),
        'Integrales impropias con el tutor', '2026-09-01 18:30-04', 45);

select pg_temp.afirmar('veo mis sesiones', (select count(*) from public.sesiones_estudio)::int, 2);

-- Una sesión suelta, sin ramo: quien estudia por su cuenta también planifica.
insert into public.sesiones_estudio (estudiante_id, titulo, empieza_en)
values ('e0000000-0000-4000-8000-000000000001', 'Leer el capítulo 4', '2026-09-04 17:00-04');
select pg_temp.afirmar('una sesión puede no ser de ningún ramo',
  (select count(*) from public.sesiones_estudio where asignatura_id is null)::int, 1);

-- Marcarla hecha es editarla, y editarla se puede.
update public.sesiones_estudio set hecha_en = now()
 where titulo = 'Ejercicios guía N°5';
select pg_temp.afirmar('puedo marcar una sesión como hecha',
  (select count(*) from public.sesiones_estudio where hecha_en is not null)::int, 1);

-- El título vacío no entra: una sesión sin nombre no le sirve a nadie.
do $$
begin
  insert into public.sesiones_estudio (estudiante_id, titulo, empieza_en)
  values ('e0000000-0000-4000-8000-000000000001', '   ', now());
  raise exception 'FALLA · pude guardar una sesión sin título';
exception when check_violation then
  raise notice 'ok · una sesión sin título se rechaza';
end $$;

-- Ni una que dure lo que no dura nada, ni una de veinte horas.
do $$
begin
  insert into public.sesiones_estudio (estudiante_id, titulo, empieza_en, minutos)
  values ('e0000000-0000-4000-8000-000000000001', 'un ratito', now(), 0);
  raise exception 'FALLA · pude guardar una sesión de cero minutos';
exception when check_violation then
  raise notice 'ok · una sesión de cero minutos se rechaza';
end $$;

do $$
begin
  insert into public.sesiones_estudio (estudiante_id, titulo, empieza_en, minutos)
  values ('e0000000-0000-4000-8000-000000000001', 'todo el día', now(), 600);
  raise exception 'FALLA · pude guardar una sesión de diez horas';
exception when check_violation then
  raise notice 'ok · una sesión desmedida se rechaza';
end $$;

do $$
begin
  insert into public.sesiones_estudio (estudiante_id, titulo, empieza_en)
  values ('e0000000-0000-4000-8000-000000000002', 'a nombre de otro', now());
  raise exception 'FALLA · pude planificarle el estudio a otra persona';
exception when insufficient_privilege then
  raise notice 'ok · no puedo planificarle el estudio a otra persona';
end $$;

-- Y nadie más las ve. Ni quien dicta el ramo, ni la administración: a qué
-- hora alguien pensaba ponerse a estudiar no es asunto de nadie. Es la única
-- tabla del sistema sin ninguna excepción, y por eso se afirma de las tres.
set pruebas.uid = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('Ana dicta ese ramo y aun así no ve las sesiones',
  (select count(*) from public.sesiones_estudio)::int, 0);

-- Para esta altura del archivo, el otro estudiante ya es la administración.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('la administración tampoco las ve',
  (select rol from public.perfiles where id = auth.uid()), 'administrador');
select pg_temp.afirmar('y cuenta cero sesiones',
  (select count(*) from public.sesiones_estudio)::int, 0);

do $$
begin
  update public.sesiones_estudio set titulo = 'secuestrada';
  if found then raise exception 'FALLA · pude editar una sesión ajena'; end if;
  raise notice 'ok · una sesión ajena no se puede editar';
end $$;

-- Se limpia: las siguientes pruebas cuentan filas y esto no es del seed.
reset role;
delete from public.sesiones_estudio
 where estudiante_id = 'e0000000-0000-4000-8000-000000000001';

select '— también pasaron las pruebas del planificador —' as resultado;

-- ===================== el quiz es un espejo, no una prueba =================
-- Un quiz nace de la función `quiz`, que escribe con la clave de servicio.
-- Acá se simula esa escritura, y después se comprueba lo que el estudiante
-- puede y no puede hacer con él.
reset role;
insert into public.quices (id, estudiante_id, asignatura_id, tema, preguntas)
values ('11111111-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001',
        (select id from public.asignaturas where codigo = 'MAT1610'),
        'Integrales',
        '[{"pregunta":"¿Cuál conviene?","opciones":["a","b","c","d"],"correcta":1,"explicacion":"porque sí"},
          {"pregunta":"¿Y esta?","opciones":["a","b","c","d"],"correcta":0,"explicacion":"porque sí"},
          {"pregunta":"¿Y esta otra?","opciones":["a","b","c","d"],"correcta":3,"explicacion":"porque sí"}]'::jsonb);

set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('veo mi quiz', (select count(*) from public.quices)::int, 1);

-- Responder es lo único que se escribe, y pasa por la función.
select public.responder_quiz('11111111-0000-4000-8000-000000000001', '[1, null, null]'::jsonb);
select pg_temp.afirmar('quedó lo que respondí',
  (select respuestas from public.quices where id = '11111111-0000-4000-8000-000000000001'),
  '[1, null, null]'::jsonb);
select pg_temp.afirmar('y el quiz sigue sin terminar',
  (select terminado_en is null from public.quices where id = '11111111-0000-4000-8000-000000000001'),
  true);

select public.responder_quiz('11111111-0000-4000-8000-000000000001', '[1, 0, 3]'::jsonb, true);
select pg_temp.afirmar('terminarlo queda anotado',
  (select terminado_en is not null from public.quices where id = '11111111-0000-4000-8000-000000000001'),
  true);

-- Repetirlo es mandar el arreglo vacío: vuelve a quedar sin terminar.
select public.responder_quiz('11111111-0000-4000-8000-000000000001', '[]'::jsonb);
select pg_temp.afirmar('repetirlo lo deja como nuevo',
  (select terminado_en is null and jsonb_array_length(respuestas) = 0
     from public.quices where id = '11111111-0000-4000-8000-000000000001'),
  true);

-- Lo que no se puede: fabricarse un quiz, o reescribir las preguntas para que
-- todas queden correctas. Sin esto el puntaje no diría nada.
do $$
begin
  insert into public.quices (estudiante_id, asignatura_id, tema, preguntas)
  values ('e0000000-0000-4000-8000-000000000001',
          (select id from public.asignaturas where codigo = 'MAT1610'), 'inventado',
          '[{"pregunta":"a","opciones":["a","b","c","d"],"correcta":0,"explicacion":"x"},
            {"pregunta":"b","opciones":["a","b","c","d"],"correcta":0,"explicacion":"x"},
            {"pregunta":"c","opciones":["a","b","c","d"],"correcta":0,"explicacion":"x"}]'::jsonb);
  raise exception 'FALLA · pude fabricarme un quiz';
exception when insufficient_privilege then
  raise notice 'ok · no puedo fabricarme un quiz';
end $$;

do $$
begin
  update public.quices set preguntas = '[]'::jsonb
   where id = '11111111-0000-4000-8000-000000000001';
  raise exception 'FALLA · pude reescribir las preguntas de mi quiz';
exception when insufficient_privilege then
  raise notice 'ok · no puedo reescribir las preguntas de mi quiz';
end $$;

-- Más respuestas que preguntas: la función lo rechaza en vez de guardar basura.
do $$
declare v_falló boolean := false;
begin
  begin
    perform public.responder_quiz('11111111-0000-4000-8000-000000000001', '[0,1,2,3,0]'::jsonb);
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('no puedo mandar más respuestas que preguntas', v_falló, true);
end $$;

-- El quiz de otro no se ve, y tampoco se responde.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('otro no ve mi quiz', (select count(*) from public.quices)::int, 0);

do $$
declare v_falló boolean := false;
begin
  begin
    perform public.responder_quiz('11111111-0000-4000-8000-000000000001', '[0,0,0]'::jsonb);
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('ni lo puede responder por mí', v_falló, true);
end $$;

-- Ni quien dicta el ramo: en qué se equivoca alguien repasando no es materia
-- de nota, y confundirlo con una prueba es lo que haría que nadie lo usara.
set pruebas.uid = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('Ana dicta el ramo y tampoco ve el quiz',
  (select count(*) from public.quices)::int, 0);

reset role;
delete from public.quices where id = '11111111-0000-4000-8000-000000000001';

select '— también pasaron las pruebas del quiz —' as resultado;

-- ============== las fichas vuelven, y la que fallas vuelve antes ===========
reset role;
insert into public.fichas (id, estudiante_id, asignatura_id, tema, pregunta, respuesta)
values ('22222222-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001',
        (select id from public.asignaturas where codigo = 'MAT1610'),
        'Integrales', '¿Fórmula de integración por partes?', 'uv − ∫v du');

set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('veo mi ficha', (select count(*) from public.fichas)::int, 1);
select pg_temp.afirmar('una ficha nueva no tiene fecha: toca ya',
  (select vuelve_en is null from public.fichas
    where id = '22222222-0000-4000-8000-000000000001'), true);

-- Acertar la aleja: un día, después tres, después siete.
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select pg_temp.afirmar('al primer acierto vuelve en un día',
  (select round(extract(epoch from vuelve_en - now()) / 86400)::int
     from public.fichas where id = '22222222-0000-4000-8000-000000000001'), 1);

select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select pg_temp.afirmar('al segundo, en tres',
  (select round(extract(epoch from vuelve_en - now()) / 86400)::int
     from public.fichas where id = '22222222-0000-4000-8000-000000000001'), 3);

select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select pg_temp.afirmar('al tercero, en siete',
  (select round(extract(epoch from vuelve_en - now()) / 86400)::int
     from public.fichas where id = '22222222-0000-4000-8000-000000000001'), 7);

-- Fallar la trae de vuelta hoy y borra la racha, que es todo el punto.
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', false);
select pg_temp.afirmar('fallar la trae de vuelta hoy',
  (select round(extract(epoch from vuelve_en - now()) / 86400)::int
     from public.fichas where id = '22222222-0000-4000-8000-000000000001'), 0);
select pg_temp.afirmar('y la racha vuelve a cero',
  (select aciertos from public.fichas where id = '22222222-0000-4000-8000-000000000001'), 0);
select pg_temp.afirmar('el fallo queda anotado',
  (select fallos from public.fichas where id = '22222222-0000-4000-8000-000000000001'), 1);

-- El intervalo tiene techo: cinco aciertos seguidos son 35 días, y de ahí no
-- sube más. Una ficha que nunca vuelve es una ficha que se olvidó.
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
select pg_temp.afirmar('el intervalo se topa en 35 días',
  (select round(extract(epoch from vuelve_en - now()) / 86400)::int
     from public.fichas where id = '22222222-0000-4000-8000-000000000001'), 35);

-- Lo que no se puede: fabricarse fichas, o cambiarles la respuesta.
do $$
begin
  insert into public.fichas (estudiante_id, asignatura_id, tema, pregunta, respuesta)
  values ('e0000000-0000-4000-8000-000000000001',
          (select id from public.asignaturas where codigo = 'MAT1610'), 'x', 'y', 'z');
  raise exception 'FALLA · pude fabricarme una ficha';
exception when insufficient_privilege then
  raise notice 'ok · no puedo fabricarme una ficha';
end $$;

do $$
begin
  update public.fichas set respuesta = 'lo que yo diga', vuelve_en = now()
   where id = '22222222-0000-4000-8000-000000000001';
  raise exception 'FALLA · pude reescribir una ficha';
exception when insufficient_privilege then
  raise notice 'ok · no puedo reescribir una ficha ni adelantarle la fecha';
end $$;

-- Y no son de nadie más: ni del otro estudiante, ni de quien dicta el ramo.
set pruebas.uid = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('Ana dicta el ramo y no ve mis fichas',
  (select count(*) from public.fichas)::int, 0);

do $$
declare v_falló boolean := false;
begin
  begin
    perform public.repasar_ficha('22222222-0000-4000-8000-000000000001', true);
  exception when others then v_falló := true;
  end;
  perform pg_temp.afirmar('ni las puede repasar por mí', v_falló, true);
end $$;

reset role;
delete from public.fichas where id = '22222222-0000-4000-8000-000000000001';

-- ─────────────────────── quedarse con el aparato de otro ─────────────────
--
-- El identificador de aparato es único, así que registrar el de otra persona
-- choca con su fila. La pregunta es qué pasa entonces: si el choque se
-- resolviera actualizando, alguien podría quedarse con el teléfono de un
-- compañero —dejarlo sin avisos y llevarse los suyos a ese aparato—.
--
-- Razonarlo no basta: depende de contra qué fila se evalúa la política al
-- resolver el choque, y eso hay que preguntárselo a la base.
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
insert into public.aparatos (persona_id, token, plataforma)
values ('e0000000-0000-4000-8000-000000000002', 'ExponentPushToken[del-otro]', 'android');

set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
do $$
declare paso boolean := false;
begin
  begin
    insert into public.aparatos (persona_id, token, plataforma)
    values ('e0000000-0000-4000-8000-000000000001', 'ExponentPushToken[del-otro]', 'android')
    on conflict (token) do update set persona_id = excluded.persona_id;
  exception when others then paso := true;
  end;
  perform pg_temp.afirmar('no puedo quedarme con el aparato de otro', paso, true);
end $$;

-- Se mira como superusuario: desde la sesión de arriba la fila no se ve, y
-- «no la veo» no es lo mismo que «ya no es suya». La primera vez esta
-- comprobación falló justamente por eso.
reset role;
select pg_temp.afirmar('y su aparato sigue siendo suyo',
  (select persona_id from public.aparatos where token = 'ExponentPushToken[del-otro]'),
  'e0000000-0000-4000-8000-000000000002'::uuid);

-- ──────────────── quién puede llamar a las funciones ─────────────────────
--
-- En Postgres una función nace abierta a todo el mundo. Una SECURITY DEFINER
-- sin comprobación adentro es, entonces, una puerta: no la abre un descuido de
-- las políticas, la abre el valor por omisión del motor.
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

-- Borrar el historial de caídas es de la administración. Un alumno que pudiera
-- llamarla no roba nada: deja al colegio sin la información con la que iba a
-- arreglar las cosas, y sin enterarse.
do $$
declare paso boolean := false;
begin
  begin
    perform public.limpiar_errores_viejos();
  exception when others then paso := true;
  end;
  perform pg_temp.afirmar('un alumno no puede borrar el registro de caídas', paso, true);
end $$;

-- Y las dos que las políticas del almacenamiento necesitan sí se pueden
-- llamar. Cerrarlas parecía prudente y habría roto la lectura de archivos con
-- un «permission denied for function», que no se parece en nada a su causa.
select pg_temp.afirmar('las funciones que usan las políticas siguen llamables',
  public.dueno_de_la_ruta('yo/e0000000-0000-4000-8000-000000000001/x.pdf', 'yo'),
  'e0000000-0000-4000-8000-000000000001'::uuid);

reset role;

-- ──────────────────────────────── el plan ────────────────────────────────
--
-- Es lo que separa lo pagado de lo gratis, así que la pregunta no es si la
-- pantalla lo respeta: es si alguien con la clave anónima —que es pública, va
-- dentro del APK— puede regalárselo con un update.
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('parte en el plan gratis',
  (select plan from public.perfiles where id = auth.uid()), 'gratis');

do $$
declare paso boolean := false;
begin
  begin
    update public.perfiles set plan = 'personal' where id = auth.uid();
  exception when others then paso := true;
  end;
  perform pg_temp.afirmar('no puede regalarse el plan pagado', paso, true);
end $$;

select pg_temp.afirmar('y sigue en gratis después de intentarlo',
  (select plan from public.perfiles where id = auth.uid()), 'gratis');

-- Ni por la función, que es la otra puerta.
do $$
declare paso boolean := false;
begin
  begin
    perform public.cambiar_plan('e0000000-0000-4000-8000-000000000001', 'institucion');
  exception when others then paso := true;
  end;
  perform pg_temp.afirmar('ni llamando a la función de la administración', paso, true);
end $$;

reset role;

-- ─────────────────────────── las caídas de la app ────────────────────────
--
-- Un alumno anota las suyas y no ve las de nadie. En un mensaje de error se
-- cuela más de lo que uno cree, y quién se cae y en qué pantalla es algo que
-- no le incumbe a un compañero.
--
-- El `set role` no sobra: la sección de arriba lo devolvió, y como
-- superusuario las políticas no se aplican y la prueba pasaría sin probar nada.
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

insert into public.errores (persona_id, mensaje, origen)
  values ('e0000000-0000-4000-8000-000000000001', 'reventó al abrir la materia', 'pantalla');
-- Anotarla se pudo —la línea de arriba no falló—, y leerla no: leer las
-- caídas es de la administración.
select pg_temp.afirmar('anoto mi caída y no la puedo leer de vuelta',
  (select count(*) from public.errores)::int, 0);

do $$
declare paso boolean := false;
begin
  begin
    insert into public.errores (persona_id, mensaje, origen)
      values ('e0000000-0000-4000-8000-000000000002', 'a nombre de otro', 'global');
  exception when insufficient_privilege then paso := true;
  end;
  perform pg_temp.afirmar('no puedo anotar caídas a nombre de otro', paso, true);
end $$;

-- La administración sí las lee: es para lo que están. Quien hace de
-- administración en estas pruebas es el segundo estudiante, al que más arriba
-- se le cambió el rol.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('la administración las ve',
  (select count(*) from public.errores)::int, 1);

reset role;

select '— también pasaron las pruebas de las fichas —' as resultado;
