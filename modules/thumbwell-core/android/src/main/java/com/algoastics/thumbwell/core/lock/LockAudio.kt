package com.algoastics.thumbwell.core.lock

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.view.KeyEvent

/** The three AudioManager calls the lock needs, so the logic is testable on the JVM. */
interface AudioPort {
  /** Requests audio focus (the reels app is told to stop). True when granted. */
  fun requestFocus(): Boolean

  fun abandonFocus()

  /** A media PAUSE key, down and up. */
  fun dispatchPause()
}

/**
 * Stops the reels app's sound while the lock is up (its next reel autoplays under the overlay).
 * [engage] when the lock shows: take audio focus and send a media PAUSE. [release] when it hides:
 * give the focus back. Idempotent both ways and never holds the focus past the lock, so nothing
 * leaks. No permission is needed and nothing is collected. Main thread only.
 */
class LockAudio(private val port: AudioPort) {
  private var engaged = false

  val isEngaged: Boolean get() = engaged

  fun engage() {
    if (engaged) return
    engaged = true
    port.requestFocus()
    port.dispatchPause()
  }

  /** A second PAUSE shortly after [engage], for an app that starts playing as the lock appears. */
  fun pauseAgain() {
    if (engaged) port.dispatchPause()
  }

  fun release() {
    if (!engaged) return
    engaged = false
    port.abandonFocus()
  }
}

/**
 * The real [AudioPort]. AUDIOFOCUS_GAIN (permanent): a transient request would let a reels app
 * resume on its own when the focus is abandoned, e.g. after "Leave reels". USAGE_MEDIA, the usage
 * Instagram, TikTok and YouTube play with.
 */
class SystemAudioPort(context: Context) : AudioPort {
  private val audio = context.getSystemService(AudioManager::class.java)
  private var request: AudioFocusRequest? = null
  private val onFocusChange = AudioManager.OnAudioFocusChangeListener { /* never re-grab: no fight */ }

  override fun requestFocus(): Boolean {
    val manager = audio ?: return false
    if (Build.VERSION.SDK_INT >= 26) {
      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
        .build()
      val built = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener(onFocusChange)
        .build()
      request = built
      return manager.requestAudioFocus(built) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
    @Suppress("DEPRECATION")
    return manager.requestAudioFocus(onFocusChange, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN) ==
      AudioManager.AUDIOFOCUS_REQUEST_GRANTED
  }

  override fun abandonFocus() {
    val manager = audio ?: return
    if (Build.VERSION.SDK_INT >= 26) {
      request?.let { manager.abandonAudioFocusRequest(it) }
      request = null
    } else {
      @Suppress("DEPRECATION")
      manager.abandonAudioFocus(onFocusChange)
    }
  }

  override fun dispatchPause() {
    val manager = audio ?: return
    manager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PAUSE))
    manager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PAUSE))
  }
}
