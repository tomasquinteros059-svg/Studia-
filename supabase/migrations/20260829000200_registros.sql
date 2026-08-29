-- El registro de quiénes están en StudIA, para la administración.
--
-- El correo de una persona no es legible desde el cliente: la columna está
-- fuera del `grant`, y por eso la app puede prometerle a cada quien que nadie
-- más lo ve. Esa promesa se mantiene; lo que se abre acá es una excepción
-- nombrada y con guardia, no un permiso nuevo para todo el mundo.
--
-- Va como función `security definer` porque es la única manera de sostener
-- las dos cosas a la vez: que la administración vea el registro completo y
-- que un alumno o un docente sigan sin poder leer el correo de nadie.

create or replace function public.registros()
returns table (
  id        uuid,
  nombre    text,
  correo    text,
  rol       text,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.correo, p.rol, p.creado_en
    from public.perfiles p
   -- Sin esto la función sería una puerta de atrás al correo de todos. Para
   -- quien no es administración devuelve vacío, que es exactamente lo que ve
   -- hoy: nada.
   where public.es_administrador()
   order by p.creado_en desc;
$$;

comment on function public.registros() is
  'El registro completo, solo para la administración. Para cualquier otra '
  'persona devuelve vacío: el correo ajeno sigue sin ser legible.';

-- ---------------------------------------------------------------- roles
-- `rol_no_se_cambia_solo` prohíbe cambiar el rol desde el cliente, y está
-- bien que lo prohíba: es lo que impide que alguien se ascienda solo. La
-- administración lo cambia por acá, donde hay guardia y queda dicho por qué.

create or replace function public.cambiar_rol(p_persona uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  update public.perfiles set rol = p_rol where id = p_persona;
  if not found then
    raise exception 'Esa persona ya no está registrada.';
  end if;
end;
$$;

comment on function public.cambiar_rol(uuid, text) is
  'Cambia el rol de otra persona. Solo la administración, y nunca el propio: '
  'ascenderse a uno mismo sería la única manera de saltarse todo lo demás.';

revoke execute on function public.registros()             from public;
revoke execute on function public.cambiar_rol(uuid, text) from public;
grant  execute on function public.registros()             to authenticated;
grant  execute on function public.cambiar_rol(uuid, text) to authenticated;
