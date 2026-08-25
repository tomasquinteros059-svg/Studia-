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
