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
