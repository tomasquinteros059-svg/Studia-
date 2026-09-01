-- Un docente no podía ver qué dicta.
--
-- `20260826000300_administracion.sql` concede sobre `dictados` insert, update
-- y delete, y se saltó select. La política "veo mis dictados" está escrita y es
-- correcta, pero una política no sirve de nada sin el permiso de tabla: Postgres
-- mira primero el grant, y sin él responde «permission denied for table
-- dictados» antes de llegar a evaluar ninguna política.
--
-- Lo que se rompía: `misDictados()`, que es de donde sale si esta persona dicta
-- algo. Sin eso la aplicación no muestra el panel docente y en su lugar aparece
-- «No pude cargar tus ramos». Todo el lado del profesor, caído, para todos.
--
-- No apareció antes porque las pruebas de acceso entran como `postgres`, que se
-- salta los permisos, y porque el resto del panel docente pregunta a través de
-- `dicta()`, que es `security definer` y tampoco los necesita. Lo encontró
-- herramientas/cruzar-consultas.mjs, cruzando cada consulta de la aplicación
-- contra los permisos de verdad.

grant select on public.dictados to authenticated;
