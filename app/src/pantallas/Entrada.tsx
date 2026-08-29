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
        // Ya no se ofrece mirar sin identificarse. Con servidor nunca se
        // ofreció; sin servidor era una puerta que la aplicación de verdad no
        // tiene, y quien la usaba se llevaba una idea equivocada de cómo se
        // entra. Ahora las dos ramas piden el correo, y en la demostración
        // los perfiles de ejemplo aparecen después de darlo.
        sinServidor={MODO_DEMO}
      />
    );
  }

  return MODO_DEMO ? <Perfiles /> : <Sesion />;
}
