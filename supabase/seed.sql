-- StudIA · datos de ejemplo
-- Reproduce las seis asignaturas del prototipo, con fechas relativas a ahora
-- para que la app arranque con una clase en vivo y tareas por vencer.

-- Atajos para no repetir subconsultas. Viven solo en esta sesión.
create or replace function pg_temp.asig(p_codigo text) returns uuid
  language sql stable as $$ select id from public.asignaturas where codigo = p_codigo $$;

create or replace function pg_temp.modu(p_codigo text, p_orden int) returns uuid
  language sql stable as $$
    select m.id from public.modulos m
      join public.asignaturas a on a.id = m.asignatura_id
     where a.codigo = p_codigo and m.orden = p_orden
  $$;

create or replace function pg_temp.hilo(p_titulo text) returns uuid
  language sql stable as $$ select id from public.hilos where titulo = p_titulo limit 1 $$;

create or replace function pg_temp.tarea(p_titulo text) returns uuid
  language sql stable as $$ select id from public.tareas where titulo = p_titulo limit 1 $$;

-- ------------------------------------------------------------ estudiante
-- Cuenta de demostración: eduardo@studia.cl / clave-demo
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  'e0000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'eduardo@studia.cl',
  crypt('clave-demo', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Eduardo Q."}'::jsonb
) on conflict (id) do nothing;

-- ----------------------------------------------------------- asignaturas
insert into public.asignaturas
  (codigo, nombre, profesor, ayudante, color, creditos, descripcion, requisitos, bibliografia, intro_tutor)
values
  ('MAT1610', 'Cálculo I', 'Ana Ríos', 'Ignacio Soto', '#208AEF', 10,
   'Cálculo diferencial en una variable: límites, continuidad, derivada y sus aplicaciones. El curso privilegia el planteamiento por sobre el cálculo mecánico.',
   'Álgebra y geometría de enseñanza media',
   array['Stewart, J. — Cálculo de una variable, 8ª ed.', 'Spivak, M. — Calculus'],
   'Cuéntame en qué problema de cálculo estás. ¿Qué te piden encontrar y qué datos tienes?'),

  ('MAT1203', 'Álgebra Lineal', 'Diego Fuentes', 'Camila Reyes', '#7A4FD6', 10,
   'Sistemas de ecuaciones, espacios vectoriales y transformaciones lineales, con énfasis en la interpretación geométrica de los resultados.',
   'Álgebra de enseñanza media',
   array['Grossman, S. — Álgebra lineal', 'Lay, D. — Álgebra lineal y sus aplicaciones'],
   '¿En qué andas? Antes de operar: ¿qué esperas de la solución del sistema, única, infinitas o ninguna?'),

  ('FIS1503', 'Física I', 'Carla Núñez', 'Pedro Lagos', '#C9701C', 10,
   'Mecánica clásica: cinemática, dinámica de la partícula, trabajo y energía. Todo problema parte por el diagrama de cuerpo libre.',
   'Cálculo I (puede cursarse en paralelo)',
   array['Serway, R. — Física para ciencias e ingeniería', 'Young & Freedman — Física universitaria'],
   'Partamos por el diagrama de cuerpo libre. ¿Qué fuerzas actúan sobre el cuerpo?'),

  ('ICS2123', 'Investigación de Operaciones', 'Rodrigo Salas', 'Fernanda Díaz', '#1E8E5A', 10,
   'Modelamiento de problemas de decisión mediante programación lineal, método simplex y análisis de dualidad. Se evalúa el modelo, no la herramienta.',
   'Álgebra Lineal',
   array['Hillier & Lieberman — Introducción a la investigación de operaciones', 'Winston, W. — Investigación de operaciones'],
   'Modelemos juntos. ¿Cuáles serían tus variables de decisión, en palabras?'),

  ('EAE1110', 'Microeconomía', 'Paula Vergara', 'Joaquín Herrera', '#D93B6B', 8,
   'Comportamiento de consumidores y productores, equilibrio de mercado y elasticidad, siempre a partir de casos concretos.',
   'Sin requisitos',
   array['Varian, H. — Microeconomía intermedia', 'Pindyck & Rubinfeld — Microeconomía'],
   'Vamos con un ejemplo concreto. ¿Qué cambia en el mercado y por qué crees que se mueve?'),

  ('IIC1103', 'Programación', 'Matías Leiva', 'Valentina Ruiz', '#0C447C', 10,
   'Fundamentos de programación en Python: control de flujo, estructuras de datos y recursión. Antes de escribir código, describir el algoritmo en palabras.',
   'Sin requisitos',
   array['Downey, A. — Think Python, 2ª ed.', 'Documentación oficial de Python 3'],
   'Descríbeme el algoritmo en palabras. ¿Cuál sería el primer paso antes de escribir código?')
on conflict (codigo) do nothing;

insert into public.inscripciones (estudiante_id, asignatura_id)
select 'e0000000-0000-4000-8000-000000000001', id from public.asignaturas
on conflict do nothing;

-- --------------------------------------------------------------- horario
insert into public.bloques_horario (asignatura_id, dia, hora_inicio, hora_fin, sala, tipo) values
  (pg_temp.asig('MAT1610'), 1, '08:30', '10:00', 'A-201', 'Cátedra'),
  (pg_temp.asig('MAT1610'), 2, '08:30', '10:00', 'A-201', 'Cátedra'),
  (pg_temp.asig('MAT1610'), 4, '11:30', '13:00', 'Lab B-3', 'Ayudantía'),
  (pg_temp.asig('MAT1203'), 2, '10:15', '11:45', 'B-104', 'Cátedra'),
  (pg_temp.asig('MAT1203'), 5, '08:30', '10:00', 'B-104', 'Cátedra'),
  (pg_temp.asig('FIS1503'), 1, '11:30', '13:00', 'C-002', 'Cátedra'),
  (pg_temp.asig('FIS1503'), 3, '11:30', '13:00', 'C-002', 'Cátedra'),
  (pg_temp.asig('FIS1503'), 5, '14:00', '16:00', 'Lab Física', 'Laboratorio'),
  (pg_temp.asig('ICS2123'), 2, '14:00', '15:30', 'D-310', 'Cátedra'),
  (pg_temp.asig('ICS2123'), 4, '14:00', '15:30', 'D-310', 'Cátedra'),
  (pg_temp.asig('EAE1110'), 3, '08:30', '10:00', 'E-105', 'Cátedra'),
  (pg_temp.asig('EAE1110'), 5, '10:15', '11:45', 'E-105', 'Cátedra'),
  (pg_temp.asig('IIC1103'), 1, '14:00', '15:30', 'Lab Comp 2', 'Cátedra'),
  (pg_temp.asig('IIC1103'), 3, '14:00', '15:30', 'Lab Comp 2', 'Cátedra');

-- --------------------------------------------------------------- materia
insert into public.modulos (asignatura_id, titulo, orden) values
  (pg_temp.asig('MAT1610'), '1 · Límites y continuidad', 1),
  (pg_temp.asig('MAT1610'), '2 · La derivada', 2),
  (pg_temp.asig('MAT1610'), '3 · Aplicaciones', 3),
  (pg_temp.asig('MAT1203'), '1 · Sistemas de ecuaciones', 1),
  (pg_temp.asig('MAT1203'), '2 · Espacios vectoriales', 2),
  (pg_temp.asig('MAT1203'), '3 · Transformaciones lineales', 3),
  (pg_temp.asig('FIS1503'), '1 · Cinemática', 1),
  (pg_temp.asig('FIS1503'), '2 · Dinámica', 2),
  (pg_temp.asig('FIS1503'), '3 · Trabajo y energía', 3),
  (pg_temp.asig('ICS2123'), '1 · Programación lineal', 1),
  (pg_temp.asig('ICS2123'), '2 · Método simplex', 2),
  (pg_temp.asig('ICS2123'), '3 · Dualidad', 3),
  (pg_temp.asig('EAE1110'), '1 · Oferta y demanda', 1),
  (pg_temp.asig('EAE1110'), '2 · Elasticidad', 2),
  (pg_temp.asig('EAE1110'), '3 · Teoría del consumidor', 3),
  (pg_temp.asig('IIC1103'), '1 · Fundamentos', 1),
  (pg_temp.asig('IIC1103'), '2 · Estructuras de datos', 2),
  (pg_temp.asig('IIC1103'), '3 · Recursión', 3);

insert into public.materiales (modulo_id, tipo, titulo, detalle, orden) values
  (pg_temp.modu('MAT1610',1), 'video',      'Idea intuitiva de límite',            'Video · 14 min',   1),
  (pg_temp.modu('MAT1610',1), 'documento',  'Apunte: límites laterales',           'PDF · 8 páginas',  2),
  (pg_temp.modu('MAT1610',1), 'ejercicios', 'Ejercicios 1.1 — resueltos',          '12 ítems',         3),
  (pg_temp.modu('MAT1610',2), 'video',      'Definición y regla de la cadena',     'Video · 19 min',   1),
  (pg_temp.modu('MAT1610',2), 'documento',  'Formulario de derivadas',             'PDF · 2 páginas',  2),
  (pg_temp.modu('MAT1610',2), 'ejercicios', 'Guía 3 — derivación',                 '15 ítems',         3),
  (pg_temp.modu('MAT1610',3), 'video',      'Optimización: máximos y mínimos',     'Video · 22 min',   1),
  (pg_temp.modu('MAT1610',3), 'documento',  'Casos de estudio',                    'PDF · 11 páginas', 2),
  (pg_temp.modu('MAT1610',3), 'ejercicios', 'Guía 4 — optimización',               '9 ítems',          3),
  (pg_temp.modu('MAT1203',1), 'video',      'Eliminación de Gauss',                'Video · 17 min',   1),
  (pg_temp.modu('MAT1203',1), 'documento',  'Apunte: matriz escalonada',           'PDF · 6 páginas',  2),
  (pg_temp.modu('MAT1203',2), 'video',      'Base y dimensión',                    'Video · 21 min',   1),
  (pg_temp.modu('MAT1203',2), 'ejercicios', 'Guía 2 — independencia lineal',       '10 ítems',         2),
  (pg_temp.modu('MAT1203',3), 'video',      'Matriz de una transformación',        'Video · 16 min',   1),
  (pg_temp.modu('MAT1203',3), 'documento',  'Apunte: núcleo e imagen',             'PDF · 9 páginas',  2),
  (pg_temp.modu('FIS1503',1), 'video',      'Movimiento en dos dimensiones',       'Video · 18 min',   1),
  (pg_temp.modu('FIS1503',1), 'ejercicios', 'Guía 1 — tiro parabólico',            '8 ítems',          2),
  (pg_temp.modu('FIS1503',2), 'video',      'Leyes de Newton y diagramas',         'Video · 24 min',   1),
  (pg_temp.modu('FIS1503',2), 'documento',  'Apunte: roce estático y cinético',    'PDF · 7 páginas',  2),
  (pg_temp.modu('FIS1503',2), 'ejercicios', 'Guía 2 — planos inclinados',          '11 ítems',         3),
  (pg_temp.modu('FIS1503',3), 'video',      'Conservación de la energía',          'Video · 20 min',   1),
  (pg_temp.modu('ICS2123',1), 'video',      'Formulación de modelos',              'Video · 23 min',   1),
  (pg_temp.modu('ICS2123',1), 'documento',  'Apunte: forma estándar',              'PDF · 5 páginas',  2),
  (pg_temp.modu('ICS2123',1), 'ejercicios', 'Casos de modelamiento',               '6 ítems',          3),
  (pg_temp.modu('ICS2123',2), 'video',      'Simplex paso a paso',                 'Video · 28 min',   1),
  (pg_temp.modu('ICS2123',2), 'documento',  'Tabla simplex comentada',             'PDF · 4 páginas',  2),
  (pg_temp.modu('ICS2123',3), 'video',      'Interpretación económica del dual',   'Video · 19 min',   1),
  (pg_temp.modu('EAE1110',1), 'video',      'Equilibrio de mercado',               'Video · 15 min',   1),
  (pg_temp.modu('EAE1110',1), 'documento',  'Apunte: desplazamientos vs. movimientos', 'PDF · 6 páginas', 2),
  (pg_temp.modu('EAE1110',2), 'video',      'Elasticidad precio de la demanda',    'Video · 18 min',   1),
  (pg_temp.modu('EAE1110',2), 'ejercicios', 'Guía 2 — cálculo de elasticidades',   '10 ítems',         2),
  (pg_temp.modu('EAE1110',3), 'video',      'Curvas de indiferencia',              'Video · 20 min',   1),
  (pg_temp.modu('IIC1103',1), 'video',      'Variables, tipos y control de flujo', 'Video · 16 min',   1),
  (pg_temp.modu('IIC1103',1), 'ejercicios', 'Ejercicios 1 — condicionales',        '14 ítems',         2),
  (pg_temp.modu('IIC1103',2), 'video',      'Listas y diccionarios',               'Video · 22 min',   1),
  (pg_temp.modu('IIC1103',2), 'documento',  'Apunte: complejidad básica',          'PDF · 5 páginas',  2),
  (pg_temp.modu('IIC1103',2), 'ejercicios', 'Ejercicios 2 — listas',               '12 ítems',         3),
  (pg_temp.modu('IIC1103',3), 'video',      'Pensar recursivamente',               'Video · 19 min',   1);

-- Lo que Eduardo ya completó.
insert into public.progreso_material (estudiante_id, material_id)
select 'e0000000-0000-4000-8000-000000000001', m.id
  from public.materiales m
  join public.modulos mo on mo.id = m.modulo_id
  join public.asignaturas a on a.id = mo.asignatura_id
 where (a.codigo = 'MAT1610' and (mo.orden = 1 or (mo.orden = 2 and m.orden <= 2)))
    or (a.codigo = 'MAT1203' and (mo.orden = 1 or (mo.orden = 2 and m.orden = 1)))
    or (a.codigo = 'FIS1503' and (mo.orden = 1 or (mo.orden = 2 and m.orden = 1)))
    or (a.codigo = 'ICS2123' and mo.orden = 1 and m.orden <= 2)
    or (a.codigo = 'EAE1110' and mo.orden <= 2)
    or (a.codigo = 'IIC1103' and mo.orden <= 2);

-- --------------------------------------------------------------- clases
insert into public.clases (asignatura_id, titulo, estado, inicia_en, duracion_seg) values
  (pg_temp.asig('MAT1610'), 'Teorema del valor medio',            'en_vivo', now() - interval '12 minutes', null),
  (pg_temp.asig('MAT1610'), 'Clase 12 · Regla de L''Hôpital',     'grabada', now() - interval '5 days',  3840),
  (pg_temp.asig('MAT1610'), 'Clase 11 · Derivadas implícitas',    'grabada', now() - interval '7 days',  3300),
  (pg_temp.asig('MAT1610'), 'Clase 10 · Continuidad en un intervalo', 'grabada', now() - interval '12 days', 3600),
  (pg_temp.asig('MAT1203'), 'Clase 9 · Base y dimensión',         'grabada', now() - interval '3 days',  3480),
  (pg_temp.asig('MAT1203'), 'Clase 8 · Subespacios',              'grabada', now() - interval '6 days',  3540),
  (pg_temp.asig('FIS1503'), 'Clase 10 · Roce y planos inclinados','grabada', now() - interval '5 days',  3720),
  (pg_temp.asig('FIS1503'), 'Clase 9 · Segunda ley de Newton',    'grabada', now() - interval '7 days',  3600),
  (pg_temp.asig('ICS2123'), 'Clase 7 · Formulación de modelos',   'grabada', now() - interval '4 days',  3300),
  (pg_temp.asig('EAE1110'), 'Clase 11 · Elasticidad e ingreso total', 'grabada', now() - interval '3 days', 3240),
  (pg_temp.asig('IIC1103'), 'Clase 14 · Diccionarios en profundidad',  'grabada', now() - interval '5 days', 3120),
  (pg_temp.asig('IIC1103'), 'Clase 13 · Listas por comprensión',  'grabada', now() - interval '7 days',  2940);

-- Capítulos: mismos cortes proporcionales que usaba el prototipo.
insert into public.capitulos_clase (clase_id, titulo, segundo, orden)
select c.id, v.titulo, round(c.duracion_seg * v.fraccion)::int, v.orden
  from public.clases c
 cross join (values
    ('Repaso de la clase anterior',        0.00, 1),
    ('Concepto central',                   0.18, 2),
    ('Ejemplo desarrollado en pizarra',    0.45, 3),
    ('Preguntas del curso',                0.78, 4)
 ) as v(titulo, fraccion, orden)
 where c.estado = 'grabada';

-- --------------------------------------------------------------- tareas
insert into public.tareas (asignatura_id, titulo, enunciado, criterios, puntos, vence_en) values
  (pg_temp.asig('MAT1610'), 'Guía 4 · Optimización',
   'Resuelve los 9 problemas de optimización de la guía. Para cada uno debes entregar el planteamiento antes del cálculo.',
   array['El diagrama o esquema de la situación', 'La función objetivo y su dominio', 'La justificación de por qué el punto hallado es máximo o mínimo'],
   20, now() + interval '3 days'),

  (pg_temp.asig('MAT1610'), 'Control 2 · Derivadas',
   'Control escrito sobre reglas de derivación y aplicaciones.', array[]::text[],
   30, now() - interval '7 days'),

  (pg_temp.asig('MAT1203'), 'Guía 2 · Independencia lineal',
   'Determina si cada conjunto de vectores es linealmente independiente y justifica el procedimiento.',
   array['Muestra el sistema planteado', 'Indica el rango de la matriz', 'Concluye en una frase'],
   15, now() + interval '1 day'),

  (pg_temp.asig('FIS1503'), 'Informe de laboratorio 2',
   'Informe del experimento de plano inclinado, en formato IMRyD.',
   array['Tabla de datos con incertidumbre', 'Gráfico con ajuste lineal', 'Discusión del coeficiente de roce obtenido'],
   25, now() + interval '2 days'),

  (pg_temp.asig('FIS1503'), 'Guía 2 · Planos inclinados',
   'Once problemas de dinámica con roce.', array[]::text[],
   15, now() - interval '1 day'),

  (pg_temp.asig('ICS2123'), 'Caso 1 · Mezcla de producción',
   'Formula el modelo de programación lineal del caso y resuélvelo con la herramienta que prefieras.',
   array['Variables de decisión definidas en palabras', 'Función objetivo', 'Restricciones con su interpretación'],
   20, now() + interval '7 days'),

  (pg_temp.asig('EAE1110'), 'Control 2 · Elasticidad',
   'Control en sala sobre elasticidad y sus aplicaciones.', array[]::text[],
   25, now() + interval '1 day'),

  (pg_temp.asig('IIC1103'), 'Tarea 3 · Análisis de datos',
   'Programa que lee un archivo CSV de notas y entrega estadísticas por sección.',
   array['Lectura robusta del archivo', 'Funciones separadas por responsabilidad', 'Casos borde: archivo vacío o con filas mal formadas'],
   30, now() + interval '3 days'),

  (pg_temp.asig('IIC1103'), 'Tarea 2 · Estructuras',
   'Implementación de un inventario con diccionarios.', array[]::text[],
   30, now() - interval '10 days');

insert into public.entregas (tarea_id, estudiante_id, entregado_en, puntos_obtenidos) values
  (pg_temp.tarea('Control 2 · Derivadas'), 'e0000000-0000-4000-8000-000000000001', now() - interval '7 days', 27),
  (pg_temp.tarea('Tarea 2 · Estructuras'), 'e0000000-0000-4000-8000-000000000001', now() - interval '10 days', 29);

-- ---------------------------------------------------------------- notas
insert into public.evaluaciones (asignatura_id, titulo, peso, orden) values
  (pg_temp.asig('MAT1610'), 'Control 1 · Límites',          20, 1),
  (pg_temp.asig('MAT1610'), 'Control 2 · Derivadas',        20, 2),
  (pg_temp.asig('MAT1610'), 'Guías y talleres',             15, 3),
  (pg_temp.asig('MAT1610'), 'Examen final',                 45, 4),
  (pg_temp.asig('MAT1203'), 'Control 1 · Sistemas',         25, 1),
  (pg_temp.asig('MAT1203'), 'Guías',                        15, 2),
  (pg_temp.asig('MAT1203'), 'Control 2 · Espacios vectoriales', 25, 3),
  (pg_temp.asig('MAT1203'), 'Examen final',                 35, 4),
  (pg_temp.asig('FIS1503'), 'Control 1 · Cinemática',       20, 1),
  (pg_temp.asig('FIS1503'), 'Laboratorios',                 20, 2),
  (pg_temp.asig('FIS1503'), 'Control 2 · Dinámica',         25, 3),
  (pg_temp.asig('FIS1503'), 'Examen final',                 35, 4),
  (pg_temp.asig('ICS2123'), 'Control 1 · Modelamiento',     30, 1),
  (pg_temp.asig('ICS2123'), 'Casos',                        20, 2),
  (pg_temp.asig('ICS2123'), 'Examen final',                 50, 3),
  (pg_temp.asig('EAE1110'), 'Control 1 · Oferta y demanda', 25, 1),
  (pg_temp.asig('EAE1110'), 'Trabajos',                     20, 2),
  (pg_temp.asig('EAE1110'), 'Control 2 · Elasticidad',      25, 3),
  (pg_temp.asig('EAE1110'), 'Examen final',                 30, 4),
  (pg_temp.asig('IIC1103'), 'Tarea 1 · Fundamentos',        15, 1),
  (pg_temp.asig('IIC1103'), 'Tarea 2 · Estructuras',        15, 2),
  (pg_temp.asig('IIC1103'), 'Control 1',                    25, 3),
  (pg_temp.asig('IIC1103'), 'Tarea 3 · Análisis de datos',  15, 4),
  (pg_temp.asig('IIC1103'), 'Examen final',                 30, 5);

insert into public.notas (evaluacion_id, estudiante_id, nota, publicada_en)
select e.id, 'e0000000-0000-4000-8000-000000000001', v.nota, now() - interval '2 days'
  from public.evaluaciones e
  join public.asignaturas a on a.id = e.asignatura_id
  join (values
    ('MAT1610', 1, 6.2), ('MAT1610', 2, 6.3), ('MAT1610', 3, 6.5),
    ('MAT1203', 1, 4.8), ('MAT1203', 2, 5.5),
    ('FIS1503', 1, 5.2), ('FIS1503', 2, 6.0),
    ('ICS2123', 1, 4.2),
    ('EAE1110', 1, 6.4), ('EAE1110', 2, 6.8),
    ('IIC1103', 1, 6.9), ('IIC1103', 2, 6.8), ('IIC1103', 3, 6.1)
  ) as v(codigo, orden, nota)
    on v.codigo = a.codigo and v.orden = e.orden;

-- ----------------------------------------------------------------- foro
insert into public.hilos (asignatura_id, autor_nombre, autor_rol, titulo, cuerpo, fijado, creado_en) values
  (pg_temp.asig('MAT1610'), 'Ana Ríos', 'Profesora', 'Sala del control del miércoles',
   'El control 3 se rinde en la sala A-301, no en la A-201 de siempre. Llevar calculadora y cédula. Entramos 8:25 en punto.',
   true, now() - interval '1 day'),
  (pg_temp.asig('MAT1610'), 'Matías Cortés', 'Estudiante', 'Duda del ejercicio 7 de la guía 4',
   'Me piden maximizar el área de un rectángulo inscrito en una parábola. Ya tengo la función objetivo pero me pierdo con el dominio. ¿Alguien lo intentó?',
   false, now() - interval '5 hours'),
  (pg_temp.asig('MAT1610'), 'Tomás González', 'Estudiante', 'Grupo de estudio para el examen',
   'Estamos juntándonos los jueves después de la ayudantía en la biblioteca. Quien quiera caer, bienvenido.',
   false, now() - interval '2 days'),
  (pg_temp.asig('MAT1203'), 'Diego Fuentes', 'Profesor', 'Criterio de corrección de la guía 2',
   'Recuerden que se corrige el procedimiento, no solo la conclusión. Una respuesta correcta sin justificación vale la mitad.',
   true, now() - interval '2 days'),
  (pg_temp.asig('MAT1203'), 'Laura Bravo', 'Estudiante', '¿Cómo saben si un conjunto genera el espacio?',
   'Entiendo la definición pero no me sale aplicarla. ¿Hay alguna forma rápida de verlo con la matriz?',
   false, now() - interval '6 hours'),
  (pg_temp.asig('FIS1503'), 'Carla Núñez', 'Profesora', 'Informe de laboratorio: formato IMRyD',
   'El informe va en formato IMRyD, máximo 6 páginas. La discusión pesa más que los resultados: quiero ver qué explican, no solo qué midieron.',
   true, now() - interval '3 days'),
  (pg_temp.asig('FIS1503'), 'Sofía Valdés', 'Estudiante', 'Se me va el signo en el plano inclinado',
   'Cuando el bloque baja me queda la aceleración negativa y no sé si está mal o es el sistema de referencia.',
   false, now() - interval '3 hours'),
  (pg_temp.asig('ICS2123'), 'Rodrigo Salas', 'Profesor', 'Software para resolver el caso 1',
   'Pueden usar Solver de Excel, Python con PuLP o lo que manejen. Lo que se evalúa es el modelo, no la herramienta.',
   true, now() - interval '4 days'),
  (pg_temp.asig('ICS2123'), 'Josefa Pérez', 'Estudiante', '¿Las variables pueden ser fraccionarias?',
   'En el caso de la mezcla, ¿tiene sentido producir 3,4 unidades o hay que forzar enteros?',
   false, now() - interval '4 hours'),
  (pg_temp.asig('EAE1110'), 'Paula Vergara', 'Profesora', 'Control 2 es en sala, no en línea',
   'El control del miércoles es presencial en la E-105, a la hora de cátedra. Sin apuntes.',
   true, now() - interval '7 hours'),
  (pg_temp.asig('EAE1110'), 'Matías Cortés', 'Estudiante', 'Elasticidad e ingreso total',
   'Si la demanda es inelástica y sube el precio, ¿el ingreso total sube o baja? Me confundo siempre.',
   false, now() - interval '1 day'),
  (pg_temp.asig('IIC1103'), 'Matías Leiva', 'Profesor', 'Casos borde de la tarea 3',
   'El corrector prueba con un CSV vacío y con filas mal formadas. Si su programa se cae ahí, pierden los puntos de robustez.',
   true, now() - interval '2 days'),
  (pg_temp.asig('IIC1103'), 'Tomás González', 'Estudiante', '¿Diccionario o lista de tuplas?',
   'Para guardar las notas por sección, ¿conviene un diccionario o una lista de tuplas? Ambas me funcionan.',
   false, now() - interval '2 hours');

insert into public.respuestas (hilo_id, autor_nombre, autor_rol, cuerpo, creado_en) values
  (pg_temp.hilo('Sala del control del miércoles'), 'Josefa Pérez', 'Estudiante',
   'Gracias por avisar. ¿Entra la materia del teorema del valor medio?', now() - interval '22 hours'),
  (pg_temp.hilo('Sala del control del miércoles'), 'Ana Ríos', 'Profesora',
   'Sí, entra todo hasta la clase de hoy inclusive.', now() - interval '21 hours'),
  (pg_temp.hilo('Duda del ejercicio 7 de la guía 4'), 'Sofía Valdés', 'Estudiante',
   'A mí me sirvió pensar primero qué valores de x tienen sentido geométrico. Ahí el dominio sale solo.', now() - interval '4 hours'),
  (pg_temp.hilo('Duda del ejercicio 7 de la guía 4'), 'Eduardo Q.', 'Estudiante',
   'Yo estaba en la misma. Con esa pista me cerró, gracias.', now() - interval '3 hours'),
  (pg_temp.hilo('¿Cómo saben si un conjunto genera el espacio?'), 'Diego Fuentes', 'Profesor',
   'Piensen en el rango. Si el rango es igual a la dimensión del espacio, generan. Intenten primero con un ejemplo de dos vectores en el plano.', now() - interval '5 hours'),
  (pg_temp.hilo('Informe de laboratorio: formato IMRyD'), 'Eduardo Q.', 'Estudiante',
   '¿La incertidumbre va en la tabla o en el gráfico?', now() - interval '3 days' + interval '2 hours'),
  (pg_temp.hilo('Informe de laboratorio: formato IMRyD'), 'Carla Núñez', 'Profesora',
   'En ambos. En la tabla como ± y en el gráfico como barras de error.', now() - interval '3 days' + interval '3 hours'),
  (pg_temp.hilo('Se me va el signo en el plano inclinado'), 'Tomás González', 'Estudiante',
   'Depende de hacia dónde apuntaste el eje. Si lo pones bajando la pendiente, te queda positiva.', now() - interval '2 hours'),
  (pg_temp.hilo('Elasticidad e ingreso total'), 'Laura Bravo', 'Estudiante',
   'Piensa en cuánto cae la cantidad comparado con cuánto sube el precio. Con ese orden de magnitud sale.', now() - interval '23 hours'),
  (pg_temp.hilo('Casos borde de la tarea 3'), 'Eduardo Q.', 'Estudiante',
   '¿Una fila mal formada se salta o se avisa por pantalla?', now() - interval '2 days' + interval '30 minutes'),
  (pg_temp.hilo('Casos borde de la tarea 3'), 'Matías Leiva', 'Profesor',
   'Se salta y se informa al final cuántas se descartaron. Que el programa no muera es lo importante.', now() - interval '2 days' + interval '1 hour');

-- La respuesta de Eduardo sí lleva autor_id: es un usuario real.
update public.respuestas
   set autor_id = 'e0000000-0000-4000-8000-000000000001'
 where autor_nombre = 'Eduardo Q.';

-- ------------------------------------------------------- notificaciones
insert into public.notificaciones
  (estudiante_id, tipo, titulo, detalle, asignatura_id, ref_tipo, ref_id, leida, creado_en)
values
  ('e0000000-0000-4000-8000-000000000001', 'clase', 'Cálculo I está en vivo',
   'Teorema del valor medio · comenzó hace 12 min', pg_temp.asig('MAT1610'),
   'clase', (select id from public.clases where estado = 'en_vivo' limit 1), false, now()),

  ('e0000000-0000-4000-8000-000000000001', 'anuncio', 'Paula Vergara publicó un aviso',
   'Control 2 es en sala, no en línea', pg_temp.asig('EAE1110'),
   'hilo', pg_temp.hilo('Control 2 es en sala, no en línea'), false, now() - interval '7 hours'),

  ('e0000000-0000-4000-8000-000000000001', 'tarea', 'Guía 2 vence mañana',
   'Independencia lineal', pg_temp.asig('MAT1203'),
   'tarea', pg_temp.tarea('Guía 2 · Independencia lineal'), false, now() - interval '9 hours'),

  ('e0000000-0000-4000-8000-000000000001', 'nota', 'Tienes una nota nueva',
   'Tarea 2 · Estructuras — 6,8', pg_temp.asig('IIC1103'),
   'notas', null, true, now() - interval '2 days'),

  ('e0000000-0000-4000-8000-000000000001', 'anuncio', 'Ana Ríos publicó un aviso',
   'Sala del control del miércoles', pg_temp.asig('MAT1610'),
   'hilo', pg_temp.hilo('Sala del control del miércoles'), true, now() - interval '1 day'),

  ('e0000000-0000-4000-8000-000000000001', 'tarea', 'Guía 2 quedó atrasada',
   'Planos inclinados · venció ayer', pg_temp.asig('FIS1503'),
   'tarea', pg_temp.tarea('Guía 2 · Planos inclinados'), true, now() - interval '1 day');
