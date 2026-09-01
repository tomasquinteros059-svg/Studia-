-- Quién puede abrir lo que un alumno entrega.
--
-- Una entrega no puede vivir en el espacio propio del alumno, que es donde
-- estaba: ahí solo la ve él, y una entrega existe justamente para que la lea
-- quien corrige. Tampoco puede vivir en la carpeta del ramo, porque entonces
-- la vería el curso entero: lo que uno entrega no es material de clase.
--
-- Así que tiene su propia forma de ruta:
--
--   entrega/<tarea>/<archivo>
--
-- y la pueden abrir dos personas y nadie más: quien la subió —Supabase deja
-- su identificador en `owner`— y quien dicta el ramo de esa tarea.

-- De la ruta al ramo, en un paso.
--
-- Es SECURITY DEFINER porque tiene que leer `tareas` sin quedar sujeta a las
-- políticas de esa tabla: una política que consulta otra tabla con RLS puede
-- devolver vacío por un motivo distinto del que se está preguntando, y ahí el
-- permiso se niega sin que nada explique por qué.
create or replace function public.ramo_de_la_entrega(p_ruta text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.asignatura_id
  from public.tareas t
  where t.id = public.dueno_de_la_ruta(p_ruta, 'entrega')
$$;

comment on function public.ramo_de_la_entrega(text) is
  'De «entrega/<tarea>/x» saca el ramo de esa tarea. Nulo si la ruta no calza.';

-- Se sube solo a una tarea de un ramo en el que se está inscrito. Sin esto,
-- cualquiera con sesión podría dejar un archivo colgando de cualquier tarea.
create policy "entrego en las tareas de mis ramos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'material'
    and public.esta_inscrito(public.ramo_de_la_entrega(name))
  );

create policy "mi entrega la vemos yo y quien corrige" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material'
    and public.ramo_de_la_entrega(name) is not null
    and (
      owner = auth.uid()
      or public.dicta(public.ramo_de_la_entrega(name))
    )
  );

-- Reemplazar lo entregado es del alumno: quien corrige lee, no reescribe.
create policy "lo que entregué lo cambio yo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'material'
    and public.ramo_de_la_entrega(name) is not null
    and owner = auth.uid()
  );
