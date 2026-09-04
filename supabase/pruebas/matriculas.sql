-- La nómina que carga una institución, y qué pasa cuando su gente se registra.
--
-- Es el camino de una universidad que contrata: entrega su planilla, y sus
-- alumnos entran a una aplicación que ya sabe quiénes son y en qué están
-- inscritos. Casi nadie de esa lista tiene cuenta cuando se carga, así que lo
-- que hay que probar es justamente el desfase.
\set ON_ERROR_STOP on

create or replace function pg_temp.afirmar(p_caso text, p_real anyelement, p_esperado anyelement)
returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLA · % · obtuve % y esperaba %', p_caso, p_real, p_esperado;
  end if;
  raise notice 'ok · %  (%)', p_caso, p_real;
end $$;

-- Alguien de administración, que es quien carga.
\set SECRE 'a0000000-0000-4000-8000-000000000009'
insert into auth.users (id, email, raw_user_meta_data)
values (:'SECRE', 'secretaria.academica@u.cl', '{"nombre":"Secretaría Académica"}'::jsonb)
on conflict do nothing;
update public.perfiles set rol = 'administrador' where id = :'SECRE';

-- ── Cargar la nómina ────────────────────────────────────────────────────

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-000000000009';

select pg_temp.afirmar('la nómina entra y queda esperando',
  (public.cargar_matriculas('[
     {"correo": "Nueva.Alumna@U.CL", "rol": "estudiante", "codigo": "mat1610"},
     {"correo": "nueva.alumna@u.cl", "rol": "estudiante", "codigo": "MAT1203"},
     {"correo": "profe.nuevo@u.cl",  "rol": "profesor",   "codigo": "MAT1610", "papel": "profesor"}
   ]'::jsonb) ->> 'esperando')::int, 3);

reset role;

-- El correo se guarda en minúsculas: la planilla trae mayúsculas y la persona
-- se registra en minúsculas. Sin normalizar, no se encuentran nunca.
select pg_temp.afirmar('el correo queda normalizado',
  (select count(*) from public.matriculas where correo = 'nueva.alumna@u.cl')::int, 2);

-- ── La alumna se registra ───────────────────────────────────────────────

insert into auth.users (id, email, raw_user_meta_data)
values ('b0000000-0000-4000-8000-000000000001', 'nueva.alumna@u.cl',
        '{"nombre":"Alumna Nueva"}'::jsonb);

select pg_temp.afirmar('al registrarse queda inscrita en sus dos ramos',
  (select count(*) from public.inscripciones
    where estudiante_id = 'b0000000-0000-4000-8000-000000000001')::int, 2);

select pg_temp.afirmar('y con el plan de la institución',
  (select plan from public.perfiles where id = 'b0000000-0000-4000-8000-000000000001'), 'institucion');

select pg_temp.afirmar('la matrícula queda marcada como aplicada',
  (select count(*) from public.matriculas
    where correo = 'nueva.alumna@u.cl' and aplicada_en is null)::int, 0);

-- ── El profesor se registra ─────────────────────────────────────────────

insert into auth.users (id, email, raw_user_meta_data)
values ('b0000000-0000-4000-8000-000000000002', 'profe.nuevo@u.cl',
        '{"nombre":"Profe Nuevo"}'::jsonb);

select pg_temp.afirmar('el docente entra con su rol puesto',
  (select rol from public.perfiles where id = 'b0000000-0000-4000-8000-000000000002'), 'profesor');

select pg_temp.afirmar('y dictando el ramo que le asignaron',
  (select count(*) from public.dictados
    where docente_id = 'b0000000-0000-4000-8000-000000000002')::int, 1);

-- ── Alguien que ya estaba registrado ────────────────────────────────────
-- Si un alumno se creó la cuenta antes de que la universidad cargara su
-- nómina, no tiene por qué esperar a nada.

insert into auth.users (id, email, raw_user_meta_data)
values ('b0000000-0000-4000-8000-000000000003', 'ya.estaba@u.cl',
        '{"nombre":"Ya Estaba"}'::jsonb);

select pg_temp.afirmar('llegó sin ramos, como cualquiera',
  (select count(*) from public.inscripciones
    where estudiante_id = 'b0000000-0000-4000-8000-000000000003')::int, 0);

set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-000000000009';

select pg_temp.afirmar('cargarla ahora se le aplica en el momento',
  (public.cargar_matriculas('[
     {"correo": "ya.estaba@u.cl", "rol": "estudiante", "codigo": "MAT1610"}
   ]'::jsonb) ->> 'aplicadas')::int, 1);

reset role;

select pg_temp.afirmar('y queda inscrita sin volver a entrar',
  (select count(*) from public.inscripciones
    where estudiante_id = 'b0000000-0000-4000-8000-000000000003')::int, 1);

-- ── Lo que no puede pasar ───────────────────────────────────────────────

set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

do $$
begin
  perform public.cargar_matriculas('[{"correo":"yo@u.cl","rol":"administrador"}]'::jsonb);
  raise exception 'FALLA · un estudiante cargó la nómina';
exception when raise_exception then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok · la nómina no la carga cualquiera';
end $$;

select pg_temp.afirmar('y tampoco la puede leer',
  (select count(*) from public.matriculas)::int, 0);

reset role;

-- Una planilla mal armada no puede dejar a la institución sin nadie que
-- pueda arreglarla.
set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-000000000009';
select public.cargar_matriculas(
  '[{"correo":"secretaria.academica@u.cl","rol":"estudiante"}]'::jsonb);
reset role;

select pg_temp.afirmar('a la administración no la baja de rol una planilla',
  (select rol from public.perfiles where id = 'a0000000-0000-4000-8000-000000000009'),
  'administrador');

-- Volver a cargar lo mismo no duplica nada.
set role authenticated;
set pruebas.uid = 'a0000000-0000-4000-8000-000000000009';
select public.cargar_matriculas('[
   {"correo": "nueva.alumna@u.cl", "rol": "estudiante", "codigo": "MAT1610"},
   {"correo": "nueva.alumna@u.cl", "rol": "estudiante", "codigo": "MAT1203"}
 ]'::jsonb);
reset role;

select pg_temp.afirmar('recargar la misma nómina no duplica inscripciones',
  (select count(*) from public.inscripciones
    where estudiante_id = 'b0000000-0000-4000-8000-000000000001')::int, 2);
