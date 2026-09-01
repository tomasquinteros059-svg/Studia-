-- Dónde se guardan los archivos, y quién puede abrirlos.
--
-- Hasta acá se podía elegir un archivo y no había dónde ponerlo: el material
-- de un ramo solo podía ser texto pegado a mano. Esto es el bucket y, sobre
-- todo, sus permisos.
--
-- El bucket es privado. Eso importa más de lo que parece: uno público entrega
-- cualquier archivo a quien tenga la dirección, y las direcciones se filtran
-- solas —se pegan en un chat, quedan en el historial—. Acá la aplicación pide
-- una dirección firmada cada vez que abre algo, y esa dirección vence.
--
-- Quién puede qué lo decide la ruta, con dos formas y nada más:
--
--   yo/<persona>/<archivo>       lo suyo. No lo ve nadie más, ni quien dicta.
--   ramo/<asignatura>/<archivo>  material del curso. Lo ve quien está inscrito
--                                o lo dicta; lo sube quien lo dicta, o el
--                                dueño si es un ramo propio.
--
-- La ruta la arma `dominio/almacen.ts`, con sus pruebas. Las dos puntas tienen
-- que estar de acuerdo: si el teléfono arma una ruta que estas políticas no
-- reconocen, la subida se rechaza sin explicación.

insert into storage.buckets (id, name, public, file_size_limit)
values ('material', 'material', false, 20971520)   -- 20 MB, lo mismo que revisa la app
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- ── Leer la ruta sin que un nombre raro reviente la política ──────────────

-- Una ruta que no calza con ninguna de las dos formas devuelve nulo, y con
-- nulo ninguna política deja pasar nada. Sin esta función habría que hacer el
-- cast a uuid dentro de la política, y una ruta con basura en el segundo
-- tramo tumbaría la consulta entera en vez de negar el acceso.
create or replace function public.dueno_de_la_ruta(p_ruta text, p_clase text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(p_ruta))[1] = p_clase
     and (storage.foldername(p_ruta))[2] ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((storage.foldername(p_ruta))[2])::uuid
  end
$$;

comment on function public.dueno_de_la_ruta(text, text) is
  'De «yo/<uuid>/x» o «ramo/<uuid>/x» saca el uuid. Nulo si la ruta no calza, '
  'y con nulo ninguna política deja pasar.';

-- ── Lo propio ─────────────────────────────────────────────────────────────

create policy "lo mío lo veo yo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material'
    and public.dueno_de_la_ruta(name, 'yo') = auth.uid()
  );

create policy "en mi carpeta subo yo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'material'
    and public.dueno_de_la_ruta(name, 'yo') = auth.uid()
  );

create policy "lo mío lo borro yo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'material'
    and public.dueno_de_la_ruta(name, 'yo') = auth.uid()
  );

-- ── El material de un ramo ────────────────────────────────────────────────

create policy "el material del ramo lo ve el curso" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material'
    and public.dueno_de_la_ruta(name, 'ramo') is not null
    and (
      public.esta_inscrito(public.dueno_de_la_ruta(name, 'ramo'))
      or public.dicta(public.dueno_de_la_ruta(name, 'ramo'))
      or public.es_mi_ramo(public.dueno_de_la_ruta(name, 'ramo'))
    )
  );

-- Estar inscrito no alcanza para subir: si alcanzara, cualquier alumno podría
-- dejarle un archivo al curso entero con el nombre que quisiera.
create policy "el material del ramo lo sube quien lo dicta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'material'
    and public.dueno_de_la_ruta(name, 'ramo') is not null
    and (
      public.dicta(public.dueno_de_la_ruta(name, 'ramo'))
      or public.es_mi_ramo(public.dueno_de_la_ruta(name, 'ramo'))
    )
  );

create policy "el material del ramo lo borra quien lo dicta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'material'
    and public.dueno_de_la_ruta(name, 'ramo') is not null
    and (
      public.dicta(public.dueno_de_la_ruta(name, 'ramo'))
      or public.es_mi_ramo(public.dueno_de_la_ruta(name, 'ramo'))
    )
  );
