import { renderPantalla } from "../../pruebas/dobles.tsx";

import Legal from "./Legal.tsx";
import { PRIVACIDAD, TERMINOS } from "../dominio/legales.ts";
import { TERCEROS } from "../dominio/terceros.ts";

const pantalla = (que?: "terminos" | "privacidad" | "terceros") =>
  renderPantalla(Legal as never, que ? { que } : undefined);

describe("los textos legales", () => {
  test("los términos se leen enteros, sin quedarse en un enlace a la web", async () => {
    const t = await pantalla("terminos");

    expect(t.getByText(TERMINOS.bajada)).toBeTruthy();
    // Todas las secciones, no las primeras: un documento cortado a la mitad
    // deja fuera justo las cláusulas que a nadie le gusta leer.
    for (const s of TERMINOS.secciones) expect(t.getByText(s.titulo)).toBeTruthy();
  });

  test("la privacidad también, y dice lo que el código cumple", async () => {
    const t = await pantalla("privacidad");

    for (const s of PRIVACIDAD.secciones) expect(t.getByText(s.titulo)).toBeTruthy();
    // La frase va partida en negrita y texto normal, así que se busca el trozo.
    expect(t.getByText("El audio de las clases no se guarda.")).toBeTruthy();
  });

  test("los asteriscos de la negrita no llegan a la pantalla", async () => {
    const t = await pantalla("privacidad");
    expect(t.queryByText(/\*\*/)).toBeNull();
  });

  test("las licencias de terceros vienen en la app, que es lo que exigen", async () => {
    const t = await pantalla("terceros");

    expect(t.getByText(`${TERCEROS.length} bibliotecas`)).toBeTruthy();
    for (const nombre of ["react-native", "expo", "@supabase/supabase-js"]) {
      expect(t.getByText(nombre)).toBeTruthy();
    }
    // El aviso de copyright es lo que MIT obliga a conservar; sin él, listar
    // el nombre del paquete no cumple nada. Son tres de Meta —react, react-dom
    // y react-native— y cada uno lleva el suyo.
    expect(t.getAllByText(/Copyright \(c\) Meta Platforms/)).toHaveLength(3);
  });

  test("una ruta sin parámetros muestra los términos y no una pantalla en blanco", async () => {
    const t = await pantalla();
    expect(t.getByText(TERMINOS.bajada)).toBeTruthy();
  });
});
