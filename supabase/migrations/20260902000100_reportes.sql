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
