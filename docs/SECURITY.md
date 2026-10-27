# Thumbwell — Security Baseline (docs/SECURITY.md)

Target baseline: **OWASP MASVS v2 Level 1 (MASVS-L1)** for every release. MVP is local-only/anonymous; Supabase sections apply from v1.1 (auth/social) but are listed now so the schema is born secure.

## 1. Secrets
- No keys, tokens, keystores or `.env` files in git. `.gitignore` covers `*.jks`, `*.keystore`, `.env*`, `google-services.json` (if used), `credentials.json`.
- Build-time values via **EAS environment variables/secrets** (`eas env`), per profile (dev/preview/prod). Only public-safe values get the `EXPO_PUBLIC_` prefix (RevenueCat public SDK key, PostHog project key, Supabase **anon** key, Sentry DSN).
- Upload keystore managed by EAS; Play App Signing enabled.
- Ruleset **Ed25519 private key stays offline** (hardware token/password manager), never in CI.
- **gitleaks** pre-commit hook (lefthook/husky) + gitleaks job in CI on every PR and full-history scan weekly. Any leak = rotate first, then purge.

## 2. Dependencies
- Exact pinned versions; `package-lock.json` (or `pnpm-lock.yaml`) committed; CI uses `npm ci`.
- `npm audit --audit-level=high` fails CI; Gradle deps via version catalog with dependency verification metadata.
- **Dependabot** (npm, gradle, github-actions) weekly; security updates reviewed within 7 days (critical: 48 h).
- New native deps need a review note (maintainer, permissions it adds to the merged manifest).

## 3. Backend (Supabase, v1.1+)
- **RLS enabled on every table**, default deny; policies per scope §12 (self; friends read limited columns via views).
- Least privilege: app uses the **anon key + user JWT only**. The **service_role key is never in the app or repo**; only in Edge Function secrets.
- Edge Functions validate all input (zod schema, size limits, auth check on JWT, rate limits); no raw SQL from client input.
- Storage buckets: rules/game_config read-only public; everything else private with signed URLs.

## 4. Tokens and local storage
- Auth/session tokens in **expo-secure-store** (Android Keystore-backed). Never in MMKV/AsyncStorage.
- **MMKV encrypted**, encryption key generated on first run and stored in Keystore (SecureStore).
- Room DB: app-private storage, `android:allowBackup="false"` (or backup rules excluding DB/MMKV), no external storage.

## 5. AccessibilityService hardening
- Service protected by `android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"` so only the system can bind it; set `exported="false"` wherever the platform allows (verify on target API that the system still binds); every other component `exported="false"` unless it must be launched externally (launcher activity, App Links).
- `packageNames` restricted to flag-enabled apps (IG + YT at launch); event types only `typeWindowStateChanged|typeWindowContentChanged|typeViewScrolled`.
- Read only the nodes the rule needs (view IDs, class, bounds, content-desc for matching); **never log, persist or upload screen text**; fingerprints are salted hashes kept on device.
- All counts on device (Room). Uploads (v1.1) only aggregate daily totals for opted-in social features.
- Debug node dumper compiled out of release (`BuildConfig.DEBUG` + separate source set).
- Overlay: `TYPE_ACCESSIBILITY_OVERLAY`, always shows an exit path; no gestures beyond BACK/HOME fallback.

## 6. Signed remote detection rules
- Rules = data only (JSON), signed Ed25519; public key compiled into the app; bundled default ruleset.
- Verify signature **before** parsing; reject unsigned/tampered/rollback (monotonic `version` + `expires_at`); keep last good ruleset; report failures to Sentry (no content).
- Fetch over HTTPS only.

## 7. Integrity of coins, streaks, duels, Pro
- MVP: coins/streaks are local, earned-only, no cash value, not tradeable — tampering only affects the user. Kotlin owns writes; JS cannot set balances directly (bridge exposes intents like `spendCoins(n)` validated natively).
- v1.1: anything **social or paid is server-authoritative** — duel scores, leagues, friend-unlock, streak shown to friends computed/validated by Edge Functions; **Play Integrity API** token verified server-side on score submit and sign-in.
- **Pro entitlement**: RevenueCat → **webhook** to Edge Function updates `profiles.is_pro`; server checks entitlement for any Pro-gated server feature. Client caches entitlement for offline lock only.

## 8. Build hardening
- Release: **R8/ProGuard** minify + obfuscation, `debuggable=false`, no `console.log` (babel strip), Hermes bytecode.
- `usesCleartextTraffic=false`; **network security config**: no user CAs in release, cleartext disabled for all domains.
- **Cert pinning: not in MVP** (risk of bricking on cert rotation; data is low-sensitivity, rules are signature-verified). Revisit for v1.1 Supabase domain with backup pins.
- Minimum permissions; audit merged manifest each release (no SYSTEM_ALERT_WINDOW unless S11 fallback kept; no FGS).

## 9. Deep links
- App Links for `getbrainling.app` with `assetlinks.json` (autoVerify). Custom scheme only for OAuth callback.
- Validate every route + params against an allowlist (e.g. invite code regex `^BRN-[A-Z0-9]{4}$`); deep links can never trigger unlock, purchase, data deletion or settings changes without user confirmation.

## 10. Privacy
- Data safety form matches reality (on-device counts; analytics + crash diagnostics; v1.1 account data). Review each release.
- Minimum PII: MVP collects none; v1.1 email (auth) + username only. No contacts upload.
- Deletion: in-app (M21) wipes local; v1.1 also deletes server rows + auth user via Edge Function, plus a web deletion URL (Play requirement).
- GDPR: lawful basis documented, analytics consent prompt for EU/UK, export (S44), privacy policy, DPA with processors (Supabase, RevenueCat, Sentry, PostHog).

## 11. Logging / Sentry
- Sentry `beforeSend` scrubs PII; `sendDefaultPii=false`; no breadcrumbs with node text, URLs with tokens, or emails. PostHog: anonymous id, no autocapture of text inputs.
- Kotlin logging via wrapper; `Log.v/d` stripped in release (R8 `-assumenosideeffects`).

## 12. Pre-release security review checklist
- [ ] gitleaks clean (full history); no secrets in APK (`apktool` + grep for keys)
- [ ] `npm audit` / Gradle scan: no high/critical open
- [ ] Release APK: not debuggable, minified, cleartext off, no user CAs, allowBackup off
- [ ] Merged manifest reviewed: permissions and exported components minimal
- [ ] A11y service: packageNames/events match declaration; no text logged (logcat capture during 100-reel run)
- [ ] Tampered/rolled-back ruleset rejected (test vectors)
- [ ] Deep-link fuzz: invalid params rejected, no state-changing link without confirmation
- [ ] MMKV encrypted, tokens only in SecureStore; device backup excludes data
- [ ] Sentry/PostHog payloads inspected — no PII
- [ ] Data safety form, privacy policy, deletion flow match build
- [ ] (v1.1) RLS tests per table (anon/other-user denied), service key absent from app, Edge Function input-validation tests, Play Integrity + RevenueCat webhook verified
- [ ] MASVS-L1 checklist (STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE-basic, PRIVACY) signed off by second dev
