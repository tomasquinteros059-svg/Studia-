// Las fichas del modo demostración.
//
// Como los quices: acá no hay evaluador que las escriba, así que están hechas
// a mano sobre la materia que la demostración tiene cargada. La repetición sí
// es la de verdad —los mismos saltos que la base— porque es lo que hay que
// poder ver funcionando: acertar una y que se vaya, fallarla y que vuelva.

import { cuandoVuelve } from "../dominio/fichas.ts";
import type { Ficha } from "./tipos.ts";

type Mazo = { tema: RegExp; fichas: { pregunta: string; respuesta: string }[] };

const MAZOS: Mazo[] = [
  {
    tema: /límite|continuidad|derivada|integral|cálculo/i,
    fichas: [
      { pregunta: "¿Fórmula de integración por partes?", respuesta: "∫u dv = uv − ∫v du. Para elegir u, la regla LIATE: logarítmica, inversa, algebraica, trigonométrica, exponencial." },
      { pregunta: "¿Cuándo converge ∫1/xᵖ en [1,∞)?", respuesta: "Cuando p > 1. Si p ≤ 1, diverge. El caso p = 1 es el logaritmo, y diverge." },
      { pregunta: "√(a²−x²) pide la sustitución…", respuesta: "x = a·sen(θ). Como 1 − sen²θ = cos²θ, la raíz desaparece." },
      { pregunta: "√(a²+x²) pide la sustitución…", respuesta: "x = a·tan(θ). Como 1 + tan²θ = sec²θ, la raíz desaparece." },
      { pregunta: "¿Qué hipótesis pide el teorema del valor medio?", respuesta: "Continua en [a,b] y derivable en (a,b). El error típico es pedir derivabilidad también en los extremos: no hace falta." },
      { pregunta: "¿Derivable implica continua, o al revés?", respuesta: "Derivable implica continua. Al revés no: |x| es continua en 0 y no derivable ahí." },
      { pregunta: "∫eˣ·cos(x) dx — ¿qué tiene de especial?", respuesta: "Por partes dos veces reaparece la integral original, y se despeja como una ecuación." },
      { pregunta: "¿Qué es una integral impropia?", respuesta: "Una con intervalo infinito o integrando no acotado. Se evalúa como el límite de una integral normal." },
    ],
  },
  {
    tema: /física|newton|cinemática|dinámica|energía/i,
    fichas: [
      { pregunta: "Velocidad constante ⇒ ¿fuerza neta?", respuesta: "Cero. Aceleración cero obliga a fuerza neta cero, aunque el cuerpo se esté moviendo." },
      { pregunta: "Peso y normal sobre un libro en la mesa, ¿son par acción-reacción?", respuesta: "No. Un par acción-reacción actúa sobre cuerpos distintos; estas dos actúan sobre el libro." },
      { pregunta: "En el punto más alto de un lanzamiento vertical, ¿la aceleración?", respuesta: "g, hacia abajo. La velocidad es cero, pero la gravedad no se apaga." },
      { pregunta: "¿Cuándo se conserva la energía mecánica?", respuesta: "Cuando no hay roce ni otras fuerzas no conservativas. La que siempre se conserva es la energía total." },
      { pregunta: "¿Qué mide un diagrama de cuerpo libre?", respuesta: "Todas las fuerzas sobre UN cuerpo. Si aparece una fuerza que ese cuerpo ejerce sobre otro, está de más." },
    ],
  },
];

const GENERAL = [
  { pregunta: "¿Por qué repasar espaciado funciona mejor que estudiar de una?", respuesta: "Porque el esfuerzo de recuperar algo casi olvidado es lo que lo fija. Releer se siente productivo y no lo es." },
  { pregunta: "Terminaste un capítulo y lo entendiste. ¿Qué conviene hacer?", respuesta: "Cerrarlo y explicarlo de memoria en voz alta. Entender leyendo y poder explicar sin mirar son cosas distintas." },
  { pregunta: "¿Cuál es el mejor momento para descubrir que no entendiste algo?", respuesta: "Ahora. Por eso esto no vale nota y no lo ve nadie más." },
  { pregunta: "¿Para qué sirve fallar una ficha?", respuesta: "Para que vuelva antes. Una ficha que siempre aciertas deja de aparecer; la que fallas es la que se repite." },
];

let siguiente = 1;
const mazos = new Map<string, Ficha[]>();
const llave = (asignaturaId: string, tema: string) => `${asignaturaId}·${tema}`;

export function generarFichasDemo(asignaturaId: string, tema: string): Ficha[] {
  const banco = MAZOS.find((m) => m.tema.test(tema))?.fichas ?? GENERAL;
  const nuevas: Ficha[] = banco.map((f) => ({
    id: `ficha-demo-${siguiente++}`,
    tema, pregunta: f.pregunta, respuesta: f.respuesta,
    aciertos: 0, fallos: 0, vuelve_en: null,
  }));
  mazos.set(llave(asignaturaId, tema), nuevas);
  return nuevas.map((f) => ({ ...f }));
}

export const fichasDemo = (asignaturaId: string, tema?: string): Ficha[] =>
  [...mazos.entries()]
    .filter(([k]) => k.startsWith(`${asignaturaId}·`) && (!tema || k === llave(asignaturaId, tema)))
    .flatMap(([, fichas]) => fichas)
    .map((f) => ({ ...f }));

export function repasarFichaDemo(fichaId: string, acerto: boolean): void {
  for (const fichas of mazos.values()) {
    const f = fichas.find((x) => x.id === fichaId);
    if (!f) continue;
    // Los mismos saltos que la base, calculados con la misma función.
    const dias = cuandoVuelve(f.aciertos, acerto);
    f.aciertos = acerto ? f.aciertos + 1 : 0;
    if (!acerto) f.fallos += 1;
    f.vuelve_en = new Date(Date.now() + dias * 86_400_000).toISOString();
    return;
  }
  throw new Error("Esa ficha no es tuya.");
}
