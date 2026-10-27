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
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import com.algoastics.thumbwell.core.R
import com.algoastics.thumbwell.core.data.CorePrefs
import com.algoastics.thumbwell.core.detection.BadgeForeground
import com.algoastics.thumbwell.core.rules.AppRule
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
  private val audioPort = SystemAudioPort(service)
  private val audio = LockAudio(audioPort, MuteGuard(audioPort, SystemMuteStore(service)))
  private var surfaceRule: AppRule? = null
  /** The container bounds the shown cover was last fitted to; a different value triggers a re-fit. */
  private var fittedSurface: Box? = null
  /** Bounds of the in-app pause or mute control the lock clicked; only that one is ever clicked back. */
  private var pausedControl: Box? = null
  private val permission = OverlayPermissionProbe()
  /** The reels container box (before the window type shapes it) the cover was last fitted to. */
  private var pickedBox: Box? = null
  private var provisional = false
  private var provisionalSince = 0L
  private val pauseAgain = Runnable { audio.pauseAgain() }
  private val verifyAudio = Runnable { audio.verify() }

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
          else {
            switchKindIfNeeded() // the permission was granted or revoked while the lock is up
            handler.postDelayed(this, WATCH_MS)
          }
        }
      }
    }
  }

  /** True while the overlay covers the surface: reels seen then are not counted. */
  val isShowing: Boolean get() = overlay.isShown

  fun start() {
    if (started) return
    started = true
    audio.recover() // a mute left behind by a crash or a kill is undone first
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
    hide() // also gives the music volume back
    surfacePackage = null
    surfaceBounds = null
  }

  /** Hides the overlay now (screen off, service interrupted, app left reels). Idempotent. */
  fun hide() {
    handler.removeCallbacks(watch)
    handler.removeCallbacks(pauseAgain)
    handler.removeCallbacks(verifyAudio)
    overlay.hide()
    overlayPackage = null
    provisional = false
    pausedControl = null
    fittedSurface = null
    pickedBox = null
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
  fun onEntry(packageName: String, root: AccessibilityNodeInfo?, rule: AppRule? = null) {
    if (rule != null) surfaceRule = rule
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
    val frame = showCover(null, app, root, packageName, content(state)) ?: return
    provisional = true
    provisionalSince = SystemClock.elapsedRealtime()
    onCoverShown(root, frame.cover)
    Log.i(TAG, "lock shown on entry app=$packageName")
  }

  /**
   * The cover is up: restart the foreground watch and stop the sound in place, never by leaving the
   * app. Layers: tap the in-app pause or mute control when it reads as playing, then audio focus
   * and a media PAUSE key, then (if sound is still heard) mute the music stream until the lock hides.
   */
  private fun onCoverShown(root: AccessibilityNodeInfo?, area: Box) {
    overlay.setBusy(flow.busy)
    foreground.reset()
    handler.removeCallbacks(watch)
    handler.postDelayed(watch, WATCH_MS)
    if (root != null && pausedControl == null) {
      pausedControl = LockTree.pausePlaying(root, area)
      if (pausedControl != null) Log.i(TAG, "lock: in-app pause control clicked")
    }
    audio.engage()
    handler.removeCallbacks(pauseAgain)
    handler.postDelayed(pauseAgain, PAUSE_AGAIN_MS)
    handler.removeCallbacks(verifyAudio)
    handler.postDelayed(verifyAudio, VERIFY_AUDIO_MS)
    handler.postDelayed(verifyAudio, VERIFY_AUDIO_MS * 3)
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
  fun onSurface(packageName: String, bounds: Rect, root: AccessibilityNodeInfo, rule: AppRule? = null): Boolean {
    if (rule != null) surfaceRule = rule
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
      resumeInApp()
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
    if (overlay.isShown && !provisional) {
      refit(root)
      return
    }
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
        val frame = showCover(surface, app, root, pkg, content(state))
        provisional = false
        if (frame != null) {
          onCoverShown(root, frame.cover)
          Log.i(TAG, if (wasProvisional) "lock confirmed app=$pkg" else "lock shown app=$pkg")
        }
      }
      OverlayGuard.Verdict.BACK_FALLBACK -> leave() // split screen: no overlay can be shown
      OverlayGuard.Verdict.WAIT_TEXT_INPUT -> if (provisional) hide()
      OverlayGuard.Verdict.NOT_ACTIVE -> Unit
    }
  }

  /**
   * A shown cover follows its reels container: when the container's bounds change (rotation, the
   * tab bar appearing or going, a layout change) the box is computed again and the window moved. The
   * tree is walked only on a change, never on every evaluation. The window type is checked first.
   */
  private fun refit(root: AccessibilityNodeInfo?) {
    val pkg = overlayPackage ?: return
    val surface = surfaceBounds ?: return
    if (switchKindIfNeeded()) return
    if (surface == fittedSurface) return
    val app = root?.let { n -> Rect().also(n::getBoundsInScreen) }?.let { Box(it.left, it.top, it.right, it.bottom) }
    showCover(surface, app, root, pkg, content(engine.state))
  }

  /**
   * The wanted window type changed under a shown lock (the permission was granted or revoked): the
   * old window is torn down and the cover shown again in the other type from the same bounds, so
   * exactly one window exists. A failed add of the preferred type falls back at once. Returns true
   * when the type was switched.
   */
  private fun switchKindIfNeeded(): Boolean {
    val shown = overlay.kind ?: return false
    if (wantedKind() == shown) return false
    val picked = pickedBox ?: return false
    showPicked(picked, content(engine.state)) // removes the old window first; null leaves none
    Log.i(TAG, "lock window type switched to ${overlay.kind}")
    if (provisional) provisionalSince = SystemClock.elapsedRealtime()
    return true
  }

  /**
   * The unlock came while the user is still on the reel: the control we paused is tapped back, and
   * only when it still reads as paused. Nothing we did not change is ever toggled.
   */
  private fun resumeInApp() {
    val was = pausedControl ?: return
    pausedControl = null
    val pkg = overlayPackage ?: return
    val root = service.rootInActiveWindow?.takeIf { it.packageName?.toString() == pkg } ?: return
    if (LockTree.resume(root, was)) Log.i(TAG, "lock: in-app control resumed")
  }

  /** The window type for now: the permission (read at most every 1.5 s) and the API level. */
  private fun wantedKind(): LockWindowKind {
    val granted = permission.granted(SystemClock.elapsedRealtime()) { canDrawOverlays() }
    return LockWindowChoice.choose(granted, Build.VERSION.SDK_INT)
  }

  private fun canDrawOverlays(): Boolean =
    try {
      Settings.canDrawOverlays(service)
    } catch (e: Exception) {
      false
    }

  /**
   * The reels box (LOCK-A): the reels container from the tree, minus the bottom tab bar and, only
   * for the whole-screen fallback, the navigation bar ([LockBounds]). The window type then shapes it
   * ([LockWindowChoice.frame]): edge to edge from y=0 for the application overlay, below the
   * see-through strip for the accessibility overlay.
   */
  private fun pickBox(surface: Box?, app: Box?, root: AccessibilityNodeInfo?, pkg: String): Box {
    val resources = service.resources
    val metrics = resources.displayMetrics
    val rule = surfaceRule
    val tabBar = if (root != null && rule != null) {
      LockTree.tabBar(root, rule, pkg, metrics.widthPixels, metrics.heightPixels, metrics.density)
    } else {
      null
    }
    val navId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
    val navBar = if (navId > 0) resources.getDimensionPixelSize(navId) else 0
    val picked = LockBounds.select(surface, tabBar, app, metrics.widthPixels, metrics.heightPixels, navBar, metrics.density)
    fittedSurface = surface
    Log.i(TAG, "lock bounds source=${picked.source} tabBar=${tabBar != null}")
    return picked.box
  }

  /** Picks the box, then shows it in the wanted window type. Null when nothing could be shown. */
  private fun showCover(surface: Box?, app: Box?, root: AccessibilityNodeInfo?, pkg: String, content: LockContent): LockFrame? {
    val picked = pickBox(surface, app, root, pkg)
    pickedBox = picked
    return showPicked(picked, content)
  }

  /**
   * Shows [picked] in the wanted window type. If the application overlay is refused (the
   * permission went away between the check and the add), the accessibility overlay is used at once
   * and the permission reads as not granted for a moment, so events do not retry it each time.
   */
  private fun showPicked(picked: Box, content: LockContent): LockFrame? {
    val resources = service.resources
    val density = resources.displayMetrics.density
    val statusId = resources.getIdentifier("status_bar_height", "dimen", "android")
    val statusBar = if (statusId > 0) resources.getDimensionPixelSize(statusId) else 0
    val band = OverlayGuard.topBandPx(statusBar, density)
    var kind = wantedKind()
    var frame = LockWindowChoice.frame(kind, picked, statusBar, band)
    if (!overlay.show(frame, kind, content) && kind == LockWindowKind.APPLICATION_OVERLAY) {
      permission.denied(SystemClock.elapsedRealtime())
      kind = LockWindowKind.ACCESSIBILITY_OVERLAY
      frame = LockWindowChoice.frame(kind, picked, statusBar, band)
      overlay.show(frame, kind, content)
    }
    return if (overlay.isShown) frame else null
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

  /**
   * "Leave reels" (LOCK-B): taps the app's Home tab (Instagram, YouTube), staying inside the app.
   * An app with no such tab (TikTok), or a tab that is not found or does not respond, falls back to
   * BACK, and when BACK loops to HOME with a toast: the last resort, never the default.
   */
  private fun leave() {
    val pkg = surfacePackage ?: overlayPackage
    val rule = surfaceRule
    val root = pkg?.let { p -> service.rootInActiveWindow?.takeIf { it.packageName?.toString() == p } }
    val rtl = service.resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL
    val tab = if (root != null && rule != null && pkg != null) LockTree.findHomeTab(root, rule, pkg, rtl) else null
    val action = flow.press(tabAvailable = tab != null) ?: return
    overlay.setBusy(true)
    if (action == LeaveFlow.Action.TAB) {
      if (tab != null) LockTree.click(tab)
      handler.postDelayed({ afterTab(pkg) }, LeaveFlow.TAB_CHECK_MS)
      return
    }
    perform(action)
    if (action == LeaveFlow.Action.BACK) {
      handler.postDelayed({ afterBack(pkg) }, LeaveFlow.BACK_CHECK_MS)
    }
  }

  private fun afterTab(pkg: String?) {
    val next = flow.tabChecked(pkg != null && isOnReels(pkg))
    if (next == null) {
      overlay.setBusy(false)
      return
    }
    Log.i(TAG, "lock exit: home tab did not work, trying back")
    perform(next)
    handler.postDelayed({ afterBack(pkg) }, LeaveFlow.BACK_CHECK_MS)
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
      LeaveFlow.Action.TAB -> Unit // the tab is tapped in leave(), not by a global action
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
    const val VERIFY_AUDIO_MS = 600L
  }
}
