-- El plan de cada persona, en el registro de la administración.
--
-- StudIA se vende de dos maneras y ninguna pasa por una pasarela propia. A las
-- personas, por Google Play, que cobra y avisa al servidor. A las
-- instituciones, por contrato: se conversa, se factura y se firma afuera, y
-- alguien de la administración deja el plan puesto acá.
--
-- Para eso el registro tiene que mostrar en qué plan está cada quien. Hasta
-- ahora mostraba el rol y no el plan, así que la administración no tenía cómo
-- saber a quién ya le corresponde lo que se contrató.

-- Cambia el tipo de lo que devuelve, así que hay que soltarla antes:
-- `create or replace` no puede cambiar la forma de la respuesta.
drop function if exists public.registros();

create function public.registros()
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
   -- Sin esto la función sería una puerta de atrás al correo de todos. Para
   -- quien no es administración devuelve vacío, que es exactamente lo que ve
   -- hoy: nada.
   where public.es_administrador()
   order by p.creado_en desc;
$$;

comment on function public.registros() is
  'El registro completo, solo para la administración. Para cualquier otra '
  'persona devuelve vacío: el correo ajeno sigue sin ser legible.';
