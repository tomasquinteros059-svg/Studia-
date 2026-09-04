-- StudIA · todas las migraciones, en orden, para pegar de una vez.
--
-- Generado por herramientas/juntar-migraciones.mjs. No lo edites a mano:
-- lo que vale son los archivos de supabase/migrations, y este se rehace.
--
-- 34 migraciones, de 20260825000100 a 20260904000100.
--
-- Supabase corre todo esto junto: si una línea falla, deshace el resto y
-- no queda nada a medias.


-- ───────────────────────────────────────────────────────────────────
-- 20260825000100 · esquema
-- ───────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────
-- 20260825000200 · rls
-- ───────────────────────────────────────────────────────────────────

-- StudIA · seguridad a nivel de fila
--
-- Regla de fondo: un estudiante ve el contenido de las asignaturas en las que
-- está inscrito, y sus propios datos. Nunca los de otro.

-- ¿El usuario actual está inscrito en esta asignatura?
-- SECURITY DEFINER a propósito: así no vuelve a pasar por las políticas de
-- inscripciones y no se produce recursión.
create or replace function public.esta_inscrito(p_asignatura uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.inscripciones
     where asignatura_id = p_asignatura
       and estudiante_id = auth.uid()
  );
$$;

revoke execute on function public.esta_inscrito(uuid) from public;
grant  execute on function public.esta_inscrito(uuid) to authenticated;

alter table public.perfiles           enable row level security;
alter table public.asignaturas        enable row level security;
alter table public.inscripciones      enable row level security;
alter table public.bloques_horario    enable row level security;
alter table public.modulos            enable row level security;
alter table public.materiales         enable row level security;
alter table public.progreso_material  enable row level security;
alter table public.clases             enable row level security;
alter table public.capitulos_clase    enable row level security;
alter table public.tareas             enable row level security;
alter table public.entregas           enable row level security;
alter table public.evaluaciones       enable row level security;
alter table public.notas              enable row level security;
alter table public.hilos              enable row level security;
alter table public.respuestas         enable row level security;
alter table public.conversaciones     enable row level security;
alter table public.mensajes           enable row level security;
alter table public.notificaciones     enable row level security;

-- --------------------------------------------------------------- perfil
create policy "cada quien ve su perfil" on public.perfiles
  for select to authenticated using (id = auth.uid());
create policy "cada quien edita su perfil" on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- --------------------------------------------------------- inscripciones
create policy "veo mis inscripciones" on public.inscripciones
  for select to authenticated using (estudiante_id = auth.uid());

-- ------------------------------------------- contenido de la asignatura
create policy "veo las asignaturas en que estoy" on public.asignaturas
  for select to authenticated using (public.esta_inscrito(id));

create policy "veo el horario de mis asignaturas" on public.bloques_horario
  for select to authenticated using (public.esta_inscrito(asignatura_id));

create policy "veo los módulos de mis asignaturas" on public.modulos
  for select to authenticated using (public.esta_inscrito(asignatura_id));

create policy "veo el material de mis asignaturas" on public.materiales
  for select to authenticated using (
    exists (select 1 from public.modulos m
             where m.id = modulo_id and public.esta_inscrito(m.asignatura_id))
  );

create policy "veo las clases de mis asignaturas" on public.clases
  for select to authenticated using (public.esta_inscrito(asignatura_id));

create policy "veo los capítulos de esas clases" on public.capitulos_clase
  for select to authenticated using (
    exists (select 1 from public.clases c
             where c.id = clase_id and public.esta_inscrito(c.asignatura_id))
  );

create policy "veo las tareas de mis asignaturas" on public.tareas
  for select to authenticated using (public.esta_inscrito(asignatura_id));

create policy "veo las evaluaciones de mis asignaturas" on public.evaluaciones
  for select to authenticated using (public.esta_inscrito(asignatura_id));

-- ----------------------------------------------------- lo mío es mío
create policy "veo mi progreso" on public.progreso_material
  for select to authenticated using (estudiante_id = auth.uid());
create policy "marco mi progreso" on public.progreso_material
  for insert to authenticated with check (estudiante_id = auth.uid());
create policy "borro mi progreso" on public.progreso_material
  for delete to authenticated using (estudiante_id = auth.uid());

create policy "veo mis entregas" on public.entregas
  for select to authenticated using (estudiante_id = auth.uid());
create policy "entrego mis tareas" on public.entregas
  for insert to authenticated with check (
    estudiante_id = auth.uid()
    and exists (select 1 from public.tareas t
                 where t.id = tarea_id and public.esta_inscrito(t.asignatura_id))
  );
create policy "corrijo mi entrega" on public.entregas
  for update to authenticated
  using (estudiante_id = auth.uid()) with check (estudiante_id = auth.uid());

-- Una nota sin publicar existe en la tabla pero el estudiante no la ve.
create policy "veo mis notas publicadas" on public.notas
  for select to authenticated
  using (estudiante_id = auth.uid() and publicada_en is not null);

-- ----------------------------------------------------------------- foro
create policy "leo el foro de mis asignaturas" on public.hilos
  for select to authenticated using (public.esta_inscrito(asignatura_id));

create policy "abro hilos donde estoy inscrito" on public.hilos
  for insert to authenticated with check (
    public.esta_inscrito(asignatura_id)
    and autor_id = auth.uid()
    and autor_rol = 'Estudiante'
  );

create policy "leo las respuestas de esos hilos" on public.respuestas
  for select to authenticated using (
    exists (select 1 from public.hilos h
             where h.id = hilo_id and public.esta_inscrito(h.asignatura_id))
  );

create policy "respondo en esos hilos" on public.respuestas
  for insert to authenticated with check (
    autor_id = auth.uid()
    and autor_rol = 'Estudiante'
    and exists (select 1 from public.hilos h
                 where h.id = hilo_id and public.esta_inscrito(h.asignatura_id))
  );

-- ---------------------------------------------------------------- tutor
create policy "veo mis conversaciones" on public.conversaciones
  for select to authenticated using (estudiante_id = auth.uid());
create policy "abro mis conversaciones" on public.conversaciones
  for insert to authenticated with check (
    estudiante_id = auth.uid() and public.esta_inscrito(asignatura_id)
  );

create policy "leo mis mensajes" on public.mensajes
  for select to authenticated using (
    exists (select 1 from public.conversaciones c
             where c.id = conversacion_id and c.estudiante_id = auth.uid())
  );

-- Ojo: el estudiante NO puede insertar mensajes directamente. Los escribe la
-- función `tutor` con la clave de servicio, que es la única que puede poner
-- palabras en boca del tutor.

-- ------------------------------------------------------- notificaciones
create policy "veo mis notificaciones" on public.notificaciones
  for select to authenticated using (estudiante_id = auth.uid());
create policy "marco mis notificaciones como leídas" on public.notificaciones
  for update to authenticated
  using (estudiante_id = auth.uid()) with check (estudiante_id = auth.uid());

-- Sin estos permisos las políticas no alcanzan: el rol ni siquiera podría
-- tocar las tablas. Supabase concede algo parecido por omisión; lo dejamos
-- explícito para que el esquema se sostenga solo.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.perfiles          to authenticated;
grant insert, delete on public.progreso_material to authenticated;
grant insert, update on public.entregas          to authenticated;
grant insert         on public.hilos             to authenticated;
grant insert         on public.respuestas        to authenticated;
grant insert         on public.conversaciones    to authenticated;
grant update         on public.notificaciones    to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260825000300 · companeros
-- ───────────────────────────────────────────────────────────────────

-- Compañeros de curso, con la menor exposición posible.
--
-- Mostrar el curso implica que un estudiante vea nombres de otros. En vez de
-- abrir `perfiles` con una política amplia, se expone una función acotada:
-- devuelve solo nombres, solo de asignaturas donde quien pregunta está
-- inscrito. Las inscripciones siguen siendo privadas.

create or replace function public.companeros_de(p_asignatura uuid)
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre
    from public.inscripciones i
    join public.perfiles p on p.id = i.estudiante_id
   where i.asignatura_id = p_asignatura
     and public.esta_inscrito(p_asignatura)   -- si no estoy inscrito, no devuelve nada
   order by p.nombre;
$$;

revoke execute on function public.companeros_de(uuid) from public;
grant  execute on function public.companeros_de(uuid) to authenticated;

-- El correo no tiene por qué salir de la base: el propio usuario lo obtiene de
-- su sesión, y de los demás no debe verlo nunca.
revoke select on public.perfiles from authenticated;
grant  select (id, nombre, creado_en) on public.perfiles to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260825000400 · apuntes
-- ───────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────
-- 20260825000500 · apuntes tablero
-- ───────────────────────────────────────────────────────────────────

-- El tablero de apuntes necesita fijar y buscar.

alter table public.apuntes
  add column fijado boolean not null default false;

-- Los fijados primero, y dentro de cada grupo el más reciente arriba.
create index apuntes_tablero
  on public.apuntes (estudiante_id, fijado desc, actualizado_en desc);

-- Búsqueda por texto en español sobre título y contenido.
create index apuntes_busqueda
  on public.apuntes
  using gin (to_tsvector('spanish', titulo || ' ' || contenido));


-- ───────────────────────────────────────────────────────────────────
-- 20260826000100 · lectura
-- ───────────────────────────────────────────────────────────────────

-- El lector inmersivo necesita el texto, no solo el título del material.
--
-- Hasta ahora un material era una fila con nombre y un enlace: "Apunte:
-- límites laterales · PDF · 8 páginas". Para escucharlo hace falta el texto
-- adentro. Los materiales que siguen siendo un archivo (videos, guías en
-- PDF) dejan la columna en null y no muestran el botón de escuchar.

alter table public.materiales
  add column texto text;

-- Un documento sin texto ni url no es nada: o se lee o se abre.
alter table public.materiales
  add constraint material_tiene_contenido
  check (tipo <> 'documento' or texto is not null or url is not null);

comment on column public.materiales.texto is
  'Cuerpo del material en texto plano, para leerlo y escucharlo dentro de la app.';

-- La política de lectura de materiales ya cubre esta columna: se hereda de
-- la inscripción al ramo a través del módulo. No hace falta política nueva.


-- ───────────────────────────────────────────────────────────────────
-- 20260826000200 · docentes
-- ───────────────────────────────────────────────────────────────────

-- StudIA · los docentes entran al sistema
--
-- Hasta acá el profesor era una cadena de texto en `asignaturas.profesor`: un
-- nombre para mostrar, sin cuenta y sin permisos. Todo el contenido venía del
-- seed, así que la app funcionaba pero nadie podía cargar nada.
--
-- La regla nueva es simétrica a la del estudiante. Un estudiante ve lo de los
-- ramos en que está inscrito; un docente ve y ESCRIBE lo de los ramos que
-- dicta. Ni uno ni otro alcanza nada de un ramo ajeno.
--
-- Hay una línea que el docente no cruza, y es a propósito: los apuntes, las
-- transcripciones, los resúmenes y la conversación con el tutor son material
-- de estudio privado del alumno. Un alumno que sabe que su profesor le lee
-- los apuntes deja de escribir lo que no entiende, que es justo lo que hace
-- útil al tutor. Acá no se agrega ninguna política que se los abra.

-- ------------------------------------------------------------------ rol
alter table public.perfiles
  add column rol text not null default 'estudiante'
  check (rol in ('estudiante', 'profesor'));

comment on column public.perfiles.rol is
  'Qué puede hacer esta persona. El rol no da acceso por sí solo: lo que '
  'abre puertas es dictar o estar inscrito en una asignatura concreta.';

comment on table public.perfiles is
  'Un perfil por usuario autenticado, estudiante o docente.';

-- El rol viene de los metadatos con que se creó la cuenta. Un usuario no
-- puede elegírselo solo: la política de perfiles deja editar el nombre, y
-- este trigger impide que un update se ascienda a profesor.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, correo, rol)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when new.raw_user_meta_data ->> 'rol' = 'profesor' then 'profesor' else 'estudiante' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Ojo con el alcance: esto vigila al CLIENTE, no al colegio. La importación
-- de una planilla corre con la clave de servicio y justamente lo que hace es
-- asignar roles; si el trigger no distinguiera quién está escribiendo, la
-- primera carga de un semestre se caería sola.
create or replace function public.rol_no_se_cambia_solo()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and new.rol is distinct from old.rol then
    raise exception 'El rol no se cambia desde el cliente.';
  end if;
  return new;
end;
$$;

create trigger al_editar_perfil
  before update on public.perfiles
  for each row execute function public.rol_no_se_cambia_solo();

-- ------------------------------------------------------------- dictados
-- Quién dicta qué. Es el espejo de `inscripciones`.
create table public.dictados (
  id             uuid primary key default gen_random_uuid(),
  docente_id     uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- Un ayudante corrige y responde el foro, pero no publica notas.
  papel          text not null default 'profesor' check (papel in ('profesor', 'ayudante')),
  creado_en      timestamptz not null default now(),
  unique (docente_id, asignatura_id)
);
create index on public.dictados (docente_id);

alter table public.dictados enable row level security;

-- ¿El usuario actual dicta esta asignatura? SECURITY DEFINER por lo mismo
-- que `esta_inscrito`: para no volver a pasar por las políticas y no entrar
-- en recursión.
create or replace function public.dicta(p_asignatura uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.dictados
     where asignatura_id = p_asignatura
       and docente_id = auth.uid()
  );
$$;

-- Publicar notas es del profesor, no del ayudante.
create or replace function public.dicta_como_profesor(p_asignatura uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.dictados
     where asignatura_id = p_asignatura
       and docente_id = auth.uid()
       and papel = 'profesor'
  );
$$;

revoke execute on function public.dicta(uuid)                from public;
revoke execute on function public.dicta_como_profesor(uuid)  from public;
grant  execute on function public.dicta(uuid)                to authenticated;
grant  execute on function public.dicta_como_profesor(uuid)  to authenticated;

create policy "veo mis dictados" on public.dictados
  for select to authenticated using (docente_id = auth.uid());

-- ------------------------------------------------------- lo que ve el docente
-- Las políticas de select se suman a las del estudiante: Postgres las une con
-- OR, así que agregar estas no le quita nada a nadie.

create policy "docente ve sus asignaturas" on public.asignaturas
  for select to authenticated using (public.dicta(id));

create policy "docente ve el horario que dicta" on public.bloques_horario
  for select to authenticated using (public.dicta(asignatura_id));

create policy "docente ve sus módulos" on public.modulos
  for select to authenticated using (public.dicta(asignatura_id));

create policy "docente ve su material" on public.materiales
  for select to authenticated using (
    exists (select 1 from public.modulos m
             where m.id = modulo_id and public.dicta(m.asignatura_id))
  );

create policy "docente ve sus clases" on public.clases
  for select to authenticated using (public.dicta(asignatura_id));

create policy "docente ve los capítulos de sus clases" on public.capitulos_clase
  for select to authenticated using (
    exists (select 1 from public.clases c
             where c.id = clase_id and public.dicta(c.asignatura_id))
  );

create policy "docente ve sus tareas" on public.tareas
  for select to authenticated using (public.dicta(asignatura_id));

create policy "docente ve sus evaluaciones" on public.evaluaciones
  for select to authenticated using (public.dicta(asignatura_id));

create policy "docente ve el foro que dicta" on public.hilos
  for select to authenticated using (public.dicta(asignatura_id));

create policy "docente ve las respuestas de ese foro" on public.respuestas
  for select to authenticated using (
    exists (select 1 from public.hilos h
             where h.id = hilo_id and public.dicta(h.asignatura_id))
  );

create policy "docente ve quién está inscrito" on public.inscripciones
  for select to authenticated using (public.dicta(asignatura_id));

create policy "docente ve las entregas de sus tareas" on public.entregas
  for select to authenticated using (
    exists (select 1 from public.tareas t
             where t.id = tarea_id and public.dicta(t.asignatura_id))
  );

-- El docente ve la nota apenas la carga, publicada o no. Es al revés que el
-- estudiante, que solo ve las publicadas.
create policy "docente ve las notas de sus evaluaciones" on public.notas
  for select to authenticated using (
    exists (select 1 from public.evaluaciones e
             where e.id = evaluacion_id and public.dicta(e.asignatura_id))
  );

create policy "docente ve el avance de su curso" on public.progreso_material
  for select to authenticated using (
    exists (select 1 from public.materiales mt
              join public.modulos m on m.id = mt.modulo_id
             where mt.id = material_id and public.dicta(m.asignatura_id))
  );

-- ---------------------------------------------------- lo que escribe el docente

create policy "docente edita la ficha del ramo" on public.asignaturas
  for update to authenticated
  using (public.dicta(id)) with check (public.dicta(id));

create policy "docente arma sus módulos" on public.modulos
  for all to authenticated
  using (public.dicta(asignatura_id)) with check (public.dicta(asignatura_id));

create policy "docente carga material" on public.materiales
  for all to authenticated
  using (
    exists (select 1 from public.modulos m
             where m.id = modulo_id and public.dicta(m.asignatura_id))
  )
  with check (
    exists (select 1 from public.modulos m
             where m.id = modulo_id and public.dicta(m.asignatura_id))
  );

create policy "docente maneja sus clases" on public.clases
  for all to authenticated
  using (public.dicta(asignatura_id)) with check (public.dicta(asignatura_id));

create policy "docente marca los capítulos" on public.capitulos_clase
  for all to authenticated
  using (
    exists (select 1 from public.clases c
             where c.id = clase_id and public.dicta(c.asignatura_id))
  )
  with check (
    exists (select 1 from public.clases c
             where c.id = clase_id and public.dicta(c.asignatura_id))
  );

create policy "docente publica tareas" on public.tareas
  for all to authenticated
  using (public.dicta(asignatura_id)) with check (public.dicta(asignatura_id));

create policy "docente arma las evaluaciones" on public.evaluaciones
  for all to authenticated
  using (public.dicta_como_profesor(asignatura_id))
  with check (public.dicta_como_profesor(asignatura_id));

create policy "el profesor pone las notas" on public.notas
  for all to authenticated
  using (
    exists (select 1 from public.evaluaciones e
             where e.id = evaluacion_id and public.dicta_como_profesor(e.asignatura_id))
  )
  with check (
    exists (select 1 from public.evaluaciones e
             where e.id = evaluacion_id and public.dicta_como_profesor(e.asignatura_id))
  );

create policy "docente corrige las entregas" on public.entregas
  for update to authenticated
  using (
    exists (select 1 from public.tareas t
             where t.id = tarea_id and public.dicta(t.asignatura_id))
  )
  with check (
    exists (select 1 from public.tareas t
             where t.id = tarea_id and public.dicta(t.asignatura_id))
  );

-- Corregir es poner un puntaje, no reescribir la entrega. Sin esto, la
-- política de arriba dejaría a un docente cambiar el archivo entregado o la
-- fecha, y el alumno no tendría cómo demostrar qué entregó ni cuándo.
create or replace function public.corregir_es_solo_puntaje()
returns trigger
language plpgsql
as $$
begin
  -- Solo aplica al cliente: el servidor corrige y migra sin este candado.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.estudiante_id = auth.uid() then
    return new;
  end if;
  if new.tarea_id      is distinct from old.tarea_id
  or new.estudiante_id is distinct from old.estudiante_id
  or new.entregado_en  is distinct from old.entregado_en
  or new.archivo_url   is distinct from old.archivo_url then
    raise exception 'Al corregir solo se puede cambiar el puntaje.';
  end if;
  return new;
end;
$$;

create trigger al_corregir_entrega
  before update on public.entregas
  for each row execute function public.corregir_es_solo_puntaje();

create policy "docente escribe en el foro" on public.hilos
  for insert to authenticated with check (
    public.dicta(asignatura_id)
    and autor_id = auth.uid()
    and autor_rol in ('Profesor', 'Ayudante')
  );

create policy "docente fija y edita sus hilos" on public.hilos
  for update to authenticated
  using (public.dicta(asignatura_id)) with check (public.dicta(asignatura_id));

create policy "docente responde en su foro" on public.respuestas
  for insert to authenticated with check (
    autor_id = auth.uid()
    and autor_rol in ('Profesor', 'Ayudante')
    and exists (select 1 from public.hilos h
                 where h.id = hilo_id and public.dicta(h.asignatura_id))
  );

-- --------------------------------------------------------------- el curso
-- Para corregir y poner notas hace falta la lista de alumnos. `perfiles`
-- tiene el correo y está cerrado con grants por columna, así que la lista
-- sale por acá, ya filtrada.
create or replace function public.alumnos_de(p_asignatura uuid)
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre
    from public.inscripciones i
    join public.perfiles p on p.id = i.estudiante_id
   where i.asignatura_id = p_asignatura
     and public.dicta(p_asignatura)
   order by p.nombre;
$$;

revoke execute on function public.alumnos_de(uuid) from public;
grant  execute on function public.alumnos_de(uuid) to authenticated;

-- `perfiles` está cerrado por columnas desde la migración de compañeros: el
-- correo no se lee desde el cliente. El rol sí hace falta —la app decide con
-- él qué pantalla abrir— y la política de select solo devuelve la fila propia,
-- así que esto no expone el rol de nadie más.
grant select (rol) on public.perfiles to authenticated;

-- Sin estos permisos las políticas de escritura no alcanzan.
grant insert, update, delete on public.modulos         to authenticated;
grant insert, update, delete on public.materiales      to authenticated;
grant insert, update, delete on public.clases          to authenticated;
grant insert, update, delete on public.capitulos_clase to authenticated;
grant insert, update, delete on public.tareas          to authenticated;
grant insert, update, delete on public.evaluaciones    to authenticated;
grant insert, update, delete on public.notas           to authenticated;
grant update                 on public.asignaturas     to authenticated;
grant update                 on public.hilos           to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260826000300 · administracion
-- ───────────────────────────────────────────────────────────────────

-- StudIA · lo que carga el colegio
--
-- Hay tres capas de escritura y conviene tenerlas separadas, porque quien
-- manda sobre cada cosa es distinto:
--
--   El colegio  → qué ramos existen, quién los dicta, quién está inscrito y
--                 en qué sala y a qué hora. Son hechos que tienen que ser
--                 iguales para todos: si cada profesor pudiera moverlos, dos
--                 cursos terminarían citados en la misma sala.
--   El docente  → el contenido y la evaluación de SU ramo: módulos, material,
--                 lecturas, tareas, notas, clases, foro.
--   El alumno   → lo suyo: entregas, apuntes, avance, preguntas al tutor.
--
-- El camino normal del colegio no es esta tabla ni una pantalla: es la
-- carpeta datos/ con planillas y `npm run importar`. Nadie va a tipear un
-- semestre en un formulario, y lo que el colegio ya tiene está en Excel.
-- Estas políticas existen para que la misma operación se pueda hacer desde
-- la app el día que haga falta corregir una fila suelta.

alter table public.perfiles
  drop constraint perfiles_rol_check;

alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('estudiante', 'profesor', 'administrador'));

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
     where id = auth.uid() and rol = 'administrador'
  );
$$;

revoke execute on function public.es_administrador() from public;
grant  execute on function public.es_administrador() to authenticated;

-- Las cuatro tablas que son del colegio y de nadie más.
create policy "administración ve todas las asignaturas" on public.asignaturas
  for select to authenticated using (public.es_administrador());
create policy "administración crea asignaturas" on public.asignaturas
  for all to authenticated
  using (public.es_administrador()) with check (public.es_administrador());

create policy "administración ve todo el horario" on public.bloques_horario
  for select to authenticated using (public.es_administrador());
create policy "administración arma el horario" on public.bloques_horario
  for all to authenticated
  using (public.es_administrador()) with check (public.es_administrador());

create policy "administración ve los dictados" on public.dictados
  for select to authenticated using (public.es_administrador());
create policy "administración asigna los dictados" on public.dictados
  for all to authenticated
  using (public.es_administrador()) with check (public.es_administrador());

create policy "administración ve las inscripciones" on public.inscripciones
  for select to authenticated using (public.es_administrador());
create policy "administración inscribe" on public.inscripciones
  for all to authenticated
  using (public.es_administrador()) with check (public.es_administrador());

grant insert, update, delete on public.asignaturas     to authenticated;
grant insert, update, delete on public.bloques_horario to authenticated;
grant insert, update, delete on public.dictados        to authenticated;
grant insert, update, delete on public.inscripciones   to authenticated;

-- Nota deliberada: la administración NO recibe acceso a apuntes,
-- transcripciones, resúmenes ni a la conversación con el tutor. La razón es
-- la misma que para el docente y está en documentacion/arquitectura.md.


-- ───────────────────────────────────────────────────────────────────
-- 20260827000100 · lista del curso
-- ───────────────────────────────────────────────────────────────────

-- `alumnos_de` solo respondía a quien dicta el ramo.
--
-- La pantalla de administración cuenta las inscripciones de cada asignatura
-- para saber cuánta gente hay en el colegio, y con esta función cerrada al
-- docente devolvía cero para todos. No era un problema de permisos de más:
-- la administración ya puede leer `inscripciones` completo por su política.
-- Era esta función, que se escribió pensando solo en el profesor.

create or replace function public.alumnos_de(p_asignatura uuid)
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre
    from public.inscripciones i
    join public.perfiles p on p.id = i.estudiante_id
   where i.asignatura_id = p_asignatura
     and (public.dicta(p_asignatura) or public.es_administrador())
   order by p.nombre;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 20260827000200 · uso asistente
-- ───────────────────────────────────────────────────────────────────

-- Un tope de uso para el asistente del docente.
--
-- El tutor ya tenía uno, pero cuenta filas en `mensajes` y el asistente no
-- guarda la conversación, así que no había nada que contar: cada pregunta
-- llegaba a Claude sin tope. Con búsqueda en internet activada, eso es una
-- cuenta que puede crecer sin techo por un dedo apoyado en el botón.
--
-- Se registra solo la marca de tiempo, no la pregunta. Para poner un tope
-- basta con saber cuándo; guardar qué preguntó un docente sería un archivo
-- de sus consultas que nadie pidió.

create table public.usos_asistente (
  id          uuid primary key default gen_random_uuid(),
  docente_id  uuid not null references public.perfiles (id) on delete cascade,
  creado_en   timestamptz not null default now()
);

create index usos_asistente_recientes
  on public.usos_asistente (docente_id, creado_en desc);

alter table public.usos_asistente enable row level security;

-- Sin políticas y sin permisos: solo la clave de servicio entra. Si el
-- cliente pudiera borrar filas acá, el tope no sería un tope.
revoke all on public.usos_asistente from authenticated, anon;

comment on table public.usos_asistente is
  'Marcas de tiempo para limitar el uso del asistente. No guarda preguntas.';


-- ───────────────────────────────────────────────────────────────────
-- 20260827000300 · espacio propio
-- ───────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────
-- 20260827000400 · codigo por dueno
-- ───────────────────────────────────────────────────────────────────

-- Que dos personas puedan estudiar lo mismo
--
-- `asignaturas.codigo` era único en toda la tabla, y eso tenía sentido cuando
-- todos los ramos eran del colegio: MAT1610 hay uno solo. Con los espacios
-- propios deja de tenerlo: el código de un ramo propio se arma de su nombre,
-- así que la segunda persona que cree "Inglés" se llevaría un choque de clave
-- única y un "no pude crear el ramo" que no explica nada.
--
-- El código sigue siendo único donde importa —entre los ramos del colegio— y
-- deja de serlo entre los propios, donde solo es una etiqueta que ve su dueño.

alter table public.asignaturas drop constraint asignaturas_codigo_key;

create unique index asignaturas_codigo_del_colegio
  on public.asignaturas (codigo)
  where creador_id is null;

comment on index public.asignaturas_codigo_del_colegio is
  'MAT1610 hay uno solo. Los ramos propios quedan fuera a propósito.';


-- ───────────────────────────────────────────────────────────────────
-- 20260829000100 · cargar catalogo
-- ───────────────────────────────────────────────────────────────────

-- Cargar el catálogo del semestre de una vez, desde el navegador.
--
-- El comando `npm run importar` ya convertía las planillas en SQL, pero ese
-- SQL había que pegarlo en el editor de Supabase. Una secretaría académica no
-- hace eso. Esta función es el mismo trabajo, llamable desde el panel de
-- administración.
--
-- Va como función y no como una serie de inserts desde el cliente por dos
-- razones que a mil ramos dejan de ser detalles:
--
--   1. Es una transacción. Un semestre a medio cargar —los ramos sí, el
--      horario no— es peor que no haber cargado nada: no hay manera de saber
--      desde afuera dónde quedó.
--   2. El índice único de `codigo` es parcial (solo los ramos del colegio),
--      y un `on conflict` así no se puede expresar desde PostgREST: hay que
--      repetir su condición, y eso solo se puede en SQL.
--
-- `security invoker` a propósito: las políticas del administrador siguen
-- mandando. Si la llama alguien que no lo es, no escribe nada. La seguridad
-- no se muda acá adentro.

create or replace function public.cargar_catalogo(
  p_asignaturas jsonb,
  p_horario     jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_codigos text[];
  v_ramos   int;
  v_bloques int;
begin
  if jsonb_typeof(p_asignaturas) <> 'array' or jsonb_typeof(p_horario) <> 'array' then
    raise exception 'Las dos planillas tienen que venir como listas.';
  end if;

  -- Los ramos que toca esta carga. Lo que no esté acá no se mira siquiera:
  -- una planilla parcial no puede borrar el resto del semestre.
  select array_agg(upper(x->>'codigo')) into v_codigos
    from jsonb_array_elements(p_asignaturas) x;

  if v_codigos is null then
    return jsonb_build_object('ramos', 0, 'bloques', 0);
  end if;

  insert into public.asignaturas
    (codigo, nombre, profesor, ayudante, color, creditos,
     descripcion, requisitos, bibliografia, intro_tutor)
  select
    upper(x->>'codigo'), x->>'nombre', x->>'profesor', nullif(x->>'ayudante', ''),
    x->>'color', (x->>'creditos')::smallint,
    nullif(x->>'descripcion', ''), nullif(x->>'requisitos', ''),
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(x->'bibliografia') b),
      '{}'::text[]),
    x->>'intro_tutor'
  from jsonb_array_elements(p_asignaturas) x
  -- Repetir la condición del índice parcial es lo que deja inferirlo.
  on conflict (codigo) where creador_id is null do update set
    nombre = excluded.nombre, profesor = excluded.profesor,
    ayudante = excluded.ayudante, color = excluded.color,
    creditos = excluded.creditos, descripcion = excluded.descripcion,
    requisitos = excluded.requisitos, bibliografia = excluded.bibliografia,
    intro_tutor = excluded.intro_tutor;

  get diagnostics v_ramos = row_count;

  -- El horario se rehace entero para esos ramos: un bloque que se sacó de la
  -- planilla tiene que desaparecer, y no hay nada del alumno colgando de él.
  delete from public.bloques_horario
   where asignatura_id in (
     select id from public.asignaturas
      where codigo = any(v_codigos) and creador_id is null);

  insert into public.bloques_horario (asignatura_id, dia, hora_inicio, hora_fin, sala, tipo)
  select a.id, (x->>'dia')::smallint, (x->>'hora_inicio')::time,
         (x->>'hora_fin')::time, x->>'sala', x->>'tipo'
    from jsonb_array_elements(p_horario) x
    join public.asignaturas a
      on a.codigo = upper(x->>'codigo') and a.creador_id is null;

  get diagnostics v_bloques = row_count;

  -- Si un bloque quedó sin ramo, la planilla nombraba un código que no existe
  -- y el horario habría quedado incompleto en silencio.
  if v_bloques <> jsonb_array_length(p_horario) then
    raise exception 'El horario nombra ramos que no están en la planilla de asignaturas.';
  end if;

  return jsonb_build_object('ramos', v_ramos, 'bloques', v_bloques);
end;
$$;

comment on function public.cargar_catalogo(jsonb, jsonb) is
  'Carga ramos y horario en una transacción. Idempotente: reimportar '
  'actualiza y no duplica. Solo escribe si quien llama es administrador, '
  'porque las políticas de la tabla siguen aplicándose.';

grant execute on function public.cargar_catalogo(jsonb, jsonb) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260829000200 · registros
-- ───────────────────────────────────────────────────────────────────

-- El registro de quiénes están en StudIA, para la administración.
--
-- El correo de una persona no es legible desde el cliente: la columna está
-- fuera del `grant`, y por eso la app puede prometerle a cada quien que nadie
-- más lo ve. Esa promesa se mantiene; lo que se abre acá es una excepción
-- nombrada y con guardia, no un permiso nuevo para todo el mundo.
--
-- Va como función `security definer` porque es la única manera de sostener
-- las dos cosas a la vez: que la administración vea el registro completo y
-- que un alumno o un docente sigan sin poder leer el correo de nadie.

create or replace function public.registros()
returns table (
  id        uuid,
  nombre    text,
  correo    text,
  rol       text,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.correo, p.rol, p.creado_en
    from public.perfiles p
   -- Sin esto la función sería una puerta de atrás al correo de todos. Para
   -- quien no es administración devuelve vacío, que es exactamente lo que ve
   -- hoy: nada.
   where public.es_administrador()
   order by p.creado_en desc;
$$;

comment on function public.registros() is
  'El registro completo, solo para la administración. Para cualquier otra '
  'persona devuelve vacío: el correo ajeno sigue sin ser legible.';

-- ---------------------------------------------------------------- roles
-- `rol_no_se_cambia_solo` prohíbe cambiar el rol desde el cliente, y está
-- bien que lo prohíba: es lo que impide que alguien se ascienda solo. La
-- administración lo cambia por acá, donde hay guardia y queda dicho por qué.

create or replace function public.cambiar_rol(p_persona uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración cambia roles.';
  end if;

  if p_rol not in ('estudiante', 'profesor', 'administrador') then
    raise exception 'Rol desconocido: %', p_rol;
  end if;

  -- Nadie se cambia el rol a sí mismo, ni para subir ni para bajar. Subir
  -- solo sería ascenderse; bajar dejaría al colegio sin quien administre si
  -- fuera la última persona. Que lo haga otra de administración.
  if p_persona = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol. Pídeselo a otra persona de administración.';
  end if;

  update public.perfiles set rol = p_rol where id = p_persona;
  if not found then
    raise exception 'Esa persona ya no está registrada.';
  end if;
end;
$$;

comment on function public.cambiar_rol(uuid, text) is
  'Cambia el rol de otra persona. Solo la administración, y nunca el propio: '
  'ascenderse a uno mismo sería la única manera de saltarse todo lo demás.';

revoke execute on function public.registros()             from public;
revoke execute on function public.cambiar_rol(uuid, text) from public;
grant  execute on function public.registros()             to authenticated;
grant  execute on function public.cambiar_rol(uuid, text) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260830000100 · sesiones estudio
-- ───────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────
-- 20260830000200 · quices
-- ───────────────────────────────────────────────────────────────────

-- Los quices de repaso: preguntas hechas con el material del propio ramo.
--
-- Un quiz es de quien lo pidió. Dos estudiantes del mismo ramo que piden un
-- quiz del mismo tema reciben preguntas distintas, y ninguno ve las del otro:
-- así no hay nada que copiarse, y sobre todo, así el quiz no es una prueba.
-- Es un espejo para saber cómo va uno, y para eso tiene que poder equivocarse
-- sin que quede en ninguna parte que le importe a alguien más.
--
-- Las preguntas se guardan enteras en la fila, en JSON, y no en tablas
-- aparte. No hay ninguna consulta que quiera preguntar «cuántas veces se ha
-- preguntado esto»: un quiz se lee entero o no se lee, y partirlo en tres
-- tablas solo agregaría uniones para volver a juntarlo.

create table public.quices (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- El módulo sobre el que se preguntó, por su título: es lo que el estudiante
  -- eligió y lo que se le muestra de vuelta.
  tema           text not null,
  -- [{pregunta, opciones[4], correcta, explicacion}]. Lo escribe la función
  -- `quiz` con la clave de servicio; el estudiante no puede fabricarlas ni
  -- editarlas, porque entonces el puntaje no diría nada.
  preguntas      jsonb not null,
  -- Lo que respondió, en el mismo orden. Índices de 0 a 3, o null en las que
  -- todavía no contesta. Esto sí lo escribe el estudiante: es lo suyo.
  respuestas     jsonb not null default '[]'::jsonb,
  terminado_en   timestamptz,
  creado_en      timestamptz not null default now(),

  constraint preguntas_es_arreglo check (jsonb_typeof(preguntas) = 'array'),
  constraint respuestas_es_arreglo check (jsonb_typeof(respuestas) = 'array'),
  -- Un quiz con menos de tres preguntas no es un repaso; el filtro de la
  -- función ya lo impide, y esto lo deja escrito también acá.
  constraint quiz_con_preguntas check (jsonb_array_length(preguntas) >= 3)
);

create index on public.quices (estudiante_id, creado_en desc);
create index on public.quices (estudiante_id, asignatura_id);

alter table public.quices enable row level security;

create policy "veo mis quices" on public.quices
  for select to authenticated using (estudiante_id = auth.uid());

create policy "borro mis quices" on public.quices
  for delete to authenticated using (estudiante_id = auth.uid());

-- Ojo: no hay política de `insert` ni de `update` para `authenticated`. Un
-- quiz solo puede nacer de la función `quiz`, que escribe con la clave de
-- servicio, y responderlo pasa por la función de acá abajo. Si se dejara el
-- `update` abierto, cualquiera podría reescribir sus propias preguntas para
-- que todas quedaran correctas —RLS no tiene permisos por columna— y el
-- puntaje dejaría de decir nada.
grant select, delete on public.quices to authenticated;

-- Responder el quiz. Escribe solo lo que es del estudiante: sus respuestas.
--
-- `p_respuestas` es un arreglo del mismo largo que las preguntas, con el
-- índice elegido en cada una o null en las que todavía no contesta. Volver a
-- empezar es mandar un arreglo vacío, que es lo que hace «repetir el quiz».
create or replace function public.responder_quiz(
  p_quiz uuid, p_respuestas jsonb, p_terminado boolean default false
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cuantas int;
begin
  select jsonb_array_length(preguntas) into v_cuantas
    from public.quices
   where id = p_quiz and estudiante_id = auth.uid();

  if v_cuantas is null then
    raise exception 'Ese quiz no es tuyo.';
  end if;
  if jsonb_typeof(p_respuestas) is distinct from 'array' then
    raise exception 'Las respuestas tienen que venir en un arreglo.';
  end if;
  if jsonb_array_length(p_respuestas) > v_cuantas then
    raise exception 'Mandaste más respuestas que preguntas.';
  end if;

  update public.quices
     set respuestas = p_respuestas,
         terminado_en = case when p_terminado then now() else null end
   where id = p_quiz and estudiante_id = auth.uid();
end $$;

grant execute on function public.responder_quiz(uuid, jsonb, boolean) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260830000300 · fichas
-- ───────────────────────────────────────────────────────────────────

-- Las fichas de repaso, con su repetición espaciada.
--
-- Una ficha es una pregunta corta y su respuesta. El evaluador las escribe con
-- el material del ramo, igual que los quices, pero se usan distinto: un quiz
-- se responde una vez y dice cómo vas; una ficha vuelve, y vuelve más seguido
-- justamente la que fallaste.
--
-- Por eso la fila guarda el historial y no solo el texto: `aciertos` seguidos
-- es lo que decide cuánto se demora en volver, y `vuelve_en` es la fecha en
-- que toca. Es todo lo que necesita la repetición espaciada, y es a propósito
-- lo más simple que funciona: sin factores de facilidad ni intervalos con
-- decimales, que son precisión inventada sobre un dato que no la tiene.

create table public.fichas (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- El módulo del que salió, por su título: es lo que se le muestra de vuelta.
  tema           text not null,
  pregunta       text not null check (length(trim(pregunta)) between 1 and 300),
  respuesta      text not null check (length(trim(respuesta)) between 1 and 600),

  -- Cuántas veces seguidas se supo. Al fallar vuelve a cero: lo que importa
  -- no es cuántas veces se acertó en total, sino desde cuándo no se falla.
  aciertos       integer not null default 0 check (aciertos >= 0),
  -- Cuántas veces se falló, en total. No entra en el cálculo; sirve para
  -- poder decirle a alguien cuál es la que más se le resiste.
  fallos         integer not null default 0 check (fallos >= 0),
  -- Cuándo toca de nuevo. Nula significa que nunca se ha visto: toca ya.
  vuelve_en      timestamptz,
  vista_en       timestamptz,
  creado_en      timestamptz not null default now()
);

-- La consulta de siempre: «mis fichas de este ramo que ya tocan».
create index on public.fichas (estudiante_id, asignatura_id, vuelve_en);

alter table public.fichas enable row level security;

-- Como los quices: son de quien las estudia y de nadie más. Que alguien esté
-- repasando una ficha por quinta vez no es asunto de quien dicta el ramo.
create policy "veo mis fichas" on public.fichas
  for select to authenticated using (estudiante_id = auth.uid());
create policy "borro mis fichas" on public.fichas
  for delete to authenticated using (estudiante_id = auth.uid());

-- Sin `insert` ni `update` abiertos: las escribe la función `fichas` con la
-- clave de servicio, y responderlas pasa por `repasar_ficha`. Si el cliente
-- pudiera escribir la fila entera, podría cambiarse la respuesta correcta o
-- adelantarse la fecha, y la repetición dejaría de repetir nada.
grant select, delete on public.fichas to authenticated;

-- Anotar que una ficha se supo o no se supo.
--
-- El cálculo del próximo intervalo vive acá y no en la aplicación para que
-- sea el mismo desde cualquier pantalla, y para que no se pueda adelantar
-- desde afuera. Los saltos son 1, 3, 7, 16 y 35 días: cada uno un poco más
-- del doble del anterior, que es lo que la evidencia sostiene sin pretender
-- una precisión que no existe.
create or replace function public.repasar_ficha(p_ficha uuid, p_acerto boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_aciertos int;
  v_dias int;
begin
  select aciertos into v_aciertos
    from public.fichas
   where id = p_ficha and estudiante_id = auth.uid();

  if v_aciertos is null then
    raise exception 'Esa ficha no es tuya.';
  end if;

  if p_acerto then
    v_aciertos := v_aciertos + 1;
    v_dias := case v_aciertos
                when 1 then 1
                when 2 then 3
                when 3 then 7
                when 4 then 16
                else 35
              end;
    update public.fichas
       set aciertos = v_aciertos,
           vista_en = now(),
           vuelve_en = now() + (v_dias || ' days')::interval
     where id = p_ficha and estudiante_id = auth.uid();
  else
    -- Al fallar vuelve al principio y reaparece hoy mismo: la ficha que no se
    -- sabe es exactamente la que hay que volver a ver.
    update public.fichas
       set aciertos = 0,
           fallos = fallos + 1,
           vista_en = now(),
           vuelve_en = now()
     where id = p_ficha and estudiante_id = auth.uid();
  end if;
end $$;

grant execute on function public.repasar_ficha(uuid, boolean) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260830000400 · apuntes a mano
-- ───────────────────────────────────────────────────────────────────

-- Escribir a mano en un apunte.
--
-- Los trazos van en una columna del mismo apunte y no en una tabla aparte, y
-- vale la pena decir por qué: un apunte con dibujo y un apunte escrito son el
-- mismo apunte, no dos cosas que se juntan al mostrarse. Se abren juntos, se
-- guardan juntos y se borran juntos. Una tabla aparte solo agregaría la
-- posibilidad de que queden desparejos.
--
-- jsonb y no texto: así la base valida que sea JSON de verdad. Un apunte con
-- los trazos corruptos abriría igual —la aplicación los lee tolerando basura—
-- pero no tiene sentido dejar entrar lo que ya se sabe roto.
--
-- Nulo significa «nunca se dibujó acá», que no es lo mismo que un tablero
-- borrado. La diferencia importa para no guardar `{"v":1,"trazos":[]}` en cada
-- apunte de texto que existe.

alter table public.apuntes
  add column trazos jsonb;

-- El tamaño sí hay que acotarlo. Un trazo aligerado pesa poco, pero nada
-- impide que alguien mande medio mega de puntos desde un cliente modificado, y
-- una fila así hace lenta la lista de apuntes de esa persona para siempre.
-- 512 kB son muchas páginas de letra manuscrita.
alter table public.apuntes
  add constraint apuntes_trazos_acotados
  check (trazos is null or pg_column_size(trazos) <= 512 * 1024);

-- Las políticas ya están: `edito mis apuntes` cubre la fila entera, y RLS no
-- distingue columnas. Quien puede escribir su apunte puede dibujar en él, que
-- es exactamente lo que corresponde.

-- La lista de apuntes no trae los trazos: son lo pesado de la fila y ahí solo
-- se muestra un adelanto del texto. Pero sí conviene saber cuáles tienen
-- dibujo, para marcarlos en la tarjeta. Una columna generada lo resuelve sin
-- que nadie tenga que acordarse de mantenerla al día.
alter table public.apuntes
  add column tiene_trazos boolean
  generated always as (trazos is not null) stored;


-- ───────────────────────────────────────────────────────────────────
-- 20260830000500 · modo escucha
-- ───────────────────────────────────────────────────────────────────

-- El modo escucha: la clase presencial, oída por el curso.
--
-- Cada teléfono de la sala transcribe en el propio aparato y sube tramos de
-- texto con su segundo y su confianza. El audio no llega acá: se queda en el
-- teléfono y se descarta a medida que se transcribe. Guardar la voz de treinta
-- menores de edad para no usarla sería cargar con un riesgo a cambio de nada,
-- y el texto es todo lo que el resumen necesita.
--
-- Los tramos son de muchos aparatos a propósito. Ninguno oye bien la clase
-- entera —el de adelante pierde la pregunta de atrás, al de atrás le llega la
-- profesora lejos— y cruzarlos es lo que hace que grabar el curso completo
-- valga la pena. El cruce vive en `dominio/escucha.ts`, con sus pruebas.

-- ── Qué clases se pueden oír ─────────────────────────────────────────────

-- Una clase por pantalla no se oye desde el aire: su audio ya pasa por la
-- aplicación. El modo escucha es de las presenciales, y hasta ahora una clase
-- no distinguía sala de pantalla.
alter table public.clases
  add column presencial boolean not null default true;

-- La clase es de quien la hace. Si quien dicta no lo permite, nadie en la sala
-- puede oír: la voz que más se escucha en una clase es la suya, y quien decide
-- si eso queda escrito es quien la pone. Por omisión, no.
alter table public.clases
  add column escucha_permitida boolean not null default false;

-- ── Quién está oyendo ────────────────────────────────────────────────────

-- Para poder decir «tu teléfono y 22 más», que no es un adorno: es lo que
-- hace visible que la sala entera está grabando.
create table public.escuchas (
  id          uuid primary key default gen_random_uuid(),
  clase_id    uuid not null references public.clases (id) on delete cascade,
  persona_id  uuid not null references public.perfiles (id) on delete cascade,
  empezo_en   timestamptz not null default now(),
  termino_en  timestamptz,
  -- Un aparato, no una persona: alguien puede entrar dos veces desde dos
  -- equipos y sus tramos no deben votarse entre sí como si fueran dos oyentes.
  aparato     text not null,
  unique (clase_id, aparato)
);
create index on public.escuchas (clase_id);

-- ── Lo que oyó cada aparato ──────────────────────────────────────────────

-- La tabla `transcripciones` existe desde el primer esquema y guarda la clase
-- ya armada: un texto por segundo, sin dueño. Esto es lo de antes: lo que oyó
-- cada aparato por separado, que es la materia prima del cruce.
create table public.tramos_oidos (
  id          uuid primary key default gen_random_uuid(),
  clase_id    uuid not null references public.clases (id) on delete cascade,
  escucha_id  uuid not null references public.escuchas (id) on delete cascade,
  segundo     integer not null check (segundo >= 0),
  texto       text not null check (length(texto) between 1 and 2000),
  -- Entre 0 y 1 donde el teléfono la informa; -1 donde no. El -1 importa: un
  -- tramo sin dato no es un tramo malo, y el cruce los distingue.
  confianza   real not null default -1 check (confianza = -1 or confianza between 0 and 1),
  creado_en   timestamptz not null default now()
);
create index on public.tramos_oidos (clase_id, segundo);

-- ── Quién ve qué ─────────────────────────────────────────────────────────

alter table public.escuchas     enable row level security;
alter table public.tramos_oidos enable row level security;

-- Se ve quién está oyendo, porque de eso se trata: la sala tiene que saber
-- que la sala está grabando.
create policy "veo quién está oyendo mi clase" on public.escuchas
  for select to authenticated using (
    exists (select 1 from public.clases c
             where c.id = clase_id and public.esta_inscrito(c.asignatura_id))
  );

create policy "puedo ponerme a oír una clase mía" on public.escuchas
  for insert to authenticated with check (
    persona_id = auth.uid()
    and exists (
      select 1 from public.clases c
       where c.id = clase_id
         and public.esta_inscrito(c.asignatura_id)
         -- Las dos condiciones que dan derecho a oír, en la base y no solo en
         -- la pantalla: que sea presencial y que quien dicta lo permita.
         and c.presencial
         and c.escucha_permitida
    )
  );

create policy "cierro mi propia escucha" on public.escuchas
  for update to authenticated
  using (persona_id = auth.uid()) with check (persona_id = auth.uid());

-- Los tramos crudos no los lee el curso: son treinta versiones a medio
-- entender de lo mismo, y leer la peor no le sirve a nadie. Cada quien ve los
-- suyos; lo que se lee es la clase ya armada, en `transcripciones`.
create policy "veo lo que oyó mi propio aparato" on public.tramos_oidos
  for select to authenticated using (
    exists (select 1 from public.escuchas e
             where e.id = escucha_id and e.persona_id = auth.uid())
  );

create policy "subo lo que oyó mi aparato" on public.tramos_oidos
  for insert to authenticated with check (
    exists (select 1 from public.escuchas e
             where e.id = escucha_id
               and e.persona_id = auth.uid()
               and e.termino_en is null)
  );

grant select, insert, update on public.escuchas to authenticated;
grant select, insert on public.tramos_oidos to authenticated;

-- La clase armada la escribe la función con la clave de servicio, igual que el
-- resumen: si el cliente pudiera escribir en `transcripciones`, cualquiera
-- podría poner en boca de un profesor algo que no dijo, y quedaría como la
-- versión oficial de la clase para todo el curso.

-- ── Lo que se tira cuando la clase queda armada ──────────────────────────

/**
 * Arma la clase con todo lo que oyeron los aparatos y borra los tramos crudos.
 *
 * El borrado va en la misma función y no en un aseo aparte a propósito: los
 * tramos sueltos son lo único que se parece a una grabación de la sala —quién
 * oyó qué, desde dónde— y tenerlos más tiempo del necesario no aporta nada.
 * En cuanto la clase está escrita, sobran.
 */
create or replace function public.armar_la_clase(p_clase uuid, p_tramos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  puede boolean;
begin
  select public.esta_inscrito(c.asignatura_id) into puede
    from public.clases c where c.id = p_clase;
  if not coalesce(puede, false) then
    raise exception 'No puedes armar una clase de un ramo en que no estás.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.transcripciones where clase_id = p_clase;

  insert into public.transcripciones (clase_id, segundo, texto)
  select p_clase, (t->>'segundo')::int, t->>'texto'
    from jsonb_array_elements(p_tramos) t;

  delete from public.tramos_oidos where clase_id = p_clase;
  update public.escuchas set termino_en = coalesce(termino_en, now())
   where clase_id = p_clase;
end $$;

revoke all on function public.armar_la_clase(uuid, jsonb) from public;
grant execute on function public.armar_la_clase(uuid, jsonb) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260831000100 · planificacion
-- ───────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────
-- 20260901000100 · borrar cuenta
-- ───────────────────────────────────────────────────────────────────

-- Que borrar la cuenta borre de verdad lo que la política promete.
--
-- El borrado en cascada ya se llevaba casi todo: `perfiles.id` referencia a
-- `auth.users(id) on delete cascade`, y de `perfiles` cuelgan con esa misma
-- regla los apuntes, las notas, las entregas, las conversaciones con el tutor,
-- los quizzes, las fichas y lo oído en clase.
--
-- Faltaba una cosa, y no era menor. En el foro el autor se guarda dos veces:
-- `autor_id`, que apunta al perfil, y `autor_nombre`, que es texto suelto.
-- Existe así por una buena razón —un hilo escrito por una profesora, que
-- todavía no tiene cuenta, igual tiene que mostrar de quién es—, pero
-- significa que al borrar la cuenta el `autor_id` quedaba en nulo y **el
-- nombre se quedaba escrito**. La política de privacidad dice que lo del foro
-- queda «sin tu nombre», y no era cierto.
--
-- El texto sí se queda: es parte de una conversación de otras personas, y
-- borrarlo dejaría respuestas colgando de preguntas que ya no están.

create or replace function public.anonimizar_lo_publicado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Antes del borrado, no después: en cuanto la fila del perfil se va, el
  -- `on delete set null` ya corrió y no queda por dónde encontrar sus hilos.
  update public.hilos
     set autor_nombre = 'Cuenta borrada'
   where autor_id = old.id;

  update public.respuestas
     set autor_nombre = 'Cuenta borrada'
   where autor_id = old.id;

  return old;
end $$;

comment on function public.anonimizar_lo_publicado() is
  'Quita el nombre de lo publicado en el foro cuando se borra la cuenta. El '
  'texto se queda: es parte de la conversación de otras personas.';

create trigger perfiles_anonimizar_al_borrar
  before delete on public.perfiles
  for each row execute function public.anonimizar_lo_publicado();


-- ───────────────────────────────────────────────────────────────────
-- 20260901000200 · almacenamiento
-- ───────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────
-- 20260901000300 · entregas con archivo
-- ───────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────
-- 20260901000400 · errores
-- ───────────────────────────────────────────────────────────────────

-- Dónde queda anotado que la aplicación se cayó.
--
-- Hasta acá, si a alguien se le cerraba la app en medio de una clase no se
-- enteraba nadie: no había registro en ninguna parte y la persona no iba a
-- escribir un correo. Un error que le pasa a treinta personas se veía igual
-- que uno que no le pasa a nadie.
--
-- Lo que NO entra acá está decidido en `dominio/errores.ts`, con pruebas: ni
-- correos, ni tokens de sesión, ni los parámetros de una dirección firmada. Un
-- token en una tabla de errores es una sesión ajena esperando a que alguien la
-- lea.

create table public.errores (
  id           uuid primary key default gen_random_uuid(),
  -- De quién le pasó. Se va con la cuenta: si alguien la borra, sus caídas
  -- también, como todo lo demás suyo.
  persona_id   uuid references public.perfiles (id) on delete cascade,
  -- Para saber si un error ya está arreglado en una versión más nueva. Sin
  -- esto, cada reporte obliga a preguntar «¿qué APK tenías?».
  version      text not null default '',
  compilacion  integer,
  plataforma   text not null default '',
  pantalla     text not null default '',
  mensaje      text not null check (length(mensaje) between 1 and 500),
  pila         text check (length(pila) <= 2000),
  origen       text not null check (origen in ('pantalla', 'global', 'promesa')),
  creado_en    timestamptz not null default now()
);

create index on public.errores (creado_en desc);
-- Para poder contar cuántas veces pasó lo mismo, que es la pregunta que uno
-- se hace de verdad: no «¿hubo errores?» sino «¿cuál es el que más pasa?».
create index on public.errores (mensaje, creado_en desc);

comment on table public.errores is
  'Caídas de la aplicación. Sin datos personales: lo que entra pasa antes por '
  'dominio/errores.ts, que saca correos, tokens y direcciones firmadas.';

alter table public.errores enable row level security;

-- Cualquiera puede anotar su propia caída, y solo la suya. Que el
-- identificador venga del token y no del cliente es lo que impide que alguien
-- llene la tabla a nombre de otro.
create policy "anoto mis propias caídas" on public.errores
  for insert to authenticated
  with check (persona_id = auth.uid());

-- Leerlas es de la administración. Un alumno no tiene por qué ver en qué se
-- cae la aplicación de sus compañeros, y en un mensaje de error se cuela más
-- de lo que uno cree.
create policy "la administración ve las caídas" on public.errores
  for select to authenticated
  using (public.es_administrador());

grant insert on public.errores to authenticated;
grant select on public.errores to authenticated;

-- ── Que la tabla no crezca para siempre ──────────────────────────────────
--
-- Una pantalla rota puede escribir mucho en poco rato. Guardar un mes alcanza
-- de sobra para arreglar algo, y más que eso es pagar almacenamiento por
-- errores que ya no existen.
create or replace function public.limpiar_errores_viejos()
returns integer
language sql
security definer
set search_path = public
as $$
  with borradas as (
    delete from public.errores where creado_en < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from borradas
$$;

comment on function public.limpiar_errores_viejos() is
  'Borra las caídas de más de 30 días. Conviene correrla desde una tarea '
  'programada; mientras no exista, se puede llamar a mano.';


-- ───────────────────────────────────────────────────────────────────
-- 20260901000500 · avisos
-- ───────────────────────────────────────────────────────────────────

-- Que los avisos lleguen al teléfono, no solo al abrir la aplicación.
--
-- Un aviso de que una entrega vence mañana no sirve de nada si hay que entrar
-- a la app para verlo: quien entra ya se acordó. Los tres avisos que caducan
-- —la clase que empieza, la entrega que vence, la nota que se publicó— tienen
-- que salir del teléfono solos.
--
-- Qué merece sonar y a qué hora está decidido en `dominio/avisos.ts`, con
-- pruebas. Acá está dónde se guardan los aparatos y qué falta por avisar.

-- ── Los aparatos de cada quien ───────────────────────────────────────────
--
-- Una persona puede tener el teléfono y una tablet, y el aviso tiene que
-- llegar a los dos. Se guarda el identificador que da Expo, que es lo único
-- que hace falta para mandarle algo a un aparato.
create table public.aparatos (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.perfiles (id) on delete cascade,
  -- El identificador de Expo. Único: si alguien presta el teléfono y entra
  -- otra persona, el aparato pasa a ser de esa, no de las dos.
  token       text not null unique,
  plataforma  text not null default '',
  creado_en   timestamptz not null default now(),
  visto_en    timestamptz not null default now()
);
create index on public.aparatos (persona_id);

comment on table public.aparatos is
  'Los teléfonos a los que mandarle un aviso. Borrar la fila es apagar los '
  'avisos en ese aparato: no hay una preferencia aparte que pueda quedar '
  'diciendo una cosa mientras la tabla dice otra.';

alter table public.aparatos enable row level security;

create policy "veo mis aparatos" on public.aparatos
  for select to authenticated using (persona_id = auth.uid());

create policy "registro mis aparatos" on public.aparatos
  for insert to authenticated with check (persona_id = auth.uid());

create policy "actualizo mis aparatos" on public.aparatos
  for update to authenticated using (persona_id = auth.uid())
  with check (persona_id = auth.uid());

-- Apagar los avisos es borrar la fila. Que cada quien pueda borrar solo las
-- suyas evita que alguien deje sin avisos a otro.
create policy "apago los avisos de mis aparatos" on public.aparatos
  for delete to authenticated using (persona_id = auth.uid());

grant select, insert, update, delete on public.aparatos to authenticated;

-- ── Qué falta por avisar ─────────────────────────────────────────────────
--
-- La marca va en la notificación y no en una tabla aparte: así no hay dos
-- listas que se puedan desincronizar, y volver a mandar un aviso ya mandado
-- —el error clásico de esto— es imposible por construcción.
alter table public.notificaciones
  add column avisado_en timestamptz;

comment on column public.notificaciones.avisado_en is
  'Cuándo salió al teléfono. Nula significa que todavía no, no que no deba: '
  'qué tipos se avisan lo decide dominio/avisos.ts.';

-- El índice es sobre las que faltan, que son siempre pocas. Uno sobre la
-- columna entera tendría dentro todo el historial, que es justo lo que nunca
-- se consulta.
create index notificaciones_por_avisar
  on public.notificaciones (creado_en)
  where avisado_en is null;


-- ───────────────────────────────────────────────────────────────────
-- 20260901000600 · planes
-- ───────────────────────────────────────────────────────────────────

-- Qué plan tiene cada quien.
--
-- Hoy decide una sola cosa, y es la que se está construyendo: si la aplicación
-- guarda lo necesario en el aparato para poder estudiar sin señal. En los dos
-- planes pagados sí; en el gratis no.
--
-- Lo importante de esta migración no es la columna: es el disparador. Cualquier
-- persona puede abrir el APK, sacar la clave anónima —que es pública por
-- diseño— y escribirle a la base directamente. Un plan que se pudiera cambiar
-- desde el cliente sería un adorno: bastaría un `update` para tener lo pagado
-- sin pagarlo. Lo mismo que ya se hizo con el rol.

alter table public.perfiles
  add column plan text not null default 'gratis'
    check (plan in ('gratis', 'personal', 'institucion'));

comment on column public.perfiles.plan is
  'El plan de la persona. Lo escribe el servidor —la administración, o el '
  'cobro cuando exista—, nunca el cliente: un disparador lo impide.';

-- El disparador de arriba ya existía para el rol. Se reescribe para cuidar
-- las dos columnas: dos disparadores sobre la misma tabla haciendo lo mismo
-- son dos lugares donde olvidarse de uno.
create or replace function public.rol_no_se_cambia_solo()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and new.rol is distinct from old.rol then
    raise exception 'El rol no se cambia desde el cliente.';
  end if;
  if current_user = 'authenticated' and new.plan is distinct from old.plan then
    raise exception 'El plan no se cambia desde el cliente.';
  end if;
  return new;
end;
$$;

comment on function public.rol_no_se_cambia_solo() is
  'Impide que el cliente se cambie el rol o el plan. El nombre se queda por '
  'compatibilidad con el disparador que ya estaba montado.';

-- Leerlo sí puede el cliente: la aplicación tiene que saber si guardar las
-- cosas en el aparato. Los permisos de esta tabla van columna por columna
-- —así el correo de nadie se lee desde otra cuenta— y una columna nueva no
-- queda incluida sola.
grant select (plan) on public.perfiles to authenticated;

-- ── Cambiarlo desde la administración ────────────────────────────────────
--
-- Igual que `cambiar_rol`: SECURITY DEFINER para poder escribir la columna que
-- el disparador protege, y con la comprobación adentro para que ser función no
-- sea una manera de saltarse el permiso.
create or replace function public.cambiar_plan(p_persona uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración cambia el plan.';
  end if;
  if p_plan not in ('gratis', 'personal', 'institucion') then
    raise exception 'Ese plan no existe.';
  end if;

  update public.perfiles set plan = p_plan where id = p_persona;
end;
$$;

comment on function public.cambiar_plan(uuid, text) is
  'Cambia el plan de una persona. Solo la administración; el cobro, cuando '
  'exista, lo hará con la clave de servicio y no por acá.';

grant execute on function public.cambiar_plan(uuid, text) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260901000700 · permisos afinados
-- ───────────────────────────────────────────────────────────────────

-- Afinar quién puede llamar a las funciones nuevas.
--
-- Sale de revisar el código de estos días buscando por dónde se rompe. En
-- Postgres, `create function` deja la ejecución abierta a todo el mundo salvo
-- que uno la cierre, y eso convierte cualquier función SECURITY DEFINER sin
-- comprobación adentro en una puerta.
--
-- Todas las anteriores estaban bien: `registros`, `cambiar_rol` y
-- `cambiar_plan` comprueban que sea la administración; `alumnos_de` y
-- `companeros_de` comprueban la inscripción; `armar_la_clase` también; y
-- `cargar_catalogo` es SECURITY INVOKER, así que sus escrituras pasan por las
-- políticas como las de cualquiera. La que faltaba es una sola.

-- ── La que estaba abierta ────────────────────────────────────────────────
--
-- `limpiar_errores_viejos` borra el historial de caídas de más de 30 días. Es
-- SECURITY DEFINER, no comprobaba nada y cualquiera con una sesión podía
-- llamarla: un alumno cualquiera podía borrar el registro de errores del
-- colegio entero. No es un robo de datos, es peor de otra manera: uno se queda
-- sin la información con la que iba a arreglar las cosas, y sin enterarse.
create or replace function public.limpiar_errores_viejos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borradas integer;
begin
  -- La comprobación va adentro además del permiso de abajo: si mañana alguien
  -- vuelve a abrir la ejecución sin pensarlo, esto sigue en pie.
  if not public.es_administrador() then
    raise exception 'Limpiar el registro de caídas es de la administración.';
  end if;

  delete from public.errores where creado_en < now() - interval '30 days';
  get diagnostics borradas = row_count;
  return borradas;
end;
$$;

revoke execute on function public.limpiar_errores_viejos() from public;
grant execute on function public.limpiar_errores_viejos() to authenticated;

comment on function public.limpiar_errores_viejos() is
  'Borra las caídas de más de 30 días. Solo la administración. La tarea '
  'programada corre como superusuario y no pasa por esa comprobación.';

-- ── Las que NO hay que cerrar, y por qué ─────────────────────────────────
--
-- `dueno_de_la_ruta` y `ramo_de_la_entrega` también son llamables por
-- cualquiera, y se quedan así a propósito: las usan las políticas del
-- almacenamiento. Una política que llama a una función se evalúa con el rol de
-- quien consulta, así que revocarle la ejecución a `authenticated` no cerraría
-- una puerta: rompería la lectura de archivos con un «permission denied for
-- function», que además no se parece en nada a su causa.
--
-- Lo que se puede averiguar llamándolas es el ramo al que pertenece una tarea,
-- y para eso hay que conocer ya el identificador de esa tarea, que solo tiene
-- quien está en ese curso. Queda escrito acá para que la próxima persona que
-- revise esto no gaste la tarde en lo mismo.


-- ───────────────────────────────────────────────────────────────────
-- 20260901000800 · leer dictados
-- ───────────────────────────────────────────────────────────────────

-- Un docente no podía ver qué dicta.
--
-- `20260826000300_administracion.sql` concede sobre `dictados` insert, update
-- y delete, y se saltó select. La política "veo mis dictados" está escrita y es
-- correcta, pero una política no sirve de nada sin el permiso de tabla: Postgres
-- mira primero el grant, y sin él responde «permission denied for table
-- dictados» antes de llegar a evaluar ninguna política.
--
-- Lo que se rompía: `misDictados()`, que es de donde sale si esta persona dicta
-- algo. Sin eso la aplicación no muestra el panel docente y en su lugar aparece
-- «No pude cargar tus ramos». Todo el lado del profesor, caído, para todos.
--
-- No apareció antes porque las pruebas de acceso entran como `postgres`, que se
-- salta los permisos, y porque el resto del panel docente pregunta a través de
-- `dicta()`, que es `security definer` y tampoco los necesita. Lo encontró
-- herramientas/cruzar-consultas.mjs, cruzando cada consulta de la aplicación
-- contra los permisos de verdad.

grant select on public.dictados to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260901000900 · perfil solo el nombre
-- ───────────────────────────────────────────────────────────────────

-- Del perfil propio, el cliente solo cambia el nombre.
--
-- `20260825000200_rls.sql` concedía `insert, update` sobre `perfiles` entera.
-- La lectura sí estaba afinada por columna desde el principio —id, nombre,
-- creado_en, rol, plan— pero la escritura no, y quedaron alcanzables dos
-- columnas que nadie debería poder tocar desde un teléfono:
--
--   · `correo`, que el cliente no puede leer pero sí podía escribir. El correo
--     de verdad vive en auth.users; esta es la copia que `registros()` le
--     muestra a la administración. Alguien podía dejar ahí el correo de otra
--     persona y la lista de la administración lo habría mostrado como cierto.
--
--   · `id` y `creado_en`, que no se cambian nunca.
--
-- `rol` y `plan` ya estaban protegidos por el disparador `al_editar_perfil`,
-- que sigue donde estaba: esto no lo reemplaza, lo acompaña. La diferencia es
-- que ahora la base lo niega antes, por permisos, y no por una excepción.
--
-- `insert` se va entero: la fila la crea el disparador de alta, que es
-- `security definer` y no usa los permisos de quien se registra.

revoke insert, update on public.perfiles from authenticated;
grant  update (nombre) on public.perfiles to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260902000100 · reportes
-- ───────────────────────────────────────────────────────────────────

-- Reportar una respuesta de la IA.
--
-- No es una idea nuestra: Google Play lo exige. Una aplicación que genera
-- contenido con inteligencia artificial tiene que traer adentro una manera de
-- avisar que algo salió ofensivo, sin que la persona tenga que salirse de la
-- app a buscar un correo. Sin eso, la revisión la rechaza.
--
-- Y es razonable. El tutor le habla a menores en un colegio: la vía para decir
-- «esto no debió responderme esto» tiene que estar donde ocurrió, en el
-- momento, y no en una dirección de contacto que nadie va a buscar.

create table if not exists public.reportes (
  id           uuid primary key default gen_random_uuid(),
  persona_id   uuid not null references public.perfiles(id) on delete cascade,
  -- Qué lo generó. No es un enum a propósito: agregar una pantalla nueva no
  -- debería pedir una migración.
  origen       text not null check (origen in ('tutor', 'asistente', 'quiz', 'fichas', 'resumen')),
  -- El texto que se está reportando. Se guarda una copia y no una referencia:
  -- lo que hay que poder mirar después es exactamente lo que esa persona vio,
  -- y la conversación se puede borrar.
  contenido    text not null check (length(contenido) between 1 and 4000),
  motivo       text not null check (motivo in ('ofensivo', 'falso', 'peligroso', 'otro')),
  -- Lo que quiera agregar, si quiere. Casi siempre viene vacío.
  detalle      text check (detalle is null or length(detalle) <= 1000),
  -- Para que la administración pueda ir marcando lo que ya miró.
  revisado_en  timestamptz,
  creado_en    timestamptz not null default now()
);

create index if not exists reportes_sin_revisar
  on public.reportes (creado_en desc) where revisado_en is null;

alter table public.reportes enable row level security;

-- Reportar lo puede hacer cualquiera, sobre lo suyo.
create policy "reporto lo que me respondieron" on public.reportes
  for insert to authenticated
  with check (persona_id = auth.uid());

-- Leerlos es de la administración. Quien reporta no necesita volver a verlo:
-- lo que necesita es que alguien lo mire.
create policy "la administración lee los reportes" on public.reportes
  for select to authenticated
  using (public.es_administrador());

create policy "la administración los marca revisados" on public.reportes
  for update to authenticated
  using (public.es_administrador())
  with check (public.es_administrador());

grant insert (persona_id, origen, contenido, motivo, detalle) on public.reportes to authenticated;
grant select on public.reportes to authenticated;
grant update (revisado_en) on public.reportes to authenticated;

comment on table public.reportes is
  'Avisos de contenido generado por IA que alguien consideró ofensivo, falso o '
  'peligroso. Requisito de Google Play para aplicaciones con IA generativa.';


-- ───────────────────────────────────────────────────────────────────
-- 20260902000200 · quien dicta
-- ───────────────────────────────────────────────────────────────────

-- Quién dicta qué, para la administración.
--
-- El panel del colegio revisa que nadie quede citado en dos salas a la misma
-- hora. Para eso necesita saber qué profesor tiene cada ramo, y hasta ahora lo
-- sacaba de los perfiles de ejemplo del modo demostración: con el servidor
-- conectado, la revisión se hacía contra profesores inventados y no contra los
-- de verdad. Salía siempre limpia, y no porque el horario estuviera bien.
--
-- Va por función y no por consulta directa porque hace falta cruzar `dictados`
-- con `perfiles`, y el nombre de otra persona no es legible desde el cliente:
-- la política de `perfiles` deja ver el propio y nada más. Acá se cruza del
-- lado del servidor, con el permiso comprobado adentro.

create or replace function public.dictados_del_colegio()
returns table (persona uuid, quien text, codigo text, papel text)
language sql
stable
security definer
set search_path = public
as $$
  select d.docente_id, p.nombre, a.codigo, d.papel
  from public.dictados d
  join public.perfiles p on p.id = d.docente_id
  join public.asignaturas a on a.id = d.asignatura_id
  where public.es_administrador()
  order by a.codigo, d.papel
$$;

comment on function public.dictados_del_colegio() is
  'Quién dicta cada ramo, con el nombre. Solo para la administración: el '
  'where lo comprueba adentro, así que llamarla sin ese rol devuelve vacío.';

revoke execute on function public.dictados_del_colegio() from public;
grant execute on function public.dictados_del_colegio() to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260902000300 · plan en el registro
-- ───────────────────────────────────────────────────────────────────

-- El plan de cada persona, en el registro de la administración.
--
-- StudIA se vende de dos maneras y ninguna pasa por una pasarela propia. A las
-- personas, por Google Play, que cobra y avisa al servidor. A las
-- instituciones, por contrato: se conversa, se factura y se firma afuera, y
-- alguien de la administración deja el plan puesto acá.
--
-- Para eso el registro tiene que mostrar en qué plan está cada quien. Hasta
-- ahora mostraba el rol y no el plan, así que la administración no tenía cómo
-- saber a quién ya le corresponde lo que se contrató.

-- Cambia el tipo de lo que devuelve, así que hay que soltarla antes:
-- `create or replace` no puede cambiar la forma de la respuesta.
drop function if exists public.registros();

create function public.registros()
returns table (
  id        uuid,
  nombre    text,
  correo    text,
  rol       text,
  plan      text,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.correo, p.rol, p.plan, p.creado_en
    from public.perfiles p
   -- Sin esto la función sería una puerta de atrás al correo de todos. Para
   -- quien no es administración devuelve vacío, que es exactamente lo que ve
   -- hoy: nada.
   where public.es_administrador()
   order by p.creado_en desc;
$$;

comment on function public.registros() is
  'El registro completo, solo para la administración. Para cualquier otra '
  'persona devuelve vacío: el correo ajeno sigue sin ser legible.';


-- ───────────────────────────────────────────────────────────────────
-- 20260903000100 · matriculas
-- ───────────────────────────────────────────────────────────────────

-- La nómina de la institución, cargada antes de que nadie se registre.
--
-- Cuando una universidad contrata StudIA, lo que entrega es una planilla: su
-- gente, quién dicta qué y quién está inscrito en qué. Y casi nadie de esa
-- lista tiene cuenta todavía.
--
-- Ese es el problema. `perfiles.id` apunta a `auth.users`: no se puede crear
-- el perfil de alguien que no se ha registrado, y por lo tanto tampoco se lo
-- puede inscribir en un ramo. Hasta ahora la carga desde el panel dejaba los
-- ramos y el horario, y la nómina había que meterla por consola con la clave
-- de servicio —o sea, no la hacía la secretaría académica, que es justamente
-- quien tiene la planilla—.
--
-- Acá la nómina se guarda como matrícula pendiente, a nombre de un correo. El
-- día que esa persona se registra con ese correo, su cuenta queda armada sola:
-- con su rol, su plan y sus ramos. Y si ya estaba registrada, se le aplica en
-- el momento de cargar.

create table if not exists public.matriculas (
  id          uuid primary key default gen_random_uuid(),
  -- Siempre en minúsculas: una planilla trae «Juan.Perez@U.CL» y la persona
  -- se registra con «juan.perez@u.cl». Sin normalizar, no se encuentran.
  correo      text not null check (correo = lower(correo) and correo like '%@%'),
  rol         text not null check (rol in ('estudiante', 'profesor', 'administrador')),
  -- El ramo. Nulo para quien solo va en la nómina —la secretaría, por
  -- ejemplo— sin estar inscrito en nada.
  codigo      text,
  -- Solo para quien dicta.
  papel       text check (papel is null or papel in ('profesor', 'ayudante')),
  creada_en   timestamptz not null default now(),
  -- Cuándo se convirtió en cuenta de verdad. Nulo mientras espera.
  aplicada_en timestamptz,

  -- `nulls not distinct` porque casi todas las filas de una secretaría llevan
  -- el código en nulo, y sin esto se podrían repetir sin que nada avise.
  unique nulls not distinct (correo, codigo, papel)
);

create index if not exists matriculas_por_correo on public.matriculas (correo);
create index if not exists matriculas_pendientes
  on public.matriculas (correo) where aplicada_en is null;

comment on table public.matriculas is
  'La nómina que entrega una institución, a nombre de correos que todavía no '
  'tienen cuenta. Se convierte en inscripciones y dictados cuando la persona '
  'se registra.';

-- ── Convertir la matrícula en cuenta ────────────────────────────────────

create or replace function public.aplicar_matriculas(p_persona uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correo text;
  v_rol    text;
  v_actual text;
  v_hechas int := 0;
begin
  select correo, rol into v_correo, v_actual from public.perfiles where id = p_persona;
  if v_correo is null then return 0; end if;

  -- El rol más alto que le asigna la nómina. Una persona puede aparecer
  -- muchas veces —una por ramo— y todas dicen lo mismo, pero si no, el que
  -- manda es el que más puede.
  select rol into v_rol
    from public.matriculas
   where correo = v_correo
   order by case rol when 'administrador' then 3 when 'profesor' then 2 else 1 end desc
   limit 1;

  if v_rol is null then return 0; end if;

  -- Quien ya es administración no se baja de rol por una planilla: un archivo
  -- mal armado dejaría a la institución sin nadie que pueda arreglarlo.
  update public.perfiles
     set rol  = case when v_actual = 'administrador' then v_actual else v_rol end,
         -- Pertenecer a una institución que contrató es el plan de ella.
         plan = 'institucion'
   where id = p_persona;

  -- Los ramos en que queda inscrita.
  insert into public.inscripciones (estudiante_id, asignatura_id)
  select p_persona, a.id
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
   where m.correo = v_correo and m.rol = 'estudiante' and m.codigo is not null
  on conflict do nothing;

  get diagnostics v_hechas = row_count;

  -- Y los que dicta.
  insert into public.dictados (docente_id, asignatura_id, papel)
  select p_persona, a.id, coalesce(m.papel, 'profesor')
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
   where m.correo = v_correo and m.rol = 'profesor' and m.codigo is not null
  on conflict do nothing;

  update public.matriculas
     set aplicada_en = now()
   where correo = v_correo and aplicada_en is null;

  return v_hechas;
end;
$$;

comment on function public.aplicar_matriculas(uuid) is
  'Arma la cuenta de una persona con lo que la institución dejó cargado a su '
  'correo: su rol, su plan y sus ramos. Idempotente.';

revoke execute on function public.aplicar_matriculas(uuid) from public;

-- Al registrarse. Va sobre `perfiles` y no sobre `auth.users` porque necesita
-- que el perfil exista para poder actualizarlo.
create or replace function public.al_crear_perfil_aplicar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.aplicar_matriculas(new.id);
  return new;
end;
$$;

drop trigger if exists perfil_aplica_matriculas on public.perfiles;
create trigger perfil_aplica_matriculas
  after insert on public.perfiles
  for each row execute function public.al_crear_perfil_aplicar();

-- ── Cargar la nómina desde el panel ─────────────────────────────────────

create or replace function public.cargar_matriculas(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puestas   int;
  v_aplicadas int := 0;
  v_persona   uuid;
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración carga la nómina.';
  end if;
  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'La nómina tiene que venir como lista.';
  end if;

  insert into public.matriculas (correo, rol, codigo, papel)
  select lower(trim(x->>'correo')), x->>'rol',
         nullif(upper(trim(x->>'codigo')), ''), nullif(x->>'papel', '')
    from jsonb_array_elements(p_filas) x
  on conflict (correo, codigo, papel) do update
     set rol = excluded.rol, aplicada_en = null;

  get diagnostics v_puestas = row_count;

  -- A quien ya tenía cuenta se le aplica ahora: si un alumno se registró la
  -- semana pasada, no tiene por qué esperar a nada.
  for v_persona in
    select p.id from public.perfiles p
     where p.correo in (
       select correo from public.matriculas where aplicada_en is null
     )
  loop
    perform public.aplicar_matriculas(v_persona);
    v_aplicadas := v_aplicadas + 1;
  end loop;

  return jsonb_build_object(
    'filas', v_puestas,
    'aplicadas', v_aplicadas,
    'esperando', (select count(*) from public.matriculas where aplicada_en is null)
  );
end;
$$;

comment on function public.cargar_matriculas(jsonb) is
  'Deja cargada la nómina de la institución. Lo que corresponde a alguien ya '
  'registrado se aplica en el momento; el resto espera a que se registre.';

grant execute on function public.cargar_matriculas(jsonb) to authenticated;

-- ── Quién ve la nómina ──────────────────────────────────────────────────

alter table public.matriculas enable row level security;

create policy "la administración ve la nómina" on public.matriculas
  for select to authenticated using (public.es_administrador());

grant select on public.matriculas to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 20260904000100 · instituciones
-- ───────────────────────────────────────────────────────────────────

-- La institución, como cosa de primera clase.
--
-- Hasta acá el panel de administración era de un solo colegio: implícito, sin
-- nombre y sin borde. `es_administrador()` preguntaba «¿tiene rol
-- administrador?» y nada más, así que el día que la segunda universidad
-- contratara, su secretaría académica habría visto —de verdad, sin trucos— la
-- nómina completa de la primera: nombres, correos y ramos. Y habría podido
-- ascender a administrador a cualquiera de esa lista.
--
-- Esta migración le pone borde a eso. Tres ideas:
--
--   1. Existe `instituciones`. Las personas, los ramos del colegio y la
--      nómina pertenecen a una, y un administrador solo ve la suya.
--   2. El plan deja de ponerse persona por persona: se contratan N cupos y
--      la nómina los ocupa. Lo que se firmó está en una fila, no repartido
--      en mil perfiles.
--   3. Se separa la administración de una institución de la operación de
--      StudIA. Son dos trabajos distintos: la secretaría de una universidad
--      arma su semestre; nosotros miramos las caídas y los reportes de
--      contenido de todo el servicio. Antes eran el mismo permiso.
--
-- Una decisión que conviene dejar dicha, porque después es cara de cambiar:
-- una persona pertenece a UNA institución. Es una columna en `perfiles` y no
-- una tabla de por medio. Quien estudie en dos universidades a la vez va a
-- necesitar dos cuentas, y eso es aceptable hoy: el caso es raro, y la tabla
-- de por medio obligaría a que cada consulta de la aplicación —el horario,
-- las tareas, el tutor— supiera en cuál de las dos está parada la persona en
-- este momento. Cuando aparezca el primer caso real se agrega la tabla; hasta
-- entonces sería complejidad pagada por adelantado.

create table public.instituciones (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (length(trim(nombre)) > 0),
  -- Cuántas personas cubre el contrato. Se ocupan a medida que su gente se
  -- registra; la nómina puede tener más filas que cupos y eso no es un error,
  -- es lo que hay que ver a tiempo.
  cupos     integer not null check (cupos >= 0),
  -- Nulo mientras no haya fecha de término. Vencido, los cupos dejan de
  -- entregarse: quien ya lo tiene no lo pierde de golpe, pero nadie nuevo
  -- entra hasta que se renueve.
  vence_en  timestamptz,
  creada_en timestamptz not null default now()
);

comment on table public.instituciones is
  'Cada universidad o colegio que contrató StudIA. Es el borde: un '
  'administrador ve su institución y ninguna otra.';
comment on column public.instituciones.cupos is
  'Lo que se contrató. El plan de institución se entrega mientras queden.';

-- ── A quién pertenece cada cosa ──────────────────────────────────────────

alter table public.perfiles
  -- `set null` y no `cascade`: si se borra el contrato, la gente no se borra.
  -- Quedan como cuentas personales, con lo suyo intacto.
  add column institucion_id uuid references public.instituciones (id) on delete set null,
  -- Nosotros. Ver más abajo por qué no alcanzaba con un cuarto rol.
  add column operador boolean not null default false;

alter table public.asignaturas
  add column institucion_id uuid references public.instituciones (id) on delete cascade;

alter table public.matriculas
  add column institucion_id uuid references public.instituciones (id) on delete cascade;

comment on column public.perfiles.institucion_id is
  'La institución a la que pertenece. Nulo para quien entró por su cuenta.';
comment on column public.perfiles.operador is
  'Personal de StudIA. Ve las caídas y los reportes de contenido de todo el '
  'servicio; no es el administrador de ninguna institución.';
comment on column public.asignaturas.institucion_id is
  'La institución dueña del ramo. Nulo en los ramos propios, que son de su '
  'creador y de nadie más.';

create index perfiles_por_institucion on public.perfiles (institucion_id)
  where institucion_id is not null;
create index asignaturas_por_institucion on public.asignaturas (institucion_id)
  where institucion_id is not null;
create index matriculas_por_institucion on public.matriculas (institucion_id);

-- ── Lo que ya estaba ─────────────────────────────────────────────────────
--
-- Antes de esta migración había exactamente una institución: la implícita.
-- Se le pone nombre y se le cuelga todo lo que existía. En una base recién
-- creada no hay nada que colgar y este bloque no hace nada.

do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.asignaturas where creador_id is null)
     or exists (select 1 from public.matriculas)
  then
    insert into public.instituciones (nombre, cupos)
    values ('Institución inicial',
            greatest((select count(*) from public.perfiles), 100))
    returning id into v_id;

    update public.asignaturas set institucion_id = v_id where creador_id is null;
    update public.matriculas   set institucion_id = v_id;
    update public.perfiles     set institucion_id = v_id;
  end if;
end $$;

alter table public.matriculas alter column institucion_id set not null;

-- Un ramo es de alguien: de una institución o de la persona que lo creó.
alter table public.asignaturas
  add constraint asignatura_tiene_dueno
  check (creador_id is not null or institucion_id is not null);

-- MAT1610 hay uno solo POR institución. Antes lo había uno solo en toda la
-- base, y eso habría hecho chocar a la segunda universidad con la primera por
-- un código de ramo tan común como «MAT1»
drop index public.asignaturas_codigo_del_colegio;
create unique index asignaturas_codigo_del_colegio
  on public.asignaturas (institucion_id, codigo)
  where creador_id is null;

comment on index public.asignaturas_codigo_del_colegio is
  'El código es único dentro de la institución. Dos universidades pueden '
  'tener MAT1610 y no son el mismo ramo.';

-- La nómina también: el mismo correo puede estar en dos nóminas.
alter table public.matriculas drop constraint matriculas_correo_codigo_papel_key;
alter table public.matriculas
  add constraint matriculas_sin_repetir
  unique nulls not distinct (institucion_id, correo, codigo, papel);

-- ── Quién soy ────────────────────────────────────────────────────────────

create or replace function public.mi_institucion()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institucion_id from public.perfiles where id = auth.uid();
$$;

comment on function public.mi_institucion() is
  'La institución de quien consulta, o nulo. `security definer` porque las '
  'políticas de otras tablas la llaman y no pueden depender de lo que esa '
  'persona alcance a leer de su propio perfil.';

revoke execute on function public.mi_institucion() from public;
grant  execute on function public.mi_institucion() to authenticated;

-- Nosotros, no ellos.
--
-- Podría haber sido un cuarto rol —'operador'— y sería peor: el rol decide
-- qué aplicación abre la persona, y quien opera StudIA también puede ser
-- alumno o profesor en alguna parte. Un rol que hay que dejar de ser para
-- poder estudiar es un rol mal puesto. Va como columna aparte.
create or replace function public.es_operador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select operador from public.perfiles where id = auth.uid()), false);
$$;

comment on function public.es_operador() is
  'Personal de StudIA. No es un rol: es una marca aparte, porque quien opera '
  'el servicio también puede estar estudiando en alguna institución.';

revoke execute on function public.es_operador() from public;
grant  execute on function public.es_operador() to authenticated;

-- ¿Este ramo es de mi institución? Lo usan las políticas de las tablas que
-- cuelgan de una asignatura y no llevan la columna encima.
create or replace function public.es_de_mi_institucion(p_asignatura uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.asignaturas a
     where a.id = p_asignatura
       and a.institucion_id is not null
       and a.institucion_id = public.mi_institucion()
  );
$$;

revoke execute on function public.es_de_mi_institucion(uuid) from public;
grant  execute on function public.es_de_mi_institucion(uuid) to authenticated;

-- ¿Queda cupo? `p_excluir` es la persona a la que se le está por dar: si ya
-- lo tiene, no debe contarse dos veces y quedarse sin el suyo propio.
create or replace function public.cupo_disponible(p_institucion uuid, p_excluir uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.instituciones i
     where i.id = p_institucion
       and (i.vence_en is null or i.vence_en > now())
       and (
         select count(*) from public.perfiles p
          where p.institucion_id = i.id
            and p.plan = 'institucion'
            and (p_excluir is null or p.id <> p_excluir)
       ) < i.cupos
  );
$$;

comment on function public.cupo_disponible(uuid, uuid) is
  'Si el contrato todavía alcanza para una persona más. Un contrato vencido '
  'no entrega cupos nuevos, y no le quita el suyo a quien ya lo tenía.';

revoke execute on function public.cupo_disponible(uuid, uuid) from public;

-- ── Que el cliente no se mude de institución solo ────────────────────────
--
-- El disparador ya cuidaba el rol y el plan. Ahora hay dos columnas más que
-- valen exactamente lo mismo: pertenecer a una institución es tener el plan
-- pagado, y ser operador es ver el servicio entero.
create or replace function public.rol_no_se_cambia_solo()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' then
    if new.rol is distinct from old.rol then
      raise exception 'El rol no se cambia desde el cliente.';
    end if;
    if new.plan is distinct from old.plan then
      raise exception 'El plan no se cambia desde el cliente.';
    end if;
    if new.institucion_id is distinct from old.institucion_id then
      raise exception 'La institución no se cambia desde el cliente.';
    end if;
    if new.operador is distinct from old.operador then
      raise exception 'Eso no se cambia desde el cliente.';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.rol_no_se_cambia_solo() is
  'Impide que el cliente se cambie el rol, el plan, la institución o la '
  'marca de operador. El nombre se queda por el disparador ya montado.';

-- ── Las políticas del colegio, ahora con borde ───────────────────────────
--
-- Las ocho de siempre. Cambia una sola cosa en cada una: además de ser
-- administración, la fila tiene que ser de su institución. Se sueltan y se
-- vuelven a crear porque `create policy` no tiene un «or replace».

drop policy "administración ve todas las asignaturas" on public.asignaturas;
drop policy "administración crea asignaturas"         on public.asignaturas;

create policy "administración ve las asignaturas de su institución" on public.asignaturas
  for select to authenticated
  using (public.es_administrador() and institucion_id = public.mi_institucion());

create policy "administración crea asignaturas de su institución" on public.asignaturas
  for all to authenticated
  using      (public.es_administrador() and institucion_id = public.mi_institucion())
  with check (public.es_administrador() and institucion_id = public.mi_institucion());

drop policy "administración ve todo el horario" on public.bloques_horario;
drop policy "administración arma el horario"    on public.bloques_horario;

create policy "administración ve el horario de su institución" on public.bloques_horario
  for select to authenticated
  using (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

create policy "administración arma el horario de su institución" on public.bloques_horario
  for all to authenticated
  using      (public.es_administrador() and public.es_de_mi_institucion(asignatura_id))
  with check (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

drop policy "administración ve los dictados"     on public.dictados;
drop policy "administración asigna los dictados" on public.dictados;

create policy "administración ve los dictados de su institución" on public.dictados
  for select to authenticated
  using (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

create policy "administración asigna los dictados de su institución" on public.dictados
  for all to authenticated
  using      (public.es_administrador() and public.es_de_mi_institucion(asignatura_id))
  with check (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

drop policy "administración ve las inscripciones" on public.inscripciones;
drop policy "administración inscribe"             on public.inscripciones;

create policy "administración ve las inscripciones de su institución" on public.inscripciones
  for select to authenticated
  using (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

create policy "administración inscribe en su institución" on public.inscripciones
  for all to authenticated
  using      (public.es_administrador() and public.es_de_mi_institucion(asignatura_id))
  with check (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

-- La nómina.
drop policy "la administración ve la nómina" on public.matriculas;
create policy "la administración ve la nómina de su institución" on public.matriculas
  for select to authenticated
  using (public.es_administrador() and institucion_id = public.mi_institucion());

-- La institución misma. Cualquiera ve la suya —la aplicación muestra su
-- nombre— y nadie ve otra.
alter table public.instituciones enable row level security;

create policy "veo mi institución" on public.instituciones
  for select to authenticated
  using (id = public.mi_institucion());

grant select on public.instituciones to authenticated;

-- ── Lo que es de StudIA y no de una institución ──────────────────────────
--
-- Las caídas y los reportes de contenido son del servicio entero. Estaban
-- abiertos a `es_administrador()`, es decir: la secretaría de una universidad
-- habría leído los mensajes de error y los reportes de IA de todas las demás.
-- Y ninguna de las dos cosas le sirve para nada: no puede arreglar la
-- aplicación ni ajustar el modelo.

drop policy "la administración ve las caídas" on public.errores;
create policy "la operación ve las caídas" on public.errores
  for select to authenticated using (public.es_operador());

drop policy "la administración lee los reportes"      on public.reportes;
drop policy "la administración los marca revisados"   on public.reportes;

create policy "la operación lee los reportes" on public.reportes
  for select to authenticated using (public.es_operador());

create policy "la operación los marca revisados" on public.reportes
  for update to authenticated
  using (public.es_operador()) with check (public.es_operador());

create or replace function public.limpiar_errores_viejos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borradas integer;
begin
  if not public.es_operador() then
    raise exception 'Limpiar el registro de caídas es de la operación de StudIA.';
  end if;

  delete from public.errores where creado_en < now() - interval '30 days';
  get diagnostics borradas = row_count;
  return borradas;
end;
$$;

comment on function public.limpiar_errores_viejos() is
  'Borra las caídas de más de 30 días. Solo la operación de StudIA. La tarea '
  'programada corre como superusuario y no pasa por esa comprobación.';

-- ── Las funciones con guardia ────────────────────────────────────────────
--
-- Todas comprobaban `es_administrador()` y nada más. Cada una gana la misma
-- segunda condición, y ninguna la puede saltar: son `security definer`, así
-- que acá adentro no queda ninguna política que las frene.

create or replace function public.registros()
returns table (
  id        uuid,
  nombre    text,
  correo    text,
  rol       text,
  plan      text,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.correo, p.rol, p.plan, p.creado_en
    from public.perfiles p
   where public.es_administrador()
     -- Las dos comparaciones importan. Sin la segunda, la secretaría de una
     -- universidad leería el correo de todo el servicio. Sin `is not null`,
     -- un administrador suelto —sin institución— se llevaría a todas las
     -- personas que tampoco tienen una, que son las cuentas personales.
     and p.institucion_id is not null
     and p.institucion_id = public.mi_institucion()
   order by p.creado_en desc;
$$;

comment on function public.registros() is
  'La gente de mi institución, con su correo. Solo para su administración. '
  'Para cualquier otra persona devuelve vacío.';

create or replace function public.cambiar_rol(p_persona uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suya uuid;
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración cambia roles.';
  end if;

  if p_rol not in ('estudiante', 'profesor', 'administrador') then
    raise exception 'Rol desconocido: %', p_rol;
  end if;

  -- Nadie se cambia el rol a sí mismo, ni para subir ni para bajar. Subir
  -- solo sería ascenderse; bajar dejaría al colegio sin quien administre si
  -- fuera la última persona. Que lo haga otra de administración.
  if p_persona = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol. Pídeselo a otra persona de administración.';
  end if;

  select institucion_id into v_suya from public.perfiles where id = p_persona;
  if not found then
    raise exception 'Esa persona ya no está registrada.';
  end if;
  -- Sin esto, ser administrador de una institución alcanzaba para ascender a
  -- cualquiera del servicio, incluida gente de otra universidad.
  if v_suya is null or v_suya is distinct from public.mi_institucion() then
    raise exception 'Esa persona no es de tu institución.';
  end if;

  update public.perfiles set rol = p_rol where id = p_persona;
end;
$$;

comment on function public.cambiar_rol(uuid, text) is
  'Cambia el rol de otra persona de la misma institución. Nunca el propio: '
  'ascenderse a uno mismo sería la única manera de saltarse todo lo demás.';

-- El plan ya no se elige de una lista de tres: se da o se quita el cupo que
-- la institución contrató. El plan Personal viene de Google Play y esta
-- función no lo toca ni para ponerlo ni para sacarlo.
create or replace function public.cambiar_plan(p_persona uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suya  uuid;
  v_antes text;
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración cambia el plan.';
  end if;
  if p_plan not in ('gratis', 'institucion') then
    raise exception 'Desde acá solo se da o se quita el cupo de la institución. El plan Personal lo pone Google Play.';
  end if;

  select institucion_id, plan into v_suya, v_antes
    from public.perfiles where id = p_persona;
  if not found then
    raise exception 'Esa persona ya no está registrada.';
  end if;
  if v_suya is null or v_suya is distinct from public.mi_institucion() then
    raise exception 'Esa persona no es de tu institución.';
  end if;
  if v_antes = 'personal' then
    raise exception 'Esa persona paga su plan por Google Play. Quitárselo desde acá no le devuelve el dinero.';
  end if;
  if p_plan = 'institucion' and not public.cupo_disponible(v_suya, p_persona) then
    raise exception 'No quedan cupos en el contrato. Quítale el cupo a alguien que ya no esté, o amplía el contrato.';
  end if;

  update public.perfiles set plan = p_plan where id = p_persona;
end;
$$;

comment on function public.cambiar_plan(uuid, text) is
  'Da o quita el cupo de la institución a una persona de ella. No entrega '
  'más cupos de los contratados, y no toca el plan Personal de Google Play.';

create or replace function public.dictados_del_colegio()
returns table (persona uuid, quien text, codigo text, papel text)
language sql
stable
security definer
set search_path = public
as $$
  select d.docente_id, p.nombre, a.codigo, d.papel
    from public.dictados d
    join public.perfiles p   on p.id = d.docente_id
    join public.asignaturas a on a.id = d.asignatura_id
   where public.es_administrador()
     and a.institucion_id is not null
     and a.institucion_id = public.mi_institucion()
   order by a.codigo, d.papel;
$$;

comment on function public.dictados_del_colegio() is
  'Quién dicta cada ramo de mi institución, con el nombre. Solo para su '
  'administración: la comprobación va adentro.';

create or replace function public.alumnos_de(p_asignatura uuid)
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre
    from public.inscripciones i
    join public.perfiles p on p.id = i.estudiante_id
   where i.asignatura_id = p_asignatura
     and (public.dicta(p_asignatura)
          or (public.es_administrador() and public.es_de_mi_institucion(p_asignatura)))
   order by p.nombre;
$$;

comment on function public.alumnos_de(uuid) is
  'La lista del curso. La ve quien lo dicta, y la administración de la '
  'institución dueña del ramo.';

-- ── Cargar el catálogo, dentro de la institución ─────────────────────────

create or replace function public.cargar_catalogo(
  p_asignaturas jsonb,
  p_horario     jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inst    uuid;
  v_codigos text[];
  v_ramos   int;
  v_bloques int;
begin
  if jsonb_typeof(p_asignaturas) <> 'array' or jsonb_typeof(p_horario) <> 'array' then
    raise exception 'Las dos planillas tienen que venir como listas.';
  end if;

  -- Un ramo del colegio es de una institución, siempre. Sin esto la carga
  -- moriría más adelante contra el `check`, con un mensaje del motor que no
  -- le dice nada a quien está pegando su planilla.
  v_inst := public.mi_institucion();
  if v_inst is null then
    raise exception 'Tu cuenta no pertenece a ninguna institución, así que no hay dónde cargar estos ramos.';
  end if;

  -- Los ramos que toca esta carga. Lo que no esté acá no se mira siquiera:
  -- una planilla parcial no puede borrar el resto del semestre.
  select array_agg(upper(x->>'codigo')) into v_codigos
    from jsonb_array_elements(p_asignaturas) x;

  if v_codigos is null then
    return jsonb_build_object('ramos', 0, 'bloques', 0);
  end if;

  insert into public.asignaturas
    (institucion_id, codigo, nombre, profesor, ayudante, color, creditos,
     descripcion, requisitos, bibliografia, intro_tutor)
  select
    v_inst,
    upper(x->>'codigo'), x->>'nombre', x->>'profesor', nullif(x->>'ayudante', ''),
    x->>'color', (x->>'creditos')::smallint,
    nullif(x->>'descripcion', ''), nullif(x->>'requisitos', ''),
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(x->'bibliografia') b),
      '{}'::text[]),
    x->>'intro_tutor'
  from jsonb_array_elements(p_asignaturas) x
  -- Repetir la condición del índice parcial es lo que deja inferirlo. Ahora
  -- lleva la institución adelante: el mismo código en otra universidad es
  -- otro ramo y no debe pisarse.
  on conflict (institucion_id, codigo) where creador_id is null do update set
    nombre = excluded.nombre, profesor = excluded.profesor,
    ayudante = excluded.ayudante, color = excluded.color,
    creditos = excluded.creditos, descripcion = excluded.descripcion,
    requisitos = excluded.requisitos, bibliografia = excluded.bibliografia,
    intro_tutor = excluded.intro_tutor;

  get diagnostics v_ramos = row_count;

  -- El horario se rehace entero para esos ramos: un bloque que se sacó de la
  -- planilla tiene que desaparecer, y no hay nada del alumno colgando de él.
  delete from public.bloques_horario
   where asignatura_id in (
     select id from public.asignaturas
      where codigo = any(v_codigos) and creador_id is null
        and institucion_id = v_inst);

  insert into public.bloques_horario (asignatura_id, dia, hora_inicio, hora_fin, sala, tipo)
  select a.id, (x->>'dia')::smallint, (x->>'hora_inicio')::time,
         (x->>'hora_fin')::time, x->>'sala', x->>'tipo'
    from jsonb_array_elements(p_horario) x
    join public.asignaturas a
      on a.codigo = upper(x->>'codigo') and a.creador_id is null
     and a.institucion_id = v_inst;

  get diagnostics v_bloques = row_count;

  -- Si un bloque quedó sin ramo, la planilla nombraba un código que no existe
  -- y el horario habría quedado incompleto en silencio.
  if v_bloques <> jsonb_array_length(p_horario) then
    raise exception 'El horario nombra ramos que no están en la planilla de asignaturas.';
  end if;

  return jsonb_build_object('ramos', v_ramos, 'bloques', v_bloques);
end;
$$;

comment on function public.cargar_catalogo(jsonb, jsonb) is
  'Carga ramos y horario de la institución de quien llama, en una '
  'transacción. Idempotente: reimportar actualiza y no duplica.';

-- ── La nómina, dentro de la institución ──────────────────────────────────

create or replace function public.aplicar_matriculas(p_persona uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correo text;
  v_actual text;
  v_plan   text;
  v_suya   uuid;
  v_inst   uuid;
  v_rol    text;
  v_cabe   boolean;
  v_hechas int := 0;
begin
  select correo, rol, plan, institucion_id
    into v_correo, v_actual, v_plan, v_suya
    from public.perfiles where id = p_persona;
  if v_correo is null then return 0; end if;

  -- De qué institución es esta persona.
  --
  -- Si ya pertenece a una, solo se le aplica lo de ESA. La nómina de otra no
  -- se lleva a alguien que ya está en un contrato: sin esta regla, la
  -- secretaría de la universidad B podría escribir el correo de un alumno de
  -- la A en su planilla y quedárselo, con sus ramos y todo.
  if v_suya is not null then
    v_inst := v_suya;
  else
    -- Si no, la primera que lo pidió.
    select institucion_id into v_inst
      from public.matriculas
     where correo = v_correo and aplicada_en is null
     order by creada_en
     limit 1;
  end if;
  if v_inst is null then return 0; end if;

  -- El rol más alto que le asigna la nómina de esa institución. Una persona
  -- puede aparecer muchas veces —una por ramo— y todas dicen lo mismo, pero
  -- si no, el que manda es el que más puede.
  select rol into v_rol
    from public.matriculas
   where correo = v_correo and institucion_id = v_inst
   order by case rol when 'administrador' then 3 when 'profesor' then 2 else 1 end desc
   limit 1;

  if v_rol is null then return 0; end if;

  v_cabe := public.cupo_disponible(v_inst, p_persona);

  update public.perfiles
     set -- Quien ya es administración no se baja de rol por una planilla: un
         -- archivo mal armado dejaría a la institución sin nadie que pueda
         -- arreglarlo.
         rol = case when v_actual = 'administrador' then v_actual else v_rol end,
         institucion_id = v_inst,
         -- El plan sale del contrato, y solo si queda cupo. Sin cupo la
         -- persona entra igual, con sus ramos, en el plan gratis: media
         -- matrícula es mejor que un error que nadie ve. Quien ya paga por
         -- Google Play se queda con lo suyo y no gasta un cupo.
         plan = case
                  when v_plan = 'personal' then v_plan
                  when v_cabe              then 'institucion'
                  else v_plan
                end
   where id = p_persona;

  -- Los ramos en que queda inscrita.
  insert into public.inscripciones (estudiante_id, asignatura_id)
  select p_persona, a.id
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
     and a.institucion_id = v_inst
   where m.correo = v_correo and m.institucion_id = v_inst
     and m.rol = 'estudiante' and m.codigo is not null
  on conflict do nothing;

  get diagnostics v_hechas = row_count;

  -- Y los que dicta.
  insert into public.dictados (docente_id, asignatura_id, papel)
  select p_persona, a.id, coalesce(m.papel, 'profesor')
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
     and a.institucion_id = v_inst
   where m.correo = v_correo and m.institucion_id = v_inst
     and m.rol = 'profesor' and m.codigo is not null
  on conflict do nothing;

  update public.matriculas
     set aplicada_en = now()
   where correo = v_correo and institucion_id = v_inst and aplicada_en is null;

  return v_hechas;
end;
$$;

comment on function public.aplicar_matriculas(uuid) is
  'Arma la cuenta de una persona con lo que su institución dejó cargado a su '
  'correo: su rol, su cupo y sus ramos. Idempotente. Quien ya pertenece a una '
  'institución no es reclamable por la nómina de otra.';

create or replace function public.cargar_matriculas(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst      uuid;
  v_puestas   int;
  v_aplicadas int := 0;
  v_persona   uuid;
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración carga la nómina.';
  end if;
  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'La nómina tiene que venir como lista.';
  end if;

  v_inst := public.mi_institucion();
  if v_inst is null then
    raise exception 'Tu cuenta no pertenece a ninguna institución, así que no hay nómina que cargar.';
  end if;

  -- La institución la pone el servidor, no la planilla: si viniera en el
  -- archivo, cargar una nómina sería poder escribir en la de al lado.
  insert into public.matriculas (institucion_id, correo, rol, codigo, papel)
  select v_inst, lower(trim(x->>'correo')), x->>'rol',
         nullif(upper(trim(x->>'codigo')), ''), nullif(x->>'papel', '')
    from jsonb_array_elements(p_filas) x
  on conflict (institucion_id, correo, codigo, papel) do update
     set rol = excluded.rol, aplicada_en = null;

  get diagnostics v_puestas = row_count;

  -- A quien ya tenía cuenta se le aplica ahora: si un alumno se registró la
  -- semana pasada, no tiene por qué esperar a nada.
  for v_persona in
    select p.id from public.perfiles p
     where p.correo in (
       select correo from public.matriculas
        where institucion_id = v_inst and aplicada_en is null
     )
  loop
    perform public.aplicar_matriculas(v_persona);
    v_aplicadas := v_aplicadas + 1;
  end loop;

  return jsonb_build_object(
    'filas', v_puestas,
    'aplicadas', v_aplicadas,
    'esperando', (select count(*) from public.matriculas
                   where institucion_id = v_inst and aplicada_en is null)
  );
end;
$$;

comment on function public.cargar_matriculas(jsonb) is
  'Deja cargada la nómina de MI institución. Lo que corresponde a alguien ya '
  'registrado se aplica en el momento; el resto espera a que se registre.';

-- ── Lo que el panel necesita saber del contrato ──────────────────────────

create or replace function public.mi_institucion_detalle()
returns table (
  id        uuid,
  nombre    text,
  cupos     integer,
  ocupados  bigint,
  esperando bigint,
  vence_en  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.nombre, i.cupos,
         (select count(*) from public.perfiles p
           where p.institucion_id = i.id and p.plan = 'institucion'),
         (select count(*) from public.matriculas m
           where m.institucion_id = i.id and m.aplicada_en is null),
         i.vence_en
    from public.instituciones i
   where i.id = public.mi_institucion()
     and public.es_administrador();
$$;

comment on function public.mi_institucion_detalle() is
  'El contrato en una fila: cuántos cupos hay, cuántos se ocuparon y cuánta '
  'gente de la nómina todavía no se registra.';

revoke execute on function public.mi_institucion_detalle() from public;
grant  execute on function public.mi_institucion_detalle() to authenticated;

-- ── Abrir una institución ────────────────────────────────────────────────
--
-- Esto no es de la secretaría de nadie: es la venta. Lo hacemos nosotros, y
-- por ahora desde el editor SQL de Supabase, que es donde no hay sesión y
-- `auth.uid()` viene nulo. De ahí la guardia de dos partes: con sesión hay
-- que ser operador; sin sesión, quien está escribiendo tiene la clave de
-- servicio y ya podía hacer cualquier cosa.
--
--   select public.crear_institucion('Universidad de Chile', 4000,
--                                   'secretaria.academica@uchile.cl');
--
-- Deja la institución creada y a esa persona esperando como administradora:
-- el día que se registre con ese correo, entra con el panel armado.

create or replace function public.crear_institucion(
  p_nombre text,
  p_cupos  integer,
  p_admin  text default null,
  p_vence  timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is not null and not public.es_operador() then
    raise exception 'Abrir una institución es de la operación de StudIA.';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'La institución necesita un nombre.';
  end if;
  if p_cupos is null or p_cupos < 0 then
    raise exception 'Los cupos contratados no pueden ser negativos.';
  end if;

  insert into public.instituciones (nombre, cupos, vence_en)
  values (trim(p_nombre), p_cupos, p_vence)
  returning id into v_id;

  if p_admin is not null then
    insert into public.matriculas (institucion_id, correo, rol)
    values (v_id, lower(trim(p_admin)), 'administrador');

    -- Y si esa persona ya tenía cuenta, no espera a nada.
    perform public.aplicar_matriculas(p.id)
       from public.perfiles p where p.correo = lower(trim(p_admin));
  end if;

  return v_id;
end;
$$;

comment on function public.crear_institucion(text, integer, text, timestamptz) is
  'Abre una institución y deja a su primera administradora esperando en la '
  'nómina. Solo la operación de StudIA, o quien tenga la clave de servicio.';

revoke execute on function public.crear_institucion(text, integer, text, timestamptz) from public;

-- Marcarse como operador. Mismo criterio: desde el editor SQL, la primera vez.
--
--   select public.hacer_operador('tomas@studia.cl', true);
create or replace function public.hacer_operador(p_correo text, p_es boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_operador() then
    raise exception 'Solo la operación de StudIA marca operadores.';
  end if;

  update public.perfiles set operador = p_es where correo = lower(trim(p_correo));
  if not found then
    raise exception 'Nadie está registrado con ese correo todavía.';
  end if;
end;
$$;

comment on function public.hacer_operador(text, boolean) is
  'Marca —o desmarca— a alguien como personal de StudIA. La primera vez se '
  'corre desde el editor SQL, que es donde no hay sesión.';

revoke execute on function public.hacer_operador(text, boolean) from public;


-- ───────────────────────────────────────────────────────────────────
-- Quedan anotadas como aplicadas
-- ───────────────────────────────────────────────────────────────────

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

insert into supabase_migrations.schema_migrations (version, name) values
  ('20260825000100', 'esquema'),
  ('20260825000200', 'rls'),
  ('20260825000300', 'companeros'),
  ('20260825000400', 'apuntes'),
  ('20260825000500', 'apuntes_tablero'),
  ('20260826000100', 'lectura'),
  ('20260826000200', 'docentes'),
  ('20260826000300', 'administracion'),
  ('20260827000100', 'lista_del_curso'),
  ('20260827000200', 'uso_asistente'),
  ('20260827000300', 'espacio_propio'),
  ('20260827000400', 'codigo_por_dueno'),
  ('20260829000100', 'cargar_catalogo'),
  ('20260829000200', 'registros'),
  ('20260830000100', 'sesiones_estudio'),
  ('20260830000200', 'quices'),
  ('20260830000300', 'fichas'),
  ('20260830000400', 'apuntes_a_mano'),
  ('20260830000500', 'modo_escucha'),
  ('20260831000100', 'planificacion'),
  ('20260901000100', 'borrar_cuenta'),
  ('20260901000200', 'almacenamiento'),
  ('20260901000300', 'entregas_con_archivo'),
  ('20260901000400', 'errores'),
  ('20260901000500', 'avisos'),
  ('20260901000600', 'planes'),
  ('20260901000700', 'permisos_afinados'),
  ('20260901000800', 'leer_dictados'),
  ('20260901000900', 'perfil_solo_el_nombre'),
  ('20260902000100', 'reportes'),
  ('20260902000200', 'quien_dicta'),
  ('20260902000300', 'plan_en_el_registro'),
  ('20260903000100', 'matriculas'),
  ('20260904000100', 'instituciones')
on conflict (version) do nothing;
