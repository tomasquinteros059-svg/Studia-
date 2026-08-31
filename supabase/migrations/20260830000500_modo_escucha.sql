-- El modo escucha: la clase presencial, oída por el curso.
--
-- Cada teléfono de la sala transcribe en el propio aparato y sube tramos de
-- texto con su segundo y su confianza. El audio no llega acá: se queda en el
-- teléfono y se descarta a medida que se transcribe. Guardar la voz de treinta
-- menores de edad para no usarla sería cargar con un riesgo a cambio de nada,
-- y el texto es todo lo que el resumen necesita.
--
-- Los tramos son de muchos aparatos a propósito. Ninguno oye bien la clase
-- entera —el de adelante pierde la pregunta de atrás, al de atrás le llega la
-- profesora lejos— y cruzarlos es lo que hace que grabar el curso completo
-- valga la pena. El cruce vive en `dominio/escucha.ts`, con sus pruebas.

-- ── Qué clases se pueden oír ─────────────────────────────────────────────

-- Una clase por pantalla no se oye desde el aire: su audio ya pasa por la
-- aplicación. El modo escucha es de las presenciales, y hasta ahora una clase
-- no distinguía sala de pantalla.
alter table public.clases
  add column presencial boolean not null default true;

-- La clase es de quien la hace. Si quien dicta no lo permite, nadie en la sala
-- puede oír: la voz que más se escucha en una clase es la suya, y quien decide
-- si eso queda escrito es quien la pone. Por omisión, no.
alter table public.clases
  add column escucha_permitida boolean not null default false;

-- ── Quién está oyendo ────────────────────────────────────────────────────

-- Para poder decir «tu teléfono y 22 más», que no es un adorno: es lo que
-- hace visible que la sala entera está grabando.
create table public.escuchas (
  id          uuid primary key default gen_random_uuid(),
  clase_id    uuid not null references public.clases (id) on delete cascade,
  persona_id  uuid not null references public.perfiles (id) on delete cascade,
  empezo_en   timestamptz not null default now(),
  termino_en  timestamptz,
  -- Un aparato, no una persona: alguien puede entrar dos veces desde dos
  -- equipos y sus tramos no deben votarse entre sí como si fueran dos oyentes.
  aparato     text not null,
  unique (clase_id, aparato)
);
create index on public.escuchas (clase_id);

-- ── Lo que oyó cada aparato ──────────────────────────────────────────────

-- La tabla `transcripciones` existe desde el primer esquema y guarda la clase
-- ya armada: un texto por segundo, sin dueño. Esto es lo de antes: lo que oyó
-- cada aparato por separado, que es la materia prima del cruce.
create table public.tramos_oidos (
  id          uuid primary key default gen_random_uuid(),
  clase_id    uuid not null references public.clases (id) on delete cascade,
  escucha_id  uuid not null references public.escuchas (id) on delete cascade,
  segundo     integer not null check (segundo >= 0),
  texto       text not null check (length(texto) between 1 and 2000),
  -- Entre 0 y 1 donde el teléfono la informa; -1 donde no. El -1 importa: un
  -- tramo sin dato no es un tramo malo, y el cruce los distingue.
  confianza   real not null default -1 check (confianza = -1 or confianza between 0 and 1),
  creado_en   timestamptz not null default now()
);
create index on public.tramos_oidos (clase_id, segundo);

-- ── Quién ve qué ─────────────────────────────────────────────────────────

alter table public.escuchas     enable row level security;
alter table public.tramos_oidos enable row level security;

-- Se ve quién está oyendo, porque de eso se trata: la sala tiene que saber
-- que la sala está grabando.
create policy "veo quién está oyendo mi clase" on public.escuchas
  for select to authenticated using (
    exists (select 1 from public.clases c
             where c.id = clase_id and public.esta_inscrito(c.asignatura_id))
  );

create policy "puedo ponerme a oír una clase mía" on public.escuchas
  for insert to authenticated with check (
    persona_id = auth.uid()
    and exists (
      select 1 from public.clases c
       where c.id = clase_id
         and public.esta_inscrito(c.asignatura_id)
         -- Las dos condiciones que dan derecho a oír, en la base y no solo en
         -- la pantalla: que sea presencial y que quien dicta lo permita.
         and c.presencial
         and c.escucha_permitida
    )
  );

create policy "cierro mi propia escucha" on public.escuchas
  for update to authenticated
  using (persona_id = auth.uid()) with check (persona_id = auth.uid());

-- Los tramos crudos no los lee el curso: son treinta versiones a medio
-- entender de lo mismo, y leer la peor no le sirve a nadie. Cada quien ve los
-- suyos; lo que se lee es la clase ya armada, en `transcripciones`.
create policy "veo lo que oyó mi propio aparato" on public.tramos_oidos
  for select to authenticated using (
    exists (select 1 from public.escuchas e
             where e.id = escucha_id and e.persona_id = auth.uid())
  );

create policy "subo lo que oyó mi aparato" on public.tramos_oidos
  for insert to authenticated with check (
    exists (select 1 from public.escuchas e
             where e.id = escucha_id
               and e.persona_id = auth.uid()
               and e.termino_en is null)
  );

grant select, insert, update on public.escuchas to authenticated;
grant select, insert on public.tramos_oidos to authenticated;

-- La clase armada la escribe la función con la clave de servicio, igual que el
-- resumen: si el cliente pudiera escribir en `transcripciones`, cualquiera
-- podría poner en boca de un profesor algo que no dijo, y quedaría como la
-- versión oficial de la clase para todo el curso.

-- ── Lo que se tira cuando la clase queda armada ──────────────────────────

/**
 * Arma la clase con todo lo que oyeron los aparatos y borra los tramos crudos.
 *
 * El borrado va en la misma función y no en un aseo aparte a propósito: los
 * tramos sueltos son lo único que se parece a una grabación de la sala —quién
 * oyó qué, desde dónde— y tenerlos más tiempo del necesario no aporta nada.
 * En cuanto la clase está escrita, sobran.
 */
create or replace function public.armar_la_clase(p_clase uuid, p_tramos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  puede boolean;
begin
  select public.esta_inscrito(c.asignatura_id) into puede
    from public.clases c where c.id = p_clase;
  if not coalesce(puede, false) then
    raise exception 'No puedes armar una clase de un ramo en que no estás.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.transcripciones where clase_id = p_clase;

  insert into public.transcripciones (clase_id, segundo, texto)
  select p_clase, (t->>'segundo')::int, t->>'texto'
    from jsonb_array_elements(p_tramos) t;

  delete from public.tramos_oidos where clase_id = p_clase;
  update public.escuchas set termino_en = coalesce(termino_en, now())
   where clase_id = p_clase;
end $$;

revoke all on function public.armar_la_clase(uuid, jsonb) from public;
grant execute on function public.armar_la_clase(uuid, jsonb) to authenticated;
