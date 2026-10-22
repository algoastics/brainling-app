# EAS builds and environment variables

Project: `@algoasticssoftwarecompany/brainling` (projectId in `app.json`). Build profiles in `eas.json`:

| Profile | Output | Distribution | EAS environment | Notes |
|---|---|---|---|---|
| `development` | APK with expo-dev-client | internal | `development` | `eas build -p android --profile development` |
| `preview` | release APK | internal | `preview` | M0 DoD check: installs on a device |
| `production` | AAB | store | `production` | `autoIncrement` on the remote app version (`appVersionSource: remote`) |

## Environment variables and secrets

- Values live in **EAS environment variables**, one set per environment (`development`, `preview`,
  `production`); each build profile selects its set through `"environment"`.
- Add with `eas env:create --environment <env> --name <NAME> --value <value> --visibility <plaintext|sensitive|secret>`.
  Use `secret` for anything that must not be readable after creation (signing, API tokens used at build time).
- Only `EXPO_PUBLIC_*` variables reach the JS bundle, and anything in the bundle is public: never
  put secrets there. Server-side keys stay out of the app entirely.
- For local development pull a set with `eas env:pull --environment development`; the generated
  `.env*` files are git-ignored and gitleaks blocks committing secrets.
- Signing credentials are managed remotely by EAS (`credentialsSource: remote`); no keystore is
  ever committed.

## Variables expected per environment (names only; values live in EAS)

| Name | Environments | Visibility | Used by |
|---|---|---|---|
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | preview, production | plaintext (public SDK key) | M8 billing |
| `EXPO_PUBLIC_SENTRY_DSN` | preview, production | plaintext (DSN is public) | M11 crash reporting |
| `SENTRY_ORG`, `SENTRY_PROJECT` | production | plaintext | Sentry config plugin / source-map upload |
| `SENTRY_AUTH_TOKEN` | production | **secret** | source-map upload during EAS Build |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | preview, production | plaintext (project key, EU host) | M11 analytics |
| `BRAINLING_RULES_URL` | development, preview, production (optional) | plaintext (public URL) | M1 remote detection ruleset |

### `BRAINLING_RULES_URL` (M1 detection rules)

Read at prebuild time by the `brainling-core` config plugin (`modules/brainling-core/app.plugin.js`)
and written to the manifest as `<meta-data android:name="com.algoastics.brainling.RULES_URL">`. It
is not an `EXPO_PUBLIC_*` variable and never reaches the JS bundle.

- Must be an `https://` URL serving a signed envelope produced by `scripts/rules/sign-rules.mjs`;
  prebuild fails on any other scheme.
- Unset: no meta-data, the app uses only the bundled signed ruleset (`RulesManager` reports
  `NOT_CONFIGURED`).
- Changing it changes the native manifest, so it needs a new build, not an `eas update`.
- The URL is public; the trust comes from the Ed25519 signature, not from the URL. Signing keys are
  never stored in EAS (see `docs/modules/M01-detection.md`).

```bash
npx eas-cli@latest env:create --environment preview --name BRAINLING_RULES_URL \
  --value https://<host>/brainling/rules.signed.json --visibility plaintext
```

`development` and `preview` set `SENTRY_DISABLE_AUTO_UPLOAD=true` in `eas.json`, so those builds
never need the Sentry token.
