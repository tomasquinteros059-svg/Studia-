-- Del perfil propio, el cliente solo cambia el nombre.
--
-- `20260825000200_rls.sql` concedía `insert, update` sobre `perfiles` entera.
-- La lectura sí estaba afinada por columna desde el principio —id, nombre,
-- creado_en, rol, plan— pero la escritura no, y quedaron alcanzables dos
-- columnas que nadie debería poder tocar desde un teléfono:
--
--   · `correo`, que el cliente no puede leer pero sí podía escribir. El correo
--     de verdad vive en auth.users; esta es la copia que `registros()` le
--     muestra a la administración. Alguien podía dejar ahí el correo de otra
--     persona y la lista de la administración lo habría mostrado como cierto.
--
--   · `id` y `creado_en`, que no se cambian nunca.
--
-- `rol` y `plan` ya estaban protegidos por el disparador `al_editar_perfil`,
-- que sigue donde estaba: esto no lo reemplaza, lo acompaña. La diferencia es
-- que ahora la base lo niega antes, por permisos, y no por una excepción.
--
-- `insert` se va entero: la fila la crea el disparador de alta, que es
-- `security definer` y no usa los permisos de quien se registra.

revoke insert, update on public.perfiles from authenticated;
grant  update (nombre) on public.perfiles to authenticated;
