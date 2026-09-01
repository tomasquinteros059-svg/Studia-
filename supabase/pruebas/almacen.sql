-- Quién puede abrir el archivo de quién.
--
-- Es la parte del almacenamiento que de verdad importa. Subir un archivo es
-- fácil; lo difícil —y lo que no se puede probar mirando la pantalla— es que
-- el apunte de alguien no se lo pueda bajar el resto del curso, y que un
-- alumno no pueda dejarle un archivo al curso entero haciéndose pasar por
-- quien dicta.
\set ON_ERROR_STOP on
\set EDUARDO 'e0000000-0000-4000-8000-000000000001'
\set OTRO    'e0000000-0000-4000-8000-000000000002'

create or replace function pg_temp.afirmar(p_caso text, p_real anyelement, p_esperado anyelement)
returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLA · % · obtuve % y esperaba %', p_caso, p_real, p_esperado;
  end if;
  raise notice 'ok · %  (%)', p_caso, p_real;
end $$;

create or replace function pg_temp.un_ramo() returns uuid
  language sql stable security definer set search_path = public
  as $$ select id from public.asignaturas order by codigo limit 1 $$;

-- Los archivos se meten como superusuario: lo que se está probando es quién
-- los ve después, no quién los puso.
insert into storage.objects (bucket_id, name, owner) values
  ('material', 'yo/' || :'EDUARDO' || '/aaa-mi-apunte.pdf',  :'EDUARDO'),
  ('material', 'yo/' || :'OTRO'    || '/bbb-lo-suyo.pdf',    :'OTRO');
insert into storage.objects (bucket_id, name, owner)
  select 'material', 'ramo/' || pg_temp.un_ramo() || '/ccc-guia.pdf', :'EDUARDO';

-- ============================ como Eduardo ============================
set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';

select pg_temp.afirmar('ve su propio archivo',
  (select count(*) from storage.objects where name like 'yo/' || :'EDUARDO' || '/%')::int, 1);

select pg_temp.afirmar('no ve el archivo del otro',
  (select count(*) from storage.objects where name like 'yo/' || :'OTRO' || '/%')::int, 0);

select pg_temp.afirmar('ve el material del ramo en que está inscrito',
  (select count(*) from storage.objects where name like 'ramo/%')::int, 1);

-- Estar inscrito no alcanza para subir: si alcanzara, cualquier alumno podría
-- dejarle un archivo al curso entero.
do $$
declare paso boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name)
      values ('material', 'ramo/' || pg_temp.un_ramo() || '/ddd-mio.pdf');
  exception when insufficient_privilege then paso := true;
  end;
  perform pg_temp.afirmar('estando inscrito no puede subirle material al curso', paso, true);
end $$;

-- Ni escribir en la carpeta de otra persona.
do $$
declare paso boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name)
      values ('material', 'yo/e0000000-0000-4000-8000-000000000002/eee-colado.pdf');
  exception when insufficient_privilege then paso := true;
  end;
  perform pg_temp.afirmar('no puede escribir en la carpeta de otro', paso, true);
end $$;

-- En la suya sí.
insert into storage.objects (bucket_id, name)
  values ('material', 'yo/e0000000-0000-4000-8000-000000000001/fff-otro-apunte.pdf');
select pg_temp.afirmar('en la suya sí puede',
  (select count(*) from storage.objects where name like 'yo/' || :'EDUARDO' || '/%')::int, 2);

-- Una ruta que no calza con ninguna de las dos formas no deja pasar nada, y
-- —esto es lo que importa— no revienta la consulta con un error de tipo. El
-- archivo se mete de vuelta como superusuario: lo que se prueba es que nadie
-- lo vea, no que alguien pueda ponerlo.
reset role;
insert into storage.objects (bucket_id, name, owner)
  values ('material', 'cualquier/cosa/rara.pdf', null);
set role authenticated;

select pg_temp.afirmar('una ruta rara no se ve, y no tumba la consulta',
  (select count(*) from storage.objects where name like 'cualquier/%')::int, 0);

-- ======================= como el otro estudiante ======================
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';

select pg_temp.afirmar('el otro ve lo suyo y nada más',
  (select count(*) from storage.objects)::int, 1);
select pg_temp.afirmar('y no ve el material de un ramo en que no está',
  (select count(*) from storage.objects where name like 'ramo/%')::int, 0);

-- ─────────────────────── lo que se entrega en una tarea ───────────────────
--
-- Es el caso con dos lectores y no uno: quien la hizo y quien la corrige. Que
-- ninguno de los dos sobre, y que no haya un tercero.
reset role;

create or replace function pg_temp.una_tarea() returns uuid
  language sql stable security definer set search_path = public
  as $$ select id from public.tareas order by vence_en limit 1 $$;

-- Un docente que dicta el ramo de esa tarea. Se crea acá y no se busca en el
-- seed: una prueba que se salta cuando no encuentra a nadie no prueba nada, y
-- justo el caso que se saltaba era el que importa.
\set PROFE 'e0000000-0000-4000-8000-00000000000a'
insert into auth.users (id, email, raw_user_meta_data)
values (:'PROFE', 'profe@studia.cl', '{"nombre":"Quien Corrige"}'::jsonb);
update public.perfiles set rol = 'profesor' where id = :'PROFE';
insert into public.dictados (docente_id, asignatura_id, papel)
  select :'PROFE', t.asignatura_id, 'profesor'
  from public.tareas t where t.id = pg_temp.una_tarea();

insert into storage.objects (bucket_id, name, owner)
  select 'material', 'entrega/' || pg_temp.una_tarea() || '/ggg-mi-entrega.pdf', :'EDUARDO';

set role authenticated;
set pruebas.uid = 'e0000000-0000-4000-8000-000000000001';
select pg_temp.afirmar('quien la entregó la ve',
  (select count(*) from storage.objects where name like 'entrega/%')::int, 1);

-- El otro estudiante está en el mismo curso y no tiene por qué ver la entrega
-- de un compañero: lo que uno entrega no es material de clase.
set pruebas.uid = 'e0000000-0000-4000-8000-000000000002';
select pg_temp.afirmar('un compañero no la ve',
  (select count(*) from storage.objects where name like 'entrega/%')::int, 0);

set pruebas.uid = 'e0000000-0000-4000-8000-00000000000a';
select pg_temp.afirmar('quien corrige sí la ve',
  (select count(*) from storage.objects where name like 'entrega/%')::int, 1);

-- Leer sí; reescribir lo que entregó otro, no.
do $$
declare paso boolean := false;
begin
  begin
    delete from storage.objects where name like 'entrega/%';
    -- Sin política de borrado que lo permita, el delete no borra nada en vez
    -- de fallar: se comprueba que la fila siga ahí.
    paso := exists (select 1 from storage.objects where name like 'entrega/%');
  exception when insufficient_privilege then paso := true;
  end;
  perform pg_temp.afirmar('quien corrige no puede borrar la entrega', paso, true);
end $$;

reset role;
select '— también pasaron las pruebas del almacenamiento —' as resultado;
