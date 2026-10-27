package com.algoastics.thumbwell.core.rules

import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.bouncycastle.util.encoders.Base64
import org.json.JSONObject

/** Why a ruleset was not applied. Names only, never content (safe for logs and analytics). */
enum class RulesRejection {
  TOO_LARGE,
  MALFORMED_ENVELOPE,
  UNKNOWN_KEY,
  BAD_SIGNATURE,
  INVALID_RULES,
  EXPIRED,
  ROLLBACK,
  NOT_NEWER,
  INSECURE_URL,
  HTTP_ERROR,
  NETWORK_ERROR,
  STORAGE_ERROR,
}

class RulesRejectedException(val reason: RulesRejection) : Exception(reason.name)

/**
 * Verifies a signed ruleset envelope:
 * `{"alg":"Ed25519","keyId":"…","payload":"<base64 rules JSON>","signature":"<base64>"}`.
 * The signature covers the exact payload bytes and is checked before the payload is parsed.
 */
class RulesVerifier(private val trustedKeys: Map<String, ByteArray>) {
  fun verify(envelopeText: String): RuleSet {
    if (envelopeText.length > MAX_ENVELOPE_CHARS) reject(RulesRejection.TOO_LARGE)
    val envelope = try {
      JSONObject(envelopeText)
    } catch (e: Exception) {
      reject(RulesRejection.MALFORMED_ENVELOPE)
    }
    if (envelope.optString("alg") != ALG) reject(RulesRejection.MALFORMED_ENVELOPE)
    val key = trustedKeys[envelope.optString("keyId")] ?: reject(RulesRejection.UNKNOWN_KEY)
    val payload = decode(envelope.optString("payload"))
    val signature = decode(envelope.optString("signature"))
    if (payload.isEmpty()) reject(RulesRejection.MALFORMED_ENVELOPE)
    if (key.size != Ed25519PublicKeyParameters.KEY_SIZE ||
      signature.size != Ed25519PublicKeyParameters.KEY_SIZE * 2
    ) {
      reject(RulesRejection.BAD_SIGNATURE)
    }
    val verifier = Ed25519Signer()
    verifier.init(false, Ed25519PublicKeyParameters(key, 0))
    verifier.update(payload, 0, payload.size)
    if (!verifier.verifySignature(signature)) reject(RulesRejection.BAD_SIGNATURE)
    return try {
      RuleSet.parse(String(payload, Charsets.UTF_8))
    } catch (e: Exception) {
      reject(RulesRejection.INVALID_RULES)
    }
  }

  private fun decode(value: String): ByteArray {
    if (value.isEmpty()) reject(RulesRejection.MALFORMED_ENVELOPE)
    return try {
      Base64.decode(value)
    } catch (e: Exception) {
      reject(RulesRejection.MALFORMED_ENVELOPE)
    }
  }

  companion object {
    const val ALG = "Ed25519"
    const val MAX_ENVELOPE_CHARS = 256 * 1024

    fun reject(reason: RulesRejection): Nothing = throw RulesRejectedException(reason)

    /** Verifier for the public keys compiled into the app. */
    fun trusted(): RulesVerifier =
      RulesVerifier(TrustedRuleKeys.KEYS.mapValues { (_, b64) -> Base64.decode(b64) })
  }
}

/** Decides whether a verified remote ruleset may replace the active one. */
object RulesPolicy {
  /**
   * Returns null when [candidate] may be applied, else why not. [highestVersion] is the highest
   * version ever accepted on this device, so an older (rolled back) ruleset is never re-applied.
   */
  fun check(candidate: RuleSet, activeVersion: Int, highestVersion: Int, nowMs: Long): RulesRejection? =
    when {
      candidate.expiresAtMs <= nowMs -> RulesRejection.EXPIRED
      candidate.version < highestVersion -> RulesRejection.ROLLBACK
      candidate.version <= activeVersion -> RulesRejection.NOT_NEWER
      else -> null
    }
}
