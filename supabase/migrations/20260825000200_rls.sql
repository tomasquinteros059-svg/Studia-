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
