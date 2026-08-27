-- Reuniones profesionales
--
-- Lo que la aplicación guarda de una reunión y quién puede verlo.
--
-- La regla de fondo es más estricta que en el resto del sistema: una reunión
-- es privada de quien la grabó, salvo que él invite explícitamente a alguien.
-- No hay jefatura que vea las reuniones de su equipo, ni administración que
-- vea las de todos. Lo que se dice en una reunión de directorio, en una
-- asamblea o en una reunión clínica no es material de gestión: es de quienes
-- estaban ahí. Si algún día hace falta un espacio de organización, se agrega
-- como tal y se ve; abrirlo de a poco por conveniencia es como se pierden
-- estas cosas.

create type public.rubro as enum ('legal', 'edificios', 'salud', 'obras', 'gerencia');

create type public.estado_reunion as enum (
  'borrador',    -- creada, todavía sin transcripción
  'grabando',
  'analizando',  -- el equipo de tres está trabajando
  'listo',
  'falló'
);

create table public.reuniones (
  id                    uuid primary key default gen_random_uuid(),
  dueno_id              uuid not null references public.perfiles (id) on delete cascade,
  titulo                text not null check (length(btrim(titulo)) > 0),
  rubro                 public.rubro not null,
  estado                public.estado_reunion not null default 'borrador',
  ocurrio_en            timestamptz not null default now(),
  duracion_seg          integer check (duracion_seg is null or duracion_seg >= 0),
  -- Quiénes participaron y qué se iba a tratar. Los dos son opcionales: se
  -- graba una reunión que ya empezó y no se alcanzó a llenar nada.
  participantes         text[] not null default '{}',
  tabla                 text[] not null default '{}',
  -- Lo que se escuchó, tal como llegó, y lo que dejó quien escucha.
  transcripcion         text,
  transcripcion_limpia  text,
  -- El documento que armó quien redacta.
  documento             text,
  analizada_en          timestamptz,
  creado_en             timestamptz not null default now()
);

create index reuniones_por_dueno on public.reuniones (dueno_id, ocurrio_en desc);

-- A quién invitó el dueño. Sin una fila acá, nadie más ve la reunión.
create table public.invitados_reunion (
  id           uuid primary key default gen_random_uuid(),
  reunion_id   uuid not null references public.reuniones (id) on delete cascade,
  persona_id   uuid not null references public.perfiles (id) on delete cascade,
  -- Quien lee ve el documento; quien edita puede además marcar tareas.
  puede_editar boolean not null default false,
  creado_en    timestamptz not null default now(),
  unique (reunion_id, persona_id)
);

create index invitados_por_persona on public.invitados_reunion (persona_id);

-- Lo que sacó quien entiende. Uno por reunión: se rehace al reanalizar.
create table public.analisis (
  reunion_id       uuid primary key references public.reuniones (id) on delete cascade,
  resumen          text not null default '',
  acuerdos         jsonb not null default '[]'::jsonb,
  pendientes       jsonb not null default '[]'::jsonb,
  sin_tratar       text[] not null default '{}',
  aportes          text[] not null default '{}',
  contradicciones  text[] not null default '{}',
  creado_en        timestamptz not null default now()
);

-- Las tareas viven en su propia tabla y no dentro del análisis, porque se
-- marcan como hechas: son lo único de la reunión que sigue cambiando después.
create table public.tareas_reunion (
  id           uuid primary key default gen_random_uuid(),
  reunion_id   uuid not null references public.reuniones (id) on delete cascade,
  que          text not null check (length(btrim(que)) > 0),
  responsable  text,
  plazo        date,
  prioridad    text not null default 'normal' check (prioridad in ('alta', 'normal')),
  acuerdo      integer,
  lista        boolean not null default false,
  lista_en     timestamptz,
  creado_en    timestamptz not null default now()
);

create index tareas_por_reunion on public.tareas_reunion (reunion_id);
create index tareas_por_plazo on public.tareas_reunion (plazo) where lista = false;

-- Cuántos análisis pidió cada uno. Solo la marca de tiempo: qué se dijo en la
-- reunión no tiene nada que hacer en una tabla de contadores.
create table public.usos_equipo (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.perfiles (id) on delete cascade,
  creado_en   timestamptz not null default now()
);

create index usos_equipo_por_persona on public.usos_equipo (persona_id, creado_en desc);

-- ============================== permisos ==============================

alter table public.reuniones         enable row level security;
alter table public.invitados_reunion enable row level security;
alter table public.analisis          enable row level security;
alter table public.tareas_reunion    enable row level security;
alter table public.usos_equipo       enable row level security;

-- Sin esto, la política de `reuniones` consulta `invitados_reunion`, cuya
-- política consulta `reuniones`, y Postgres se queda dando vueltas.
create or replace function public.me_invitaron(p_reunion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invitados_reunion i
     where i.reunion_id = p_reunion and i.persona_id = auth.uid()
  );
$$;

create or replace function public.alcanzo_la_reunion(p_reunion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reuniones r
     where r.id = p_reunion and r.dueno_id = auth.uid()
  ) or public.me_invitaron(p_reunion);
$$;

create or replace function public.puedo_escribir_la_reunion(p_reunion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reuniones r
     where r.id = p_reunion and r.dueno_id = auth.uid()
  ) or exists (
    select 1 from public.invitados_reunion i
     where i.reunion_id = p_reunion and i.persona_id = auth.uid()
       and i.puede_editar
  );
$$;

revoke execute on function public.me_invitaron(uuid) from public;
grant  execute on function public.me_invitaron(uuid) to authenticated;
revoke execute on function public.alcanzo_la_reunion(uuid) from public;
revoke execute on function public.puedo_escribir_la_reunion(uuid) from public;
grant  execute on function public.alcanzo_la_reunion(uuid) to authenticated;
grant  execute on function public.puedo_escribir_la_reunion(uuid) to authenticated;

-- El `grant select on all tables` de la migración de permisos ya pasó: estas
-- tablas nacen después y hay que darles lo suyo. Lo que no aparece acá, no se
-- puede hacer desde el cliente, y eso es a propósito: `analisis` solo se lee
-- porque lo escribe la función, y `usos_equipo` ni se lee.
grant select, insert, update, delete on public.reuniones         to authenticated;
grant select, insert, update, delete on public.invitados_reunion to authenticated;
grant select                         on public.analisis          to authenticated;
grant select, insert, update, delete on public.tareas_reunion    to authenticated;

-- ------------------------------------------------------------ reuniones
-- Mirar la columna y no volver a consultar la tabla no es una optimización:
-- es lo único que funciona. Un `insert ... returning` comprueba la política
-- de lectura sobre la fila nueva, y una política que reconsulta `reuniones`
-- no la encuentra todavía —la ve con una instantánea anterior a su propia
-- inserción— así que grabar una reunión fallaba con un error que hablaba de
-- permisos cuando el problema era el momento.
create policy "veo mis reuniones" on public.reuniones
  for select to authenticated using (dueno_id = auth.uid());

create policy "veo las que me compartieron" on public.reuniones
  for select to authenticated using (public.me_invitaron(id));

-- Grabar una reunión a nombre de otro sería poder poner palabras en su boca.
create policy "grabo reuniones a mi nombre" on public.reuniones
  for insert to authenticated with check (dueno_id = auth.uid());

create policy "edito mis reuniones" on public.reuniones
  for update to authenticated
  using (dueno_id = auth.uid()) with check (dueno_id = auth.uid());

create policy "borro mis reuniones" on public.reuniones
  for delete to authenticated using (dueno_id = auth.uid());

-- ------------------------------------------------------------ invitados
-- Invitar es del dueño y de nadie más: un invitado con permiso de edición
-- puede marcar tareas, no repartir el acceso.
-- Por lo mismo de arriba: la fila propia se reconoce por su columna.
create policy "veo mis invitaciones" on public.invitados_reunion
  for select to authenticated using (persona_id = auth.uid());

create policy "veo con quién compartí mis reuniones" on public.invitados_reunion
  for select to authenticated using (
    exists (select 1 from public.reuniones r
             where r.id = reunion_id and r.dueno_id = auth.uid())
  );

create policy "invito a mis reuniones" on public.invitados_reunion
  for insert to authenticated with check (
    exists (select 1 from public.reuniones r
             where r.id = reunion_id and r.dueno_id = auth.uid())
  );

-- Pasar a alguien de solo lectura a poder marcar tareas, y de vuelta.
create policy "cambio el permiso de mis invitados" on public.invitados_reunion
  for update to authenticated
  using (
    exists (select 1 from public.reuniones r
             where r.id = reunion_id and r.dueno_id = auth.uid())
  )
  with check (
    exists (select 1 from public.reuniones r
             where r.id = reunion_id and r.dueno_id = auth.uid())
  );

create policy "saco invitados de mis reuniones" on public.invitados_reunion
  for delete to authenticated using (
    exists (select 1 from public.reuniones r
             where r.id = reunion_id and r.dueno_id = auth.uid())
    -- Cualquiera puede irse de una reunión ajena; eso no es repartir acceso.
    or persona_id = auth.uid()
  );

-- ------------------------------------------------------------- análisis
-- Lo escribe la función con la clave de servicio, no el cliente: si la app
-- pudiera escribirlo, el análisis dejaría de ser lo que dijo el equipo.
create policy "leo el análisis de las reuniones que alcanzo" on public.analisis
  for select to authenticated using (public.alcanzo_la_reunion(reunion_id));

-- --------------------------------------------------------------- tareas
create policy "leo las tareas de las reuniones que alcanzo" on public.tareas_reunion
  for select to authenticated using (public.alcanzo_la_reunion(reunion_id));

-- Agregar una tarea a mano: la reunión dejó algo fuera y se anota.
create policy "agrego tareas donde puedo escribir" on public.tareas_reunion
  for insert to authenticated with check (public.puedo_escribir_la_reunion(reunion_id));

create policy "marco y edito tareas donde puedo escribir" on public.tareas_reunion
  for update to authenticated
  using (public.puedo_escribir_la_reunion(reunion_id))
  with check (public.puedo_escribir_la_reunion(reunion_id));

create policy "borro tareas donde puedo escribir" on public.tareas_reunion
  for delete to authenticated using (public.puedo_escribir_la_reunion(reunion_id));

-- `usos_equipo` queda sin políticas a propósito: es del servidor. Con RLS
-- encendida y ninguna política, el cliente no lee ni escribe nada.

-- Marcar una tarea deja la hora sola. Si la app la mandara, dos aparatos con
-- el reloj corrido darían dos horas distintas para el mismo hecho.
create or replace function public.sellar_tarea_lista()
returns trigger
language plpgsql
as $$
begin
  if new.lista and not old.lista then
    new.lista_en := now();
  elsif not new.lista then
    new.lista_en := null;
  end if;
  return new;
end;
$$;

create trigger tarea_lista_se_sella
  before update on public.tareas_reunion
  for each row execute function public.sellar_tarea_lista();
