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
