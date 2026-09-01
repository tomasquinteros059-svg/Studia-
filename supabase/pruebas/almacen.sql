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

reset role;
select '— también pasaron las pruebas del almacenamiento —' as resultado;
