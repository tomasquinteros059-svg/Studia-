-- Las sesiones de estudio: lo que cada quien se propone hacer, y cuándo.
--
-- Es la mitad del planificador que no existía. La otra mitad ya estaba: los
-- bloques del horario los pone la institución y las tareas tienen su fecha de
-- entrega. Lo que faltaba era lo propio —«el martes a las 17:00, una hora de
-- la guía 5»— que no es de nadie más y por eso vive en su propia tabla con
-- sus propias políticas.
--
-- Una sesión puede colgar de un ramo o no colgar de ninguno: alguien que
-- estudia por su cuenta se pone «leer el capítulo 4» sin que eso sea de una
-- asignatura cargada. Por eso `asignatura_id` acepta nulo.

create table public.sesiones_estudio (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  -- Si el ramo se borra, la sesión no: lo que la persona se propuso hacer
  -- sigue siendo suyo aunque el ramo desaparezca del catálogo.
  asignatura_id  uuid references public.asignaturas (id) on delete set null,
  titulo         text not null check (length(trim(titulo)) between 1 and 120),
  -- Cuándo empieza, con fecha y hora: una sesión es de un día concreto, no
  -- de «los martes». Repetir algo todas las semanas es otra cosa, y todavía
  -- no hace falta.
  empieza_en     timestamptz not null,
  -- En minutos, que es como lo piensa quien estudia. Media hora es el bloque
  -- más corto que tiene sentido y ocho horas el más largo que es honesto.
  minutos        integer not null default 45 check (minutos between 5 and 480),
  hecha_en       timestamptz,
  creado_en      timestamptz not null default now()
);

-- Todas las consultas son «lo mío de esta semana», en ese orden.
create index on public.sesiones_estudio (estudiante_id, empieza_en);

alter table public.sesiones_estudio enable row level security;

-- Sin excepciones para nadie: una sesión de estudio es de quien la escribió.
-- Ni la administración ni quien dicta el ramo tienen por qué ver a qué hora
-- alguien pensaba ponerse a estudiar.
create policy "veo mis sesiones" on public.sesiones_estudio
  for select to authenticated using (estudiante_id = auth.uid());
create policy "escribo mis sesiones" on public.sesiones_estudio
  for insert to authenticated with check (estudiante_id = auth.uid());
create policy "edito mis sesiones" on public.sesiones_estudio
  for update to authenticated
  using (estudiante_id = auth.uid()) with check (estudiante_id = auth.uid());
create policy "borro mis sesiones" on public.sesiones_estudio
  for delete to authenticated using (estudiante_id = auth.uid());

grant select, insert, update, delete on public.sesiones_estudio to authenticated;
