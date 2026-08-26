// Los textos que el lector lee en modo demostración.
//
// Son los mismos que están en supabase/seed.sql. Viven en su propio archivo
// porque son largos: mezclados con las listas de datos-demo.ts taparían todo
// lo demás.

export const TEXTOS_DEMO: Record<string, string> = {
  // Apunte: límites laterales
  mm2: `Un límite lateral describe hacia dónde se acerca una función cuando nos aproximamos a un punto por un solo lado. Se escribe con un signo más o menos arriba del punto: por la derecha (tomando valores mayores que a) y por la izquierda (tomando valores menores que a).

La regla que ordena todo el capítulo es esta: el límite existe si y solo si los dos límites laterales existen y son iguales. Si uno de los dos no existe, o si existen pero dan distinto, el límite no existe. No hay término medio y no hay que discutirlo caso a caso.

Conviene tener presente por qué esto importa. Una función puede estar perfectamente definida en un punto y aun así no tener límite ahí. El ejemplo clásico es la función escalón: vale 0 a la izquierda del cero y vale 1 a la derecha. En cero la función tiene un valor, pero los laterales dan 0 y 1, así que el límite no existe.

El valor absoluto de x dividido por x, o sea f(x) igual a |x|/x, es el otro ejemplo que aparece siempre en la prueba. Para x positivo la expresión vale 1; para x negativo vale menos 1. Los laterales existen los dos, son finitos los dos, y son distintos. Por lo tanto el límite en cero no existe, aunque a simple vista la fórmula parezca inofensiva.

Con funciones definidas por tramos el procedimiento es mecánico. Se identifica el punto donde cambia la definición, se calcula el límite usando la fórmula del tramo izquierdo, se calcula usando la del tramo derecho, y recién ahí se comparan. El error más frecuente no es de cálculo: es evaluar la fórmula equivocada en cada lado.

Un último detalle que cuesta en el control. Cuando el enunciado pide que la función sea continua en el punto a, no basta con que los laterales coincidan: además tienen que coincidir con f(a), el valor de la función ahí. Son tres cosas que verificar, no dos.`,

  // Formulario de derivadas
  mm5: `La derivada mide la razón a la que cambia una función. Geométricamente es la pendiente de la recta tangente en un punto; físicamente, la velocidad instantánea si la función describe una posición. Las dos lecturas son la misma cuenta.

Reglas básicas. La derivada de una constante es cero. La derivada de x elevado a n es n por x elevado a n menos 1. La derivada de una suma es la suma de las derivadas. Una constante que multiplica sale intacta de la derivada.

Producto. La derivada de f(x) por g(x) es la derivada de f por g, más f por la derivada de g. El orden de los dos términos no importa; lo que importa es que son dos términos y no uno. Derivar cada factor por separado y multiplicar los resultados es el error más común del curso.

Cociente. La derivada de f dividido g es la derivada de f por g, menos f por la derivada de g, todo dividido por g al cuadrado. Acá el orden sí importa por el signo menos, y el denominador va al cuadrado, no elevado a uno.

Regla de la cadena. Si una función está compuesta con otra, se deriva la de afuera dejando el interior sin tocar, y después se multiplica por la derivada del interior. En la práctica conviene decir en voz alta cuál es la de afuera y cuál la de adentro antes de escribir nada.

Las que hay que saber de memoria. La derivada del seno es el coseno. La del coseno es menos seno. La de la exponencial es ella misma. La del logaritmo natural es uno partido por x. La de la tangente es secante al cuadrado.`,

  // Casos de estudio
  mm8: `Optimizar es encontrar el mayor o el menor valor que puede tomar una cantidad cuando otra puede moverse. El curso lo trata con derivadas, pero la mitad del trabajo ocurre antes de derivar: hay que escribir la función correcta.

El procedimiento tiene cinco pasos y ninguno se puede saltar. Primero, nombrar las variables y hacer un dibujo. Segundo, escribir qué se quiere maximizar o minimizar. Tercero, usar la condición del problema para dejar todo en función de una sola variable. Cuarto, encontrar el dominio real de esa variable. Quinto, derivar, igualar a cero y comparar los candidatos.

El cuarto paso es el que más puntos cuesta. Un lado de un rectángulo no puede ser negativo, y una cantidad producida no puede superar la capacidad de la planta. Si el punto crítico cae fuera de ese intervalo, se descarta, y el máximo está en un extremo del dominio.

Caso típico de cercos. Con una cantidad fija de material, el rectángulo de mayor área es el cuadrado. Si uno de los lados no lleva cerco porque da a un muro, la respuesta cambia y el rectángulo óptimo tiene el largo igual al doble del ancho. Vale la pena rehacer este caso completo antes de la prueba en vez de memorizar la respuesta.

Caso típico de costos. Cuando el costo tiene una parte fija y una que crece con la cantidad, el mínimo aparece donde el costo marginal iguala al costo medio. Es el mismo resultado que después reaparece en Microeconomía, con otro nombre.`,

  // Apunte: matriz escalonada
  mm10: `Una matriz está en forma escalonada cuando cada fila empieza más a la derecha que la anterior y las filas de puros ceros quedan abajo. El primer elemento no nulo de una fila se llama pivote, y todo lo que hay debajo de un pivote es cero.

Se llega ahí con operaciones elementales de fila, que son tres: intercambiar dos filas, multiplicar una fila por un número distinto de cero, y sumar a una fila un múltiplo de otra. Ninguna de las tres cambia el conjunto de soluciones del sistema, y esa es la razón por la que el método funciona.

La forma escalonada reducida agrega dos exigencias: cada pivote vale uno, y arriba de cada pivote también hay ceros. Cuesta un poco más de trabajo, pero deja la solución escrita sin necesidad de sustituir hacia atrás.

Cómo leer el resultado. Si aparece una fila con todos ceros a la izquierda y un número distinto de cero a la derecha, el sistema no tiene solución: esa fila dice que cero es igual a algo que no es cero. Si no aparece esa fila y cada incógnita tiene su pivote, la solución es única. Si no aparece esa fila y sobran incógnitas sin pivote, hay infinitas soluciones.

Las incógnitas sin pivote se llaman variables libres, y su cantidad es el número de incógnitas menos el rango de la matriz. Cada variable libre es un parámetro en la respuesta final. Escribir la solución general sin nombrar los parámetros es un error de forma que igual descuenta.

Un consejo práctico para el control. Conviene trabajar con la matriz ampliada (la del sistema con la columna de términos libres pegada al lado) desde el principio y anotar al costado qué operación se hizo en cada paso. Si el resultado no cuadra, revisar la anotación toma un minuto; rehacer todo, quince.`,

  // Apunte: roce estático y cinético
  mm12: `El roce es la fuerza que aparece entre dos superficies en contacto y se opone al movimiento relativo entre ellas. Siempre actúa a lo largo de la superficie, nunca perpendicular a ella, y su dirección se determina preguntándose hacia dónde se movería el cuerpo si el roce no existiera.

Hay dos regímenes distintos y confundirlos es el error central del capítulo. El roce estático actúa mientras el cuerpo no se mueve, y no tiene un valor fijo: vale exactamente lo necesario para impedir el movimiento, hasta un máximo. El roce cinético actúa cuando el cuerpo ya está deslizando, y ahí sí tiene un valor definido.

El máximo del roce estático es el coeficiente estático por la fuerza normal. Mientras la fuerza aplicada sea menor que ese máximo, el cuerpo no se mueve y el roce iguala a la fuerza aplicada. Cuando la fuerza aplicada supera ese máximo, el cuerpo se suelta y el roce pasa a ser el cinético, que es el coeficiente cinético por la normal.

El coeficiente cinético es menor que el estático en casi todos los materiales. Por eso cuesta más empezar a empujar un mueble que seguir empujándolo, y por eso el cuerpo acelera de golpe justo después de soltarse.

Sobre la normal hay que tener cuidado. En un plano horizontal sin fuerzas verticales extras, la normal es el peso. En un plano inclinado, la normal es el peso por el coseno del ángulo, no el peso. Y si alguien empuja hacia abajo o tira hacia arriba, la normal cambia y el roce cambia con ella.

En un plano inclinado el cuerpo empieza a deslizar cuando la tangente del ángulo iguala al coeficiente estático. Es un resultado útil porque la masa se cancela: el ángulo al que un objeto se suelta no depende de cuánto pesa, cosa que en el laboratorio sorprende a todo el mundo.

Al hacer el diagrama de cuerpo libre conviene poner los ejes paralelo y perpendicular al plano, no horizontal y vertical. Descomponer el peso una vez es mucho más corto que descomponer la normal y el roce por separado.`,

  // Apunte: complejidad básica
  mm16: `La complejidad de un algoritmo describe cómo crece el trabajo que hace cuando crece el tamaño de la entrada. No mide segundos: mide operaciones en función de n, y por eso la conclusión no cambia si el computador es más rápido.

La notación O grande da una cota superior y se queda con el término que domina, ignorando constantes. Un algoritmo que hace tres n más veinte operaciones es O de n, porque para n grande el tres y el veinte no cambian la forma de la curva.

Los órdenes que aparecen en el curso, de menor a mayor: constante, logarítmico, lineal, n logaritmo de n, cuadrático y exponencial. La diferencia entre ellos no es de matiz. Con un millón de elementos, un algoritmo lineal termina y uno cuadrático no alcanza a terminar en la clase.

Cómo contar sin equivocarse. Un ciclo que recorre la entrada una vez es lineal. Dos ciclos anidados que recorren la entrada completa cada uno son cuadráticos. Un ciclo que en cada paso parte el problema por la mitad es logarítmico. Dos ciclos seguidos, no anidados, siguen siendo lineales: se suman, no se multiplican.

Sobre las estructuras que ya usaron. Buscar en una lista es lineal, porque hay que mirar elemento por elemento. Buscar en un diccionario es constante en promedio, porque la tabla de hash va directo a la posición. Cuando un ejercicio pide bajar de cuadrático a lineal, la respuesta casi siempre es cambiar una lista por un diccionario.`,
};
