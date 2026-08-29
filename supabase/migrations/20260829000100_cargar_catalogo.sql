-- Cargar el catálogo del semestre de una vez, desde el navegador.
--
-- El comando `npm run importar` ya convertía las planillas en SQL, pero ese
-- SQL había que pegarlo en el editor de Supabase. Una secretaría académica no
-- hace eso. Esta función es el mismo trabajo, llamable desde el panel de
-- administración.
--
-- Va como función y no como una serie de inserts desde el cliente por dos
-- razones que a mil ramos dejan de ser detalles:
--
--   1. Es una transacción. Un semestre a medio cargar —los ramos sí, el
--      horario no— es peor que no haber cargado nada: no hay manera de saber
--      desde afuera dónde quedó.
--   2. El índice único de `codigo` es parcial (solo los ramos del colegio),
--      y un `on conflict` así no se puede expresar desde PostgREST: hay que
--      repetir su condición, y eso solo se puede en SQL.
--
-- `security invoker` a propósito: las políticas del administrador siguen
-- mandando. Si la llama alguien que no lo es, no escribe nada. La seguridad
-- no se muda acá adentro.

create or replace function public.cargar_catalogo(
  p_asignaturas jsonb,
  p_horario     jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_codigos text[];
  v_ramos   int;
  v_bloques int;
begin
  if jsonb_typeof(p_asignaturas) <> 'array' or jsonb_typeof(p_horario) <> 'array' then
    raise exception 'Las dos planillas tienen que venir como listas.';
  end if;

  -- Los ramos que toca esta carga. Lo que no esté acá no se mira siquiera:
  -- una planilla parcial no puede borrar el resto del semestre.
  select array_agg(upper(x->>'codigo')) into v_codigos
    from jsonb_array_elements(p_asignaturas) x;

  if v_codigos is null then
    return jsonb_build_object('ramos', 0, 'bloques', 0);
  end if;

  insert into public.asignaturas
    (codigo, nombre, profesor, ayudante, color, creditos,
     descripcion, requisitos, bibliografia, intro_tutor)
  select
    upper(x->>'codigo'), x->>'nombre', x->>'profesor', nullif(x->>'ayudante', ''),
    x->>'color', (x->>'creditos')::smallint,
    nullif(x->>'descripcion', ''), nullif(x->>'requisitos', ''),
    coalesce(
      (select array_agg(b) from jsonb_array_elements_text(x->'bibliografia') b),
      '{}'::text[]),
    x->>'intro_tutor'
  from jsonb_array_elements(p_asignaturas) x
  -- Repetir la condición del índice parcial es lo que deja inferirlo.
  on conflict (codigo) where creador_id is null do update set
    nombre = excluded.nombre, profesor = excluded.profesor,
    ayudante = excluded.ayudante, color = excluded.color,
    creditos = excluded.creditos, descripcion = excluded.descripcion,
    requisitos = excluded.requisitos, bibliografia = excluded.bibliografia,
    intro_tutor = excluded.intro_tutor;

  get diagnostics v_ramos = row_count;

  -- El horario se rehace entero para esos ramos: un bloque que se sacó de la
  -- planilla tiene que desaparecer, y no hay nada del alumno colgando de él.
  delete from public.bloques_horario
   where asignatura_id in (
     select id from public.asignaturas
      where codigo = any(v_codigos) and creador_id is null);

  insert into public.bloques_horario (asignatura_id, dia, hora_inicio, hora_fin, sala, tipo)
  select a.id, (x->>'dia')::smallint, (x->>'hora_inicio')::time,
         (x->>'hora_fin')::time, x->>'sala', x->>'tipo'
    from jsonb_array_elements(p_horario) x
    join public.asignaturas a
      on a.codigo = upper(x->>'codigo') and a.creador_id is null;

  get diagnostics v_bloques = row_count;

  -- Si un bloque quedó sin ramo, la planilla nombraba un código que no existe
  -- y el horario habría quedado incompleto en silencio.
  if v_bloques <> jsonb_array_length(p_horario) then
    raise exception 'El horario nombra ramos que no están en la planilla de asignaturas.';
  end if;

  return jsonb_build_object('ramos', v_ramos, 'bloques', v_bloques);
end;
$$;

comment on function public.cargar_catalogo(jsonb, jsonb) is
  'Carga ramos y horario en una transacción. Idempotente: reimportar '
  'actualiza y no duplica. Solo escribe si quien llama es administrador, '
  'porque las políticas de la tabla siguen aplicándose.';

grant execute on function public.cargar_catalogo(jsonb, jsonb) to authenticated;
