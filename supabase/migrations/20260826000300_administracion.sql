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
-- la misma que para el docente y está en docs/arquitectura.md.
