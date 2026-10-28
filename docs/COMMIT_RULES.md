# Thumbwell — Commit & Branch Rules

## 1. Branches
- One branch per module: `module/<nn>-<name>`, two-digit number matching `module-plan.md`.
  `module/00-foundation`, `module/01-detection`, `module/02-onboarding`, `module/03-home`, `module/04-lock`, `module/05-mascot`, `module/06-games`, `module/07-coins`, `module/08-paywall`, `module/09-notifications`, `module/10-settings`, `module/11-analytics`, `module/12-release`, `module/13-auth`, `module/14-social`, `module/15-v11-extras`.
- `main` is always releasable and protected: no direct pushes, no force pushes, linear history (squash or rebase merge), required CI checks.
- A module merges to `main` **only when** (1) every item of its Definition of Done in `module-plan.md` is met, including its Security DoD, and (2) **Ahsan has approved the PR review**.
- Rebase on `main` before requesting review; keep branches short-lived.

## 2. Commit format — Conventional Commits
```
<type>(<scope>): <imperative summary, ≤72 chars, no period>

<body: what and why, wrapped at 100>

Refs: M<nn> [S/M/A/N IDs]
```
**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`, `security`.
Breaking change: `!` after scope plus a `BREAKING CHANGE:` footer.

**Scopes (one per module, plus shared):**

| Module | Scope |
|---|---|
| M0 | `foundation`, `theme`, `ui` |
| M1 | `detection` |
| M2 | `onboarding` |
| M3 | `home` |
| M4 | `lock` |
| M5 | `mascot` |
| M6 | `games` |
| M7 | `coins` |
| M8 | `paywall` |
| M9 | `notifications` |
| M10 | `settings` |
| M11 | `analytics` |
| M12 | `release` |
| M13 | `auth` |
| M14 | `social` |
| M15 | `v11` |
| shared | `deps`, `ci`, `security`, `docs` |

Examples:
- `feat(lock): show native lock overlay when budget is reached` — `Refs: M04 S22 A14`
- `fix(detection): ignore DM reels in Instagram ruleset` — `Refs: M01`
- `build(deps): bump react-native-mmkv to 3.2.1`

## 3. Commit content rules
- **One logical change per commit.** Don't mix a refactor with a feature, or a formatting change with a fix.
- **Every commit builds, lints and typechecks** (`npm run typecheck && npm run lint && npm test -- --findRelatedTests` and `./gradlew :thumbwell-core:assembleDebug lint` for native changes). History must be bisectable.
- **Never commit:**
  - WIP / "tmp" / "fixup" commits (squash locally before pushing)
  - debug code (`console.log`, `Log.d` outside the logging wrapper, debug overlays outside debug source sets)
  - placeholders, TODO stubs presented as finished work, lorem ipsum, fake or hard-coded demo data (test fixtures live under `__tests__/` / `src/test/` only)
  - secrets, keys, keystores, `.env*` files, `google-services.json`
  - build output (`android/app/build`, `dist/`, `.expo/`, `*.apk`, `*.aab`, `node_modules/`)
  - commented-out code
- Tests travel with the change they cover.

## 4. Enforcement
| Tool | Hook / where | Checks |
|---|---|---|
| **husky** | `pre-commit`, `commit-msg`, `pre-push` | runs the tools below |
| **lint-staged** | pre-commit | ESLint `--max-warnings 0`, Prettier, ktlint on staged files; `tsc --noEmit` |
| **gitleaks** | pre-commit (`gitleaks protect --staged`) + CI (`gitleaks detect`, full history weekly) | secrets |
| **commitlint** | commit-msg + CI on PR range | Conventional Commits, allowed types/scopes, header ≤72 |
| ESLint rules | pre-commit + CI | `no-console`, `no-warning-comments` (TODO/FIXME/WIP), `no-debugger`, `eslint-comments/no-unused-disable` |
| custom grep | pre-commit + CI | rejects commented-out code blocks, `WIP`/`fixup!` in messages on pushed branches, build artefacts |
| CI | every PR | `npm ci`, typecheck, lint, tests, `npm audit --audit-level=high`, Gradle build + lint, commitlint, gitleaks |

### Setup
```bash
npm i -D --save-exact husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
cat > .husky/pre-commit <<'H'
gitleaks protect --staged --redact -v
npx lint-staged
npm run typecheck
H
echo 'npm test -- --ci --passWithNoTests' > .husky/pre-push
```
(gitleaks is installed as a binary: `brew install gitleaks` / release download; CI uses `gitleaks/gitleaks-action`.)

**commitlint.config.js**
```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat','fix','refactor','perf','test','docs','build','ci','chore','style','revert','security']],
    'scope-enum': [2, 'always', ['foundation','theme','ui','detection','onboarding','home','lock','mascot','games','coins','paywall','notifications','settings','analytics','release','auth','social','v11','deps','ci','security','docs']],
    'scope-empty': [2, 'never'],
    'header-max-length': [2, 'always', 72],
    'subject-case': [2, 'never', ['sentence-case','start-case','pascal-case','upper-case']],
    'body-max-line-length': [2, 'always', 100],
  },
  ignores: [],
  defaultIgnores: false,
};
```

**package.json (excerpt)**
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js}": ["eslint --max-warnings 0 --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"],
    "*.kt": ["ktlint --format"]
  }
}
```

**Branch-name check (CI)**
```bash
[[ "$GITHUB_HEAD_REF" =~ ^module/(0[0-9]|1[0-5])-[a-z0-9-]+$ ]] || { echo "Branch must be module/<nn>-<name>"; exit 1; }
```

## 5. PR template — `.github/pull_request_template.md`
```markdown
## Module
M<nn> — <name>  ·  Branch: `module/<nn>-<name>`

## What this PR does
<!-- short summary; list screen/modal/anim/notification IDs -->
IDs: S__ · M__ · A__ · N__

## Definition of Done (from module-plan.md)
- [ ] All functional DoD items met (paste and tick each)
- [ ] Security DoD met (see SECURITY.md)
- [ ] Tested on: Pixel / Samsung / Xiaomi / Oppo-Realme / OnePlus / Vivo (as applicable)
- [ ] Light + dark, font scale 1.3×, TalkBack checked (UI changes)

## Commit hygiene
- [ ] Conventional Commits with the module scope; one logical change per commit
- [ ] Every commit builds, lints and typechecks
- [ ] No WIP, debug code, placeholders, fake data, secrets, build output or commented-out code
- [ ] Tests added/updated

## Risk & rollout
<!-- remote flags involved, migration, Play policy impact (permissions, Data safety, A11y declaration) -->

## Screenshots / recordings

## Review
- [ ] Approved by **Ahsan** (required before merge to `main`)
```

Branch protection on `main`: require PR, 1 approval from CODEOWNERS (`* @ahsan`), all CI checks green, up-to-date branch, no force push.
