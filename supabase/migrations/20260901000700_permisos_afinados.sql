-- Afinar quién puede llamar a las funciones nuevas.
--
-- Sale de revisar el código de estos días buscando por dónde se rompe. En
-- Postgres, `create function` deja la ejecución abierta a todo el mundo salvo
-- que uno la cierre, y eso convierte cualquier función SECURITY DEFINER sin
-- comprobación adentro en una puerta.
--
-- Todas las anteriores estaban bien: `registros`, `cambiar_rol` y
-- `cambiar_plan` comprueban que sea la administración; `alumnos_de` y
-- `companeros_de` comprueban la inscripción; `armar_la_clase` también; y
-- `cargar_catalogo` es SECURITY INVOKER, así que sus escrituras pasan por las
-- políticas como las de cualquiera. La que faltaba es una sola.

-- ── La que estaba abierta ────────────────────────────────────────────────
--
-- `limpiar_errores_viejos` borra el historial de caídas de más de 30 días. Es
-- SECURITY DEFINER, no comprobaba nada y cualquiera con una sesión podía
-- llamarla: un alumno cualquiera podía borrar el registro de errores del
-- colegio entero. No es un robo de datos, es peor de otra manera: uno se queda
-- sin la información con la que iba a arreglar las cosas, y sin enterarse.
create or replace function public.limpiar_errores_viejos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borradas integer;
begin
  -- La comprobación va adentro además del permiso de abajo: si mañana alguien
  -- vuelve a abrir la ejecución sin pensarlo, esto sigue en pie.
  if not public.es_administrador() then
    raise exception 'Limpiar el registro de caídas es de la administración.';
  end if;

  delete from public.errores where creado_en < now() - interval '30 days';
  get diagnostics borradas = row_count;
  return borradas;
end;
$$;

revoke execute on function public.limpiar_errores_viejos() from public;
grant execute on function public.limpiar_errores_viejos() to authenticated;

comment on function public.limpiar_errores_viejos() is
  'Borra las caídas de más de 30 días. Solo la administración. La tarea '
  'programada corre como superusuario y no pasa por esa comprobación.';

-- ── Las que NO hay que cerrar, y por qué ─────────────────────────────────
--
-- `dueno_de_la_ruta` y `ramo_de_la_entrega` también son llamables por
-- cualquiera, y se quedan así a propósito: las usan las políticas del
-- almacenamiento. Una política que llama a una función se evalúa con el rol de
-- quien consulta, así que revocarle la ejecución a `authenticated` no cerraría
-- una puerta: rompería la lectura de archivos con un «permission denied for
-- function», que además no se parece en nada a su causa.
--
-- Lo que se puede averiguar llamándolas es el ramo al que pertenece una tarea,
-- y para eso hay que conocer ya el identificador de esa tarea, que solo tiene
-- quien está en ese curso. Queda escrito acá para que la próxima persona que
-- revise esto no gaste la tarde en lo mismo.
