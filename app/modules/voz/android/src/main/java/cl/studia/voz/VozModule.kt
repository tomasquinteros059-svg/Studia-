package cl.studia.voz

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reconocimiento de voz para el modo escucha.
 *
 * Envuelve el `SpeechRecognizer` de Android. Existe porque el paquete de la
 * comunidad todavía no tiene versión para Expo 57, y porque de todos modos
 * hace falta mucho menos: oír una clase y devolverla escrita.
 *
 * Transcribe en el propio teléfono y prefiere el reconocedor local. Eso no es
 * un detalle de implementación: es lo que hace que el audio de una sala de
 * clases con treinta menores de edad no viaje a ninguna parte. Lo que sale de
 * acá es texto; el sonido no sale del aparato.
 *
 * Devuelve además la confianza de cada tramo, que es lo que después permite
 * cruzar lo que oyeron varios teléfonos y quedarse con una sola versión de la
 * clase.
 *
 * Lo que este módulo NO hace, y conviene que esté escrito acá y no solo en
 * la documentación: no separa quién habló. El reconocedor de Android
 * devuelve una sola corriente de texto, sin hablantes. Cualquier "Profesora /
 * Alumno" que apareciera después lo habría inventado alguien, y poner en boca
 * de un profesor algo que no se sabe que dijo es peor que no atribuir nada.
 */
class VozModule : Module() {

  private var reconocedor: SpeechRecognizer? = null

  /** Lo que pidió la pantalla. Distinto de que el reconocedor esté activo:
   *  entre un corte y el reinicio, `escuchando` sigue en true y el
   *  reconocedor está detenido. Es justo esa diferencia la que permite
   *  reanudar sin avisarle a la interfaz de un final que no ocurrió. */
  private var escuchando = false
  private var idioma = "es-CL"

  private val enElHilo = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("Voz")

    Events("alParcial", "alTexto", "alError", "alFin")

    /**
     * Si este teléfono tiene un reconocedor instalado. En algunos equipos sin
     * servicios de Google no hay ninguno, y entonces la pantalla ofrece pegar
     * el texto en vez de un botón que no haría nada.
     */
    Function("hayReconocedor") {
      val contexto = appContext.reactContext ?: return@Function false
      SpeechRecognizer.isRecognitionAvailable(contexto)
    }

    AsyncFunction("empezar") { codigoIdioma: String? ->
      idioma = codigoIdioma ?: "es-CL"
      enElHiloPrincipal {
        val contexto = appContext.reactContext
          ?: throw CodedException("SIN_CONTEXTO", "La aplicación no está lista.", null)
        if (!SpeechRecognizer.isRecognitionAvailable(contexto)) {
          throw CodedException(
            "SIN_RECONOCEDOR",
            "Este teléfono no trae reconocimiento de voz.",
            null,
          )
        }
        soltar()
        val nuevo = SpeechRecognizer.createSpeechRecognizer(contexto)
        nuevo.setRecognitionListener(Oyente())
        reconocedor = nuevo
        escuchando = true
        arrancarSesion()
      }
    }

    AsyncFunction("detener") {
      enElHiloPrincipal {
        escuchando = false
        soltar()
        sendEvent("alFin", Bundle())
      }
    }

    OnDestroy {
      enElHiloPrincipal {
        escuchando = false
        soltar()
      }
    }
  }

  // ── Ciclo del reconocedor ──────────────────────────────────────────────────

  /**
   * El `SpeechRecognizer` solo puede tocarse desde el hilo principal: llamarlo
   * desde otro lanza `IllegalStateException` sin decir por qué.
   */
  private fun enElHiloPrincipal(bloque: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) bloque()
    else enElHilo.post(bloque)
  }

  private fun soltar() {
    reconocedor?.let {
      try {
        it.stopListening()
        it.destroy()
      } catch (_: Exception) {
        // Ya estaba destruido: no hay nada que rescatar ni que informar.
      }
    }
    reconocedor = null
  }

  private fun intencion(): Intent =
    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(
        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
      )
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma)
      // Sin esto solo llega texto al final de cada tramo, y quien dicta no ve
      // nada durante varios segundos y cree que no lo está tomando.
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      // Preferir el reconocedor del dispositivo cuando exista: una reunión no
      // debería viajar a un servidor solo para transcribirse.
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
        putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
      }
    }

  private fun arrancarSesion() {
    val activo = reconocedor ?: return
    try {
      activo.startListening(intencion())
    } catch (e: Exception) {
      escuchando = false
      sendEvent("alError", Bundle().apply {
        putString("codigo", "NO_ARRANCA")
        putString("mensaje", e.message ?: "No se pudo iniciar el dictado.")
      })
    }
  }

  /**
   * Android corta la sesión sola en cada silencio largo. Reanudarla es lo que
   * hace que una reunión de una hora no se transforme en dos minutos de texto:
   * sin esto el dictado se muere en el primer silencio y nadie se entera.
   *
   * Se reanuda con un respiro: encadenar `startListening` dentro del callback
   * anterior falla en varios equipos.
   */
  private fun reanudarSiCorresponde() {
    if (!escuchando) return
    enElHilo.postDelayed({
      if (!escuchando) return@postDelayed
      val contexto = appContext.reactContext ?: return@postDelayed
      soltar()
      val nuevo = SpeechRecognizer.createSpeechRecognizer(contexto)
      nuevo.setRecognitionListener(Oyente())
      reconocedor = nuevo
      arrancarSesion()
    }, 250)
  }

  // ── Oyente ────────────────────────────────────────────────────────────────

  private inner class Oyente : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rms: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onEvent(tipo: Int, params: Bundle?) {}

    override fun onPartialResults(resultados: Bundle?) {
      val texto = primero(resultados) ?: return
      if (texto.isBlank()) return
      sendEvent("alParcial", Bundle().apply { putString("texto", texto) })
    }

    override fun onResults(resultados: Bundle?) {
      val texto = primero(resultados)
      if (!texto.isNullOrBlank()) {
        sendEvent("alTexto", Bundle().apply {
          putString("texto", texto)
          putFloat("confianza", confianzaDe(resultados))
        })
      }
      reanudarSiCorresponde()
    }

    /**
     * Cuánto se cree el reconocedor lo que acaba de entregar.
     *
     * No todos los equipos la informan: cuando falta llega -1 y el cruce de
     * versiones sabe que ese tramo no trae confianza, en vez de tratarlo como
     * si fuera pésimo. Un tramo sin dato no es un tramo malo.
     */
    private fun confianzaDe(resultados: Bundle?): Float =
      resultados
        ?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
        ?.firstOrNull()
        ?.takeIf { it > 0f }
        ?: -1f

    override fun onError(error: Int) {
      // Silencio y "no entendí" son el estado normal de una reunión con
      // pausas: se reanuda sin molestar a nadie.
      if (error == SpeechRecognizer.ERROR_NO_MATCH ||
        error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
      ) {
        reanudarSiCorresponde()
        return
      }
      escuchando = false
      soltar()
      sendEvent("alError", Bundle().apply {
        putString("codigo", codigoDe(error))
        putString("mensaje", mensajeDe(error))
      })
    }

    private fun primero(resultados: Bundle?): String? =
      resultados
        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        ?.firstOrNull()
  }

  private fun codigoDe(error: Int): String = when (error) {
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "SIN_PERMISO"
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "SIN_RED"
    SpeechRecognizer.ERROR_AUDIO -> "SIN_MICROFONO"
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "OCUPADO"
    else -> "FALLO"
  }

  /** En español y diciendo qué hacer, porque esto se muestra tal cual. */
  private fun mensajeDe(error: Int): String = when (error) {
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
      "Falta el permiso del micrófono. Se activa desde los ajustes del teléfono."
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
      "El reconocimiento de voz se quedó sin conexión."
    SpeechRecognizer.ERROR_AUDIO ->
      "No se pudo leer el micrófono. Puede que otra aplicación lo tenga tomado."
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY ->
      "El reconocedor está ocupado. Cierra la otra aplicación que lo esté usando."
    else ->
      "Se cortó el dictado. Lo que ya se escribió quedó guardado."
  }
}
