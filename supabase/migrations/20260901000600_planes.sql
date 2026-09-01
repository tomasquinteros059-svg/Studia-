-- Qué plan tiene cada quien.
--
-- Hoy decide una sola cosa, y es la que se está construyendo: si la aplicación
-- guarda lo necesario en el aparato para poder estudiar sin señal. En los dos
-- planes pagados sí; en el gratis no.
--
-- Lo importante de esta migración no es la columna: es el disparador. Cualquier
-- persona puede abrir el APK, sacar la clave anónima —que es pública por
-- diseño— y escribirle a la base directamente. Un plan que se pudiera cambiar
-- desde el cliente sería un adorno: bastaría un `update` para tener lo pagado
-- sin pagarlo. Lo mismo que ya se hizo con el rol.

alter table public.perfiles
  add column plan text not null default 'gratis'
    check (plan in ('gratis', 'personal', 'institucion'));

comment on column public.perfiles.plan is
  'El plan de la persona. Lo escribe el servidor —la administración, o el '
  'cobro cuando exista—, nunca el cliente: un disparador lo impide.';

-- El disparador de arriba ya existía para el rol. Se reescribe para cuidar
-- las dos columnas: dos disparadores sobre la misma tabla haciendo lo mismo
-- son dos lugares donde olvidarse de uno.
create or replace function public.rol_no_se_cambia_solo()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and new.rol is distinct from old.rol then
    raise exception 'El rol no se cambia desde el cliente.';
  end if;
  if current_user = 'authenticated' and new.plan is distinct from old.plan then
    raise exception 'El plan no se cambia desde el cliente.';
  end if;
  return new;
end;
$$;

comment on function public.rol_no_se_cambia_solo() is
  'Impide que el cliente se cambie el rol o el plan. El nombre se queda por '
  'compatibilidad con el disparador que ya estaba montado.';

-- Leerlo sí puede el cliente: la aplicación tiene que saber si guardar las
-- cosas en el aparato. Los permisos de esta tabla van columna por columna
-- —así el correo de nadie se lee desde otra cuenta— y una columna nueva no
-- queda incluida sola.
grant select (plan) on public.perfiles to authenticated;

-- ── Cambiarlo desde la administración ────────────────────────────────────
--
-- Igual que `cambiar_rol`: SECURITY DEFINER para poder escribir la columna que
-- el disparador protege, y con la comprobación adentro para que ser función no
-- sea una manera de saltarse el permiso.
create or replace function public.cambiar_plan(p_persona uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_administrador() then
    raise exception 'Solo la administración cambia el plan.';
  end if;
  if p_plan not in ('gratis', 'personal', 'institucion') then
    raise exception 'Ese plan no existe.';
  end if;

  update public.perfiles set plan = p_plan where id = p_persona;
end;
$$;

comment on function public.cambiar_plan(uuid, text) is
  'Cambia el plan de una persona. Solo la administración; el cobro, cuando '
  'exista, lo hará con la clave de servicio y no por acá.';

grant execute on function public.cambiar_plan(uuid, text) to authenticated;
