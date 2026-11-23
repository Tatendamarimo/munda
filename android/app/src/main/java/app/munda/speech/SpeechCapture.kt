package app.munda.speech

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SpeechState(
    val listening: Boolean = false,
    val partial: String = "",
    val onDevice: Boolean = false,
    val error: String? = null,
)

/**
 * Dictation that works without signal. Uses Android's on-device recognizer when the language
 * pack is installed (API 31+), otherwise the default recognizer with EXTRA_PREFER_OFFLINE.
 * Recognizers stop after a pause, so we restart until the user taps stop, emitting each
 * finished segment via [onSegment]. Must be used from the main thread.
 */
class SpeechCapture(private val context: Context, private val onSegment: (String) -> Unit) {
    private val _state = MutableStateFlow(SpeechState())
    val state: StateFlow<SpeechState> = _state.asStateFlow()

    private var recognizer: SpeechRecognizer? = null
    private var wantListening = false
    private var forceDefaultRecognizer = false

    val isAvailable: Boolean get() = SpeechRecognizer.isRecognitionAvailable(context)

    fun start() {
        wantListening = true
        _state.value = _state.value.copy(error = null)
        listen()
    }

    fun stop() {
        wantListening = false
        recognizer?.stopListening()
        _state.value = _state.value.copy(listening = false, partial = "")
    }

    fun release() {
        wantListening = false
        recognizer?.destroy()
        recognizer = null
    }

    private fun listen() {
        val r = recognizer ?: createRecognizer().also { recognizer = it }
        r.startListening(
            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
            }
        )
    }

    private fun createRecognizer(): SpeechRecognizer {
        val onDevice = !forceDefaultRecognizer && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
        val r = if (onDevice) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        } else SpeechRecognizer.createSpeechRecognizer(context)
        _state.value = _state.value.copy(onDevice = onDevice)
        r.setRecognitionListener(listener)
        return r
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) { _state.value = _state.value.copy(listening = true) }
        override fun onPartialResults(partialResults: Bundle?) {
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
            _state.value = _state.value.copy(partial = text)
        }
        override fun onResults(results: Bundle?) {
            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                ?.takeIf { it.isNotBlank() }?.let(onSegment)
            _state.value = _state.value.copy(partial = "")
            if (wantListening) listen() else _state.value = _state.value.copy(listening = false)
        }
        @android.annotation.SuppressLint("SwitchIntDef")
        override fun onError(error: Int) {
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
                    if (wantListening) { listen(); return }
                SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> if (!forceDefaultRecognizer) {
                    // On-device language pack missing; fall back to the default recognizer.
                    Log.i(TAG, "On-device speech unavailable (code $error); falling back")
                    forceDefaultRecognizer = true
                    recognizer?.destroy(); recognizer = null
                    if (wantListening) { listen(); return }
                }
            }
            wantListening = false
            _state.value = _state.value.copy(listening = false, partial = "", error = describe(error))
        }
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    @android.annotation.SuppressLint("SwitchIntDef")
    private fun describe(code: Int) = when (code) {
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is needed for dictation."
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
            "Offline dictation isn't installed on this phone. Type the note, or install the offline speech pack in system settings."
        SpeechRecognizer.ERROR_AUDIO -> "Couldn't access the microphone."
        else -> "Dictation stopped (code $code). You can keep typing."
    }

    private companion object {
        const val TAG = "SpeechCapture"
    }
}
