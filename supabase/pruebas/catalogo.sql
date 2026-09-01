-- El esquema, tal como quedó, en un JSON para cruzarlo contra las consultas de
-- la aplicación. No es una copia a mano: es la base misma respondiendo.
--
-- Lo usa herramientas/cruzar-consultas.mjs, desde correr.sh.

select json_build_object(
  'tablas', (
    select json_object_agg(table_name, cols)
    from (
      select table_name, json_agg(column_name order by ordinal_position) as cols
      from information_schema.columns
      where table_schema = 'public'
      group by table_name
    ) t
  ),

  -- PostgREST deja incrustar en los dos sentidos de cada clave foránea.
  'relaciones', (
    select json_object_agg(desde, tablas)
    from (
      select desde, json_agg(distinct hacia) as tablas
      from (
        select c.conrelid::regclass::text as desde, c.confrelid::regclass::text as hacia
        from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where c.contype = 'f' and n.nspname = 'public'
        union all
        select c.confrelid::regclass::text, c.conrelid::regclass::text
        from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where c.contype = 'f' and n.nspname = 'public'
      ) p
      group by desde
    ) q
  ),

  'funciones', (
    select json_object_agg(nombre, argumentos)
    from (
      select p.proname as nombre, json_agg(distinct coalesce(a.nombre, '')) as argumentos
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      left join lateral (select unnest(coalesce(p.proargnames, array[]::text[])) as nombre) a on true
      where n.nspname = 'public'
      group by p.proname
    ) f
  ),

  -- Lo que puede tocar una sesión con la clave anónima. Que una columna
  -- exista no significa que la aplicación pueda leerla: los permisos van por
  -- columna, y una columna nueva no se lee hasta que alguien la concede.
  'permisos', (
    select json_object_agg(permiso, tablas)
    from (
      select privilege_type as permiso,
             json_object_agg(table_name, cols) as tablas
      from (
        select privilege_type, table_name, json_agg(distinct column_name) as cols
        from information_schema.column_privileges
        where table_schema = 'public'
          and grantee in ('authenticated', 'PUBLIC')
        group by privilege_type, table_name
      ) c
      group by privilege_type
    ) g
  ),

  -- DELETE no tiene permisos por columna: va por tabla entera.
  'permisos_de_tabla', (
    select json_object_agg(permiso, tablas)
    from (
      select privilege_type as permiso, json_agg(distinct table_name) as tablas
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('authenticated', 'PUBLIC')
      group by privilege_type
    ) g
  ),

  -- Las políticas del almacenamiento, en texto. La aplicación arma las rutas
  -- en dominio/almacen.ts y las políticas las leen por su primera carpeta: si
  -- las dos puntas dejan de nombrar las mismas, la subida se rechaza sin decir
  -- por qué.
  --
  -- El texto va expandido: varias políticas no nombran la carpeta, se la
  -- preguntan a una función (`ramo_de_la_entrega(name)`). Sin pegar el cuerpo
  -- de esas funciones, buscar la carpeta en la política no encuentra nada.
  'politicas_de_almacen', (
    select coalesce(json_agg(json_build_object(
      'nombre', policyname, 'cmd', cmd, 'texto', expandido
    )), '[]'::json)
    from (
      select p.policyname, p.cmd,
             coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') || ' ' ||
             coalesce((
               select string_agg(f.prosrc, ' ')
               from pg_proc f
               join pg_namespace fn on fn.oid = f.pronamespace
               where fn.nspname = 'public'
                 and coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')
                     like '%' || f.proname || '(%'
             ), '') as expandido
      from pg_policies p
      where p.schemaname = 'storage' and p.tablename = 'objects'
    ) q
  ),

  'baldes', (select coalesce(json_agg(id), '[]'::json) from storage.buckets),

  -- Y qué funciones puede llamar: una `security definer` sin permiso concedido
  -- responde «permission denied», no un resultado vacío.
  'funciones_permitidas', (
    select coalesce(json_agg(distinct p.proname), '[]'::json)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  )
);
