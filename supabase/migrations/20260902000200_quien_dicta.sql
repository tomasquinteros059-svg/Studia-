-- Quién dicta qué, para la administración.
--
-- El panel del colegio revisa que nadie quede citado en dos salas a la misma
-- hora. Para eso necesita saber qué profesor tiene cada ramo, y hasta ahora lo
-- sacaba de los perfiles de ejemplo del modo demostración: con el servidor
-- conectado, la revisión se hacía contra profesores inventados y no contra los
-- de verdad. Salía siempre limpia, y no porque el horario estuviera bien.
--
-- Va por función y no por consulta directa porque hace falta cruzar `dictados`
-- con `perfiles`, y el nombre de otra persona no es legible desde el cliente:
-- la política de `perfiles` deja ver el propio y nada más. Acá se cruza del
-- lado del servidor, con el permiso comprobado adentro.

create or replace function public.dictados_del_colegio()
returns table (persona uuid, quien text, codigo text, papel text)
language sql
stable
security definer
set search_path = public
as $$
  select d.docente_id, p.nombre, a.codigo, d.papel
  from public.dictados d
  join public.perfiles p on p.id = d.docente_id
  join public.asignaturas a on a.id = d.asignatura_id
  where public.es_administrador()
  order by a.codigo, d.papel
$$;

comment on function public.dictados_del_colegio() is
  'Quién dicta cada ramo, con el nombre. Solo para la administración: el '
  'where lo comprueba adentro, así que llamarla sin ese rol devuelve vacío.';

revoke execute on function public.dictados_del_colegio() from public;
grant execute on function public.dictados_del_colegio() to authenticated;
