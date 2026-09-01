"""Comprueba que cada función pedida esté dentro del paquete que va al APK.

Nace de un problema real: Tomás bajó APK «arregladas» que seguían igual, y no
había manera de saber si el archivo traía o no el cambio sin instalarlo. Esto
mira el paquete Hermes —lo mismo que se mete adentro del APK— y busca una
frase de cada función.

Dos trampas que hay que saber, porque las dos me dieron falsos negativos:

  · Hermes guarda en un byte por carácter las cadenas puramente ASCII y en
    UTF-16 las que llevan tilde o símbolo. Un grep normal no ve las segundas,
    que en castellano bien escrito son casi todas. Acá se busca en las dos.

  · Lo que la pantalla arma en tiempo de ejecución —«Vuelve » + «hoy mismo»—
    no existe como una sola cadena. Por eso cada función se busca por una
    frase que sí esté escrita entera en el código.

Uso:  npm run prueba:paquete-android
"""
import glob
import sys

PIEZAS = {
    "Del alumno": [
        ("Portada · titular", "Tu semestre, con un tutor al lado"),
        ("Portada · precios", "sin letra chica"),
        ("Portada · el quiz", "antes de la prueba"),
        ("Portada · los agentes", "No es un chat cualquiera"),
        ("Entrada solo con correo", "Entra con tu correo"),
        ("Planificador de la semana", "Cargar mi horario"),
        ("Quiz · corrige al momento", "La correcta era otra. "),
        ("Fichas de repaso", "toca para voltear"),
        ("Fichas · vuelven solas", "hoy mismo"),
        ("Nuevo apunte sin ramos", "Apuntar en"),
        ("Tutor guardable", "Guardar el tutor"),
        ("Tutor · pestaña para abrirlo", "Abrir el tutor"),
        ("Escribir a mano", "Hoja para escribir a mano"),
        ("Útiles · destacador", "Destacador"),
        ("Útiles · deshacer", "Deshacer el último trazo"),
        ("Modo escucha", "Escuchando la clase"),
        ("Escucha · no dice quién habló", "No separa quién habló"),
        ("Crear quiz desde Tareas", "Crear un quiz con mi material"),
        ("Lector en voz alta", "Volver a empezar"),
    ],
    "Del profesor": [
        ("Iniciar la grabación", "Permitir y empezar a grabar"),
        ("Grabación · retirar permiso", "Dejar de permitirlo"),
        ("Registro · crear evaluación", "Crear una evaluación"),
        ("Registro · ponderado honesto", "no cuenta como cero"),
        ("Registro · columna del ponderado", "Va con"),
        ("Material de todos sus ramos", "Buscar en todo mi material"),
        ("Plan del mes", "Guardar esta propuesta"),
        ("Plan · al asistente", "Conversarlo con el asistente"),
        ("Publicar notas al curso", "Publicar al curso"),
    ],
    "Legal": [
        ("Términos de uso", "Al entrar aceptas los"),
        ("Términos · la propiedad reservada", "La aplicación es de"),
        ("Términos · no entrenar modelos", "para entrenar, ajustar o evaluar modelos"),
        ("Privacidad · el audio no se guarda", "El audio de las clases no se guarda."),
        ("Privacidad · Ley 21.719", "21.719"),
        ("Privacidad · menores de edad", "niñas, niños y adolescentes"),
        ("Licencias de terceros", "Licencias de terceros"),
        ("Licencias · el aviso de una biblioteca", "Copyright (c) Meta Platforms"),
        ("Aviso de copyright", "Todos los derechos reservados."),
    ],
    "La cuenta": [
        ("Recuperar la clave", "Olvidé mi clave"),
        ("Recuperar · sin delatar quién tiene cuenta", "tiene cuenta, le llega un enlace"),
        ("Crear cuenta · confirmar por correo", "Te mandamos un correo a"),
        ("Clave nueva desde el enlace", "Tu clave nueva"),
        ("Enlace vencido", "Este enlace ya venció"),
        ("Borrar la cuenta", "Borrar mi cuenta para siempre"),
        ("Borrar · avisa que no se deshace", "Esto no se puede deshacer"),
    ],
    "Archivos": [
        ("Adjuntar un archivo", "Guardar archivos necesita el servidor conectado"),
        ("Abrir el archivo guardado", "El archivo ya no está disponible"),
        ("Subida · sin permiso", "No tienes permiso para guardar archivos acá."),
        ("Entregar con archivo", "Adjuntar un archivo a la entrega"),
        ("Ver lo entregado", "Ver lo que entregué"),
        ("Profesor · cargar material", "Lo que subas acá lo ve tu curso"),
        ("Material · elegir la unidad", "¿En qué unidad va?"),
        ("Profesor · abrir la entrega", "Ver lo que entregó"),
        ("Profesor · entrega sin archivo", "Entregó sin adjuntar ningún archivo."),
    ],
    "Cuando algo falla": [
        ("La pantalla que se cayó", "Se cayó esta pantalla"),
        ("No le echa la culpa a nadie", "No fue algo que hicieras mal"),
        ("Privacidad · qué se guarda de una caída", "De las caídas:"),
    ],
}


def main() -> int:
    paquetes = glob.glob("app/dist/_expo/static/js/android/*.hbc")
    if not paquetes:
        print("No hay paquete que auditar. Corre primero:")
        print("  npm --prefix app run paquete:android")
        return 1

    datos = open(paquetes[0], "rb").read()

    def esta(cadena: str) -> bool:
        return cadena.encode("utf-8") in datos or cadena.encode("utf-16-le") in datos

    print(f"Paquete: {paquetes[0]}  ({len(datos) / 1_048_576:.1f} MB)")
    faltan = []
    for grupo, filas in PIEZAS.items():
        print(f"\n{grupo}:")
        for nombre, cadena in filas:
            ok = esta(cadena)
            if not ok:
                faltan.append(nombre)
            print(f"  {'ok  ' if ok else 'FALTA'} {nombre}")

    if faltan:
        print(f"\nFaltan {len(faltan)}: " + ", ".join(faltan))
        return 1
    print(f"\nLas {sum(len(f) for f in PIEZAS.values())} piezas están en el paquete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
