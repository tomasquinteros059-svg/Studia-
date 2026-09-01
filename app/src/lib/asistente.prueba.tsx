// El cliente del asistente docente: qué manda, adónde, y qué hace cuando el
// servidor contesta mal. La pantalla se prueba aparte.

const modo = { demo: false };
jest.mock("./config.ts", () => ({
  get MODO_DEMO() { return modo.demo; },
  hayBackend: true,
  URL_SUPABASE: "https://pruebas.supabase.co", CLAVE_ANON: "clave", AVISO_DEMO: "",
}));

const sesion = { token: "token-de-ana" as string | undefined };
jest.mock("./supabase.ts", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: sesion.token ? { access_token: sesion.token } : null },
      }),
    },
  },
  urlFuncion: (nombre: string) => `https://pruebas.supabase.co/functions/v1/${nombre}`,
}));

import { preguntarAlAsistente, TURNOS_QUE_VIAJAN, type Turno } from "./asistente.ts";

const contesta = (cuerpo: unknown, estado = 200) =>
  jest.fn().mockResolvedValue({
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => cuerpo,
  });

beforeEach(() => {
  modo.demo = false;
  sesion.token = "token-de-ana";
});

/** Lo que se le mandó al servidor en la última llamada. */
function loEnviado() {
  const llamada = (globalThis.fetch as jest.Mock).mock.calls[0];
  return { url: llamada[0] as string, opciones: llamada[1] as RequestInit };
}

test("la pregunta va a la función asistente, con la sesión de quien pregunta", async () => {
  globalThis.fetch = contesta({ respuesta: "Faltan dos por entregar." });

  const r = await preguntarAlAsistente({ pregunta: "¿Quién no ha entregado?", turnos: [], cursos: [] });

  const { url, opciones } = loEnviado();
  expect(url).toBe("https://pruebas.supabase.co/functions/v1/asistente");
  expect((opciones.headers as Record<string, string>).Authorization).toBe("Bearer token-de-ana");
  expect(JSON.parse(opciones.body as string)).toEqual({
    pregunta: "¿Quién no ha entregado?", turnos: [],
  });
  expect(r.texto).toBe("Faltan dos por entregar.");
});

test("la conversación anterior viaja como contexto", async () => {
  globalThis.fetch = contesta({ respuesta: "Josefa." });

  const turnos: Turno[] = [
    { role: "user", content: "¿Quién no ha entregado?" },
    { role: "assistant", content: "Josefa Pérez." },
  ];
  await preguntarAlAsistente({ pregunta: "¿Y en el otro ramo?", turnos, cursos: [] });

  expect(JSON.parse(loEnviado().opciones.body as string).turnos).toEqual(turnos);
});

test("de una conversación larga viajan los últimos turnos y no todos", async () => {
  globalThis.fetch = contesta({ respuesta: "ya" });

  const muchos: Turno[] = Array.from({ length: 60 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant", content: `turno ${i}`,
  }));
  await preguntarAlAsistente({ pregunta: "otra", turnos: muchos, cursos: [] });

  const enviados = JSON.parse(loEnviado().opciones.body as string).turnos as Turno[];
  expect(enviados).toHaveLength(TURNOS_QUE_VIAJAN);
  // Los últimos, que son los que dan contexto a la pregunta nueva.
  expect(enviados.at(-1)?.content).toBe("turno 59");
});

test("el motivo que da el servidor es el que se muestra", async () => {
  globalThis.fetch = contesta({ error: "Este asistente es para docentes y administración." }, 403);

  await expect(
    preguntarAlAsistente({ pregunta: "hola", turnos: [], cursos: [] }),
  ).rejects.toThrow("Este asistente es para docentes y administración.");
});

test("si el servidor contesta cualquier cosa, igual se dice algo entendible", async () => {
  globalThis.fetch = contesta({}, 500);

  await expect(
    preguntarAlAsistente({ pregunta: "hola", turnos: [], cursos: [] }),
  ).rejects.toThrow("El asistente no está disponible en este momento.");
});

test("sin sesión no se llama al servidor: se dice que hay que volver a entrar", async () => {
  globalThis.fetch = contesta({ respuesta: "no debería llegar acá" });
  sesion.token = undefined;

  await expect(
    preguntarAlAsistente({ pregunta: "hola", turnos: [], cursos: [] }),
  ).rejects.toThrow("Tu sesión venció. Vuelve a entrar.");
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("en demostración contesta el aparato y no sale ninguna llamada", async () => {
  globalThis.fetch = contesta({ respuesta: "no debería llegar acá" });
  modo.demo = true;

  const r = await preguntarAlAsistente({ pregunta: "¿Quién no ha entregado?", turnos: [], cursos: [] });

  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(r.texto).toBe("Todavía no tienes ramos asignados.");
});
