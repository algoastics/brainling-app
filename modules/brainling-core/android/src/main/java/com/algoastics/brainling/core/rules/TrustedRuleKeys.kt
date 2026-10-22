package com.algoastics.brainling.core.rules

/**
 * Ed25519 public keys (raw 32 bytes, base64) trusted to sign detection rulesets, by key id.
 * Public keys are not secret; the matching private keys never enter the repo or CI. Rotate by
 * adding the new key, shipping an app update, then signing with it (docs/modules/M01-detection.md).
 */
object TrustedRuleKeys {
  val KEYS: Map<String, String> = mapOf(
    // Development key (M1). Replace with the offline production key before release.
    "brainling-dev-2026-10" to "rjCZCjalrU3QMmh/trq8z0l5o32hvRek6N6/+f6jEsA=",
  )
}
