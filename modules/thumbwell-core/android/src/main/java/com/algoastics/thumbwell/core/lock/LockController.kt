package com.algoastics.thumbwell.core.lock

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.widget.Toast
import android.view.accessibility.AccessibilityNodeInfo
import com.algoastics.thumbwell.core.R
import com.algoastics.thumbwell.core.data.CorePrefs
import com.algoastics.thumbwell.core.detection.BadgeForeground
import java.util.TimeZone

/**
 * Connects the [LimitEngine] to the S22-P0 [LockOverlay] inside the accessibility service. Runs on
 * the main thread only. The service reports what it sees ([onSurface], [onSurfaceGone], [onSwipe]);
 * this class decides when to cover, guards against text input and split screen, and runs the
 * "Leave reels" flow.
 *
 * Timing: the limit reel itself is never covered. When its count reaches the limit while the user
 * is on a reels surface, the lock waits for the next swipe on that surface (the first scroll event,
 * well under 500 ms) and covers the next item. Arriving on a reels surface while locked (or zero
 * mode) covers it on the first evaluation.
 */
class LockController(
  private val service: AccessibilityService,
  private val engine: LimitEngine,
  private val prefs: CorePrefs,
  /** True while [packageName] is foreground with a reels surface on screen. */
  private val isOnReels: (packageName: String) -> Boolean,
  /** Launcher (home) packages of this device; Home and Recents hide the lock at once. */
  private val homePackages: () -> Set<String> = { emptySet() },
) {
  private val handler = Handler(Looper.getMainLooper())
  private val trigger = LockTrigger()
  private val flow = LeaveFlow()
  private val overlay = LockOverlay(service) { leave() }
  private var surfacePackage: String? = null
  private var surfaceBounds: Box? = null
  private var overlayPackage: String? = null
  private var started = false
  private val foreground = BadgeForeground()
  private val audio = LockAudio(SystemAudioPort(service))
  private var provisional = false
  private var provisionalSince = 0L
  private val pauseAgain = Runnable { audio.pauseAgain() }

  private val stateListener: (LockState) -> Unit = { state -> handler.post { onState(state) } }

  private val screenOff = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      hide()
    }
  }

  private val watch = object : Runnable {
    override fun run() {
      val pkg = overlayPackage
      val activePkg = service.rootInActiveWindow?.packageName?.toString()
      if (!overlay.isShown) return
      // Never hide on one sample of another window: it must stay in front for the debounce.
      val now = SystemClock.elapsedRealtime()
      val verdict = foreground.check(activePkg, pkg.orEmpty(), now, homePackages = homePackages())
      val active = LockRules.activeAt(engine.state, System.currentTimeMillis())
      when (LockWatch.decide(active, verdict)) {
        LockWatch.Action.SAFETY_HIDE, LockWatch.Action.LEAVE_HIDE -> onSafetyWindow()
        LockWatch.Action.HIDE -> hide()
        LockWatch.Action.KEEP -> {
          // A cover shown on entry, before any reels surface, is removed when none ever appears.
          if (provisional && EarlyCover.expired(provisionalSince, now)) hide()
          else handler.postDelayed(this, WATCH_MS)
        }
      }
    }
  }

  /** True while the overlay covers the surface: reels seen then are not counted. */
  val isShowing: Boolean get() = overlay.isShown

  fun start() {
    if (started) return
    started = true
    engine.addListener(stateListener)
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    if (Build.VERSION.SDK_INT >= 33) {
      service.registerReceiver(screenOff, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      service.registerReceiver(screenOff, filter)
    }
    engine.refresh()
  }

  fun stop() {
    if (!started) return
    started = false
    engine.removeListener(stateListener)
    try {
      service.unregisterReceiver(screenOff)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "screen receiver was not registered")
    }
    handler.removeCallbacksAndMessages(null)
    flow.reset()
    hide()
    surfacePackage = null
    surfaceBounds = null
  }

  /** Hides the overlay now (screen off, service interrupted, app left reels). Idempotent. */
  fun hide() {
    handler.removeCallbacks(watch)
    handler.removeCallbacks(pauseAgain)
    overlay.hide()
    overlayPackage = null
    provisional = false
    audio.release()
  }

  /**
   * The user left the app: Home, Recents or another app (an immediate leave). Hides the lock at
   * once and forgets the surface; the lock returns only on a fresh reels entry while still locked.
   */
  fun onLeftApp() = onSafetyWindow()

  /**
   * [packageName] was just opened (its first event) while it is the active window. A lock that is
   * already active covers it at once, before any reels surface is detected, and the sound stops.
   * Guards as for [maybeShow]: never over a text input, split screen or a small window is left to
   * the normal path. The cover is provisional: the reels surface, when found, confirms it and sets
   * its bounds ([maybeShow]); with none after [EarlyCover.GRACE_MS] it is removed.
   */
  fun onEntry(packageName: String, root: AccessibilityNodeInfo?) {
    trigger.onSurfaceEntered() // an entry, not the live limit reel: nothing waits for a swipe
    if (overlay.isShown) return
    val state = engine.state
    val active = LockRules.activeAt(state, System.currentTimeMillis())
    val metrics = service.resources.displayMetrics
    val app = root?.let { n -> Rect().also(n::getBoundsInScreen) }?.let { Box(it.left, it.top, it.right, it.bottom) }
    val verdict = OverlayGuard.decide(
      active = active,
      consent = prefs.consentValid(),
      focusedTextInput = focusedTextInput(root),
      multiWindow = OverlayGuard.isMultiWindow(app, metrics.widthPixels, metrics.heightPixels),
    )
    if (verdict != OverlayGuard.Verdict.SHOW) return
    overlayPackage = packageName
    val box = OverlayGuard.coverBox(app ?: Box(0, 0, metrics.widthPixels, metrics.heightPixels), app, metrics.widthPixels, metrics.heightPixels)
    overlay.show(box, content(state))
    if (!overlay.isShown) return
    provisional = true
    provisionalSince = SystemClock.elapsedRealtime()
    onCoverShown()
    Log.i(TAG, "lock shown on entry app=$packageName")
  }

  /** The cover is up: restart the foreground watch, stop the sound. */
  private fun onCoverShown() {
    overlay.setBusy(flow.busy)
    foreground.reset()
    handler.removeCallbacks(watch)
    handler.postDelayed(watch, WATCH_MS)
    audio.engage()
    handler.removeCallbacks(pauseAgain)
    handler.postDelayed(pauseAgain, PAUSE_AGAIN_MS)
  }

  /**
   * The foreground window is Settings, Accessibility settings or an installer dialog (F07-10).
   * Hide only: no BACK, no HOME. The surface is forgotten, so nothing re-shows until a tracked
   * reels surface is on screen again (the next [onSurface] counts as a new entry).
   */
  fun onSafetyWindow() {
    surfacePackage = null
    surfaceBounds = null
    hide()
  }

  /**
   * A reels surface is on screen in [packageName]. Returns true when the overlay covers it, so the
   * caller skips counting. Called from every evaluation, so it must stay cheap.
   */
  fun onSurface(packageName: String, bounds: Rect, root: AccessibilityNodeInfo): Boolean {
    if (surfacePackage != packageName) {
      if (overlayPackage != null && overlayPackage != packageName) hide()
      surfacePackage = packageName
      trigger.onSurfaceEntered()
    }
    surfaceBounds = Box(bounds.left, bounds.top, bounds.right, bounds.bottom)
    maybeShow(root)
    return overlay.isShown
  }

  /** The reels surface of [packageName] is gone (tab changed, app left, covered). */
  fun onSurfaceGone(packageName: String) {
    if (surfacePackage != packageName) return
    surfacePackage = null
    surfaceBounds = null
    hide()
  }

  /** The user started swiping on the reels surface of [packageName]. */
  fun onSwipe(packageName: String) {
    if (surfacePackage != packageName) return
    if (!trigger.onSwipe()) return
    val root = service.rootInActiveWindow?.takeIf { it.packageName?.toString() == packageName }
    maybeShow(root)
  }

  private fun onState(state: LockState) {
    val active = LockRules.activeAt(state, System.currentTimeMillis())
    trigger.onState(active, surfacePackage != null)
    if (!active) {
      hide()
      return
    }
    if (overlay.isShown) {
      overlay.bind(content(state))
    }
  }

  private fun maybeShow(root: AccessibilityNodeInfo?) {
    val pkg = surfacePackage ?: return
    val surface = surfaceBounds ?: return
    // A provisional cover (shown on entry) is confirmed and re-fitted to the surface below.
    if (overlay.isShown && !provisional) return
    val state = engine.state
    val active = LockRules.activeAt(state, System.currentTimeMillis())
    if (!trigger.mayShow(active, true)) return
    val metrics = service.resources.displayMetrics
    val screenW = metrics.widthPixels
    val screenH = metrics.heightPixels
    val app = root?.let { n -> Rect().also(n::getBoundsInScreen) }?.let { Box(it.left, it.top, it.right, it.bottom) }
    val verdict = OverlayGuard.decide(
      active = active,
      consent = prefs.consentValid(),
      focusedTextInput = focusedTextInput(root),
      multiWindow = OverlayGuard.isMultiWindow(app, screenW, screenH),
    )
    when (verdict) {
      OverlayGuard.Verdict.SHOW -> {
        val wasProvisional = provisional
        overlayPackage = pkg
        overlay.show(OverlayGuard.coverBox(surface, app, screenW, screenH), content(state))
        provisional = false
        if (overlay.isShown) {
          onCoverShown()
          Log.i(TAG, if (wasProvisional) "lock confirmed app=$pkg" else "lock shown app=$pkg")
        }
      }
      OverlayGuard.Verdict.BACK_FALLBACK -> leave()
      OverlayGuard.Verdict.WAIT_TEXT_INPUT -> if (provisional) hide()
      OverlayGuard.Verdict.NOT_ACTIVE -> Unit
    }
  }

  /** Focus and flags only; the text of a field is never read. */
  private fun focusedTextInput(root: AccessibilityNodeInfo?): Boolean {
    val focused = root?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
    return OverlayGuard.isTextInput(focused.isEditable, focused.className?.toString())
  }

  private fun content(state: LockState): LockContent {
    val until = LockClock.format(
      state.lockedUntilMs ?: System.currentTimeMillis(),
      TimeZone.getDefault(),
    )
    return LockContent(state.limit, state.total, until)
  }

  /** "Leave reels": BACK; when BACK loops, a cooldown, then HOME with a toast. */
  private fun leave() {
    val pkg = surfacePackage ?: overlayPackage
    val action = flow.press() ?: return
    overlay.setBusy(true)
    perform(action)
    if (action == LeaveFlow.Action.BACK) {
      handler.postDelayed({ afterBack(pkg) }, LeaveFlow.BACK_CHECK_MS)
    }
  }

  private fun afterBack(pkg: String?) {
    val still = pkg != null && isOnReels(pkg)
    val now = System.currentTimeMillis()
    val until = flow.backChecked(now, still)
    if (until == null) {
      overlay.setBusy(false)
      return
    }
    handler.postDelayed({
      val stillThen = pkg != null && isOnReels(pkg)
      val next = flow.cooldownElapsed(System.currentTimeMillis(), stillThen)
      overlay.setBusy(false)
      if (next != null) perform(next)
    }, maxOf(0L, until - now))
  }

  private fun perform(action: LeaveFlow.Action) {
    when (action) {
      LeaveFlow.Action.BACK -> service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
      LeaveFlow.Action.HOME -> {
        service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
        Toast.makeText(service, R.string.thumbwell_lock_home_toast, Toast.LENGTH_SHORT).show()
        Log.i(TAG, "lock exit: home after back loop")
      }
    }
  }

  private companion object {
    const val TAG = "ThumbwellLock"
    const val WATCH_MS = 150L
    const val PAUSE_AGAIN_MS = 400L
  }
}
