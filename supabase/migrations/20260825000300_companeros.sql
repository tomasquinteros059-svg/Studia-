-- Compañeros de curso, con la menor exposición posible.
--
-- Mostrar el curso implica que un estudiante vea nombres de otros. En vez de
-- abrir `perfiles` con una política amplia, se expone una función acotada:
-- devuelve solo nombres, solo de asignaturas donde quien pregunta está
-- inscrito. Las inscripciones siguen siendo privadas.

create or replace function public.companeros_de(p_asignatura uuid)
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
     and public.esta_inscrito(p_asignatura)   -- si no estoy inscrito, no devuelve nada
   order by p.nombre;
$$;

revoke execute on function public.companeros_de(uuid) from public;
grant  execute on function public.companeros_de(uuid) to authenticated;

-- El correo no tiene por qué salir de la base: el propio usuario lo obtiene de
-- su sesión, y de los demás no debe verlo nunca.
revoke select on public.perfiles from authenticated;
grant  select (id, nombre, creado_en) on public.perfiles to authenticated;
