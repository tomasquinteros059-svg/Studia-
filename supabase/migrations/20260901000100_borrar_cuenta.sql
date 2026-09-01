-- Que borrar la cuenta borre de verdad lo que la política promete.
--
-- El borrado en cascada ya se llevaba casi todo: `perfiles.id` referencia a
-- `auth.users(id) on delete cascade`, y de `perfiles` cuelgan con esa misma
-- regla los apuntes, las notas, las entregas, las conversaciones con el tutor,
-- los quizzes, las fichas y lo oído en clase.
--
-- Faltaba una cosa, y no era menor. En el foro el autor se guarda dos veces:
-- `autor_id`, que apunta al perfil, y `autor_nombre`, que es texto suelto.
-- Existe así por una buena razón —un hilo escrito por una profesora, que
-- todavía no tiene cuenta, igual tiene que mostrar de quién es—, pero
-- significa que al borrar la cuenta el `autor_id` quedaba en nulo y **el
-- nombre se quedaba escrito**. La política de privacidad dice que lo del foro
-- queda «sin tu nombre», y no era cierto.
--
-- El texto sí se queda: es parte de una conversación de otras personas, y
-- borrarlo dejaría respuestas colgando de preguntas que ya no están.

create or replace function public.anonimizar_lo_publicado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Antes del borrado, no después: en cuanto la fila del perfil se va, el
  -- `on delete set null` ya corrió y no queda por dónde encontrar sus hilos.
  update public.hilos
     set autor_nombre = 'Cuenta borrada'
   where autor_id = old.id;

  update public.respuestas
     set autor_nombre = 'Cuenta borrada'
   where autor_id = old.id;

  return old;
end $$;

comment on function public.anonimizar_lo_publicado() is
  'Quita el nombre de lo publicado en el foro cuando se borra la cuenta. El '
  'texto se queda: es parte de la conversación de otras personas.';

create trigger perfiles_anonimizar_al_borrar
  before delete on public.perfiles
  for each row execute function public.anonimizar_lo_publicado();
