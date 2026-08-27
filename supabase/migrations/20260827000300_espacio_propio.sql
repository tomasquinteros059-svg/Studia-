-- StudIA para quien llega por su cuenta
--
-- Hasta acá todo colgaba del colegio: una asignatura la creaba la
-- administración, y un alumno solo podía estar inscrito en lo que otro cargó.
-- Eso deja fuera a la mitad del público: alguien que se baja la app para
-- estudiar por su cuenta y subir su propio material.
--
-- La solución no es un segundo sistema. Es una columna: una asignatura puede
-- tener dueño. Si lo tiene, es el espacio personal de esa persona y ella
-- manda ahí adentro; si no, es del colegio y manda la administración. Todo lo
-- demás —el lector, los apuntes, el tutor, las tareas— funciona igual sin
-- enterarse de la diferencia.

alter table public.asignaturas
  add column creador_id uuid references public.perfiles (id) on delete cascade;

create index asignaturas_propias on public.asignaturas (creador_id)
  where creador_id is not null;

comment on column public.asignaturas.creador_id is
  'Quién es dueño de este ramo. Null = lo cargó la institución.';

-- Un ramo del colegio no puede quedar sin profesor a nombre de nadie, pero
-- uno propio tampoco necesita uno: se deja explícito.
alter table public.asignaturas
  alter column profesor set default 'Por tu cuenta';

create or replace function public.es_mi_ramo(p_asignatura uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.asignaturas
     where id = p_asignatura and creador_id = auth.uid()
  );
$$;

revoke execute on function public.es_mi_ramo(uuid) from public;
grant  execute on function public.es_mi_ramo(uuid) to authenticated;

-- ------------------------------------------------------- lo que ve el dueño
create policy "veo los ramos que creé" on public.asignaturas
  for select to authenticated using (creador_id = auth.uid());

-- Crear uno propio. La condición es que quede a nombre propio: sin esto,
-- cualquiera podría crear un ramo del colegio y colgarle material.
create policy "creo mis propios ramos" on public.asignaturas
  for insert to authenticated with check (creador_id = auth.uid());

create policy "edito y borro los ramos que creé" on public.asignaturas
  for update to authenticated
  using (creador_id = auth.uid()) with check (creador_id = auth.uid());

create policy "borro los ramos que creé" on public.asignaturas
  for delete to authenticated using (creador_id = auth.uid());

-- Inscribirse en lo propio. En un ramo del colegio sigue inscribiendo la
-- administración: nadie se mete solo a un curso ajeno.
create policy "me inscribo en mis propios ramos" on public.inscripciones
  for insert to authenticated with check (
    estudiante_id = auth.uid() and public.es_mi_ramo(asignatura_id)
  );

create policy "me salgo de mis propios ramos" on public.inscripciones
  for delete to authenticated using (
    estudiante_id = auth.uid() and public.es_mi_ramo(asignatura_id)
  );

-- ---------------------------------------------------- lo que escribe el dueño
-- Su material y sus lecturas: es lo que hace útil el espacio propio.
create policy "armo los módulos de mis ramos" on public.modulos
  for all to authenticated
  using (public.es_mi_ramo(asignatura_id)) with check (public.es_mi_ramo(asignatura_id));

create policy "cargo material en mis ramos" on public.materiales
  for all to authenticated
  using (
    exists (select 1 from public.modulos m
             where m.id = modulo_id and public.es_mi_ramo(m.asignatura_id))
  )
  with check (
    exists (select 1 from public.modulos m
             where m.id = modulo_id and public.es_mi_ramo(m.asignatura_id))
  );

-- Su horario y sus plazos, si quiere ponérselos.
create policy "armo el horario de mis ramos" on public.bloques_horario
  for all to authenticated
  using (public.es_mi_ramo(asignatura_id)) with check (public.es_mi_ramo(asignatura_id));

create policy "me pongo tareas en mis ramos" on public.tareas
  for all to authenticated
  using (public.es_mi_ramo(asignatura_id)) with check (public.es_mi_ramo(asignatura_id));

-- Ojo con lo que NO se abre acá. Un espacio propio no lleva evaluaciones ni
-- notas: ponerse uno mismo un 6,5 no significa nada, y abrir esa tabla sería
-- una puerta más que vigilar a cambio de nada.
