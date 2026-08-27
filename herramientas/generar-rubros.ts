// Copia las instrucciones de los rubros a donde las necesitan las funciones.
//
// La fuente única es `app/src/dominio/rubros.ts`: ahí se lee, ahí se edita.
// Pero las funciones de Supabase corren en Deno y no pueden importar desde
// dentro de la app, así que necesitan su propia copia.
//
// Copiar a mano cinco rubros por tres instrucciones es exactamente la clase
// de cosa que se desincroniza en silencio: alguien afina el prompt del
// analista de obras, el servidor sigue con el viejo y nadie se entera. Por
// eso se genera, y por eso hay una prueba que falla si la copia quedó atrás.

import { EQUIPOS } from "../app/src/dominio/rubros.ts";

export const DESTINO = "supabase/functions/_compartido/rubros-generado.ts";

export function generar(): string {
  const filas = EQUIPOS.map((e) => {
    const de = (papel: string) => {
      const a = e.agentes.find((x) => x.papel === papel);
      if (!a) throw new Error(`${e.id} no tiene ${papel}`);
      return a.instruccion;
    };
    return [
      `  ${e.id}: {`,
      `    nombre: ${JSON.stringify(e.nombre)},`,
      `    documento: ${JSON.stringify(e.documento)},`,
      `    escucha: ${JSON.stringify(de("escucha"))},`,
      `    redacta: ${JSON.stringify(de("redacta"))},`,
      `    entiende: ${JSON.stringify(de("entiende"))},`,
      `  },`,
    ].join("\n");
  });

  return `// GENERADO. No lo edites a mano.
//
// Sale de app/src/dominio/rubros.ts, que es donde se editan las
// instrucciones de verdad. Para regenerarlo: npm run generar
//
// Existe porque las funciones corren en Deno y no pueden importar desde
// dentro de la app. La prueba de dominio falla si esta copia quedó atrás.

export type Rubro = ${EQUIPOS.map((e) => JSON.stringify(e.id)).join(" | ")};

export type Instrucciones = {
  nombre: string;
  documento: string;
  escucha: string;
  redacta: string;
  entiende: string;
};

export const EQUIPOS: Record<Rubro, Instrucciones> = {
${filas.join("\n")}
};
`;
}

// Cuando se corre directo, escribe el archivo.
if (import.meta.filename === process.argv[1]) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(DESTINO, generar(), "utf-8");
  console.log(`escrito ${DESTINO}`);
}
