// Los mismos tokens del prototipo, para que la app y el diseño no se separen.

export const color = {
  marca: "#208AEF",
  marcaOscura: "#0C447C",
  ambar: "#C9701C",
  vivo: "#D93B3B",
  ok: "#1E8E5A",

  fondo: "#FFFFFF",
  texto: "#0B1220",
  textoSuave: "#60646C",
  elemento: "#F1F1F4",
  borde: "#E1E2E7",
  sobreMarca: "#FFFFFF",
  nocturno: "#0E1726",
} as const;

export const radio = { campo: 11, boton: 12, tarjeta: 14, burbuja: 15, pastilla: 999 } as const;

export const espacio = { xs: 4, s: 8, m: 14, l: 18, xl: 26 } as const;

export const tipo = {
  titulo: { fontSize: 25, fontWeight: "600" },
  subtitulo: { fontSize: 20, fontWeight: "600" },
  fila: { fontSize: 14, fontWeight: "600" },
  cuerpo: { fontSize: 14 },
  detalle: { fontSize: 12, color: color.textoSuave },
  etiqueta: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: color.textoSuave,
  },
} as const;

/** El color del ramo, atenuado, para fondos de íconos. */
export const tenue = (hex: string) => `${hex}1F`;

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const nombreDia = (n: number) => DIAS[n] ?? "";
export const diaCorto = (n: number) => (DIAS[n] ?? "").slice(0, 3);

/** "1:04:00" o "14:32" — para duraciones de clases. */
export function duracion(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dosDigitos(m)}:${dosDigitos(s)}` : `${dosDigitos(m)}:${dosDigitos(s)}`;
}

/** "Jue 20 ago" */
export function fechaCorta(iso: string): string {
  const f = new Date(iso);
  const dia = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][f.getDay()] ?? "";
  const mes = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][f.getMonth()] ?? "";
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${f.getDate()} ${mes}`;
}

/** "Vie 28 ago, 23:59" */
export function fechaYHora(iso: string): string {
  const f = new Date(iso);
  return `${fechaCorta(iso)}, ${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

/** "08:30" a partir de "08:30:00" */
export const hora = (t: string) => t.slice(0, 5);
