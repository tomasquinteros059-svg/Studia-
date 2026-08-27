-- Que dos personas puedan estudiar lo mismo
--
-- `asignaturas.codigo` era único en toda la tabla, y eso tenía sentido cuando
-- todos los ramos eran del colegio: MAT1610 hay uno solo. Con los espacios
-- propios deja de tenerlo: el código de un ramo propio se arma de su nombre,
-- así que la segunda persona que cree "Inglés" se llevaría un choque de clave
-- única y un "no pude crear el ramo" que no explica nada.
--
-- El código sigue siendo único donde importa —entre los ramos del colegio— y
-- deja de serlo entre los propios, donde solo es una etiqueta que ve su dueño.

alter table public.asignaturas drop constraint asignaturas_codigo_key;

create unique index asignaturas_codigo_del_colegio
  on public.asignaturas (codigo)
  where creador_id is null;

comment on index public.asignaturas_codigo_del_colegio is
  'MAT1610 hay uno solo. Los ramos propios quedan fuera a propósito.';
