package com.algoastics.thumbwell.core.data

import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.Base64
import java.io.ByteArrayOutputStream

/**
 * Loads an installed app's own launcher icon at runtime (never bundled, never altered). Only the
 * packages Thumbwell supports can be asked for, so JS cannot enumerate the installed apps.
 */
object AppIcons {
  /** Supported package names, including the regional TikTok build. Keep in sync with the manifest `queries`. */
  val ALLOWED: Set<String> = setOf(
    "com.instagram.android",
    "com.google.android.youtube",
    "com.zhiliaoapp.musically",
    "com.ss.android.ugc.trill",
  )

  const val MIN_SIZE_PX = 32
  const val MAX_SIZE_PX = 512

  fun allowed(packageName: String): Boolean = packageName in ALLOWED

  fun clampSize(sizePx: Int): Int = sizePx.coerceIn(MIN_SIZE_PX, MAX_SIZE_PX)

  /** Base64 PNG of the launcher icon, or null when the app is not installed or not allowed. */
  fun pngBase64(pm: PackageManager, packageName: String, sizePx: Int): String? {
    if (!allowed(packageName)) return null
    return try {
      val drawable = pm.getApplicationIcon(packageName)
      val size = clampSize(sizePx)
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      drawable.setBounds(0, 0, size, size)
      drawable.draw(canvas)
      val out = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
      bitmap.recycle()
      Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    } catch (e: PackageManager.NameNotFoundException) {
      null
    } catch (e: RuntimeException) {
      null
    }
  }
}
