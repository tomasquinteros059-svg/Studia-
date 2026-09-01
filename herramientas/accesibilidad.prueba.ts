// Que nada que se pueda tocar quede invisible para quien usa lector de pantalla.
//
// Un `Pressable` sin `accessibilityRole` se anuncia como texto suelto: TalkBack
// y VoiceOver no lo ofrecen como algo que se pueda activar, así que quien
// navega por voz simplemente no puede apretarlo. No se ve en ninguna captura y
// no lo atrapa ninguna prueba de pantalla, porque la pantalla funciona.
//
// Se revisa el código fuente y no una pantalla renderizada a propósito: así
// cubre las treinta pantallas de una vez, incluidas las que nadie recordó
// probar.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function tsx(carpeta: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) salida.push(...tsx(ruta));
    else if (entrada.name.endsWith(".tsx") && !entrada.name.includes(".prueba.")) salida.push(ruta);
  }
  return salida;
}

/**
 * Los atributos de una etiqueta, desde `<Pressable` hasta su `>` de cierre.
 *
 * Contar llaves no es capricho: los atributos traen `onPress={() => algo}`, y
 * ese `=>` tiene un `>` adentro. Cortar en el primer `>` da por terminada la
 * etiqueta antes de tiempo y produce avisos donde no hay nada malo, que es la
 * manera más rápida de que una prueba deje de tomarse en serio.
 */
function atributosDe(texto: string, desde: number): string {
  let llaves = 0;
  for (let i = desde; i < texto.length; i++) {
    const c = texto[i];
    if (c === "{") llaves++;
    else if (c === "}") llaves--;
    else if (c === ">" && llaves === 0) return texto.slice(desde, i);
  }
  return texto.slice(desde);
}

test("todo lo que se puede tocar se anuncia como tal", () => {
  const sinRol: string[] = [];

  for (const ruta of tsx("app/src")) {
    const fuente = readFileSync(ruta, "utf8");
    for (let i = fuente.indexOf("<Pressable"); i >= 0; i = fuente.indexOf("<Pressable", i + 1)) {
      const attrs = atributosDe(fuente, i + "<Pressable".length);
      // Sin `onPress` no es un control: es una caja que usa Pressable por su
      // estilo al apretar y no lleva a ninguna parte.
      if (!attrs.includes("onPress")) continue;
      if (attrs.includes("accessibilityRole")) continue;
      sinRol.push(`${ruta}:${fuente.slice(0, i).split("\n").length}`);
    }
  }

  assert.deepEqual(sinRol, [], `Sin accessibilityRole:\n  ${sinRol.join("\n  ")}`);
});
