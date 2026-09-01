-- Andamio SOLO para pruebas locales: imita lo mínimo que Supabase provee
-- (el esquema auth y auth.uid()) para poder correr las migraciones sin
-- levantar Supabase entero. No se despliega.

create schema if not exists auth;
create extension if not exists pgcrypto with schema public;

create table if not exists auth.users (
  id                  uuid primary key,
  instance_id         uuid,
  aud                 text,
  role                text,
  email               text unique,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  raw_app_meta_data   jsonb,
  raw_user_meta_data  jsonb
);

-- En Supabase esto lee el JWT. Acá lo simulamos con un ajuste de sesión.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('pruebas.uid', true), '')::uuid $$;

-- Roles que las políticas nombran.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

-- Supabase concede esto al iniciar el proyecto. Sin ello, una política puede
-- llamar a auth.uid() —el motor evalúa esas expresiones aparte— pero un
-- trigger no, y la diferencia solo aparece cuando se escribe uno.
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;


-- ── El almacenamiento, de mentira ────────────────────────────────────────
--
-- Supabase trae el esquema `storage` hecho; acá no existe, y sin él la
-- migración del bucket no corre y sus políticas —que son lo que decide quién
-- puede abrir el archivo de quién— no se podrían probar nunca. Esto es lo
-- mínimo que esas políticas tocan, con los mismos nombres.
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now(),
  metadata   jsonb
);
alter table storage.objects enable row level security;

-- La que usan las políticas de Supabase para leer la ruta por partes.
-- «yo/p-1/aaa-apunte.pdf» da {yo, p-1}: el archivo no, las carpetas sí.
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$
    select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
  $$;

grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;
