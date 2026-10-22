import { describe, expect, it } from '@jest/globals';

import {
  BUDGET,
  budgetMascotState,
  budgetMinutes,
  checkName,
  evaluateSelfTest,
  guessMascotState,
  nameLength,
  ONBOARDING_ROUTES,
  reelsSince,
  routeAfterDisclosure,
  snap,
  stepBudget,
} from '../flow';

describe('routeAfterDisclosure', () => {
  it('shows the restricted-settings guide first on Android 13+', () => {
    expect(routeAfterDisclosure('android', 33)).toBe(ONBOARDING_ROUTES.restricted);
    expect(routeAfterDisclosure('android', 35)).toBe(ONBOARDING_ROUTES.restricted);
  });

  it('goes straight to the accessibility guide on older Android', () => {
    expect(routeAfterDisclosure('android', 32)).toBe(ONBOARDING_ROUTES.accessibility);
    expect(routeAfterDisclosure('android', 28)).toBe(ONBOARDING_ROUTES.accessibility);
  });

  it('never routes to a settings screen other than the two S07 guides', () => {
    const allowed: string[] = [ONBOARDING_ROUTES.restricted, ONBOARDING_ROUTES.accessibility];
    for (const v of [26, 30, 33, 36]) expect(allowed).toContain(routeAfterDisclosure('android', v));
  });
});

describe('budget', () => {
  it('steps by 10 within 10–300', () => {
    expect(stepBudget(60, 1)).toBe(70);
    expect(stepBudget(60, -1)).toBe(50);
    expect(stepBudget(BUDGET.min, -1)).toBe(BUDGET.min);
    expect(stepBudget(BUDGET.max, 1)).toBe(BUDGET.max);
  });

  it('snaps and clamps arbitrary values', () => {
    expect(snap(64, 0, 500, 10)).toBe(60);
    expect(snap(-20, 0, 500, 10)).toBe(0);
    expect(snap(9999, 0, 500, 10)).toBe(500);
  });

  it('estimates minutes like the kit (60 reels ≈ 25 min)', () => {
    expect(budgetMinutes(60)).toBe(25);
    expect(budgetMinutes(10)).toBe(4);
  });

  it('previews a happier mascot for smaller budgets', () => {
    expect(budgetMascotState(20)).toBe('glowing');
    expect(budgetMascotState(60)).toBe('happy');
    expect(budgetMascotState(120)).toBe('meh');
    expect(budgetMascotState(200)).toBe('fried');
    expect(budgetMascotState(300)).toBe('zombie');
  });

  it('shows the kit mascot for the default quiz guess', () => {
    expect(guessMascotState(200)).toBe('meh');
    expect(guessMascotState(0)).toBe('glowing');
    expect(guessMascotState(500)).toBe('zombie');
  });
});

describe('mascot name', () => {
  it('accepts 2–14 characters', () => {
    expect(checkName('Bean')).toBe('ok');
    expect(checkName('B')).toBe('tooShort');
    expect(checkName('   ')).toBe('tooShort');
    expect(checkName('abcdefghijklmno')).toBe('tooLong');
  });

  it('counts an emoji as one character', () => {
    expect(nameLength('🧠')).toBe(1);
    expect(nameLength('👍🏽')).toBe(1);
    expect(checkName('Bo🧠')).toBe('ok');
  });
});

describe('self-test', () => {
  const base = { date: '2026-10-21', total: 40 };

  it('counts reels since the baseline', () => {
    expect(reelsSince(base, { date: '2026-10-21', total: 43 })).toBe(3);
    expect(reelsSince(base, { date: '2026-10-21', total: 39 })).toBe(0);
  });

  it('handles the day rolling over mid-test', () => {
    expect(reelsSince(base, { date: '2026-10-22', total: 2 })).toBe(2);
  });

  it('passes at 3 reels and only fails once the user is back', () => {
    expect(evaluateSelfTest(3, false)).toBe('pass');
    expect(evaluateSelfTest(5, true)).toBe('pass');
    expect(evaluateSelfTest(2, false)).toBe('running');
    expect(evaluateSelfTest(2, true)).toBe('fail');
  });
});
