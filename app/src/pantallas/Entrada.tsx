import { useState } from "react";
import { MODO_DEMO } from "../lib/config.ts";
import Portada from "./Portada.tsx";
import Perfiles from "./Perfiles.tsx";
import Sesion from "./Sesion.tsx";

/**
 * Por dónde se entra a StudIA, con servidor o sin él.
 *
 * Antes eran dos ramas sueltas en App.tsx: sin servidor caías en el selector
 * de perfiles y con servidor en el formulario de la clave. Las dos entraban
 * de golpe, sin decir qué era esto. Ahora las dos pasan por la portada, y
 * recién después se separan.
 */
export default function Entrada() {
  const [dondeEstoy, setDonde] = useState<"portada" | "adentro">("portada");

  if (dondeEstoy === "portada") {
    return (
      <Portada
        entrar={() => setDonde("adentro")}
        // Sin servidor, mirar con datos de ejemplo es el único camino que hay,
        // así que el botón lleva al mismo lugar. Con servidor no se ofrece:
        // no hay nada de ejemplo que mirar.
        probar={MODO_DEMO ? () => setDonde("adentro") : undefined}
        sinServidor={MODO_DEMO}
      />
    );
  }

  return MODO_DEMO ? <Perfiles /> : <Sesion />;
}
