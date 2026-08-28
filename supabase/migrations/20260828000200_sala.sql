-- La sala: uno graba, los demás reciben
--
-- En una clase o en una asamblea graba una sola persona y el acta le sirve a
-- todos los que estaban ahí. Hasta ahora el dueño tenía que invitar de a uno,
-- buscando a cada persona; con treinta en una sala eso no ocurre nunca.
--
-- Con un código, entran ellos. Y ahí aparece el problema interesante: quien
-- va a entrar todavía no puede VER la reunión —las políticas la esconden— así
-- que tampoco puede buscarla por su código para saber a cuál se está uniendo.
-- No se puede resolver con una política; se resuelve con una función que
-- mira el código por dentro y solo devuelve si acertó.

alter table public.reuniones
  add column codigo         text unique,
  add column sala_abierta   boolean not null default false,
  add column sala_abierta_en timestamptz;

-- El alfabeto es el mismo de app/src/dominio/sala.ts: sin O/0, I/1/L, S/5,
-- B/8 ni U/V, que son los pares que se confunden al dictar un código en voz
-- alta. La restricción está acá para que un código de otra forma no entre por
-- una vía que no sea la app.
alter table public.reuniones
  add constraint codigo_bien_formado
  check (codigo is null or codigo ~ '^[ACDEFGHJKMNPQRTWXY2346789]{6}$');

comment on column public.reuniones.codigo is
  'Código para entrar a la sala. Null mientras no se abra.';

/* Cuánto vale un código. Doce horas: el código sigue circulando en un grupo
   de WhatsApp mucho después de que la reunión terminó. */
create or replace function public.sala_abierta_de(p_reunion public.reuniones)
returns boolean
language sql
immutable
as $$
  select p_reunion.sala_abierta
     and p_reunion.sala_abierta_en is not null
     and now() - p_reunion.sala_abierta_en < interval '12 hours';
$$;

/*
 * Entrar con el código.
 *
 * SECURITY DEFINER porque quien entra no ve la reunión todavía: la busca a
 * ciegas. Por eso la función es lo más angosta posible —recibe un código y
 * devuelve un id— y no acepta ningún otro parámetro: no hay forma de pedirle
 * "métete a esta reunión", solo "acá está el código que me dieron".
 *
 * Lo que devuelve es el id, y nada más. Si el código no existe o la sala se
 * cerró, devuelve null y no dice cuál de las dos cosas pasó: la diferencia
 * serviría para averiguar qué códigos existen probando de a uno.
 */
create or replace function public.entrar_con_codigo(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reunion public.reuniones;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Tolerante con cómo lo escribieron: mayúsculas, espacios y el guion con
  -- que se muestra. Las confusiones de letras las corrige la app, que sabe
  -- cuál quiso escribir; acá corregirlas dejaría que un código se pareciera
  -- a otro sin que nadie lo hubiera pedido.
  select * into v_reunion
    from public.reuniones
   where codigo = upper(regexp_replace(p_codigo, '[[:space:]\-_.]', '', 'g'));

  if not found or not public.sala_abierta_de(v_reunion) then
    return null;
  end if;

  -- El dueño ya está adentro; anotarlo como invitado de sí mismo sería una
  -- fila que después habría que explicar en todas las cuentas.
  if v_reunion.dueno_id = auth.uid() then
    return v_reunion.id;
  end if;

  insert into public.invitados_reunion (reunion_id, persona_id, puede_editar)
  values (v_reunion.id, auth.uid(), false)
  on conflict (reunion_id, persona_id) do nothing;

  return v_reunion.id;
end;
$$;

revoke execute on function public.entrar_con_codigo(text) from public;
grant  execute on function public.entrar_con_codigo(text) to authenticated;

revoke execute on function public.sala_abierta_de(public.reuniones) from public;
grant  execute on function public.sala_abierta_de(public.reuniones) to authenticated;

/*
 * Quiénes están en la sala.
 *
 * `invitados_reunion` guarda identificadores, y para mostrar la sala hacen
 * falta nombres. Leer `perfiles` de otra persona no está abierto —y no debe
 * estarlo— así que esto entrega solo los nombres de quienes comparten esta
 * reunión, y solo a quien también la comparte.
 */
create or replace function public.gente_de_la_sala(p_reunion uuid)
returns table (id uuid, nombre text, puede_editar boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, i.puede_editar
    from public.invitados_reunion i
    join public.perfiles p on p.id = i.persona_id
   where i.reunion_id = p_reunion
     and public.alcanzo_la_reunion(p_reunion)
   order by p.nombre;
$$;

revoke execute on function public.gente_de_la_sala(uuid) from public;
grant  execute on function public.gente_de_la_sala(uuid) to authenticated;

-- Abrir la sala deja la hora sola, igual que al marcar una tarea: si la
-- mandara la app, un teléfono con el reloj corrido daría una sala que caduca
-- antes o después de lo que corresponde.
create or replace function public.sellar_sala()
returns trigger
language plpgsql
as $$
begin
  if new.sala_abierta and not old.sala_abierta then
    new.sala_abierta_en := now();
  elsif not new.sala_abierta then
    new.sala_abierta_en := null;
  end if;
  return new;
end;
$$;

create trigger sala_se_sella
  before update on public.reuniones
  for each row execute function public.sellar_sala();
