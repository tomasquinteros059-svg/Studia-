-- El lector inmersivo necesita el texto, no solo el título del material.
--
-- Hasta ahora un material era una fila con nombre y un enlace: "Apunte:
-- límites laterales · PDF · 8 páginas". Para escucharlo hace falta el texto
-- adentro. Los materiales que siguen siendo un archivo (videos, guías en
-- PDF) dejan la columna en null y no muestran el botón de escuchar.

alter table public.materiales
  add column texto text;

-- Un documento sin texto ni url no es nada: o se lee o se abre.
alter table public.materiales
  add constraint material_tiene_contenido
  check (tipo <> 'documento' or texto is not null or url is not null);

comment on column public.materiales.texto is
  'Cuerpo del material en texto plano, para leerlo y escucharlo dentro de la app.';

-- La política de lectura de materiales ya cubre esta columna: se hereda de
-- la inscripción al ramo a través del módulo. No hace falta política nueva.
