-- Dos instituciones en la misma base, y el borde entre ellas.
--
-- Es la prueba que faltaba antes de salir a vender a la segunda universidad.
-- Hasta esta migración `es_administrador()` no preguntaba «¿de dónde?», así
-- que la secretaría académica de la B habría abierto el panel y visto la
-- nómina de la A: nombres, correos y ramos. No hacía falta ningún truco.
--
-- Acá se arma exactamente esa situación —dos contratos, con gente y ramos
-- propios— y se afirma, una por una, cada cosa que la B no puede hacer.
\set ON_ERROR_STOP on

create or replace function pg_temp.afirmar(p_caso text, p_real anyelement, p_esperado anyelement)
returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLA · % · obtuve % y esperaba %', p_caso, p_real, p_esperado;
  end if;
  raise notice 'ok · %  (%)', p_caso, p_real;
end $$;

-- Corre lo que se le pase y responde si reventó. Lo que se prueba abajo es
-- casi siempre eso: que la puerta esté cerrada.
create or replace function pg_temp.revienta(p_sql text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;

-- La institución A es la del seed. La B se abre acá, como la abriríamos de
-- verdad el día que alguien contrate: desde el editor SQL, sin sesión.
\set A 'c0000000-0000-4000-8000-000000000001'
\set ADMIN_A 'a0000000-0000-4000-8000-000000000009'

reset role;
set pruebas.uid = '';

select public.crear_institucion('Universidad B', 2, 'rectoria@ub.cl') as b \gset

select pg_temp.afirmar('la institución nueva queda abierta',
  (select nombre from public.instituciones where id = :'b'), 'Universidad B');
select pg_temp.afirmar('y su administradora queda esperando en la nómina',
  (select count(*) from public.matriculas
    where institucion_id = :'b' and correo = 'rectoria@ub.cl' and aplicada_en is null)::int, 1);

-- Se registra. La cuenta se arma sola, con el rol y la institución puestos.
insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-0000000000b1', 'rectoria@ub.cl',
        '{"nombre":"Rectoría B"}'::jsonb);
\set ADMIN_B 'a0000000-0000-4000-8000-0000000000b1'

select pg_temp.afirmar('entra ya como administración',
  (select rol from public.perfiles where id = :'ADMIN_B'), 'administrador');
select pg_temp.afirmar('y perteneciendo a su institución',
  (select institucion_id from public.perfiles where id = :'ADMIN_B'), :'b'::uuid);

-- ── La B carga su semestre ──────────────────────────────────────────────
-- Con el mismo código de ramo que la A. MAT1610 es un código tan común que
-- esto va a pasar con las dos primeras universidades que contraten, y antes
-- habría chocado contra un índice único de toda la base.

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-0000000000b1';

select public.cargar_catalogo(
  '[{"codigo":"MAT1610","nombre":"Cálculo de la B","profesor":"Otra Persona",
     "color":"#2F45D4","creditos":6,"bibliografia":[],
     "intro_tutor":"¿En qué andas?"}]'::jsonb,
  '[{"codigo":"MAT1610","dia":2,"hora_inicio":"10:00","hora_fin":"11:30",
     "sala":"B-101","tipo":"Cátedra"}]'::jsonb);

reset role;
select pg_temp.afirmar('el mismo código existe en las dos instituciones',
  (select count(*) from public.asignaturas
    where codigo = 'MAT1610' and creador_id is null)::int, 2);
select pg_temp.afirmar('y son ramos distintos',
  (select count(distinct nombre) from public.asignaturas
    where codigo = 'MAT1610' and creador_id is null)::int, 2);

-- ── Lo que la B no ve ───────────────────────────────────────────────────

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-0000000000b1';

select pg_temp.afirmar('solo ve los ramos de su institución',
  (select count(*) from public.asignaturas)::int, 1);
select pg_temp.afirmar('solo ve su horario',
  (select count(*) from public.bloques_horario)::int, 1);
select pg_temp.afirmar('no ve las inscripciones de la otra',
  (select count(*) from public.inscripciones)::int, 0);
select pg_temp.afirmar('no ve los dictados de la otra',
  (select count(*) from public.dictados)::int, 0);
select pg_temp.afirmar('no ve la nómina de la otra',
  (select count(*) from public.matriculas where institucion_id = :'A')::int, 0);
select pg_temp.afirmar('ni quién dicta en la otra',
  (select count(*) from public.dictados_del_colegio())::int, 0);

-- El registro es lo más delicado: es el único lugar de StudIA donde se lee el
-- correo de otra persona.
select pg_temp.afirmar('en el registro solo aparece su propia gente',
  (select count(*) from public.registros())::int, 1);
select pg_temp.afirmar('y es ella misma',
  (select id from public.registros()), :'ADMIN_B'::uuid);
select pg_temp.afirmar('no aparece nadie de la otra institución',
  (select count(*) from public.registros() where correo like '%@studia.cl')::int, 0);

-- ── Lo que la B no puede hacer ──────────────────────────────────────────

select pg_temp.afirmar('no asciende a nadie de la otra institución',
  pg_temp.revienta(
    format('select public.cambiar_rol(%L, ''administrador'')', :'ADMIN_A')), true);
select pg_temp.afirmar('no le regala el plan a nadie de la otra',
  pg_temp.revienta(
    format('select public.cambiar_plan(%L, ''institucion'')', :'ADMIN_A')), true);
select pg_temp.afirmar('no abre instituciones',
  pg_temp.revienta('select public.crear_institucion(''Universidad C'', 10)'), true);
select pg_temp.afirmar('no se marca a sí misma como operación de StudIA',
  pg_temp.revienta('select public.hacer_operador(''rectoria@ub.cl'')'), true);
select pg_temp.afirmar('y no ve las caídas del servicio',
  (select count(*) from public.errores)::int, 0);

-- Escribir directo en la tabla tampoco: la política no es solo de lectura.
select pg_temp.afirmar('no cuelga un ramo de la institución de al lado',
  pg_temp.revienta(format(
    'insert into public.asignaturas (institucion_id, codigo, nombre, profesor, color, creditos, intro_tutor)
     values (%L, ''ROBO101'', ''Ramo ajeno'', ''x'', ''#2F45D4'', 5, ''hola'')', :'A')), true);

-- Ni mudarse de institución para verlo todo desde adentro, que sería la
-- manera obvia de saltarse todo lo anterior.
select pg_temp.afirmar('no se cambia de institución sola',
  pg_temp.revienta(format(
    'update public.perfiles set institucion_id = %L where id = auth.uid()', :'A')), true);

reset role;

-- ── Los cupos ───────────────────────────────────────────────────────────
--
-- La B contrató dos. Uno ya lo ocupa su rectoría, así que queda uno: el
-- primer alumno de la nómina lo toma y el segundo entra igual —con sus ramos
-- y todo— pero en el plan gratis. Media matrícula es mejor que un error que
-- nadie ve, y el panel dice cuántos faltan.

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-0000000000b1';
select public.cargar_matriculas(format('[
   {"correo":"uno@ub.cl", "rol":"estudiante", "codigo":"MAT1610"},
   {"correo":"dos@ub.cl", "rol":"estudiante", "codigo":"MAT1610"}
 ]')::jsonb);
reset role;

select pg_temp.afirmar('la rectoría ocupa el primer cupo',
  (select plan from public.perfiles where id = :'ADMIN_B'), 'institucion');

insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-0000000000b2', 'uno@ub.cl', '{"nombre":"Uno"}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-0000000000b3', 'dos@ub.cl', '{"nombre":"Dos"}'::jsonb);

select pg_temp.afirmar('la primera alumna toma el cupo que quedaba',
  (select plan from public.perfiles where id = 'a0000000-0000-4000-8000-0000000000b2'), 'institucion');
select pg_temp.afirmar('el segundo entra sin cupo, en el plan gratis',
  (select plan from public.perfiles where id = 'a0000000-0000-4000-8000-0000000000b3'), 'gratis');
select pg_temp.afirmar('pero con sus ramos igual: la matrícula no se pierde',
  (select count(*) from public.inscripciones
    where estudiante_id = 'a0000000-0000-4000-8000-0000000000b3')::int, 1);

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-0000000000b1';

select pg_temp.afirmar('la administración no puede dar más cupos de los contratados',
  pg_temp.revienta(
    'select public.cambiar_plan(''a0000000-0000-4000-8000-0000000000b3'', ''institucion'')'), true);

-- Quitándoselo a alguien que ya no está, el cupo vuelve a la bolsa.
select public.cambiar_plan('a0000000-0000-4000-8000-0000000000b2', 'gratis');
select public.cambiar_plan('a0000000-0000-4000-8000-0000000000b3', 'institucion');

-- El contrato en una fila, que es lo que muestra el panel.
select pg_temp.afirmar('el panel ve los cupos contratados',
  (select cupos from public.mi_institucion_detalle()), 2);
select pg_temp.afirmar('y cuántos están ocupados',
  (select ocupados from public.mi_institucion_detalle())::int, 2);

-- Fuera de sesión para mirar: el plan de otra persona no se lee desde el
-- cliente ni siendo administración —la política de `perfiles` es «cada quien
-- ve el suyo» y no tiene excepción—, y el registro va por función aparte.
reset role;
select pg_temp.afirmar('liberado un cupo, se lo puede dar a otra persona',
  (select plan from public.perfiles where id = 'a0000000-0000-4000-8000-0000000000b3'), 'institucion');
select pg_temp.afirmar('y a quien se lo quitaron queda en gratis',
  (select plan from public.perfiles where id = 'a0000000-0000-4000-8000-0000000000b2'), 'gratis');

-- El plan Personal es de Google Play y no se toca desde el panel: quitárselo
-- a alguien no le devuelve el dinero, y le corta lo que compró.
update public.perfiles set plan = 'personal'
 where id = 'a0000000-0000-4000-8000-0000000000b3';

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-0000000000b1';
select pg_temp.afirmar('no le quita a nadie el plan que pagó por Google Play',
  pg_temp.revienta(
    'select public.cambiar_plan(''a0000000-0000-4000-8000-0000000000b3'', ''gratis'')'), true);
reset role;

-- ── Un contrato vencido no entrega cupos nuevos ─────────────────────────

reset role;
set pruebas.uid = '';
select public.crear_institucion('Universidad Vencida', 50, null,
                                now() - interval '1 day') as v \gset

insert into public.matriculas (institucion_id, correo, rol)
values (:'v', 'tarde@uv.cl', 'estudiante');

insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-0000000000c1', 'tarde@uv.cl', '{"nombre":"Tarde"}'::jsonb);

select pg_temp.afirmar('con el contrato vencido no se entrega el cupo',
  (select plan from public.perfiles where id = 'a0000000-0000-4000-8000-0000000000c1'), 'gratis');
select pg_temp.afirmar('pero la persona queda igual en su institución',
  (select institucion_id from public.perfiles where id = 'a0000000-0000-4000-8000-0000000000c1'), :'v'::uuid);

-- ── Nadie se lleva a la gente de otra institución ───────────────────────
--
-- La B escribe en su nómina el correo de un alumno que ya es de la A. Sin
-- esta regla se lo quedaría, con sus ramos y su plan.

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-0000000000b1';
select public.cargar_matriculas(
  '[{"correo":"eduardo@studia.cl","rol":"estudiante","codigo":"MAT1610"}]'::jsonb);
reset role;

select pg_temp.afirmar('el alumno de la A sigue siendo de la A',
  (select institucion_id from public.perfiles where correo = 'eduardo@studia.cl'), :'A'::uuid);
select pg_temp.afirmar('y no quedó inscrito en el ramo de la B',
  (select count(*) from public.inscripciones i
     join public.asignaturas a on a.id = i.asignatura_id
    where i.estudiante_id = (select id from public.perfiles where correo = 'eduardo@studia.cl')
      and a.institucion_id = :'b')::int, 0);

-- ── Un administrador sin institución no administra nada ─────────────────
--
-- Es el caso raro y hay que dejarlo dicho: `institucion_id = mi_institucion()`
-- con las dos en nulo es falso en SQL, no verdadero. Si fuera al revés, un
-- administrador suelto se llevaría de una sola vez a todas las cuentas
-- personales del servicio, que son justamente las que no tienen institución.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-0000000000d1', 'suelto@studia.cl',
        '{"nombre":"Admin Suelto"}'::jsonb);
update public.perfiles set rol = 'administrador'
 where id = 'a0000000-0000-4000-8000-0000000000d1';

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-0000000000d1';

select pg_temp.afirmar('un administrador sin institución no ve a nadie',
  (select count(*) from public.registros())::int, 0);
select pg_temp.afirmar('ni ramos del colegio',
  (select count(*) from public.asignaturas)::int, 0);
select pg_temp.afirmar('ni el contrato de nadie',
  (select count(*) from public.mi_institucion_detalle())::int, 0);
select pg_temp.afirmar('y no puede cargar un semestre en ninguna parte',
  pg_temp.revienta(
    'select public.cargar_catalogo(''[]''::jsonb, ''[]''::jsonb)'), true);
select pg_temp.afirmar('ni una nómina',
  pg_temp.revienta(
    'select public.cargar_matriculas(''[]''::jsonb)'), true);

reset role;

select '— también pasaron las pruebas de las instituciones —' as resultado;
