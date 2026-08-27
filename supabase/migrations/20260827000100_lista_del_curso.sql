-- `alumnos_de` solo respondía a quien dicta el ramo.
--
-- La pantalla de administración cuenta las inscripciones de cada asignatura
-- para saber cuánta gente hay en el colegio, y con esta función cerrada al
-- docente devolvía cero para todos. No era un problema de permisos de más:
-- la administración ya puede leer `inscripciones` completo por su política.
-- Era esta función, que se escribió pensando solo en el profesor.

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
     and (public.dicta(p_asignatura) or public.es_administrador())
   order by p.nombre;
$$;
