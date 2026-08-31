-- StudIA · esquema base
-- Convención: nombres en español, igual que el resto del proyecto.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- personas
create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  correo      text not null,
  creado_en   timestamptz not null default now()
);
comment on table public.perfiles is
  'Un perfil por usuario autenticado. Hoy solo estudiantes; los docentes viven '
  'como texto en asignaturas (ver documentacion/arquitectura.md, simplificaciones).';

-- ----------------------------------------------------------- asignaturas
create table public.asignaturas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nombre        text not null,
  profesor      text not null,
  ayudante      text,
  color         text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  creditos      smallint not null check (creditos > 0),
  descripcion   text,
  requisitos    text,
  bibliografia  text[] not null default '{}',
  -- Pregunta con la que el tutor abre la conversación en este ramo.
  intro_tutor   text not null,
  creado_en     timestamptz not null default now()
);

create table public.inscripciones (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  creado_en      timestamptz not null default now(),
  unique (estudiante_id, asignatura_id)
);
create index on public.inscripciones (estudiante_id);

-- --------------------------------------------------------------- horario
create table public.bloques_horario (
  id             uuid primary key default gen_random_uuid(),
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  dia            smallint not null check (dia between 1 and 7),   -- 1 = lunes
  hora_inicio    time not null,
  hora_fin       time not null,
  sala           text not null,
  tipo           text not null default 'Cátedra',
  check (hora_fin > hora_inicio)
);
create index on public.bloques_horario (asignatura_id, dia);

-- --------------------------------------------------------------- materia
create table public.modulos (
  id             uuid primary key default gen_random_uuid(),
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  titulo         text not null,
  orden          smallint not null,
  unique (asignatura_id, orden)
);

create table public.materiales (
  id         uuid primary key default gen_random_uuid(),
  modulo_id  uuid not null references public.modulos (id) on delete cascade,
  tipo       text not null check (tipo in ('video', 'documento', 'ejercicios')),
  titulo     text not null,
  detalle    text not null,
  url        text,
  orden      smallint not null,
  unique (modulo_id, orden)
);

create table public.progreso_material (
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  material_id    uuid not null references public.materiales (id) on delete cascade,
  completado_en  timestamptz not null default now(),
  primary key (estudiante_id, material_id)
);

-- --------------------------------------------------------------- clases
create table public.clases (
  id             uuid primary key default gen_random_uuid(),
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  titulo         text not null,
  estado         text not null check (estado in ('programada', 'en_vivo', 'grabada')),
  inicia_en      timestamptz not null,
  termina_en     timestamptz,
  duracion_seg   integer check (duracion_seg > 0),
  audio_url      text,
  -- Una clase grabada necesita duración; una en vivo todavía no la tiene.
  check (estado <> 'grabada' or duracion_seg is not null)
);
create index on public.clases (asignatura_id, inicia_en desc);

create table public.capitulos_clase (
  id       uuid primary key default gen_random_uuid(),
  clase_id uuid not null references public.clases (id) on delete cascade,
  titulo   text not null,
  segundo  integer not null check (segundo >= 0),
  orden    smallint not null,
  unique (clase_id, orden)
);

-- --------------------------------------------------------------- tareas
create table public.tareas (
  id             uuid primary key default gen_random_uuid(),
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  titulo         text not null,
  enunciado      text not null,
  criterios      text[] not null default '{}',
  puntos         smallint not null check (puntos > 0),
  vence_en       timestamptz not null,
  creado_en      timestamptz not null default now()
);
create index on public.tareas (asignatura_id, vence_en);

create table public.entregas (
  id               uuid primary key default gen_random_uuid(),
  tarea_id         uuid not null references public.tareas (id) on delete cascade,
  estudiante_id    uuid not null references public.perfiles (id) on delete cascade,
  entregado_en     timestamptz not null default now(),
  archivo_url      text,
  puntos_obtenidos numeric(5, 2) check (puntos_obtenidos >= 0),
  unique (tarea_id, estudiante_id)
);

-- ------------------------------------------------------ notas (1,0 a 7,0)
create table public.evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  titulo         text not null,
  peso           numeric(5, 2) not null check (peso > 0 and peso <= 100),
  orden          smallint not null,
  unique (asignatura_id, orden)
);

create table public.notas (
  id             uuid primary key default gen_random_uuid(),
  evaluacion_id  uuid not null references public.evaluaciones (id) on delete cascade,
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  nota           numeric(2, 1) not null check (nota >= 1.0 and nota <= 7.0),
  -- Mientras sea null, la nota existe pero el estudiante no la ve (ver RLS).
  publicada_en   timestamptz,
  unique (evaluacion_id, estudiante_id)
);

-- La suma de pesos de una asignatura no puede pasar de 100.
create or replace function public.pesos_suman_hasta_cien()
returns trigger
language plpgsql
as $$
declare
  total numeric;
begin
  select coalesce(sum(peso), 0) into total
    from public.evaluaciones
   where asignatura_id = new.asignatura_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if total + new.peso > 100 then
    raise exception
      'Los pesos de la asignatura suman % y no pueden pasar de 100', total + new.peso;
  end if;
  return new;
end;
$$;

create trigger evaluaciones_pesos
  before insert or update of peso, asignatura_id on public.evaluaciones
  for each row execute function public.pesos_suman_hasta_cien();

-- ----------------------------------------------------------------- foro
create table public.hilos (
  id             uuid primary key default gen_random_uuid(),
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- Null cuando el autor es docente: todavía no tienen cuenta (ver simplificaciones).
  autor_id       uuid references public.perfiles (id) on delete set null,
  autor_nombre   text not null,
  autor_rol      text not null check (autor_rol in ('Estudiante', 'Profesor', 'Profesora', 'Ayudante')),
  titulo         text not null,
  cuerpo         text not null,
  fijado         boolean not null default false,
  creado_en      timestamptz not null default now()
);
create index on public.hilos (asignatura_id, fijado desc, creado_en desc);

create table public.respuestas (
  id            uuid primary key default gen_random_uuid(),
  hilo_id       uuid not null references public.hilos (id) on delete cascade,
  autor_id      uuid references public.perfiles (id) on delete set null,
  autor_nombre  text not null,
  autor_rol     text not null check (autor_rol in ('Estudiante', 'Profesor', 'Profesora', 'Ayudante')),
  cuerpo        text not null,
  creado_en     timestamptz not null default now()
);
create index on public.respuestas (hilo_id, creado_en);

-- ---------------------------------------------------------------- tutor
create table public.conversaciones (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- De dónde venía el estudiante: "Estoy con «Guía 4 · Optimización»".
  contexto       text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.conversaciones (estudiante_id, actualizado_en desc);

create table public.mensajes (
  id               uuid primary key default gen_random_uuid(),
  conversacion_id  uuid not null references public.conversaciones (id) on delete cascade,
  rol              text not null check (rol in ('estudiante', 'tutor')),
  contenido        text not null,
  creado_en        timestamptz not null default now()
);
create index on public.mensajes (conversacion_id, creado_en);

-- -------------------------------------------------------- notificaciones
create table public.notificaciones (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  tipo           text not null check (tipo in ('clase', 'anuncio', 'tarea', 'nota')),
  titulo         text not null,
  detalle        text not null,
  asignatura_id  uuid references public.asignaturas (id) on delete cascade,
  -- A dónde lleva al tocarla.
  ref_tipo       text check (ref_tipo in ('clase', 'hilo', 'tarea', 'notas')),
  ref_id         uuid,
  leida          boolean not null default false,
  creado_en      timestamptz not null default now()
);
create index on public.notificaciones (estudiante_id, creado_en desc);
create index on public.notificaciones (estudiante_id) where not leida;

-- Crear el perfil al registrarse, sin que el cliente tenga que acordarse.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, correo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();
