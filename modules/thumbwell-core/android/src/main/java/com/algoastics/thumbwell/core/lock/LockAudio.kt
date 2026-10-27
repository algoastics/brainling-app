package com.algoastics.thumbwell.core.lock

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import android.view.KeyEvent

/** The AudioManager calls the lock needs, so the logic is testable on the JVM. */
interface AudioPort {
  /** Requests audio focus (the reels app is told to stop). True when granted. */
  fun requestFocus(): Boolean

  fun abandonFocus()

  /** A media PAUSE key, down and up. */
  fun dispatchPause()

  /** True while any app is playing on the music stream. */
  fun isMusicActive(): Boolean = false

  fun isMusicMuted(): Boolean = false

  /** Current music stream volume index. */
  fun musicVolume(): Int = 0

  /** STREAM_MUSIC ADJUST_MUTE: the volume index is kept by the system. */
  fun muteMusic() {}

  /** STREAM_MUSIC ADJUST_UNMUTE. */
  fun unmuteMusic() {}

  fun setMusicVolume(index: Int) {}
}

/** The "we muted the music stream, at this volume" record, kept on disk so a crash can be undone. */
interface MuteStore {
  fun save(volume: Int)
  fun clear()

  /** The volume saved by a mute that was never released, or null. */
  fun pending(): Int?
}

/**
 * Mute of the music stream with an exact restore (LOCK-C layer 3). It only mutes a stream that is
 * audible, and only releases a mute it made itself: a stream the user had muted (or at volume 0) is
 * never touched, so the phone is never left silent by us. The volume is written to a [MuteStore]
 * before muting, so [recover] puts it back after a crash, a kill or a service restart.
 * Main thread only.
 */
class MuteGuard(private val port: AudioPort, private val store: MuteStore) {
  private var savedVolume: Int? = null

  /** True while this guard holds the mute. */
  val isMuting: Boolean get() = savedVolume != null

  /** Mutes the music stream. False (and no change) when it is already silent or already ours. */
  fun engage(): Boolean {
    if (savedVolume != null) return false
    if (port.isMusicMuted()) return false
    val volume = port.musicVolume()
    if (volume <= 0) return false
    store.save(volume)
    savedVolume = volume
    port.muteMusic()
    return true
  }

  /** Puts the volume back exactly as it was. Safe to call at any time and more than once. */
  fun release() {
    val volume = savedVolume ?: return
    savedVolume = null
    restore(volume)
    store.clear()
  }

  /** At startup: undoes a mute left behind by a crash or kill. */
  fun recover() {
    val volume = store.pending() ?: return
    if (savedVolume == null) restore(volume)
    store.clear()
  }

  private fun restore(volume: Int) {
    port.unmuteMusic()
    if (port.isMusicMuted() || port.musicVolume() != volume) port.setMusicVolume(volume)
  }
}

/**
 * Stops the reels app's sound while the lock is up, in place (the user is not moved out of the
 * app). Layers, in order:
 *  1. (the controller, before [engage]) tap the app's own pause or mute control when the tree shows
 *     it is playing, see [PauseControl];
 *  2. [engage]: audio focus and a media PAUSE key;
 *  3. [verify], shortly after: if music is still playing, mute STREAM_MUSIC with [MuteGuard].
 * [release] gives the focus and the volume back. Idempotent both ways and never holds anything past
 * the lock. No permission is needed and nothing is collected.
 *
 * BEST EFFORT, not a guarantee. On Android 15 and up an app targeting API 35 (Thumbwell does) may
 * request audio focus only as the top app or with a foreground service; an accessibility service is
 * neither, so the request often returns AUDIOFOCUS_REQUEST_FAILED (logged) and the reels app is not
 * told to stop. The media PAUSE key only reaches an app that holds an active MediaSession, and
 * reels players mostly do not. The mute is the layer that works whatever the app does, because the
 * system silences the stream itself.
 */
class LockAudio(private val port: AudioPort, private val mute: MuteGuard? = null) {
  private var engaged = false

  val isEngaged: Boolean get() = engaged

  /** True while the music stream is muted by the lock. */
  val isMuting: Boolean get() = mute?.isMuting == true

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

  /** Layer 3: mutes the music stream when sound is still playing. True when it was muted now. */
  fun verify(): Boolean {
    if (!engaged || mute == null) return false
    if (!port.isMusicActive()) return false
    return mute.engage()
  }

  fun release() {
    mute?.release()
    if (!engaged) return
    engaged = false
    port.abandonFocus()
  }

  /** Startup: undo a mute a crash left behind. */
  fun recover() {
    mute?.recover()
  }
}

/**
 * The real [AudioPort].
 *
 * Focus gain is AUDIOFOCUS_GAIN_TRANSIENT, as the scope (F06 item 9) says: the lock is a temporary
 * state, and a transient request lets the user's other media (music, podcasts) resume by itself
 * when the lock hides. A permanent AUDIOFOCUS_GAIN would stop that media for good, and a reels app
 * that honours focus gets the same "stop now" signal either way. The cost is that a reels app may
 * resume when the focus is abandoned, which only happens when the lock lifts or the user leaves.
 * USAGE_MEDIA, the usage Instagram, TikTok and YouTube play with.
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
      val built = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener(onFocusChange)
        .build()
      request = built
      val result = manager.requestAudioFocus(built)
      Log.i("ThumbwellLock", "audio focus request result=$result (1 granted, 0 failed)")
      return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
    @Suppress("DEPRECATION")
    return manager.requestAudioFocus(onFocusChange, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT) ==
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

  override fun isMusicActive(): Boolean = audio?.isMusicActive == true

  override fun isMusicMuted(): Boolean = audio?.isStreamMute(AudioManager.STREAM_MUSIC) == true

  override fun musicVolume(): Int = audio?.getStreamVolume(AudioManager.STREAM_MUSIC) ?: 0

  /** ADJUST_MUTE on STREAM_MUSIC needs no Do Not Disturb access (only ring-like streams can). */
  override fun muteMusic() = adjust(AudioManager.ADJUST_MUTE)

  override fun unmuteMusic() = adjust(AudioManager.ADJUST_UNMUTE)

  override fun setMusicVolume(index: Int) {
    try {
      audio?.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
    } catch (e: SecurityException) {
      Log.w("ThumbwellLock", "music volume restore refused")
    }
  }

  private fun adjust(direction: Int) {
    try {
      audio?.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, 0)
    } catch (e: SecurityException) {
      Log.w("ThumbwellLock", "music mute refused")
    }
  }
}

/** [MuteStore] on app-private SharedPreferences; `commit()` so the record survives a crash. */
class SystemMuteStore(context: Context) : MuteStore {
  private val prefs = context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  override fun save(volume: Int) {
    prefs.edit().putInt(KEY, volume).commit()
  }

  override fun clear() {
    prefs.edit().remove(KEY).commit()
  }

  override fun pending(): Int? = if (prefs.contains(KEY)) prefs.getInt(KEY, 0) else null

  private companion object {
    const val NAME = "thumbwell_lock_audio"
    const val KEY = "music_volume_before_mute"
  }
}

/**
 * LOCK-C layer 1, the pure part: reading a pause or mute control's state from its content
 * description. Only exact, case-insensitive labels count (labels of a control, never user content),
 * only English, and only a control that is playing is ever clicked. The lock remembers that it
 * clicked and only clicks the same control back when it then reads as paused, so it never toggles
 * something it did not change.
 */
object PauseControl {
  enum class State { PLAYING, PAUSED, UNKNOWN }

  /** The control reads "Pause" or "Mute": the reel is playing with sound, a click stops it. */
  val PLAYING_LABELS: Set<String> =
    linkedSetOf("pause", "pause video", "mute", "mute video", "audio is playing", "sound on")

  /** The control reads "Play" or "Unmute": already stopped or silent, a click would START it. */
  val PAUSED_LABELS: Set<String> =
    linkedSetOf("play", "play video", "unmute", "unmute video", "audio is muted", "sound off")

  /** Search keys for the tree: each label above contains one of these words. */
  val SEARCH_KEYS: List<String> = listOf("Pause", "Mute", "Audio is playing", "Sound on")

  fun stateOf(description: String?): State {
    val label = description?.trim()?.lowercase() ?: return State.UNKNOWN
    return when (label) {
      in PLAYING_LABELS -> State.PLAYING
      in PAUSED_LABELS -> State.PAUSED
      else -> State.UNKNOWN
    }
  }

  /** Click only a control that shows the reel playing. Never when unknown. */
  fun shouldClick(state: State): Boolean = state == State.PLAYING

  /** The same control: [b]'s centre lies inside [a] (the label changes, the position does not). */
  fun sameControl(a: Box, b: Box): Boolean {
    val cx = (b.left + b.right) / 2
    val cy = (b.top + b.bottom) / 2
    return cx in a.left..a.right && cy in a.top..a.bottom
  }

  /** Click back only a control that we clicked and that now reads as paused. */
  fun shouldRestore(weClicked: Boolean, state: State): Boolean = weClicked && state == State.PAUSED
}
