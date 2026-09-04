-- La institución, como cosa de primera clase.
--
-- Hasta acá el panel de administración era de un solo colegio: implícito, sin
-- nombre y sin borde. `es_administrador()` preguntaba «¿tiene rol
-- administrador?» y nada más, así que el día que la segunda universidad
-- contratara, su secretaría académica habría visto —de verdad, sin trucos— la
-- nómina completa de la primera: nombres, correos y ramos. Y habría podido
-- ascender a administrador a cualquiera de esa lista.
--
-- Esta migración le pone borde a eso. Tres ideas:
--
--   1. Existe `instituciones`. Las personas, los ramos del colegio y la
--      nómina pertenecen a una, y un administrador solo ve la suya.
--   2. El plan deja de ponerse persona por persona: se contratan N cupos y
--      la nómina los ocupa. Lo que se firmó está en una fila, no repartido
--      en mil perfiles.
--   3. Se separa la administración de una institución de la operación de
--      StudIA. Son dos trabajos distintos: la secretaría de una universidad
--      arma su semestre; nosotros miramos las caídas y los reportes de
--      contenido de todo el servicio. Antes eran el mismo permiso.
--
-- Una decisión que conviene dejar dicha, porque después es cara de cambiar:
-- una persona pertenece a UNA institución. Es una columna en `perfiles` y no
-- una tabla de por medio. Quien estudie en dos universidades a la vez va a
-- necesitar dos cuentas, y eso es aceptable hoy: el caso es raro, y la tabla
-- de por medio obligaría a que cada consulta de la aplicación —el horario,
-- las tareas, el tutor— supiera en cuál de las dos está parada la persona en
-- este momento. Cuando aparezca el primer caso real se agrega la tabla; hasta
-- entonces sería complejidad pagada por adelantado.

create table public.instituciones (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (length(trim(nombre)) > 0),
  -- Cuántas personas cubre el contrato. Se ocupan a medida que su gente se
  -- registra; la nómina puede tener más filas que cupos y eso no es un error,
  -- es lo que hay que ver a tiempo.
  cupos     integer not null check (cupos >= 0),
  -- Nulo mientras no haya fecha de término. Vencido, los cupos dejan de
  -- entregarse: quien ya lo tiene no lo pierde de golpe, pero nadie nuevo
  -- entra hasta que se renueve.
  vence_en  timestamptz,
  creada_en timestamptz not null default now()
);

comment on table public.instituciones is
  'Cada universidad o colegio que contrató StudIA. Es el borde: un '
  'administrador ve su institución y ninguna otra.';
comment on column public.instituciones.cupos is
  'Lo que se contrató. El plan de institución se entrega mientras queden.';

-- ── A quién pertenece cada cosa ──────────────────────────────────────────

alter table public.perfiles
  -- `set null` y no `cascade`: si se borra el contrato, la gente no se borra.
  -- Quedan como cuentas personales, con lo suyo intacto.
  add column institucion_id uuid references public.instituciones (id) on delete set null,
  -- Nosotros. Ver más abajo por qué no alcanzaba con un cuarto rol.
  add column operador boolean not null default false;

alter table public.asignaturas
  add column institucion_id uuid references public.instituciones (id) on delete cascade;

alter table public.matriculas
  add column institucion_id uuid references public.instituciones (id) on delete cascade;

comment on column public.perfiles.institucion_id is
  'La institución a la que pertenece. Nulo para quien entró por su cuenta.';
comment on column public.perfiles.operador is
  'Personal de StudIA. Ve las caídas y los reportes de contenido de todo el '
  'servicio; no es el administrador de ninguna institución.';
comment on column public.asignaturas.institucion_id is
  'La institución dueña del ramo. Nulo en los ramos propios, que son de su '
  'creador y de nadie más.';

create index perfiles_por_institucion on public.perfiles (institucion_id)
  where institucion_id is not null;
create index asignaturas_por_institucion on public.asignaturas (institucion_id)
  where institucion_id is not null;
create index matriculas_por_institucion on public.matriculas (institucion_id);

-- ── Lo que ya estaba ─────────────────────────────────────────────────────
--
-- Antes de esta migración había exactamente una institución: la implícita.
-- Se le pone nombre y se le cuelga todo lo que existía. En una base recién
-- creada no hay nada que colgar y este bloque no hace nada.

do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.asignaturas where creador_id is null)
     or exists (select 1 from public.matriculas)
  then
    insert into public.instituciones (nombre, cupos)
    values ('Institución inicial',
            greatest((select count(*) from public.perfiles), 100))
    returning id into v_id;

    update public.asignaturas set institucion_id = v_id where creador_id is null;
    update public.matriculas   set institucion_id = v_id;
    update public.perfiles     set institucion_id = v_id;
  end if;
end $$;

alter table public.matriculas alter column institucion_id set not null;

-- Un ramo es de alguien: de una institución o de la persona que lo creó.
alter table public.asignaturas
  add constraint asignatura_tiene_dueno
  check (creador_id is not null or institucion_id is not null);

-- MAT1610 hay uno solo POR institución. Antes lo había uno solo en toda la
-- base, y eso habría hecho chocar a la segunda universidad con la primera por
-- un código de ramo tan común como «MAT1»
drop index public.asignaturas_codigo_del_colegio;
create unique index asignaturas_codigo_del_colegio
  on public.asignaturas (institucion_id, codigo)
  where creador_id is null;

comment on index public.asignaturas_codigo_del_colegio is
  'El código es único dentro de la institución. Dos universidades pueden '
  'tener MAT1610 y no son el mismo ramo.';

-- La nómina también: el mismo correo puede estar en dos nóminas.
alter table public.matriculas drop constraint matriculas_correo_codigo_papel_key;
alter table public.matriculas
  add constraint matriculas_sin_repetir
  unique nulls not distinct (institucion_id, correo, codigo, papel);

-- ── Quién soy ────────────────────────────────────────────────────────────

create or replace function public.mi_institucion()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institucion_id from public.perfiles where id = auth.uid();
$$;

comment on function public.mi_institucion() is
  'La institución de quien consulta, o nulo. `security definer` porque las '
  'políticas de otras tablas la llaman y no pueden depender de lo que esa '
  'persona alcance a leer de su propio perfil.';

revoke execute on function public.mi_institucion() from public;
grant  execute on function public.mi_institucion() to authenticated;

-- Nosotros, no ellos.
--
-- Podría haber sido un cuarto rol —'operador'— y sería peor: el rol decide
-- qué aplicación abre la persona, y quien opera StudIA también puede ser
-- alumno o profesor en alguna parte. Un rol que hay que dejar de ser para
-- poder estudiar es un rol mal puesto. Va como columna aparte.
create or replace function public.es_operador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select operador from public.perfiles where id = auth.uid()), false);
$$;

comment on function public.es_operador() is
  'Personal de StudIA. No es un rol: es una marca aparte, porque quien opera '
  'el servicio también puede estar estudiando en alguna institución.';

revoke execute on function public.es_operador() from public;
grant  execute on function public.es_operador() to authenticated;

-- ¿Este ramo es de mi institución? Lo usan las políticas de las tablas que
-- cuelgan de una asignatura y no llevan la columna encima.
create or replace function public.es_de_mi_institucion(p_asignatura uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.asignaturas a
     where a.id = p_asignatura
       and a.institucion_id is not null
       and a.institucion_id = public.mi_institucion()
  );
$$;

revoke execute on function public.es_de_mi_institucion(uuid) from public;
grant  execute on function public.es_de_mi_institucion(uuid) to authenticated;

-- ¿Queda cupo? `p_excluir` es la persona a la que se le está por dar: si ya
-- lo tiene, no debe contarse dos veces y quedarse sin el suyo propio.
create or replace function public.cupo_disponible(p_institucion uuid, p_excluir uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.instituciones i
     where i.id = p_institucion
       and (i.vence_en is null or i.vence_en > now())
       and (
         select count(*) from public.perfiles p
          where p.institucion_id = i.id
            and p.plan = 'institucion'
            and (p_excluir is null or p.id <> p_excluir)
       ) < i.cupos
  );
$$;

comment on function public.cupo_disponible(uuid, uuid) is
  'Si el contrato todavía alcanza para una persona más. Un contrato vencido '
  'no entrega cupos nuevos, y no le quita el suyo a quien ya lo tenía.';

revoke execute on function public.cupo_disponible(uuid, uuid) from public;

-- ── Que el cliente no se mude de institución solo ────────────────────────
--
-- El disparador ya cuidaba el rol y el plan. Ahora hay dos columnas más que
-- valen exactamente lo mismo: pertenecer a una institución es tener el plan
-- pagado, y ser operador es ver el servicio entero.
create or replace function public.rol_no_se_cambia_solo()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' then
    if new.rol is distinct from old.rol then
      raise exception 'El rol no se cambia desde el cliente.';
    end if;
    if new.plan is distinct from old.plan then
      raise exception 'El plan no se cambia desde el cliente.';
    end if;
    if new.institucion_id is distinct from old.institucion_id then
      raise exception 'La institución no se cambia desde el cliente.';
    end if;
    if new.operador is distinct from old.operador then
      raise exception 'Eso no se cambia desde el cliente.';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.rol_no_se_cambia_solo() is
  'Impide que el cliente se cambie el rol, el plan, la institución o la '
  'marca de operador. El nombre se queda por el disparador ya montado.';

-- ── Las políticas del colegio, ahora con borde ───────────────────────────
--
-- Las ocho de siempre. Cambia una sola cosa en cada una: además de ser
-- administración, la fila tiene que ser de su institución. Se sueltan y se
-- vuelven a crear porque `create policy` no tiene un «or replace».

drop policy "administración ve todas las asignaturas" on public.asignaturas;
drop policy "administración crea asignaturas"         on public.asignaturas;

create policy "administración ve las asignaturas de su institución" on public.asignaturas
  for select to authenticated
  using (public.es_administrador() and institucion_id = public.mi_institucion());

create policy "administración crea asignaturas de su institución" on public.asignaturas
  for all to authenticated
  using      (public.es_administrador() and institucion_id = public.mi_institucion())
  with check (public.es_administrador() and institucion_id = public.mi_institucion());

drop policy "administración ve todo el horario" on public.bloques_horario;
drop policy "administración arma el horario"    on public.bloques_horario;

create policy "administración ve el horario de su institución" on public.bloques_horario
  for select to authenticated
  using (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

create policy "administración arma el horario de su institución" on public.bloques_horario
  for all to authenticated
  using      (public.es_administrador() and public.es_de_mi_institucion(asignatura_id))
  with check (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

drop policy "administración ve los dictados"     on public.dictados;
drop policy "administración asigna los dictados" on public.dictados;

create policy "administración ve los dictados de su institución" on public.dictados
  for select to authenticated
  using (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

create policy "administración asigna los dictados de su institución" on public.dictados
  for all to authenticated
  using      (public.es_administrador() and public.es_de_mi_institucion(asignatura_id))
  with check (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

drop policy "administración ve las inscripciones" on public.inscripciones;
drop policy "administración inscribe"             on public.inscripciones;

create policy "administración ve las inscripciones de su institución" on public.inscripciones
  for select to authenticated
  using (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

create policy "administración inscribe en su institución" on public.inscripciones
  for all to authenticated
  using      (public.es_administrador() and public.es_de_mi_institucion(asignatura_id))
  with check (public.es_administrador() and public.es_de_mi_institucion(asignatura_id));

-- La nómina.
drop policy "la administración ve la nómina" on public.matriculas;
create policy "la administración ve la nómina de su institución" on public.matriculas
  for select to authenticated
  using (public.es_administrador() and institucion_id = public.mi_institucion());

-- La institución misma. Cualquiera ve la suya —la aplicación muestra su
-- nombre— y nadie ve otra.
alter table public.instituciones enable row level security;

create policy "veo mi institución" on public.instituciones
  for select to authenticated
  using (id = public.mi_institucion());

grant select on public.instituciones to authenticated;

-- ── Lo que es de StudIA y no de una institución ──────────────────────────
--
-- Las caídas y los reportes de contenido son del servicio entero. Estaban
-- abiertos a `es_administrador()`, es decir: la secretaría de una universidad
-- habría leído los mensajes de error y los reportes de IA de todas las demás.
-- Y ninguna de las dos cosas le sirve para nada: no puede arreglar la
-- aplicación ni ajustar el modelo.

drop policy "la administración ve las caídas" on public.errores;
create policy "la operación ve las caídas" on public.errores
  for select to authenticated using (public.es_operador());

drop policy "la administración lee los reportes"      on public.reportes;
drop policy "la administración los marca revisados"   on public.reportes;

create policy "la operación lee los reportes" on public.reportes
  for select to authenticated using (public.es_operador());

create policy "la operación los marca revisados" on public.reportes
  for update to authenticated
  using (public.es_operador()) with check (public.es_operador());

create or replace function public.limpiar_errores_viejos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borradas integer;
begin
  if not public.es_operador() then
    raise exception 'Limpiar el registro de caídas es de la operación de StudIA.';
  end if;

  delete from public.errores where creado_en < now() - interval '30 days';
  get diagnostics borradas = row_count;
  return borradas;
end;
$$;

comment on function public.limpiar_errores_viejos() is
  'Borra las caídas de más de 30 días. Solo la operación de StudIA. La tarea '
  'programada corre como superusuario y no pasa por esa comprobación.';

-- ── Las funciones con guardia ────────────────────────────────────────────
--
-- Todas comprobaban `es_administrador()` y nada más. Cada una gana la misma
-- segunda condición, y ninguna la puede saltar: son `security definer`, así
-- que acá adentro no queda ninguna política que las frene.

create or replace function public.registros()
returns table (
  id        uuid,
  nombre    text,
  correo    text,
  rol       text,
  plan      text,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.correo, p.rol, p.plan, p.creado_en
    from public.perfiles p
   where public.es_administrador()
     -- Las dos comparaciones importan. Sin la segunda, la secretaría de una
     -- universidad leería el correo de todo el servicio. Sin `is not null`,
     -- un administrador suelto —sin institución— se llevaría a todas las
     -- personas que tampoco tienen una, que son las cuentas personales.
     and p.institucion_id is not null
     and p.institucion_id = public.mi_institucion()
   order by p.creado_en desc;
$$;

comment on function public.registros() is
  'La gente de mi institución, con su correo. Solo para su administración. '
  'Para cualquier otra persona devuelve vacío.';

create or replace function public.cambiar_rol(p_persona uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suya uuid;
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración cambia roles.';
  end if;

  if p_rol not in ('estudiante', 'profesor', 'administrador') then
    raise exception 'Rol desconocido: %', p_rol;
  end if;

  -- Nadie se cambia el rol a sí mismo, ni para subir ni para bajar. Subir
  -- solo sería ascenderse; bajar dejaría al colegio sin quien administre si
  -- fuera la última persona. Que lo haga otra de administración.
  if p_persona = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol. Pídeselo a otra persona de administración.';
  end if;

  select institucion_id into v_suya from public.perfiles where id = p_persona;
  if not found then
    raise exception 'Esa persona ya no está registrada.';
  end if;
  -- Sin esto, ser administrador de una institución alcanzaba para ascender a
  -- cualquiera del servicio, incluida gente de otra universidad.
  if v_suya is null or v_suya is distinct from public.mi_institucion() then
    raise exception 'Esa persona no es de tu institución.';
  end if;

  update public.perfiles set rol = p_rol where id = p_persona;
end;
$$;

comment on function public.cambiar_rol(uuid, text) is
  'Cambia el rol de otra persona de la misma institución. Nunca el propio: '
  'ascenderse a uno mismo sería la única manera de saltarse todo lo demás.';

-- El plan ya no se elige de una lista de tres: se da o se quita el cupo que
-- la institución contrató. El plan Personal viene de Google Play y esta
-- función no lo toca ni para ponerlo ni para sacarlo.
create or replace function public.cambiar_plan(p_persona uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suya  uuid;
  v_antes text;
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración cambia el plan.';
  end if;
  if p_plan not in ('gratis', 'institucion') then
    raise exception 'Desde acá solo se da o se quita el cupo de la institución. El plan Personal lo pone Google Play.';
  end if;

  select institucion_id, plan into v_suya, v_antes
    from public.perfiles where id = p_persona;
  if not found then
    raise exception 'Esa persona ya no está registrada.';
  end if;
  if v_suya is null or v_suya is distinct from public.mi_institucion() then
    raise exception 'Esa persona no es de tu institución.';
  end if;
  if v_antes = 'personal' then
    raise exception 'Esa persona paga su plan por Google Play. Quitárselo desde acá no le devuelve el dinero.';
  end if;
  if p_plan = 'institucion' and not public.cupo_disponible(v_suya, p_persona) then
    raise exception 'No quedan cupos en el contrato. Quítale el cupo a alguien que ya no esté, o amplía el contrato.';
  end if;

  update public.perfiles set plan = p_plan where id = p_persona;
end;
$$;

comment on function public.cambiar_plan(uuid, text) is
  'Da o quita el cupo de la institución a una persona de ella. No entrega '
  'más cupos de los contratados, y no toca el plan Personal de Google Play.';

create or replace function public.dictados_del_colegio()
returns table (persona uuid, quien text, codigo text, papel text)
language sql
stable
security definer
set search_path = public
as $$
  select d.docente_id, p.nombre, a.codigo, d.papel
    from public.dictados d
    join public.perfiles p   on p.id = d.docente_id
    join public.asignaturas a on a.id = d.asignatura_id
   where public.es_administrador()
     and a.institucion_id is not null
     and a.institucion_id = public.mi_institucion()
   order by a.codigo, d.papel;
$$;

comment on function public.dictados_del_colegio() is
  'Quién dicta cada ramo de mi institución, con el nombre. Solo para su '
  'administración: la comprobación va adentro.';

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
     and (public.dicta(p_asignatura)
          or (public.es_administrador() and public.es_de_mi_institucion(p_asignatura)))
   order by p.nombre;
$$;

comment on function public.alumnos_de(uuid) is
  'La lista del curso. La ve quien lo dicta, y la administración de la '
  'institución dueña del ramo.';

-- ── Cargar el catálogo, dentro de la institución ─────────────────────────

create or replace function public.cargar_catalogo(
  p_asignaturas jsonb,
  p_horario     jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inst    uuid;
  v_codigos text[];
  v_ramos   int;
  v_bloques int;
begin
  if jsonb_typeof(p_asignaturas) <> 'array' or jsonb_typeof(p_horario) <> 'array' then
    raise exception 'Las dos planillas tienen que venir como listas.';
  end if;

  -- Un ramo del colegio es de una institución, siempre. Sin esto la carga
  -- moriría más adelante contra el `check`, con un mensaje del motor que no
  -- le dice nada a quien está pegando su planilla.
  v_inst := public.mi_institucion();
  if v_inst is null then
    raise exception 'Tu cuenta no pertenece a ninguna institución, así que no hay dónde cargar estos ramos.';
  end if;

  -- Los ramos que toca esta carga. Lo que no esté acá no se mira siquiera:
  -- una planilla parcial no puede borrar el resto del semestre.
  select array_agg(upper(x->>'codigo')) into v_codigos
    from jsonb_array_elements(p_asignaturas) x;

  if v_codigos is null then
    return jsonb_build_object('ramos', 0, 'bloques', 0);
  end if;

  insert into public.asignaturas
    (institucion_id, codigo, nombre, profesor, ayudante, color, creditos,
     descripcion, requisitos, bibliografia, intro_tutor)
  select
    v_inst,
    upper(x->>'codigo'), x->>'nombre', x->>'profesor', nullif(x->>'ayudante', ''),
    x->>'color', (x->>'creditos')::smallint,
    nullif(x->>'descripcion', ''), nullif(x->>'requisitos', ''),
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(x->'bibliografia') b),
      '{}'::text[]),
    x->>'intro_tutor'
  from jsonb_array_elements(p_asignaturas) x
  -- Repetir la condición del índice parcial es lo que deja inferirlo. Ahora
  -- lleva la institución adelante: el mismo código en otra universidad es
  -- otro ramo y no debe pisarse.
  on conflict (institucion_id, codigo) where creador_id is null do update set
    nombre = excluded.nombre, profesor = excluded.profesor,
    ayudante = excluded.ayudante, color = excluded.color,
    creditos = excluded.creditos, descripcion = excluded.descripcion,
    requisitos = excluded.requisitos, bibliografia = excluded.bibliografia,
    intro_tutor = excluded.intro_tutor;

  get diagnostics v_ramos = row_count;

  -- El horario se rehace entero para esos ramos: un bloque que se sacó de la
  -- planilla tiene que desaparecer, y no hay nada del alumno colgando de él.
  delete from public.bloques_horario
   where asignatura_id in (
     select id from public.asignaturas
      where codigo = any(v_codigos) and creador_id is null
        and institucion_id = v_inst);

  insert into public.bloques_horario (asignatura_id, dia, hora_inicio, hora_fin, sala, tipo)
  select a.id, (x->>'dia')::smallint, (x->>'hora_inicio')::time,
         (x->>'hora_fin')::time, x->>'sala', x->>'tipo'
    from jsonb_array_elements(p_horario) x
    join public.asignaturas a
      on a.codigo = upper(x->>'codigo') and a.creador_id is null
     and a.institucion_id = v_inst;

  get diagnostics v_bloques = row_count;

  -- Si un bloque quedó sin ramo, la planilla nombraba un código que no existe
  -- y el horario habría quedado incompleto en silencio.
  if v_bloques <> jsonb_array_length(p_horario) then
    raise exception 'El horario nombra ramos que no están en la planilla de asignaturas.';
  end if;

  return jsonb_build_object('ramos', v_ramos, 'bloques', v_bloques);
end;
$$;

comment on function public.cargar_catalogo(jsonb, jsonb) is
  'Carga ramos y horario de la institución de quien llama, en una '
  'transacción. Idempotente: reimportar actualiza y no duplica.';

-- ── La nómina, dentro de la institución ──────────────────────────────────

create or replace function public.aplicar_matriculas(p_persona uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correo text;
  v_actual text;
  v_plan   text;
  v_suya   uuid;
  v_inst   uuid;
  v_rol    text;
  v_cabe   boolean;
  v_hechas int := 0;
begin
  select correo, rol, plan, institucion_id
    into v_correo, v_actual, v_plan, v_suya
    from public.perfiles where id = p_persona;
  if v_correo is null then return 0; end if;

  -- De qué institución es esta persona.
  --
  -- Si ya pertenece a una, solo se le aplica lo de ESA. La nómina de otra no
  -- se lleva a alguien que ya está en un contrato: sin esta regla, la
  -- secretaría de la universidad B podría escribir el correo de un alumno de
  -- la A en su planilla y quedárselo, con sus ramos y todo.
  if v_suya is not null then
    v_inst := v_suya;
  else
    -- Si no, la primera que lo pidió.
    select institucion_id into v_inst
      from public.matriculas
     where correo = v_correo and aplicada_en is null
     order by creada_en
     limit 1;
  end if;
  if v_inst is null then return 0; end if;

  -- El rol más alto que le asigna la nómina de esa institución. Una persona
  -- puede aparecer muchas veces —una por ramo— y todas dicen lo mismo, pero
  -- si no, el que manda es el que más puede.
  select rol into v_rol
    from public.matriculas
   where correo = v_correo and institucion_id = v_inst
   order by case rol when 'administrador' then 3 when 'profesor' then 2 else 1 end desc
   limit 1;

  if v_rol is null then return 0; end if;

  v_cabe := public.cupo_disponible(v_inst, p_persona);

  update public.perfiles
     set -- Quien ya es administración no se baja de rol por una planilla: un
         -- archivo mal armado dejaría a la institución sin nadie que pueda
         -- arreglarlo.
         rol = case when v_actual = 'administrador' then v_actual else v_rol end,
         institucion_id = v_inst,
         -- El plan sale del contrato, y solo si queda cupo. Sin cupo la
         -- persona entra igual, con sus ramos, en el plan gratis: media
         -- matrícula es mejor que un error que nadie ve. Quien ya paga por
         -- Google Play se queda con lo suyo y no gasta un cupo.
         plan = case
                  when v_plan = 'personal' then v_plan
                  when v_cabe              then 'institucion'
                  else v_plan
                end
   where id = p_persona;

  -- Los ramos en que queda inscrita.
  insert into public.inscripciones (estudiante_id, asignatura_id)
  select p_persona, a.id
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
     and a.institucion_id = v_inst
   where m.correo = v_correo and m.institucion_id = v_inst
     and m.rol = 'estudiante' and m.codigo is not null
  on conflict do nothing;

  get diagnostics v_hechas = row_count;

  -- Y los que dicta.
  insert into public.dictados (docente_id, asignatura_id, papel)
  select p_persona, a.id, coalesce(m.papel, 'profesor')
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
     and a.institucion_id = v_inst
   where m.correo = v_correo and m.institucion_id = v_inst
     and m.rol = 'profesor' and m.codigo is not null
  on conflict do nothing;

  update public.matriculas
     set aplicada_en = now()
   where correo = v_correo and institucion_id = v_inst and aplicada_en is null;

  return v_hechas;
end;
$$;

comment on function public.aplicar_matriculas(uuid) is
  'Arma la cuenta de una persona con lo que su institución dejó cargado a su '
  'correo: su rol, su cupo y sus ramos. Idempotente. Quien ya pertenece a una '
  'institución no es reclamable por la nómina de otra.';

create or replace function public.cargar_matriculas(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst      uuid;
  v_puestas   int;
  v_aplicadas int := 0;
  v_persona   uuid;
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración carga la nómina.';
  end if;
  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'La nómina tiene que venir como lista.';
  end if;

  v_inst := public.mi_institucion();
  if v_inst is null then
    raise exception 'Tu cuenta no pertenece a ninguna institución, así que no hay nómina que cargar.';
  end if;

  -- La institución la pone el servidor, no la planilla: si viniera en el
  -- archivo, cargar una nómina sería poder escribir en la de al lado.
  insert into public.matriculas (institucion_id, correo, rol, codigo, papel)
  select v_inst, lower(trim(x->>'correo')), x->>'rol',
         nullif(upper(trim(x->>'codigo')), ''), nullif(x->>'papel', '')
    from jsonb_array_elements(p_filas) x
  on conflict (institucion_id, correo, codigo, papel) do update
     set rol = excluded.rol, aplicada_en = null;

  get diagnostics v_puestas = row_count;

  -- A quien ya tenía cuenta se le aplica ahora: si un alumno se registró la
  -- semana pasada, no tiene por qué esperar a nada.
  for v_persona in
    select p.id from public.perfiles p
     where p.correo in (
       select correo from public.matriculas
        where institucion_id = v_inst and aplicada_en is null
     )
  loop
    perform public.aplicar_matriculas(v_persona);
    v_aplicadas := v_aplicadas + 1;
  end loop;

  return jsonb_build_object(
    'filas', v_puestas,
    'aplicadas', v_aplicadas,
    'esperando', (select count(*) from public.matriculas
                   where institucion_id = v_inst and aplicada_en is null)
  );
end;
$$;

comment on function public.cargar_matriculas(jsonb) is
  'Deja cargada la nómina de MI institución. Lo que corresponde a alguien ya '
  'registrado se aplica en el momento; el resto espera a que se registre.';

-- ── Lo que el panel necesita saber del contrato ──────────────────────────

create or replace function public.mi_institucion_detalle()
returns table (
  id        uuid,
  nombre    text,
  cupos     integer,
  ocupados  bigint,
  esperando bigint,
  vence_en  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.nombre, i.cupos,
         (select count(*) from public.perfiles p
           where p.institucion_id = i.id and p.plan = 'institucion'),
         (select count(*) from public.matriculas m
           where m.institucion_id = i.id and m.aplicada_en is null),
         i.vence_en
    from public.instituciones i
   where i.id = public.mi_institucion()
     and public.es_administrador();
$$;

comment on function public.mi_institucion_detalle() is
  'El contrato en una fila: cuántos cupos hay, cuántos se ocuparon y cuánta '
  'gente de la nómina todavía no se registra.';

revoke execute on function public.mi_institucion_detalle() from public;
grant  execute on function public.mi_institucion_detalle() to authenticated;

-- ── Abrir una institución ────────────────────────────────────────────────
--
-- Esto no es de la secretaría de nadie: es la venta. Lo hacemos nosotros, y
-- por ahora desde el editor SQL de Supabase, que es donde no hay sesión y
-- `auth.uid()` viene nulo. De ahí la guardia de dos partes: con sesión hay
-- que ser operador; sin sesión, quien está escribiendo tiene la clave de
-- servicio y ya podía hacer cualquier cosa.
--
--   select public.crear_institucion('Universidad de Chile', 4000,
--                                   'secretaria.academica@uchile.cl');
--
-- Deja la institución creada y a esa persona esperando como administradora:
-- el día que se registre con ese correo, entra con el panel armado.

create or replace function public.crear_institucion(
  p_nombre text,
  p_cupos  integer,
  p_admin  text default null,
  p_vence  timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is not null and not public.es_operador() then
    raise exception 'Abrir una institución es de la operación de StudIA.';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'La institución necesita un nombre.';
  end if;
  if p_cupos is null or p_cupos < 0 then
    raise exception 'Los cupos contratados no pueden ser negativos.';
  end if;

  insert into public.instituciones (nombre, cupos, vence_en)
  values (trim(p_nombre), p_cupos, p_vence)
  returning id into v_id;

  if p_admin is not null then
    insert into public.matriculas (institucion_id, correo, rol)
    values (v_id, lower(trim(p_admin)), 'administrador');

    -- Y si esa persona ya tenía cuenta, no espera a nada.
    perform public.aplicar_matriculas(p.id)
       from public.perfiles p where p.correo = lower(trim(p_admin));
  end if;

  return v_id;
end;
$$;

comment on function public.crear_institucion(text, integer, text, timestamptz) is
  'Abre una institución y deja a su primera administradora esperando en la '
  'nómina. Solo la operación de StudIA, o quien tenga la clave de servicio.';

revoke execute on function public.crear_institucion(text, integer, text, timestamptz) from public;

-- Marcarse como operador. Mismo criterio: desde el editor SQL, la primera vez.
--
--   select public.hacer_operador('tomas@studia.cl', true);
create or replace function public.hacer_operador(p_correo text, p_es boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_operador() then
    raise exception 'Solo la operación de StudIA marca operadores.';
  end if;

  update public.perfiles set operador = p_es where correo = lower(trim(p_correo));
  if not found then
    raise exception 'Nadie está registrado con ese correo todavía.';
  end if;
end;
$$;

comment on function public.hacer_operador(text, boolean) is
  'Marca —o desmarca— a alguien como personal de StudIA. La primera vez se '
  'corre desde el editor SQL, que es donde no hay sesión.';

revoke execute on function public.hacer_operador(text, boolean) from public;
