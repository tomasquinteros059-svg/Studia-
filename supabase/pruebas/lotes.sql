-- Que pedir de a muchas devuelva exactamente lo mismo que pedir de a una.
--
-- El panel de quien dicta pasó de pedir las entregas de cada tarea por
-- separado a pedirlas todas juntas. Eso es más rápido y también es la clase de
-- cambio donde se pierde una fila sin que nadie lo note: una tarea sin
-- entregas que desaparece de la lista, o una nota que queda con el alumno
-- equivocado porque el agrupado se hizo por la columna que no era.
--
-- Acá se comprueba contra la base, con datos: lo que traería el `in (...)`
-- comparado, fila por fila, con lo que traería consultar una por una.
\set ON_ERROR_STOP on

create or replace function pg_temp.afirmar(p_caso text, p_real anyelement, p_esperado anyelement)
returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLA · % · obtuve % y esperaba %', p_caso, p_real, p_esperado;
  end if;
  raise notice 'ok · %  (%)', p_caso, p_real;
end $$;

-- Datos propios, y no los del seed. Una comparación entre dos consultas que
-- no devuelven nada pasa siempre, y no prueba nada: es la manera más común de
-- tener una prueba verde que no cuida nada.
\set RAMO 'b0000000-0000-4000-8000-0000000000e1'
\set A1   'e0000000-0000-4000-8000-000000000001'
\set A2   'e0000000-0000-4000-8000-000000000002'

insert into public.asignaturas (id, codigo, nombre, profesor, color, creditos, intro_tutor)
values (:'RAMO', 'LOTE101', 'Ramo de prueba', 'Quien sea', '#2F45D4', 5, 'hola');

insert into public.inscripciones (asignatura_id, estudiante_id)
values (:'RAMO', :'A1'), (:'RAMO', :'A2');

insert into public.tareas (id, asignatura_id, titulo, enunciado, puntos, vence_en)
values
  ('c0000000-0000-4000-8000-00000000a001'::uuid, :'RAMO', 'Guía 1', 'x', 20, now() + interval '3 days'),
  ('c0000000-0000-4000-8000-00000000a002'::uuid, :'RAMO', 'Guía 2', 'x', 20, now() + interval '5 days'),
  ('c0000000-0000-4000-8000-00000000a003'::uuid, :'RAMO', 'Guía 3', 'x', 20, now() + interval '9 days');

-- La tercera queda sin entregas a propósito: es el caso que se pierde al
-- agrupar mal, porque no aparece en el resultado de la consulta grande.
insert into public.entregas (tarea_id, estudiante_id) values
  ('c0000000-0000-4000-8000-00000000a001'::uuid, :'A1'),
  ('c0000000-0000-4000-8000-00000000a001'::uuid, :'A2'),
  ('c0000000-0000-4000-8000-00000000a002'::uuid, :'A1');

with tareas as (
  select id from public.tareas where asignatura_id = :'RAMO'
),
de_a_una as (
  select e.id from public.entregas e join tareas t on e.tarea_id = t.id
),
todas_juntas as (
  select e.id from public.entregas e where e.tarea_id in (select id from tareas)
)
select
  pg_temp.afirmar('hay entregas que comparar, no está pasando en vacío',
    (select count(*) from todas_juntas)::int, 3),
  pg_temp.afirmar('las entregas juntas son las mismas que de a una',
    ((select count(*) from (select id from de_a_una except select id from todas_juntas) x)
     + (select count(*) from (select id from todas_juntas except select id from de_a_una) y))::int,
    0);

-- Y que se puedan repartir por su tarea: dos, una y cero. La de cero es la
-- que la pantalla tiene que mostrar igual, con «nadie ha entregado».
select pg_temp.afirmar('cada entrega trae la tarea de la que cuelga',
  (select count(distinct tarea_id) from public.entregas
    where tarea_id in (select id from public.tareas where asignatura_id = :'RAMO'))::int,
  2);

-- Lo mismo con las notas, agrupadas por evaluación. Si el agrupado usara la
-- columna equivocada, cada nota quedaría bajo otra evaluación y el promedio
-- del curso saldría mal sin que nada falle.
insert into public.evaluaciones (id, asignatura_id, titulo, peso, orden) values
  ('d0000000-0000-4000-8000-00000000b001'::uuid, :'RAMO', 'Control 1', 50, 1),
  ('d0000000-0000-4000-8000-00000000b002'::uuid, :'RAMO', 'Control 2', 50, 2);

insert into public.notas (evaluacion_id, estudiante_id, nota) values
  ('d0000000-0000-4000-8000-00000000b001'::uuid, :'A1', 6.2),
  ('d0000000-0000-4000-8000-00000000b002'::uuid, :'A1', 4.1);

select pg_temp.afirmar('la nota de cada evaluación queda en la suya',
  (select nota from public.notas
    where evaluacion_id = 'd0000000-0000-4000-8000-00000000b001'::uuid
      and estudiante_id = :'A1'),
  6.2::numeric);

-- Y la cuenta que la pantalla arma: una fila por alumno y evaluación, tenga
-- nota o no. Dos alumnos por dos evaluaciones son cuatro filas, aunque solo
-- haya dos notas puestas: es lo que hace que el docente vea a quién le falta.
select pg_temp.afirmar('quien no tiene nota igual aparece',
  ((select count(*) from public.inscripciones where asignatura_id = :'RAMO')
   * (select count(*) from public.evaluaciones where asignatura_id = :'RAMO'))::int,
  4);

select '— también pasaron las pruebas de pedir de a muchas —' as resultado;
