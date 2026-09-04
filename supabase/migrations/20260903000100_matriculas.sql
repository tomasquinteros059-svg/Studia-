-- La nómina de la institución, cargada antes de que nadie se registre.
--
-- Cuando una universidad contrata StudIA, lo que entrega es una planilla: su
-- gente, quién dicta qué y quién está inscrito en qué. Y casi nadie de esa
-- lista tiene cuenta todavía.
--
-- Ese es el problema. `perfiles.id` apunta a `auth.users`: no se puede crear
-- el perfil de alguien que no se ha registrado, y por lo tanto tampoco se lo
-- puede inscribir en un ramo. Hasta ahora la carga desde el panel dejaba los
-- ramos y el horario, y la nómina había que meterla por consola con la clave
-- de servicio —o sea, no la hacía la secretaría académica, que es justamente
-- quien tiene la planilla—.
--
-- Acá la nómina se guarda como matrícula pendiente, a nombre de un correo. El
-- día que esa persona se registra con ese correo, su cuenta queda armada sola:
-- con su rol, su plan y sus ramos. Y si ya estaba registrada, se le aplica en
-- el momento de cargar.

create table if not exists public.matriculas (
  id          uuid primary key default gen_random_uuid(),
  -- Siempre en minúsculas: una planilla trae «Juan.Perez@U.CL» y la persona
  -- se registra con «juan.perez@u.cl». Sin normalizar, no se encuentran.
  correo      text not null check (correo = lower(correo) and correo like '%@%'),
  rol         text not null check (rol in ('estudiante', 'profesor', 'administrador')),
  -- El ramo. Nulo para quien solo va en la nómina —la secretaría, por
  -- ejemplo— sin estar inscrito en nada.
  codigo      text,
  -- Solo para quien dicta.
  papel       text check (papel is null or papel in ('profesor', 'ayudante')),
  creada_en   timestamptz not null default now(),
  -- Cuándo se convirtió en cuenta de verdad. Nulo mientras espera.
  aplicada_en timestamptz,

  -- `nulls not distinct` porque casi todas las filas de una secretaría llevan
  -- el código en nulo, y sin esto se podrían repetir sin que nada avise.
  unique nulls not distinct (correo, codigo, papel)
);

create index if not exists matriculas_por_correo on public.matriculas (correo);
create index if not exists matriculas_pendientes
  on public.matriculas (correo) where aplicada_en is null;

comment on table public.matriculas is
  'La nómina que entrega una institución, a nombre de correos que todavía no '
  'tienen cuenta. Se convierte en inscripciones y dictados cuando la persona '
  'se registra.';

-- ── Convertir la matrícula en cuenta ────────────────────────────────────

create or replace function public.aplicar_matriculas(p_persona uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correo text;
  v_rol    text;
  v_actual text;
  v_hechas int := 0;
begin
  select correo, rol into v_correo, v_actual from public.perfiles where id = p_persona;
  if v_correo is null then return 0; end if;

  -- El rol más alto que le asigna la nómina. Una persona puede aparecer
  -- muchas veces —una por ramo— y todas dicen lo mismo, pero si no, el que
  -- manda es el que más puede.
  select rol into v_rol
    from public.matriculas
   where correo = v_correo
   order by case rol when 'administrador' then 3 when 'profesor' then 2 else 1 end desc
   limit 1;

  if v_rol is null then return 0; end if;

  -- Quien ya es administración no se baja de rol por una planilla: un archivo
  -- mal armado dejaría a la institución sin nadie que pueda arreglarlo.
  update public.perfiles
     set rol  = case when v_actual = 'administrador' then v_actual else v_rol end,
         -- Pertenecer a una institución que contrató es el plan de ella.
         plan = 'institucion'
   where id = p_persona;

  -- Los ramos en que queda inscrita.
  insert into public.inscripciones (estudiante_id, asignatura_id)
  select p_persona, a.id
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
   where m.correo = v_correo and m.rol = 'estudiante' and m.codigo is not null
  on conflict do nothing;

  get diagnostics v_hechas = row_count;

  -- Y los que dicta.
  insert into public.dictados (docente_id, asignatura_id, papel)
  select p_persona, a.id, coalesce(m.papel, 'profesor')
    from public.matriculas m
    join public.asignaturas a
      on a.codigo = upper(m.codigo) and a.creador_id is null
   where m.correo = v_correo and m.rol = 'profesor' and m.codigo is not null
  on conflict do nothing;

  update public.matriculas
     set aplicada_en = now()
   where correo = v_correo and aplicada_en is null;

  return v_hechas;
end;
$$;

comment on function public.aplicar_matriculas(uuid) is
  'Arma la cuenta de una persona con lo que la institución dejó cargado a su '
  'correo: su rol, su plan y sus ramos. Idempotente.';

revoke execute on function public.aplicar_matriculas(uuid) from public;

-- Al registrarse. Va sobre `perfiles` y no sobre `auth.users` porque necesita
-- que el perfil exista para poder actualizarlo.
create or replace function public.al_crear_perfil_aplicar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.aplicar_matriculas(new.id);
  return new;
end;
$$;

drop trigger if exists perfil_aplica_matriculas on public.perfiles;
create trigger perfil_aplica_matriculas
  after insert on public.perfiles
  for each row execute function public.al_crear_perfil_aplicar();

-- ── Cargar la nómina desde el panel ─────────────────────────────────────

create or replace function public.cargar_matriculas(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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

  insert into public.matriculas (correo, rol, codigo, papel)
  select lower(trim(x->>'correo')), x->>'rol',
         nullif(upper(trim(x->>'codigo')), ''), nullif(x->>'papel', '')
    from jsonb_array_elements(p_filas) x
  on conflict (correo, codigo, papel) do update
     set rol = excluded.rol, aplicada_en = null;

  get diagnostics v_puestas = row_count;

  -- A quien ya tenía cuenta se le aplica ahora: si un alumno se registró la
  -- semana pasada, no tiene por qué esperar a nada.
  for v_persona in
    select p.id from public.perfiles p
     where p.correo in (
       select correo from public.matriculas where aplicada_en is null
     )
  loop
    perform public.aplicar_matriculas(v_persona);
    v_aplicadas := v_aplicadas + 1;
  end loop;

  return jsonb_build_object(
    'filas', v_puestas,
    'aplicadas', v_aplicadas,
    'esperando', (select count(*) from public.matriculas where aplicada_en is null)
  );
end;
$$;

comment on function public.cargar_matriculas(jsonb) is
  'Deja cargada la nómina de la institución. Lo que corresponde a alguien ya '
  'registrado se aplica en el momento; el resto espera a que se registre.';

grant execute on function public.cargar_matriculas(jsonb) to authenticated;

-- ── Quién ve la nómina ──────────────────────────────────────────────────

alter table public.matriculas enable row level security;

create policy "la administración ve la nómina" on public.matriculas
  for select to authenticated using (public.es_administrador());

grant select on public.matriculas to authenticated;
