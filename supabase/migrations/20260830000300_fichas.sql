-- Las fichas de repaso, con su repetición espaciada.
--
-- Una ficha es una pregunta corta y su respuesta. El evaluador las escribe con
-- el material del ramo, igual que los quices, pero se usan distinto: un quiz
-- se responde una vez y dice cómo vas; una ficha vuelve, y vuelve más seguido
-- justamente la que fallaste.
--
-- Por eso la fila guarda el historial y no solo el texto: `aciertos` seguidos
-- es lo que decide cuánto se demora en volver, y `vuelve_en` es la fecha en
-- que toca. Es todo lo que necesita la repetición espaciada, y es a propósito
-- lo más simple que funciona: sin factores de facilidad ni intervalos con
-- decimales, que son precisión inventada sobre un dato que no la tiene.

create table public.fichas (
  id             uuid primary key default gen_random_uuid(),
  estudiante_id  uuid not null references public.perfiles (id) on delete cascade,
  asignatura_id  uuid not null references public.asignaturas (id) on delete cascade,
  -- El módulo del que salió, por su título: es lo que se le muestra de vuelta.
  tema           text not null,
  pregunta       text not null check (length(trim(pregunta)) between 1 and 300),
  respuesta      text not null check (length(trim(respuesta)) between 1 and 600),

  -- Cuántas veces seguidas se supo. Al fallar vuelve a cero: lo que importa
  -- no es cuántas veces se acertó en total, sino desde cuándo no se falla.
  aciertos       integer not null default 0 check (aciertos >= 0),
  -- Cuántas veces se falló, en total. No entra en el cálculo; sirve para
  -- poder decirle a alguien cuál es la que más se le resiste.
  fallos         integer not null default 0 check (fallos >= 0),
  -- Cuándo toca de nuevo. Nula significa que nunca se ha visto: toca ya.
  vuelve_en      timestamptz,
  vista_en       timestamptz,
  creado_en      timestamptz not null default now()
);

-- La consulta de siempre: «mis fichas de este ramo que ya tocan».
create index on public.fichas (estudiante_id, asignatura_id, vuelve_en);

alter table public.fichas enable row level security;

-- Como los quices: son de quien las estudia y de nadie más. Que alguien esté
-- repasando una ficha por quinta vez no es asunto de quien dicta el ramo.
create policy "veo mis fichas" on public.fichas
  for select to authenticated using (estudiante_id = auth.uid());
create policy "borro mis fichas" on public.fichas
  for delete to authenticated using (estudiante_id = auth.uid());

-- Sin `insert` ni `update` abiertos: las escribe la función `fichas` con la
-- clave de servicio, y responderlas pasa por `repasar_ficha`. Si el cliente
-- pudiera escribir la fila entera, podría cambiarse la respuesta correcta o
-- adelantarse la fecha, y la repetición dejaría de repetir nada.
grant select, delete on public.fichas to authenticated;

-- Anotar que una ficha se supo o no se supo.
--
-- El cálculo del próximo intervalo vive acá y no en la aplicación para que
-- sea el mismo desde cualquier pantalla, y para que no se pueda adelantar
-- desde afuera. Los saltos son 1, 3, 7, 16 y 35 días: cada uno un poco más
-- del doble del anterior, que es lo que la evidencia sostiene sin pretender
-- una precisión que no existe.
create or replace function public.repasar_ficha(p_ficha uuid, p_acerto boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_aciertos int;
  v_dias int;
begin
  select aciertos into v_aciertos
    from public.fichas
   where id = p_ficha and estudiante_id = auth.uid();

  if v_aciertos is null then
    raise exception 'Esa ficha no es tuya.';
  end if;

  if p_acerto then
    v_aciertos := v_aciertos + 1;
    v_dias := case v_aciertos
                when 1 then 1
                when 2 then 3
                when 3 then 7
                when 4 then 16
                else 35
              end;
    update public.fichas
       set aciertos = v_aciertos,
           vista_en = now(),
           vuelve_en = now() + (v_dias || ' days')::interval
     where id = p_ficha and estudiante_id = auth.uid();
  else
    -- Al fallar vuelve al principio y reaparece hoy mismo: la ficha que no se
    -- sabe es exactamente la que hay que volver a ver.
    update public.fichas
       set aciertos = 0,
           fallos = fallos + 1,
           vista_en = now(),
           vuelve_en = now()
     where id = p_ficha and estudiante_id = auth.uid();
  end if;
end $$;

grant execute on function public.repasar_ficha(uuid, boolean) to authenticated;
