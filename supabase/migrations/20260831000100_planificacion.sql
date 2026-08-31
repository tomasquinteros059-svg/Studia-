-- La planificación mensual de quien dicta.
--
-- Es el cuaderno del profesor: qué se pasa cada semana. No lo ve el curso —lo
-- que el curso ve es el material y las tareas, que son otra cosa— y por eso
-- vive con sus propias políticas y no cuelga del temario.
--
-- Una semana se identifica por su lunes y no por «semana 3 de septiembre»:
-- así dos meses nunca reclaman la misma semana, y mover un bloque de mes es
-- cambiar una fecha en vez de renumerar todo.

create table public.planificacion (
  id            uuid primary key default gen_random_uuid(),
  asignatura_id uuid not null references public.asignaturas (id) on delete cascade,
  -- Quién lo escribió. Un ramo puede tener profesor y ayudante, y conviene
  -- saber de quién es cada bloque cuando hay que preguntar.
  autor_id      uuid not null references public.perfiles (id) on delete cascade,
  -- El lunes de la semana. La aplicación siempre manda un lunes.
  semana        date not null,
  titulo        text not null check (length(trim(titulo)) between 1 and 160),
  detalle       text not null default '' check (length(detalle) <= 600),
  -- De qué unidad de la materia salió, si salió de una. Si la unidad se borra,
  -- el bloque no: lo planificado sigue siendo una decisión del profesor.
  modulo_id     uuid references public.modulos (id) on delete set null,
  orden         smallint not null default 1,
  creado_en     timestamptz not null default now()
);
create index on public.planificacion (asignatura_id, semana);

alter table public.planificacion enable row level security;

-- Quien dicta el ramo ve y escribe su planificación. El curso no la ve: no es
-- material, es el cuaderno de trabajo de quien hace la clase.
create policy "veo la planificación de mis ramos" on public.planificacion
  for select to authenticated using (public.dicta(asignatura_id));

create policy "planifico mis ramos" on public.planificacion
  for insert to authenticated with check (
    public.dicta(asignatura_id) and autor_id = auth.uid()
  );

create policy "edito la planificación de mis ramos" on public.planificacion
  for update to authenticated
  using (public.dicta(asignatura_id)) with check (public.dicta(asignatura_id));

create policy "borro la planificación de mis ramos" on public.planificacion
  for delete to authenticated using (public.dicta(asignatura_id));

grant select, insert, update, delete on public.planificacion to authenticated;
