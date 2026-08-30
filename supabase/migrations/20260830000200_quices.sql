-- Los quices de repaso: preguntas hechas con el material del propio ramo.
--
-- Un quiz es de quien lo pidió. Dos estudiantes del mismo ramo que piden un
-- quiz del mismo tema reciben preguntas distintas, y ninguno ve las del otro:
-- así no hay nada que copiarse, y sobre todo, así el quiz no es una prueba.
-- Es un espejo para saber cómo va uno, y para eso tiene que poder equivocarse
-- sin que quede en ninguna parte que le importe a alguien más.
--
-- Las preguntas se guardan enteras en la fila, en JSON, y no en tablas
-- aparte. No hay ninguna consulta que quiera preguntar «cuántas veces se ha
-- preguntado esto»: un quiz se lee entero o no se lee, y partirlo en tres
-- tablas solo agregaría uniones para volver a juntarlo.

create table public.quices (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- El módulo sobre el que se preguntó, por su título: es lo que el estudiante
  -- eligió y lo que se le muestra de vuelta.
  tema           text not null,
  -- [{pregunta, opciones[4], correcta, explicacion}]. Lo escribe la función
  -- `quiz` con la clave de servicio; el estudiante no puede fabricarlas ni
  -- editarlas, porque entonces el puntaje no diría nada.
  preguntas      jsonb not null,
  -- Lo que respondió, en el mismo orden. Índices de 0 a 3, o null en las que
  -- todavía no contesta. Esto sí lo escribe el estudiante: es lo suyo.
  respuestas     jsonb not null default '[]'::jsonb,
  terminado_en   timestamptz,
  creado_en      timestamptz not null default now(),

  constraint preguntas_es_arreglo check (jsonb_typeof(preguntas) = 'array'),
  constraint respuestas_es_arreglo check (jsonb_typeof(respuestas) = 'array'),
  -- Un quiz con menos de tres preguntas no es un repaso; el filtro de la
  -- función ya lo impide, y esto lo deja escrito también acá.
  constraint quiz_con_preguntas check (jsonb_array_length(preguntas) >= 3)
);

create index on public.quices (estudiante_id, creado_en desc);
create index on public.quices (estudiante_id, asignatura_id);

alter table public.quices enable row level security;

create policy "veo mis quices" on public.quices
  for select to authenticated using (estudiante_id = auth.uid());

create policy "borro mis quices" on public.quices
  for delete to authenticated using (estudiante_id = auth.uid());

-- Ojo: no hay política de `insert` ni de `update` para `authenticated`. Un
-- quiz solo puede nacer de la función `quiz`, que escribe con la clave de
-- servicio, y responderlo pasa por la función de acá abajo. Si se dejara el
-- `update` abierto, cualquiera podría reescribir sus propias preguntas para
-- que todas quedaran correctas —RLS no tiene permisos por columna— y el
-- puntaje dejaría de decir nada.
grant select, delete on public.quices to authenticated;

-- Responder el quiz. Escribe solo lo que es del estudiante: sus respuestas.
--
-- `p_respuestas` es un arreglo del mismo largo que las preguntas, con el
-- índice elegido en cada una o null en las que todavía no contesta. Volver a
-- empezar es mandar un arreglo vacío, que es lo que hace «repetir el quiz».
create or replace function public.responder_quiz(
  p_quiz uuid, p_respuestas jsonb, p_terminado boolean default false
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cuantas int;
begin
  select jsonb_array_length(preguntas) into v_cuantas
    from public.quices
   where id = p_quiz and estudiante_id = auth.uid();

  if v_cuantas is null then
    raise exception 'Ese quiz no es tuyo.';
  end if;
  if jsonb_typeof(p_respuestas) is distinct from 'array' then
    raise exception 'Las respuestas tienen que venir en un arreglo.';
  end if;
  if jsonb_array_length(p_respuestas) > v_cuantas then
    raise exception 'Mandaste más respuestas que preguntas.';
  end if;

  update public.quices
     set respuestas = p_respuestas,
         terminado_en = case when p_terminado then now() else null end
   where id = p_quiz and estudiante_id = auth.uid();
end $$;

grant execute on function public.responder_quiz(uuid, jsonb, boolean) to authenticated;
