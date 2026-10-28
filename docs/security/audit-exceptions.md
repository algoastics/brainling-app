# npm audit exceptions

CI runs `npm run audit:ci` (audit-ci, fails on **high** and **critical**). The advisories below are
allowlisted in `audit-ci.jsonc`. Each one must be re-checked by its review date or on every Expo SDK
upgrade, whichever comes first; delete the entry as soon as a fixed version is installable.

| Advisory | Package (installed) | Pulled in by | Severity | Why accepted | Added | Review by |
|---|---|---|---|---|---|---|
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — stack-exhaustion DoS on deeply nested patterns | `braces` 3.0.3 (latest published) | `expo` → `@expo/metro` → `metro-file-map` → `micromatch` | high | Build/dev tooling only (Metro file watching, Jest); never bundled into the app. Patterns come from our own config, not user input. No fixed release exists. | 2026-10-21 | 2026-12-21 |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) — RSA PKCS#1 v1.5 signature verification accepts extra DigestAlgorithm elements | `node-forge` 1.4.0 (latest published) | `expo` → `@expo/cli` → `@expo/code-signing-certificates` | high | Used by the Expo CLI for code-signing helpers on developer/CI machines; not in the app bundle, and Thumbwell does not use code signing in M0. No fixed release exists. | 2026-10-21 | 2026-12-21 |

`npm audit` reports ~30 high entries because every package depending on these two inherits them;
the root advisories are the two above. Moderate findings are tracked by Dependabot, not gated.
