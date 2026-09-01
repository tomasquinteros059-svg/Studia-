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
