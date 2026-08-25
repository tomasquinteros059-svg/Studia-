-- Apuntes del estudiante y transcripción de la clase.
--
-- El resumen de fin de clase cruza lo que el estudiante escribió con lo que se
-- dijo en la sala. Hoy solo existe lo primero; la tabla de transcripciones
-- queda lista para cuando el transporte de audio la produzca.

create table public.apuntes (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- Un apunte puede colgar de una clase concreta o ser suelto.
  clase_id       uuid references public.clases (id) on delete set null,
  titulo         text not null default 'Apuntes de clase',
  contenido      text not null default '',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.apuntes (estudiante_id, actualizado_en desc);
create index on public.apuntes (clase_id);

create table public.transcripciones (
  id          uuid primary key default gen_random_uuid(),
  clase_id    uuid not null references public.clases (id) on delete cascade,
  -- Segundo de la clase en que se dijo, para poder alinear con los apuntes.
  segundo     integer not null check (segundo >= 0),
  texto       text not null,
  creado_en   timestamptz not null default now()
);
create index on public.transcripciones (clase_id, segundo);

create table public.resumenes (
  id            uuid primary key default gen_random_uuid(),
  apunte_id     uuid not null references public.apuntes (id) on delete cascade,
  cuerpo        text not null,
  -- Lo que la materia cubre y el apunte no menciona.
  vacios        text[] not null default '{}',
  consejos      text[] not null default '{}',
  creado_en     timestamptz not null default now(),
  unique (apunte_id)
);

create or replace function public.tocar_apunte()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

create trigger apuntes_actualizados
  before update on public.apuntes
  for each row execute function public.tocar_apunte();

alter table public.apuntes         enable row level security;
alter table public.transcripciones enable row level security;
alter table public.resumenes       enable row level security;

create policy "veo mis apuntes" on public.apuntes
  for select to authenticated using (estudiante_id = auth.uid());
create policy "escribo mis apuntes" on public.apuntes
  for insert to authenticated with check (
    estudiante_id = auth.uid() and public.esta_inscrito(asignatura_id)
  );
create policy "edito mis apuntes" on public.apuntes
  for update to authenticated
  using (estudiante_id = auth.uid()) with check (estudiante_id = auth.uid());
create policy "borro mis apuntes" on public.apuntes
  for delete to authenticated using (estudiante_id = auth.uid());

-- La transcripción es de la clase, no de nadie: la ve quien está en el ramo.
create policy "leo la transcripción de mis clases" on public.transcripciones
  for select to authenticated using (
    exists (select 1 from public.clases c
             where c.id = clase_id and public.esta_inscrito(c.asignatura_id))
  );

create policy "veo los resúmenes de mis apuntes" on public.resumenes
  for select to authenticated using (
    exists (select 1 from public.apuntes a
             where a.id = apunte_id and a.estudiante_id = auth.uid())
  );

-- El resumen lo escribe la función `resumen` con la clave de servicio: es
-- texto generado por Claude y el estudiante no debe poder fabricarlo.

grant select, insert, update, delete on public.apuntes to authenticated;
grant select on public.transcripciones to authenticated;
grant select on public.resumenes to authenticated;
