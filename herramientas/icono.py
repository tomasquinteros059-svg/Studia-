"""Dibuja el ícono de StudIA.

Se dibuja con código y no se guarda un PNG suelto por una razón práctica: los
tamaños que pide Android e iOS son varios y cambian, y un archivo binario en el
repositorio no se puede revisar ni corregir un poco. Acá se ve qué se dibujó.

Qué se dibuja, y por qué eso. La aplicación entera se sostiene en una idea —el
color siempre significa un ramo; todo lo demás es tinta y papel— y su gesto más
propio es el destacador amarillo detrás de una palabra. Eso es el ícono: una
hoja con tres renglones y una franja de destacador. Sin letras: no hay una «S»
que se distinga de las otras cuarenta aplicaciones con una «S», y la tipografía
de los titulares no viaja dentro del APK.

Uso:  python3 herramientas/icono.py
"""
from PIL import Image, ImageDraw

AZUL = (47, 69, 212)
TINTA = (23, 28, 63)
PAPEL = (251, 250, 245)
DESTACADOR = (255, 225, 77)

LADO = 1024


def hoja(d: ImageDraw.ImageDraw, cx: int, cy: int, ancho: int, alto: int, sombra: bool) -> None:
    """La hoja con sus renglones, centrada en (cx, cy)."""
    izq, arr = cx - ancho // 2, cy - alto // 2
    der, aba = izq + ancho, arr + alto
    radio = int(ancho * 0.11)
    borde = max(6, int(ancho * 0.035))

    # La sombra dura, corrida y sin desenfoque: es la firma de la interfaz.
    if sombra:
        corrida = int(ancho * 0.055)
        d.rounded_rectangle(
            [izq + corrida, arr + corrida, der + corrida, aba + corrida],
            radius=radio, fill=TINTA,
        )

    d.rounded_rectangle([izq, arr, der, aba], radius=radio, fill=PAPEL,
                        outline=TINTA, width=borde)

    # Tres renglones. El del medio es el destacado, y por eso es el más corto:
    # un destacador marca una parte de la línea, no la línea entera.
    margen = int(ancho * 0.17)
    grosor = max(8, int(alto * 0.052))
    hueco = int(alto * 0.185)
    largos = [1.0, 0.72, 0.86]
    primero = cy - hueco

    # El amarillo va debajo del renglón del medio y lo desborda por los dos
    # lados, como un destacador pasado a mano y no como un relleno de celda.
    y = primero + hueco
    ancho_util = ancho - margen * 2
    d.rounded_rectangle(
        [izq + margen - grosor, y - grosor * 1.25,
         izq + margen + int(ancho_util * largos[1]) + grosor, y + grosor * 1.25],
        radius=grosor, fill=DESTACADOR,
    )

    for i, largo in enumerate(largos):
        y = primero + hueco * i
        d.rounded_rectangle(
            [izq + margen, y - grosor // 2,
             izq + margen + int(ancho_util * largo), y + grosor // 2],
            radius=grosor // 2, fill=TINTA,
        )


def lienzo(fondo) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (LADO, LADO), fondo)
    return img, ImageDraw.Draw(img)


def cuadricula(d: ImageDraw.ImageDraw) -> None:
    """La cuadrícula del papel, apenas insinuada sobre el azul."""
    paso = LADO // 8
    tono = (255, 255, 255, 26)
    for i in range(1, 8):
        d.line([(paso * i, 0), (paso * i, LADO)], fill=tono, width=3)
        d.line([(0, paso * i), (LADO, paso * i)], fill=tono, width=3)


def guardar(img: Image.Image, nombre: str) -> None:
    ruta = f"app/assets/{nombre}"
    img.save(ruta)
    print(f"{ruta}  {img.size[0]}×{img.size[1]}")


# ── El ícono de siempre: a sangre, para iOS y como respaldo ────────────────
img, d = lienzo(AZUL)
cuadricula(d)
hoja(d, LADO // 2, int(LADO * 0.47), int(LADO * 0.56), int(LADO * 0.66), sombra=True)
guardar(img, "icono.png")

# ── El adaptativo de Android: solo el frente, sobre nada ───────────────────
# El sistema recorta el frente con la forma que use el lanzador —círculo,
# cuadrado redondeado, gota— y solo garantiza lo que quepa en el círculo
# central. Por eso la hoja va más chica acá que en el de arriba: lo que se
# salga de esa zona se lo puede llevar el recorte.
img, d = lienzo((0, 0, 0, 0))
hoja(d, LADO // 2, LADO // 2, int(LADO * 0.40), int(LADO * 0.48), sombra=True)
guardar(img, "icono-adaptativo.png")

# ── El monocromo, para los íconos con el color del sistema (Android 13+) ───
# Sin él, el lanzador temático dibuja un cuadrado gris con el ícono adentro.
img, d = lienzo((0, 0, 0, 0))
blanco = (255, 255, 255, 255)
izq, arr = int(LADO * 0.30), int(LADO * 0.26)
der, aba = LADO - izq, LADO - arr
d.rounded_rectangle([izq, arr, der, aba], radius=int((der - izq) * 0.11),
                    outline=blanco, width=int((der - izq) * 0.075))
ancho_util = (der - izq) - int((der - izq) * 0.34)
grosor = max(10, int((aba - arr) * 0.052))
for i, largo in enumerate([1.0, 0.72, 0.86]):
    y = (arr + aba) // 2 + int((aba - arr) * 0.185) * (i - 1)
    d.rounded_rectangle(
        [izq + int((der - izq) * 0.17), y - grosor // 2,
         izq + int((der - izq) * 0.17) + int(ancho_util * largo), y + grosor // 2],
        radius=grosor // 2, fill=blanco,
    )
guardar(img, "icono-monocromo.png")

# ── El arranque: la misma hoja sobre el papel de la aplicación ─────────────
# El fondo es el papel y no un color oscuro: lo primero que pinta la app es
# crema, y arrancar en negro produce un destello que se ve como un parpadeo.
img, d = lienzo(PAPEL)
hoja(d, LADO // 2, LADO // 2, int(LADO * 0.34), int(LADO * 0.40), sombra=True)
guardar(img, "arranque.png")

# ── El de la pestaña del navegador ────────────────────────────────────────
img, d = lienzo(AZUL)
hoja(d, LADO // 2, LADO // 2, int(LADO * 0.60), int(LADO * 0.70), sombra=False)
guardar(img.resize((96, 96), Image.LANCZOS), "favicon.png")
