-- Escribir a mano en un apunte.
--
-- Los trazos van en una columna del mismo apunte y no en una tabla aparte, y
-- vale la pena decir por qué: un apunte con dibujo y un apunte escrito son el
-- mismo apunte, no dos cosas que se juntan al mostrarse. Se abren juntos, se
-- guardan juntos y se borran juntos. Una tabla aparte solo agregaría la
-- posibilidad de que queden desparejos.
--
-- jsonb y no texto: así la base valida que sea JSON de verdad. Un apunte con
-- los trazos corruptos abriría igual —la aplicación los lee tolerando basura—
-- pero no tiene sentido dejar entrar lo que ya se sabe roto.
--
-- Nulo significa «nunca se dibujó acá», que no es lo mismo que un tablero
-- borrado. La diferencia importa para no guardar `{"v":1,"trazos":[]}` en cada
-- apunte de texto que existe.

alter table public.apuntes
  add column trazos jsonb;

-- El tamaño sí hay que acotarlo. Un trazo aligerado pesa poco, pero nada
-- impide que alguien mande medio mega de puntos desde un cliente modificado, y
-- una fila así hace lenta la lista de apuntes de esa persona para siempre.
-- 512 kB son muchas páginas de letra manuscrita.
alter table public.apuntes
  add constraint apuntes_trazos_acotados
  check (trazos is null or pg_column_size(trazos) <= 512 * 1024);

-- Las políticas ya están: `edito mis apuntes` cubre la fila entera, y RLS no
-- distingue columnas. Quien puede escribir su apunte puede dibujar en él, que
-- es exactamente lo que corresponde.

-- La lista de apuntes no trae los trazos: son lo pesado de la fila y ahí solo
-- se muestra un adelanto del texto. Pero sí conviene saber cuáles tienen
-- dibujo, para marcarlos en la tarjeta. Una columna generada lo resuelve sin
-- que nadie tenga que acordarse de mantenerla al día.
alter table public.apuntes
  add column tiene_trazos boolean
  generated always as (trazos is not null) stored;
