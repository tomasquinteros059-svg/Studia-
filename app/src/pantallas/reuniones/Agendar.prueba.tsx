import { fireEvent, render } from "@testing-library/react-native";
import { tocar } from "../../../pruebas/dobles.tsx";
import { SIN_AGENDA, type Agenda } from "../../dominio/agenda.ts";
import Agendar, { leerHora } from "./Agendar.tsx";

const montar = async (agenda: Agenda = SIN_AGENDA) => {
  const cambiar = jest.fn();
  const vista = await render(<Agendar agenda={agenda} cambiar={cambiar} />);
  return Object.assign(vista, { cambiar });
};

const ultima = (cambiar: jest.Mock): Agenda =>
  cambiar.mock.calls[cambiar.mock.calls.length - 1]![0] as Agenda;

describe("agendar una reunión", () => {
  test("no se agenda nada hasta que se pide", async () => {
    const t = await montar();
    expect(t.getByLabelText("Agendarla para otro día")).toBeTruthy();
    expect(t.queryByText("Se repite")).toBeNull();
  });

  test("al abrirla propone mañana a las 9, para no partir de la nada", async () => {
    const t = await montar();
    await tocar(() => fireEvent.press(t.getByLabelText("Agendarla para otro día")));

    const a = ultima(t.cambiar);
    expect(a.programada_para).not.toBeNull();
    const cuando = new Date(a.programada_para!);
    expect(cuando.getHours()).toBe(9);
    expect(cuando.getTime()).toBeGreaterThan(Date.now());
  });

  test("dice claramente que no puede prender el micrófono sola", async () => {
    const t = await montar({ programada_para: new Date().toISOString(), repite: "nunca" });
    expect(t.getByText(/no puede prender el micrófono sola/)).toBeTruthy();
    expect(t.getByText(/grabas con un toque/)).toBeTruthy();
  });

  test("se elige cada cuánto se repite", async () => {
    const t = await montar({ programada_para: new Date().toISOString(), repite: "nunca" });
    await tocar(() => fireEvent.press(t.getByLabelText("de lunes a viernes")));
    expect(ultima(t.cambiar).repite).toBe("dias_de_semana");
  });

  test("quitar la agenda la deja sin fecha y sin repetición", async () => {
    const t = await montar({ programada_para: new Date().toISOString(), repite: "cada_semana" });
    await tocar(() => fireEvent.press(t.getByLabelText("Quitar la agenda")));
    expect(ultima(t.cambiar)).toEqual({ programada_para: null, repite: "nunca" });
  });

  test("un atajo de hora cambia la hora y conserva la repetición", async () => {
    const t = await montar({ programada_para: new Date().toISOString(), repite: "cada_semana" });
    await tocar(() => fireEvent.press(t.getByLabelText("Mañana 14:00")));

    const a = ultima(t.cambiar);
    expect(new Date(a.programada_para!).getHours()).toBe(14);
    expect(a.repite).toBe("cada_semana");
  });

  test("escribir la hora a mano también sirve", async () => {
    const hoy = new Date();
    hoy.setHours(9, 0, 0, 0);
    const t = await montar({ programada_para: hoy.toISOString(), repite: "nunca" });
    await tocar(() => fireEvent.changeText(t.getByLabelText("Hora"), "08:30"));

    const cuando = new Date(ultima(t.cambiar).programada_para!);
    expect(cuando.getHours()).toBe(8);
    expect(cuando.getMinutes()).toBe(30);
  });

  test("una hora a medio escribir no mueve nada", async () => {
    const t = await montar({ programada_para: new Date().toISOString(), repite: "nunca" });
    await tocar(() => fireEvent.changeText(t.getByLabelText("Hora"), "8"));
    expect(t.cambiar).not.toHaveBeenCalled();
  });
});

describe("leer la hora que alguien escribió", () => {
  test("las formas normales de escribirla", () => {
    expect(leerHora("8:30")).toEqual({ horas: 8, minutos: 30 });
    expect(leerHora("08:30")).toEqual({ horas: 8, minutos: 30 });
    expect(leerHora("08.30")).toEqual({ horas: 8, minutos: 30 });
    expect(leerHora("0830")).toEqual({ horas: 8, minutos: 30 });
    expect(leerHora(" 14:00 ")).toEqual({ horas: 14, minutos: 0 });
  });

  test("una hora que no existe se rechaza en vez de corregirse sola", () => {
    expect(leerHora("25:00")).toBeNull();
    expect(leerHora("08:70")).toBeNull();
  });

  test("lo que no es una hora se rechaza", () => {
    expect(leerHora("mañana")).toBeNull();
    expect(leerHora("8")).toBeNull();
    expect(leerHora("")).toBeNull();
  });
});
