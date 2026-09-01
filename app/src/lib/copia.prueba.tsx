// Se llama .tsx aunque no dibuje nada: en este proyecto la extensión es la que
// decide quién corre la prueba, y esta necesita el AsyncStorage de mentira que
// trae Jest. Las de `dominio/` corren con node:test y no pueden tocar módulos
// nativos.

// El doble que trae jest-expo no implementa `getAllKeys` ni `multiRemove`, y
// `olvidarTodasLasCopias` las necesita. Se pone uno completo: además deja
// escrito qué parte del almacenamiento usa este módulo.
jest.mock("@react-native-async-storage/async-storage", () => {
  const disco = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => disco.get(k) ?? null,
      setItem: async (k: string, v: string) => { disco.set(k, v); },
      removeItem: async (k: string) => { disco.delete(k); },
      getAllKeys: async () => [...disco.keys()],
      multiRemove: async (ks: string[]) => { for (const k of ks) disco.delete(k); },
      clear: async () => { disco.clear(); },
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  anotarPlan, guardarCopia, hayQueGuardar, leerCopia, olvidarTodasLasCopias,
} from "./copia.ts";

beforeEach(async () => {
  await AsyncStorage.clear();
  anotarPlan("gratis");
});

describe("la copia para estudiar sin señal", () => {
  test("el plan gratis no deja nada guardado en el aparato", async () => {
    anotarPlan("gratis");
    expect(hayQueGuardar()).toBe(false);

    await guardarCopia("tareas", [{ id: "t1" }]);

    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await leerCopia("tareas")).toBeNull();
  });

  test("los dos planes pagados guardan y recuperan", async () => {
    for (const plan of ["personal", "institucion"] as const) {
      await AsyncStorage.clear();
      anotarPlan(plan);

      await guardarCopia("tareas", [{ id: "t1" }]);
      const copia = await leerCopia<{ id: string }[]>("tareas");

      expect(copia?.datos).toEqual([{ id: "t1" }]);
      expect(typeof copia?.guardadaEn).toBe("number");
    }
  });

  // Si se guardara «por si acaso» y solo se ocultara en la pantalla, la
  // función pagada estaría hecha y apagada con un `if`, que es lo primero que
  // alguien quita.
  test("bajar de plan deja de leer lo que había quedado guardado", async () => {
    anotarPlan("personal");
    await guardarCopia("tareas", [{ id: "t1" }]);

    anotarPlan("gratis");
    expect(await leerCopia("tareas")).toBeNull();
  });

  test("una copia a medio escribir se descarta en vez de romper la pantalla", async () => {
    anotarPlan("personal");

    await AsyncStorage.setItem("studia.copia.tareas", "{ esto no es json");
    expect(await leerCopia("tareas")).toBeNull();

    await AsyncStorage.setItem("studia.copia.tareas", JSON.stringify({ datos: [1] }));
    expect(await leerCopia("tareas")).toBeNull();
  });

  // Lo de una persona no puede quedar en el teléfono esperando a la siguiente.
  test("olvidarlas las borra todas, y no toca lo que no es suyo", async () => {
    anotarPlan("personal");
    await guardarCopia("tareas", [1]);
    await guardarCopia("inicio", [2]);
    await AsyncStorage.setItem("studia.lectura.preferencias", "{}");

    await olvidarTodasLasCopias();

    expect(await leerCopia("tareas")).toBeNull();
    expect(await leerCopia("inicio")).toBeNull();
    expect(await AsyncStorage.getItem("studia.lectura.preferencias")).toBe("{}");
  });
});
