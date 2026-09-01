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
