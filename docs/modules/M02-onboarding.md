# M02 — Onboarding, permissions and disclosure

JS only; runs on the current dev-client build. Routes live in `src/app/(onboarding)/`, logic in
`src/onboarding/` (`flow.ts`, `oem.ts`, `store.ts`, `settings.ts`), strings in
`src/i18n/locales/en.json` under `onboarding.*`.

## Flow

| Screen | Route | Notes |
|---|---|---|
| S02 welcome (3 cards) | `/welcome` | Card 3 copy is neutral: duels and squads are not in the MVP. |
| S03 quiz | `/quiz` | Launch apps only (Instagram, YouTube). |
| S04 budget (+M22) | `/budget` | |
| S05 / S05-named | `/hatch` | 3 taps hatch, name 2–14 chars, colour swatch. Stored locally. |
| S06 / S06-agreed | `/disclosure` | Prominent disclosure, checkbox + "Agree & continue". "Not now" finishes onboarding with counting off. |
| S07-restricted | `/restricted` | Android 13+: App info → ⋮ → Allow restricted settings. |
| S07 / -error / -success | `/accessibility` | Opens accessibility settings; `isServiceEnabled` re-read on every foreground. Banking-app pause note. |
| S08 | `/notifications` | Primer, then the system prompt. |
| S09 | `/battery` | Opens the battery-optimisation list (fallback App info). |
| S10 (+5 makers, intentfail) | `/oem` | Detected maker first, else Samsung. Explicit components / App info only. |
| S11 | — | Cut (no `SYSTEM_ALERT_WINDOW` in the MVP; lock uses the accessibility overlay). |
| S12 | — | Hidden until v1.1 (no auth in the MVP). |
| S13 / -pass / -fail | `/setup-check` | Live self-test: 3 new reels since "Run test". Finish completes onboarding. |

`/restricted` and `/accessibility` redirect to `/disclosure` until S06 is accepted, so no
settings deep-link for the service happens without the disclosure.

## Deviations from the kit

- S06: the Chrome clause and "If you sign in, only daily totals are synced" are dropped (neither
  ships in the MVP). Re-add them when browser reels or accounts land.
- S08: duel / friend-unlock examples replaced by streak and counting-stopped examples.
- S09: no direct "Allow?" dialog; it needs `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` and a native
  rebuild.
- S10: arrow buttons + dots instead of a swipe pager.
- S13-fail: "Report my phone model" left out (no backend or consent flow yet).
- S05 colour is stored but the mascot art is pink only until M5 cosmetics.
- A06/A07/A09/A10 use Reanimated/SVG instead of Lottie (no Lottie assets yet).
- S06 "Privacy details" link is not shown yet (no S44 / hosted policy URL on this branch).

## Native calls

On this branch `isServiceEnabled`, `openAccessibilitySettings` and `getTodayCounts` are the
synchronous spike versions. M01 makes them async: on merge, `useServiceStatus` comes from M01
(same `{ enabled, refresh }` shape) and `setup-check.tsx`'s `snapshot()` must `await`
`getTodayCounts()`.
