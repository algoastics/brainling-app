# Thumbwell — Module-by-Module Development Plan (v1, 21 Oct 2026)

Inputs: `build-plan.md`, `feasibility-research.md`, `brainling-design/docs/handoff.md`, scope doc FINAL v1.0.
Locked decisions: Android-first, Expo SDK 58 / RN 0.88 (already scaffolded); squads (S37–S38, A22, N09, M14) and Chrome reels (S47) out of MVP; launch apps = **Instagram Reels + YouTube Shorts** (TikTok, FB/FB Lite, Snapchat, IG Lite behind remote flags in the signed ruleset); lock = native `TYPE_ACCESSIBILITY_OVERLAY` (no `SYSTEM_ALERT_WINDOW` in the normal path, **no foreground service**); all counting + locking in Kotlin; personal Play account → closed test with ≥12 testers × 14 continuous days.

Goal of this plan: **the leanest MVP that passes Play review fastest.** Every feature that adds backend, a policy declaration or review surface without helping approval moves to v1.1.

---

## 0. Key scoping calls (read first)

| Topic | Decision | Why |
|---|---|---|
| **Auth** | **Not needed for MVP.** Scope S12 is explicitly *"Account (optional) … App works without an account; Skip for now (local-only mode)"*. Auth only unlocks social (friends, duels, friend-unlock) and cloud restore. MVP ships **anonymous/local-only**; S12 is hidden from onboarding. Supabase Auth (Google + magic link) arrives in v1.1 with social. | Removes Supabase Auth, RLS, account deletion web flow and Data-safety "account" disclosures from the first review. |
| **Backend in MVP** | None beyond static hosting: signed ruleset JSON + `game_config` on a CDN/Supabase Storage public bucket, RevenueCat, Sentry, PostHog. No Postgres tables. | Zero-server MVP; nothing to pause. |
| **Social / duels / friend unlock** | v1.1 (needs auth, Realtime, FCM). | Biggest backend chunk; not required for approval. |
| **Strict lock without friends** | MVP strict lock (S45, M18) unlocks only by: end of schedule/day, or **1 emergency code per week** (scope A.5). Friend unlock (S46, M06, M07) = v1.1. | Keeps the "real lock" USP without a server. |
| **Overlay** | `TYPE_ACCESSIBILITY_OVERLAY` from the AccessibilityService. S11 (SYSTEM_ALERT_WINDOW) only as fallback after S13-fail — **recommend dropping S11 from MVP entirely** if spike shows overlay works on all 6 test phones (one less sensitive permission). | Fewer permissions = faster review. |
| **N01 persistent counter** | No FGS → no persistent FGS notification. N01 is v1.1 as an *optional* low-priority ongoing notification, off by default. | Avoids FGS-type declaration. |
| **Accessibility config** | Follow scope: `typeWindowStateChanged|typeWindowContentChanged|typeViewScrolled`, `packageNames` = flagged-on apps only, `canRetrieveWindowContent=true`, GLOBAL_ACTION_BACK/HOME only for lock fallback; no text stored. | Matches the Play Accessibility declaration. |
| **Out-of-MVP links in design** | S32→S38, S18→S47, S14→S32/S35 entry points are hidden behind remote flags (not "coming soon") in MVP. | Reviewers flag dead-end UI. |

---

## 1. Ordered module list (summary)

Days = dev-days for one dev. A = Android/Kotlin dev, B = RN dev.

| # | Module | Owner | Days | Tag |
|---|---|---|---|---|
| M0 | Foundation (tooling, Expo Router, theme/tokens, design system) | B (+A 1d) | 5 | MVP |
| M1 | Native detection engine (Kotlin core, rules, Room, bridge) | A | 10 | MVP · **critical** |
| M2 | Onboarding + permissions + prominent disclosure | B (+A 2d) | 6 | MVP · **critical** |
| M3 | Home / dashboard + stats/history | B | 5 | MVP |
| M4 | Limits + lock (native overlay, schedules, strict) | A (+B 3d) | 9 | MVP · **critical** |
| M5 | Mascot + progression (levels, XP, badges, shop) | B | 5 | MVP |
| M6 | Earn-your-reels games | B | 4 | MVP |
| M7 | Coins + streaks | A 2d + B 2d | 4 | MVP |
| M8 | Paywall + billing (RevenueCat) | B (+A 1d) | 4 | MVP |
| M9 | Notifications (local only) | A | 3 | MVP |
| M10 | Settings, privacy, help, profile | B | 4 | MVP |
| M11 | Analytics + crash + remote flags | B 1 + A 1 | 2 | MVP |
| M12 | Release + Play compliance + closed test | A+B | 6 | MVP · **critical** |
| M13 | Auth + cloud sync | A/B | 4 | **v1.1** |
| M14 | Social: friends, duels, friend unlock, report/share | A/B | 9 | **v1.1** |
| M15 | Squads + leagues; Chrome reels; extra apps GA; widget; N01 | — | ~12 | **v1.1** |

**MVP total ≈ 67 dev-days ≈ 34 days per dev ≈ 7 calendar weeks with 2 devs** (incl. ~4 days slack). Closed test starts **end of week 4 (≈ day 20)**; production application ≈ day 35–36 → target production approval in week 8.

---

## 2. Modules in detail

### M0 — Foundation (5 d, MVP)
- **Purpose:** working app shell everyone builds on.
- **Scope:** ESLint/Prettier/TS strict, Jest + RNTL, EAS Build profiles (dev/preview/prod), dev-client, `expo-router` file routes (`(onboarding)`, `(tabs)`: Home/Stats/Me, modal stack), `theme.ts` + `tokens.json` from design kit (light/dark, contrast fixes: darken `muted`, ink-on-primary <16dp lint rule), fonts, MMKV, Zustand store, i18n scaffold (EN only), design-system components C01–C10 (Button with A01 press scale 0.97, Card, Ring/Counter, Chip, Sheet, Toast, ListRow, Stepper, ProTag, EmptyState), `<Mascot>` interface with static SVG fallback (Rive swap later), app icons via `PackageManager.getApplicationIcon` (no trademark logos). Empty `modules/thumbwell-core` Expo Module + config plugin (A, 1 d).
- **IDs:** A01, S01 + S01-error.
- **Native vs JS:** JS; config plugin + module skeleton native.
- **Deps:** none.
- **DoD:** `eas build --profile preview` APK installs; router navigates all tab stubs; Storybook/preview screen renders all C01–C10 in light/dark at 1.3× font; CI lint+tests green.
- **Security DoD:** gitleaks pre-commit + CI; `.gitignore` for keys/env; EAS env/secrets per profile; pinned deps + lockfile + `npm ci`; `npm audit` gate; Dependabot on; MMKV encrypted with Keystore key; release build R8 on, not debuggable, cleartext off, network security config.

### M1 — Native detection engine (10 d, MVP, critical path)
- **Purpose:** count reels in IG Reels + YT Shorts with the RN app dead.
- **Scope (Kotlin):** `ThumbwellAccessibilityService`; `RuleEngine` (signed JSON, Ed25519, bundled default; surface detection + new-item detection, 800 ms dwell, 20-fingerprint salted de-dupe, YT autoplay counts, DM reels excluded); per-app **remote flags** in ruleset (`ig`,`yt` on; `tiktok`,`fb`,`fb_lite`,`ig_lite`,`snap` off); `RulesManager` (WorkManager 6 h + on open, keep last good); Room DB (events, daily aggregates, budget, settings mirror); `HealthMonitor` (WorkManager 15 min heartbeat → state for M01/M23/N04); miss detector → M17; Expo Module bridge (`getToday()`, `subscribe(countEvents)`, `setBudget()`, `getHealth()`, `openA11ySettings()`, self-test hook); debug overlay/node dumper (debug builds only).
- **IDs:** feeds S13, S14, M01, M17, M23, N04, N12.
- **Native vs JS:** 100% native; JS only consumes events.
- **Deps:** M0 module skeleton. Day 1–3 = spike/go-no-go on 6 phones (Pixel, Samsung A + S, Xiaomi, Oppo/Realme, OnePlus).
- **DoD:** IG/YT accuracy ≥95% on 6 phones over 200-reel scripted runs; counts survive app kill, process death and reboot; battery <2 %/day; rules hot-swap verified with a bad signature rejected; unit tests on RuleEngine with recorded node trees.
- **Security DoD:** service `permission=BIND_ACCESSIBILITY_SERVICE`, other components exported=false; packageNames limited to flag-enabled apps; only needed nodes read; no screen text logged/stored/uploaded (logcat audit); Ed25519 verify before parse, tampered/rollback rulesets rejected (tests); debug dumper absent from release; Room in app-private storage, backups excluded.

### M2 — Onboarding + permissions + disclosure (6 d, MVP, critical path)
- **Purpose:** fresh install to counting in <3 min, Play-compliant.
- **Screens:** S02 (+card2, card3), S03 (+S03-empty, lists only flag-enabled apps), S04, S05 (+S05-named), **S06 (+S06-agreed) prominent disclosure exact §10.2 text, checkbox + button, before any settings deep-link**, S07 (+error, restricted, success), S08, S09, S10 (+samsung, oppo, vivo, oneplus, pixel, intentfail), S13 (+pass, fail). S11 only as S13-fail fallback (or cut, see §0). **S12 hidden (v1.1).**
- **Modals:** M15 (trial offer after S13-pass; wired once M8 lands), M22 (from S04 Pro hint).
- **Anims:** A04, A05, A06, A07 (A11y success), A09 (battery), A10 (test pass).
- **Native vs JS:** JS UI; native (A, 2 d): A11y-enabled check, restricted-settings detection, battery-optimisation intent, OEM autostart intents with fallback, S13 live self-test.
- **Deps:** M0, M1 bridge.
- **DoD:** disclosure shown before settings on every path (incl. re-enable from S14-off); all 6 OEM guides open the right page or S10-intentfail; S13 passes on 6 phones; screen-recorded walkthrough usable as Play declaration video.
- **Security DoD:** disclosure precedes every settings deep-link; only the permissions listed in §0 requested; OEM intents resolved safely (no implicit intents to untrusted handlers); no PII collected in quiz/name (stored locally only).

### M3 — Home / dashboard + stats (5 d, MVP)
- **Screens:** S14 (+pro, pro-locked, empty, off, fried, zombie, loading), S16 (+empty), S17 (week/month), S49 (Profile/Me, local-only), S39 *simple* weekly report (1 card, Pro) optional → if late, v1.1.
- **Modals:** M01 (counting stopped), M12 (mood toast), M17 (detection paused), M23 (OEM kill).
- **Anims:** A02 (counter tick), A03 (mood change), A11 (ring fill).
- **Native vs JS:** JS; data from M1 bridge (live events).
- **Deps:** M0, M1.
- **DoD:** counter updates <1 s after a reel; all 8 S14 variants reachable from real state; TalkBack announces count at most once per 10 reels.
- **Security DoD:** bridge is read-only for counts (JS cannot write counts); accessibility labels expose counts only, no app content.

### M4 — Limits + lock (9 d, MVP, critical path)
- **Purpose:** per-app limits and a real, fast lock.
- **Screens:** S18 (Limits, Pro), S19 (app limit detail), S20 (Schedules, Pro, 3 templates), S21 (editor), **S22 lock overlay (native, 4 variants incl. fallback)**, S45 (strict lock setup).
- **Modals:** M02 (80 % heads-up banner, native), M03 (Free soft nudge, native), M04 (unlock options, native), M18 (turn on strict, hold 2 s), M19 (schedule wind-down), M20 (honour check), M22.
- **Anims:** A08 (banner), A12, A13, A14 (lock slam), A15 (strict hold).
- **Native vs JS:** S22/M02/M03/M04 = native Kotlin Views via `TYPE_ACCESSIBILITY_OVERLAY` (fixed dark-violet, theme-independent); LimitEngine, ScheduleEngine (AlarmManager exact-not-required windows), StrictState + weekly emergency code all in Kotlin/Room. Settings screens JS (B, 3 d).
- **Deps:** M1; M8 entitlement for Pro gating (stub `isPro` until then).
- **DoD:** lock appears <500 ms after limit reel on 6 phones; always offers "Leave reels" (GLOBAL_ACTION_BACK/HOME fallback); Free never hard-locks (M03 only); strict lock survives app kill/reboot/clear-from-recents; emergency code 1/week enforced.
- **Security DoD:** lock/strict state only writable in Kotlin; bridge validates intents (cannot clear strict lock from JS/deep link); emergency code generated and rate-limited natively; overlay always has exit; no SYSTEM_ALERT_WINDOW unless fallback kept.

### M5 — Mascot + progression (5 d, MVP)
- **Screens:** S15 (+S15-zombie), S30 (Level & XP), S31 (Badges), S42 (Shop, 12 cosmetics, coins only).
- **Modals:** M10 (level up), M11 (badge earned).
- **Anims:** A03, A18 (level up), A19 (badge), A25 (poke) + mascot state machine (states per `stateForHealth`, Sleeping/Recovering overrides, Ghost when service off).
- **Native vs JS:** JS rendering (Rive when delivered, SVG fallback); XP/badge award logic in Kotlin (Room) so it accrues with app closed.
- **Deps:** M0, M3; Rive rig (freelancer, by end of week 3) — non-blocking thanks to fallback.
- **DoD:** mascot state matches health formula in unit tests; level/badge awards idempotent; works with static fallback.
- **Security DoD:** XP/badges/cosmetic purchases written natively with validation; shop spends via `spendCoins` intent, not raw balance writes.

### M6 — Earn-your-reels games (4 d, MVP)
- **Screens:** S23 (hub, + Free demo), S24 Quick Puzzle, S25 Focus Tap, S26 Breathe, S27 Push-ups (honour).
- **Modals:** M20 (honour check), M05 (spend coins?).
- **Anims:** A26 (breathe), A16.
- **Native vs JS:** JS games; grant of extra reels written to native LimitEngine (daily cap from `game_config`).
- **Deps:** M4, M7.
- **DoD:** each game grants exactly the configured reels, capped/day; can be launched from M04 over the lock and returns to lock state correctly.
- **Security DoD:** reel grants capped natively per `game_config` (signed); game results cannot exceed daily cap even if JS is tampered.

### M7 — Coins + streaks (4 d, MVP)
- **Screens:** S28 (Coins & scroll budget), S29 (Streak).
- **Modals:** M05, M08 (streak saved), M09 (streak broken).
- **Anims:** A16 (coin spend), A17 (streak flame).
- **Native vs JS:** wallet, day-close job (midnight local, DST-safe), streak & freezes in Kotlin/Room (A, 2 d); UI JS (B, 2 d). Earned-only coins, no cash value, no IAP for coins.
- **Deps:** M1, M4.
- **DoD:** day-close runs with app dead; timezone change and reboot tests pass; coins never purchasable.
- **Security DoD:** wallet/streak authoritative in Room; earned-only, no cash value, no IAP; clock-change abuse handled (monotonic elapsed time + day-close checks). v1.1: server-authoritative for anything shown to friends + Play Integrity.

### M8 — Paywall + billing (4 d, MVP)
- **Screens:** S41 (+compare/success/error).
- **Modals:** M15 (trial), M22 (soft paywall), M24 (trial ends tomorrow).
- **Anims:** A24.
- **Native vs JS:** RevenueCat RN SDK (JS); entitlement `pro` mirrored into Room so native lock respects Pro offline (A, 1 d).
- **Deps:** M0; Play Console products (needs the app created in M12 early).
- **DoD:** licence-tester purchase, restore, cancel and expiry all flip native Pro gating; clear trial terms/price on S41 (subscriptions policy).
- **Security DoD:** only RevenueCat public key in app; entitlement cached locally for offline lock only; RevenueCat webhook → server is source of truth for any server-side Pro feature (v1.1); no receipts logged.

### M9 — Notifications (3 d, MVP)
- **MVP IDs:** N02 (80 %), N03 (budget reached), N04 (counting stopped), N05 (day won), N06 (weekly report, local), N10 (schedule wind-down), N11 (trial ending), N12 (rules updated). **v1.1:** N01 (optional ongoing), N07 (duels), N08 (friend unlock), N09 (squads).
- **Native vs JS:** all local, posted from Kotlin (service/WorkManager); one channel per type; quiet hours = bedtime; ≤4 non-social/day. No FCM in MVP.
- **Deps:** M1, M4, M7.
- **DoD:** POST_NOTIFICATIONS denial handled; caps and quiet hours unit-tested; each notification deep-links to the right Expo Router route.
- **Security DoD:** notification payloads contain no app content; PendingIntents FLAG_IMMUTABLE and explicit; deep links from notifications go through the route allowlist.

### M10 — Settings, privacy, help, profile (4 d, MVP)
- **Screens:** S43 (Settings), S44 (Privacy & data center), S48 (Help & troubleshoot, OEM guides reuse), S49 polish.
- **Modals:** M16 (in-app review, after ≥3 green days), M21 (delete data — local wipe; type DELETE).
- **Native vs JS:** JS; native wipe of Room + rules cache.
- **Deps:** M0–M4.
- **DoD:** export/delete works offline; privacy text matches Data safety form; "disable counting" path explains how to turn off the service.
- **Security DoD:** M21 wipes Room, MMKV, SecureStore, rules cache; export contains only user's own data; privacy text = Data safety form; deep links validated against allowlist and never trigger destructive actions.

### M11 — Analytics, crash, remote flags (2 d, MVP)
- PostHog (anonymous device id, no content), Sentry (RN + native), remote flags from signed ruleset/`game_config` (per-app enable, hide social/squads/Chrome entry points). Events per scope §16 (onboarding funnel, a11y_enabled, self_test_pass, lock_shown, unlock_type, paywall_view, trial_start, rule_miss opt-in).
- **DoD:** funnel dashboard live before closed test; flags flip TikTok on for a test device without a Play update.
- **Security DoD:** Sentry `sendDefaultPii=false` + `beforeSend` scrubber; PostHog anonymous id, autocapture of inputs off; release strips debug logs; payload inspection test.

### M12 — Release + Play compliance + closed test (6 d, MVP, critical path)
- App created in Play Console week 1 (needed for billing products); privacy policy at getbrainling.app; Accessibility API declaration + demo video (from M2 recording); Data safety (on-device counts, analytics, crash; no account); content rating; target API level; store listing + screenshots (runtime app icons only); internal track → **closed test track**; recruit **15–20 testers** (buffer over 12 — opt-outs reset the clock); production-access questionnaire; staged rollout plan.
- **DoD:** closed test ≥12 opted-in testers for 14 continuous days, crash-free ≥99.5 %, production access granted.
- **Security DoD:** full pre-release checklist in SECURITY.md §12 (MASVS-L1) signed off; Play App Signing; Data safety + A11y declaration match the build; apktool secret scan clean.

### v1.1 modules
- **M13 Auth + sync (4 d):** Security DoD: tokens in SecureStore, RLS on every table with deny tests, service key only in Edge Functions, server + auth deletion flow.
  - Scope: S12 (+S12-offline), Supabase Auth (Google, magic link), profiles/devices/daily_totals tables with RLS, account deletion web URL.
- **M14 Social (9 d):** Security DoD: duel scores/friend unlock server-authoritative, Play Integrity verified server-side, Edge Function input validation + rate limits, invite-code deep links validated.
  - Scope: S32–S36, S46 friend unlock, M06, M07, M13, N07, N08, A20, A21, A27, FCM via Edge Functions, Realtime; S39 full 5-card report + S40 share templates (A23).
- **M15 (~12 d):** S37–S38 squads + leagues (M14 check-in, N09, A22), S47 Chrome reels, GA of TikTok/FB/Snap/IG Lite after accuracy checks, home widget, N01 optional, DE/FR/ES/NL.

---

## 3. Order, critical path and 2-dev parallel plan

**Critical path:** M0 skeleton (1 d) → **M1 detection (10 d)** → **M4 lock native (6 d)** → M12 closed-test build → **14-day closed test** → production questionnaire → review.
Everything RN-side runs in parallel off the bridge contract (mock `thumbwell-core` in JS from day 2).

| Week | Dev A (Android/Kotlin) | Dev B (React Native) |
|---|---|---|
| 1 | M0 module skeleton; **M1 spike + go/no-go** (IG/YT ≥95 %, overlay on 5/6 phones) | M0 foundation; Play Console app + RevenueCat/Sentry/PostHog projects |
| 2 | M1 engine, rules, Room, bridge, HealthMonitor | M2 onboarding UI (S02–S10, S13) on mocked bridge |
| 3 | M2 native bits (2 d); M4 native lock/overlay | M3 home/stats; M2 wiring to real bridge |
| 4 | M4 limits/schedules/strict; M7 wallet/streak core; **closed-test build #1 → start 14-day clock (≈ day 20)** | M4 JS screens; M8 paywall; M11 analytics/flags; M12 listing/declarations draft |
| 5 | M9 notifications; M8 native entitlement; fixes from testers | M5 mascot/progression; M7 UI |
| 6 | Perf/battery, OEM device pass, rule fixes | M6 games; M10 settings/privacy/help |
| 7 | Hardening, crash fixes; final closed-test build | Accessibility of own UI (TalkBack, 1.3×, reduce motion); **apply for production (≈ day 35)** |
| 8 | Production review buffer → staged rollout | v1.1 prep (M13) |

**Closed test start:** as soon as the build contains M1 + M2 (with S06 disclosure) + M3 + M4 core lock — end of week 4. Testers stay opted in while later modules ship as closed-test updates (updates do not reset the clock; opt-outs do). Starting earlier is pointless because the production questionnaire asks about tester feedback on the real app.

**Parallel-safe pairs:** M2-UI ∥ M1; M3 ∥ M4-native; M5/M6 ∥ M9; M8 ∥ M7-native; M12 paperwork ∥ everything from week 1.

## 4. Risks to the critical path
1. M1 go/no-go fails on an OEM → ship with that OEM marked "beta" via flag, do not slip.
2. Accessibility declaration rejection → video and S06 text are the fix; keep `packageNames` minimal (IG + YT only at launch, flags extend the list via ruleset update + service reconfig).
3. Tester churn → recruit 15–20 on day 1 of the closed test.
4. Rive late → static SVG mascot ships; swap in a later update.

## 5. Security
Baseline MASVS-L1; full policy and pre-release checklist in `SECURITY.md` (→ repo `docs/SECURITY.md`). Each module above carries a Security DoD line. M12 adds ~1 d for the security review (included in its 6 d).
