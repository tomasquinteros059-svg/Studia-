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
