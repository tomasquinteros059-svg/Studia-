-- Reuniones que se repiten a una hora fija
--
-- Una reunión de obra es todos los martes a las nueve; una clase, todos los
-- días a la misma hora. Agendarlas evita tener que acordarse, que es la razón
-- por la que la mitad de las reuniones no quedan grabadas.
--
-- Lo que se agenda es el AVISO, no la grabación. Ninguna aplicación puede
-- prender el micrófono sola a una hora: Android prohíbe crear un servicio de
-- micrófono con la app en segundo plano, iOS solo deja continuar una
-- grabación que empezó con la app abierta, y los dos muestran un indicador
-- permanente mientras el micrófono está activo. Así que a la hora fijada
-- llega una notificación y basta un toque.
--
-- El aviso lo programa el propio teléfono; la base solo guarda cuándo y cada
-- cuánto, para que la agenda siga estando si la persona cambia de aparato.

create type public.repeticion as enum ('nunca', 'cada_semana', 'dias_de_semana');

alter table public.reuniones
  add column programada_para timestamptz,
  add column repite public.repeticion not null default 'nunca';

-- Repetir algo que no tiene fecha de inicio no significa nada.
alter table public.reuniones
  add constraint repite_necesita_fecha
  check (repite = 'nunca' or programada_para is not null);

create index reuniones_agendadas on public.reuniones (dueno_id, programada_para)
  where programada_para is not null;

comment on column public.reuniones.programada_para is
  'Cuándo empieza. El aviso lo programa el teléfono; acá solo se guarda.';
