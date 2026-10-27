package com.algoastics.thumbwell.core.rules

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.bouncycastle.util.encoders.Base64
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.security.SecureRandom

class RulesVerifierTest {
  private val sourceText = File("../rules/rules.json").readText()
  private val testKey = Ed25519PrivateKeyParameters(SecureRandom())
  private val verifier = RulesVerifier(mapOf("test" to testKey.generatePublicKey().encoded))

  private fun envelope(payload: String, keyId: String = "test", key: Ed25519PrivateKeyParameters = testKey): String {
    val bytes = payload.toByteArray(Charsets.UTF_8)
    val signer = Ed25519Signer().apply {
      init(true, key)
      update(bytes, 0, bytes.size)
    }
    return JSONObject()
      .put("alg", "Ed25519")
      .put("keyId", keyId)
      .put("payload", Base64.toBase64String(bytes))
      .put("signature", Base64.toBase64String(signer.generateSignature()))
      .toString()
  }

  private fun assertRejected(reason: RulesRejection, block: () -> Unit) {
    try {
      block()
      fail("expected $reason")
    } catch (e: RulesRejectedException) {
      assertEquals(reason, e.reason)
    }
  }

  @Test
  fun bundledSignedRulesVerifyWithTrustedKeyAndMatchSource() {
    val bundled = RulesVerifier.trusted().verify(File("src/main/assets/${RulesManager.BUNDLED_ASSET}").readText())
    assertEquals(RuleSet.parse(sourceText), bundled)
  }

  @Test
  fun acceptsCorrectlySignedRules() {
    assertEquals(RuleSet.parse(sourceText).version, verifier.verify(envelope(sourceText)).version)
  }

  @Test
  fun rejectsTamperedPayload() {
    val signed = JSONObject(envelope(sourceText))
    val tampered = sourceText.replace("\"dwellMs\": 1000", "\"dwellMs\": 100")
    signed.put("payload", Base64.toBase64String(tampered.toByteArray()))
    assertRejected(RulesRejection.BAD_SIGNATURE) { verifier.verify(signed.toString()) }
  }

  @Test
  fun rejectsSignatureFromUntrustedKey() {
    val other = Ed25519PrivateKeyParameters(SecureRandom())
    assertRejected(RulesRejection.BAD_SIGNATURE) { verifier.verify(envelope(sourceText, key = other)) }
  }

  @Test
  fun rejectsUnknownKeyId() {
    assertRejected(RulesRejection.UNKNOWN_KEY) { verifier.verify(envelope(sourceText, keyId = "nope")) }
  }

  @Test
  fun rejectsMalformedEnvelope() {
    assertRejected(RulesRejection.MALFORMED_ENVELOPE) { verifier.verify("not json") }
    assertRejected(RulesRejection.MALFORMED_ENVELOPE) {
      verifier.verify(JSONObject(envelope(sourceText)).put("alg", "RS256").toString())
    }
  }

  @Test
  fun rejectsSignedButInvalidRules() {
    assertRejected(RulesRejection.INVALID_RULES) { verifier.verify(envelope("""{"schema":2}""")) }
  }

  @Test
  fun rejectsOversizedEnvelope() {
    assertRejected(RulesRejection.TOO_LARGE) {
      verifier.verify(" ".repeat(RulesVerifier.MAX_ENVELOPE_CHARS + 1))
    }
  }

  @Test
  fun policyRejectsRollbackExpiredAndNotNewer() {
    val rules = RuleSet.parse(sourceText)
    val now = rules.issuedAtMs + 1
    assertNull(RulesPolicy.check(rules, activeVersion = 2, highestVersion = 2, nowMs = now))
    assertEquals(RulesRejection.ROLLBACK, RulesPolicy.check(rules, 2, highestVersion = rules.version + 1, nowMs = now))
    assertEquals(RulesRejection.NOT_NEWER, RulesPolicy.check(rules, activeVersion = rules.version, highestVersion = rules.version, nowMs = now))
    assertEquals(RulesRejection.EXPIRED, RulesPolicy.check(rules, 2, 2, nowMs = rules.expiresAtMs))
  }
}
