// Reuniones de ejemplo, para el modo demostración.
//
// Son cuatro y no una porque lo que hay que mostrar es justamente que el
// equipo de cada rubro mira cosas distintas: la de edificios se juega en el
// quórum, la de obra en la ruta crítica, la jurídica en los plazos. Una sola
// reunión de ejemplo no dejaría ver eso.
//
// Están escritas como quedarían de verdad: con tareas sin responsable, con
// puntos de la tabla que no se alcanzaron a tratar y con una contradicción.
// Una reunión de ejemplo perfecta no se parece a ninguna reunión.

import type * as Real from "./reuniones-supabase.ts";
import type { Rubro } from "../dominio/rubros.ts";
import { normalizarCodigo, nuevoCodigo, sePuedeEntrar } from "../dominio/sala.ts";
import type { Acuerdo, Pendiente, Tarea } from "../dominio/acta.ts";
import {
  comoSala, type Reunion, type ReunionCompleta, type ReunionNueva, type TareaConReunion,
} from "./tipos-reunion.ts";

const ahora = Date.now();
const enDias = (d: number) => new Date(ahora + d * 86_400_000).toISOString();
const dia = (d: number) => enDias(d).slice(0, 10);
const haceHoras = (h: number) => new Date(ahora - h * 3_600_000).toISOString();

type Semilla = Omit<ReunionCompleta, "mia" | "puedo_editar">;

let siguiente = 1;
const nuevoId = (p: string) => `${p}-nuevo-${siguiente++}`;

function t(
  que: string, responsable: string | null, plazo: string | null,
  prioridad: "alta" | "normal", acuerdo: number | null,
): Tarea {
  return { id: nuevoId("t"), que, responsable, plazo, prioridad, acuerdo, lista: false };
}


const SEMILLAS: Semilla[] = [
  {
    id: "r-asamblea",
    titulo: "Asamblea extraordinaria · Torre B",
    rubro: "edificios",
    estado: "listo",
    ocurrio_en: enDias(-2),
    duracion_seg: 4920,
    participantes: ["Marta Vega (administración)", "Luis Pinto (comité)", "Sonia Cerda (comité)", "18 copropietarios"],
    tabla: ["Mantención de ascensores", "Gastos comunes de marzo", "Morosidad", "Renovación del seguro"],
    // La asamblea fue hace dos días: su sala ya caducó, con tres personas
    // adentro. Es el estado en que queda una sala la mayor parte del tiempo.
    codigo: "KRD497", sala_abierta: false, sala_abierta_en: null,
    sala: [
      { id: "p-luis", nombre: "Luis Pinto", puede_editar: true },
      { id: "p-sonia", nombre: "Sonia Cerda", puede_editar: false },
      { id: "p-jorge", nombre: "Jorge Ampuero", puede_editar: false },
    ],
    documento: null,
    transcripcion: null,
    resumen:
      "Se trató la mantención de los ascensores, que llevan tres detenciones en el mes, y se revisó el detalle de gastos comunes de marzo. La asamblea aprobó contratar la mantención con cargo al fondo de reserva y encargó a la administración reunir tres cotizaciones antes de firmar. La morosidad se revisó sin llegar a acuerdo. El seguro no alcanzó a tratarse.",
    acuerdos: [
      { numero: 1, texto: "Se aprueba contratar la mantención mayor de los dos ascensores con cargo al fondo de reserva, hasta 4.200.000 pesos.", firme: true },
      { numero: 2, texto: "La administración reunirá tres cotizaciones antes de adjudicar.", firme: true },
      { numero: 3, texto: "Se evaluará subir la cuota del fondo de reserva en la asamblea ordinaria.", firme: false },
    ],
    tareas: [
      t("Pedir tres cotizaciones de mantención mayor", "Marta Vega", dia(4), "alta", 2),
      t("Enviar el acta firmada a los copropietarios", "Luis Pinto", dia(-1), "normal", null),
      t("Revisar la póliza del seguro antes de que venza", null, dia(9), "alta", null),
      t("Preparar el detalle de morosidad por unidad", "Marta Vega", null, "normal", null),
    ],
    pendientes: [
      { texto: "Adjudicar la mantención", porque: "faltan dos cotizaciones de las tres acordadas" },
      { texto: "Qué hacer con las cinco unidades con más de seis meses de mora", porque: "no hubo acuerdo; el comité quiere cobranza y la administración prefiere convenio" },
    ],
    sinTratar: ["Renovación del seguro"],
    aportes: [
      "Llevar el detalle de morosidad por unidad, con antigüedad: sin eso la discusión se repitió sin avanzar.",
      "Pedir a la corredora la propuesta de renovación antes de la próxima, para no arrastrar el punto otra vez.",
      "Confirmar en el reglamento qué quórum exige cambiar la cuota del fondo de reserva.",
    ],
    contradicciones: [
      "El monto del fondo de reserva: la administración habló de 6.100.000 y el comité de 5.400.000. Nadie mostró la cartola.",
    ],
  },
  {
    id: "r-obra",
    titulo: "Reunión de obra semanal · Edificio Los Robles",
    rubro: "obras",
    estado: "listo",
    ocurrio_en: haceHoras(3),
    duracion_seg: 3480,
    participantes: ["Rodrigo Salas (ITO)", "Carla Núñez (jefa de obra)", "Pedro Lagos (clima)", "Fernanda Díaz (eléctrica)"],
    tabla: ["Avance de la semana", "Interferencias", "RDI abiertas", "Estados de pago", "Seguridad"],
    // Esta es de hace un rato y su sala sigue abierta: es el único estado en
    // que se puede recorrer el flujo entero sin tener que armarlo a mano.
    codigo: "TWQ863", sala_abierta: true, sala_abierta_en: haceHoras(3),
    sala: [{ id: "p-pedro", nombre: "Pedro Lagos", puede_editar: false }],
    documento: null,
    transcripcion: null,
    resumen:
      "Se revisó el avance de la semana 14. La tabiquería del piso 7 va cuatro días atrasada y arrastra a clima. Se detectó una interferencia entre la bandeja eléctrica y el ducto de extracción en los pisos 5 a 8. Quedaron dos RDI sin respuesta y el estado de pago 12 sigue frenado por falta de cubicación.",
    acuerdos: [
      { numero: 1, texto: "Clima entra al piso 7 el lunes aunque la tabiquería quede al 90%, para no perder la semana.", firme: true },
      { numero: 2, texto: "Eléctrica redibuja la bandeja en los pisos 5 a 8 y la coordina con clima antes del jueves.", firme: true },
      { numero: 3, texto: "Se pedirá ampliación de plazo por las lluvias de la semana 12.", firme: false },
    ],
    tareas: [
      t("Redibujar la bandeja eléctrica pisos 5 a 8", "Fernanda Díaz", dia(3), "alta", 2),
      t("Responder la RDI 41 (sello cortafuego)", null, dia(1), "alta", null),
      t("Cerrar la cubicación del estado de pago 12", "Carla Núñez", dia(2), "alta", null),
      t("Reponer la baranda del piso 9", "Carla Núñez", dia(-2), "alta", null),
      t("Actualizar la carta Gantt con el atraso de tabiquería", null, null, "normal", null),
    ],
    pendientes: [
      { texto: "RDI 41 y RDI 43", porque: "el proyectista no ha respondido hace nueve días" },
      { texto: "Estado de pago 12", porque: "falta la cubicación de tabiquería" },
    ],
    sinTratar: ["Seguridad"],
    aportes: [
      "Llevar la carta Gantt actualizada: se discutió el atraso sin tenerla a la vista y nadie pudo decir cuánto arrastra.",
      "Traer las RDI con su fecha de emisión, para poder reclamar el plazo de respuesta por escrito.",
    ],
    contradicciones: [
      "El atraso de tabiquería: la jefa de obra dijo cuatro días y la ITO seis. Se está midiendo desde fechas distintas.",
    ],
  },
  {
    id: "r-cliente",
    titulo: "Reunión con cliente · Sucesión Alcaíno",
    rubro: "legal",
    estado: "listo",
    ocurrio_en: enDias(-5),
    duracion_seg: 2760,
    participantes: ["Ana Ríos (socia)", "Ignacio Soto (asociado)", "Cliente"],
    tabla: ["Estado de la posesión efectiva", "Inventario de bienes", "Honorarios"],
    codigo: null, sala_abierta: false, sala_abierta_en: null, sala: [],
    documento: null,
    transcripcion: null,
    resumen:
      "Se revisó el estado de la posesión efectiva, que está en trámite desde enero. El cliente aportará los certificados que faltan. Se conversaron los honorarios sin dejarlos cerrados.",
    acuerdos: [
      { numero: 1, texto: "El cliente entrega los certificados de dominio vigente de las dos propiedades.", firme: true },
      { numero: 2, texto: "El estudio presenta el inventario dentro de los diez días siguientes a recibirlos.", firme: true },
    ],
    tareas: [
      t("Pedir al cliente los certificados de dominio vigente", "Ignacio Soto", dia(-3), "alta", 1),
      t("Preparar el borrador de inventario", "Ignacio Soto", null, "normal", 2),
      t("Enviar la propuesta de honorarios por escrito", "Ana Ríos", dia(2), "alta", null),
    ],
    pendientes: [
      { texto: "Honorarios", porque: "el cliente pidió verlo con su hermana antes de cerrar" },
    ],
    sinTratar: [],
    aportes: [
      "Confirmar la fecha exacta de la inscripción: de ahí corre el plazo y en la reunión se dio por sabida.",
      "Llevar la propuesta de honorarios impresa: el cliente pidió verla y quedó en el aire.",
    ],
    contradicciones: [],
  },
  {
    id: "r-comite",
    titulo: "Comité de gerencia · Cierre de mes",
    rubro: "gerencia",
    estado: "listo",
    ocurrio_en: enDias(-8),
    duracion_seg: 3900,
    participantes: ["Paula Vergara", "Diego Fuentes", "Matías Leiva"],
    tabla: ["Cierre de marzo", "Dotación", "Proveedor de logística", "Presupuesto de abril"],
    codigo: null, sala_abierta: false, sala_abierta_en: null, sala: [],
    documento: null,
    transcripcion: null,
    resumen:
      "Se revisó el cierre de marzo, con el margen dos puntos bajo lo presupuestado. Se decidió postergar dos contrataciones y pedir una propuesta nueva al proveedor de logística. El presupuesto de abril quedó para la próxima.",
    acuerdos: [
      { numero: 1, texto: "Se postergan las dos contrataciones de operaciones hasta el cierre de abril.", firme: true },
      { numero: 2, texto: "Se pide propuesta nueva al proveedor de logística, con volumen anual.", firme: true },
    ],
    tareas: [
      t("Pedir propuesta anual al proveedor de logística", "Diego Fuentes", dia(1), "alta", 2),
      t("Rehacer la proyección de abril con el margen real", "Paula Vergara", dia(3), "alta", null),
      t("Avisar a operaciones de la postergación", null, null, "alta", 1),
    ],
    pendientes: [
      { texto: "Presupuesto de abril", porque: "depende de la proyección con el margen real" },
    ],
    sinTratar: ["Presupuesto de abril"],
    aportes: [
      "Llevar el margen por línea de producto: se habló del margen total y no se pudo ver de dónde viene la caída.",
      "Tener a mano el contrato vigente de logística antes de pedir una propuesta nueva.",
    ],
    contradicciones: [],
  },
];

const copiar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const dormir = () => new Promise((r) => setTimeout(r, 90));

// Copia y no referencia: marcar una tarea escribe en la reunión, y con las
// mismas referencias escribiría también en la semilla, que es de donde se
// vuelve a partir.
const REUNIONES: Semilla[] = copiar(SEMILLAS);

/** Quién soy en la demostración, para saber qué tareas son mías. */
const YO = "Marta Vega";

export async function quienSoy(): Promise<string> {
  return YO;
}

export async function miPerfil(): Promise<{ nombre: string; correo: string }> {
  await dormir();
  return { nombre: YO, correo: "marta@administracion.cl" };
}

export async function cambiarNombre(): Promise<void> {
  // En demostración el perfil no se guarda en ninguna parte.
}

const conPermisos = (r: Semilla): ReunionCompleta =>
  ({ ...copiar(r), mia: true, puedo_editar: true });

const sinDetalle = (r: ReunionCompleta): Reunion => {
  const {
    documento: _d, transcripcion: _t, resumen: _r, acuerdos: _a, tareas: _ta,
    pendientes: _p, sinTratar: _s, aportes: _ap, contradicciones: _c,
    sala: _sa, ...cabecera
  } = r;
  return cabecera;
};

export async function misReuniones(): Promise<Reunion[]> {
  await dormir();
  return REUNIONES
    .map(conPermisos)
    .map(sinDetalle)
    .sort((a, b) => b.ocurrio_en.localeCompare(a.ocurrio_en));
}

export async function reunionPorId(id: string): Promise<ReunionCompleta | null> {
  await dormir();
  const r = REUNIONES.find((x) => x.id === id);
  return r ? conPermisos(r) : null;
}

export async function crearReunion(nueva: ReunionNueva): Promise<Reunion> {
  await dormir();
  const semilla: Semilla = {
    id: nuevoId("r"),
    titulo: nueva.titulo.trim(),
    rubro: nueva.rubro,
    estado: "borrador",
    ocurrio_en: new Date().toISOString(),
    duracion_seg: null,
    participantes: nueva.participantes,
    tabla: nueva.tabla,
    codigo: null, sala_abierta: false, sala_abierta_en: null, sala: [],
    documento: null, transcripcion: null, resumen: "",
    acuerdos: [], tareas: [], pendientes: [],
    sinTratar: [], aportes: [], contradicciones: [],
  };
  REUNIONES.unshift(semilla);
  return sinDetalle(conPermisos(semilla));
}

export async function borrarReunion(id: string): Promise<void> {
  const i = REUNIONES.findIndex((r) => r.id === id);
  if (i >= 0) REUNIONES.splice(i, 1);
}

export async function marcarTarea(tareaId: string, lista: boolean): Promise<void> {
  for (const r of REUNIONES) {
    const t = r.tareas.find((x) => x.id === tareaId);
    if (t) { t.lista = lista; return; }
  }
}

export async function agregarTarea(reunionId: string, que: string): Promise<void> {
  const r = REUNIONES.find((x) => x.id === reunionId);
  if (!r) throw new Error("Esa reunión ya no existe.");
  r.tareas.push(t(que.trim(), null, null, "normal", null));
}

export async function misTareasDeTodas(): Promise<TareaConReunion[]> {
  await dormir();
  return REUNIONES.flatMap((r) =>
    copiar(r.tareas).map((t) => ({ ...t, reunion_id: r.id, reunion: r.titulo, rubro: r.rubro })));
}

/**
 * En la demostración no hay a quién pedirle el análisis, así que se arma uno
 * a partir de lo que la persona escribió. No pretende ser lo que haría el
 * equipo de verdad: pretende que se pueda recorrer la pantalla sin servidor.
 */
export async function analizarReunion(reunionId: string, transcripcion: string): Promise<void> {
  await dormir();
  const r = REUNIONES.find((x) => x.id === reunionId);
  if (!r) throw new Error("Esa reunión ya no existe.");

  const frases = transcripcion
    .split(/(?<=[.?!])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 12);

  r.transcripcion = transcripcion;
  r.estado = "listo";
  r.resumen = frases.slice(0, 3).join(" ") ||
    "No alcancé a sacar un resumen: la transcripción es muy corta.";
  r.acuerdos = frases
    .filter((f) => /\b(acord|aprob|se decid|queda|se hará)/i.test(f))
    .slice(0, 5)
    .map((texto, i): Acuerdo => ({ numero: i + 1, texto, firme: !/evalu|ver[áa]|propone/i.test(texto) }));
  r.tareas = frases
    .filter((f) => /\b(pedir|enviar|revisar|preparar|confirmar|coordinar|cotiza)/i.test(f))
    .slice(0, 6)
    .map((f) => t(f, null, null, "normal", null));
  r.pendientes = frases
    .filter((f) => /\b(falta|pendiente|no lleg|sin respuesta)/i.test(f))
    .slice(0, 4)
    .map((texto): Pendiente => ({ texto, porque: null }));
  r.sinTratar = r.tabla.filter(
    (punto) => !transcripcion.toLowerCase().includes(punto.toLowerCase().slice(0, 8)));
  r.aportes = r.sinTratar.length > 0
    ? [`Dejar para el principio lo que quedó fuera: ${r.sinTratar.join(", ")}.`]
    : [];
  r.contradicciones = [];
}

/* --------------------------------------------------------------- la sala */

export async function abrirSala(reunionId: string): Promise<string> {
  await dormir();
  const r = REUNIONES.find((x) => x.id === reunionId);
  if (!r) throw new Error("Esa reunión ya no existe.");
  r.codigo = nuevoCodigo();
  r.sala_abierta = true;
  r.sala_abierta_en = new Date().toISOString();
  return r.codigo;
}

export async function cerrarSala(reunionId: string): Promise<void> {
  const r = REUNIONES.find((x) => x.id === reunionId);
  if (!r) return;
  r.sala_abierta = false;
  r.sala_abierta_en = null;
}

export async function entrarConCodigo(escrito: string): Promise<string | null> {
  await dormir();
  const codigo = normalizarCodigo(escrito);
  if (codigo === null) return null;

  const r = REUNIONES.find((x) => x.codigo === codigo);
  if (!r || !sePuedeEntrar(comoSala(r))) return null;
  return r.id;
}

// Si en `reuniones-supabase.ts` aparece una consulta nueva, esto deja de
// compilar hasta que exista también acá.
const _cobertura: typeof Real = {
  quienSoy, miPerfil, cambiarNombre, misReuniones, reunionPorId, crearReunion,
  borrarReunion, analizarReunion, misTareasDeTodas, marcarTarea, agregarTarea,
  abrirSala, cerrarSala, entrarConCodigo,
};
void _cobertura;

/** Solo para las pruebas: deja las reuniones como recién instaladas. */
export function reiniciarReuniones(): void {
  REUNIONES.length = 0;
  REUNIONES.push(...copiar(SEMILLAS));
  siguiente = 1;
}
