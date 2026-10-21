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
