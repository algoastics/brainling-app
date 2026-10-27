package com.algoastics.thumbwell.core.lock

import com.algoastics.thumbwell.core.detection.BadgeForeground

/**
 * What the lock overlay's foreground watch does with one sample. Pure. The foreground comes
 * from [BadgeForeground], the same debounce the badge uses: a safety package (F07-10) hides the
 * lock at once, any other window must stay in front for the debounce, and one odd sample never
 * hides it. A lock that is no longer active hides at once.
 */
object LockWatch {
  enum class Action { KEEP, HIDE, SAFETY_HIDE }

  fun decide(lockActive: Boolean, verdict: BadgeForeground.Verdict): Action = when {
    verdict == BadgeForeground.Verdict.HIDE_NOW -> Action.SAFETY_HIDE
    !lockActive -> Action.HIDE
    verdict == BadgeForeground.Verdict.HIDE -> Action.HIDE
    else -> Action.KEEP
  }
}
