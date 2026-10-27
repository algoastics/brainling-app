import { describe, expect, it } from '@jest/globals';

import {
  applyLimitChange,
  classifyLimitChange,
  clampLimit,
  estimateMinutes,
  limitState,
  resolveLimit,
  stepLimit,
} from '../limitRule';

const today = '2026-10-27';
const tomorrow = '2026-10-28';

describe('daily limit rule', () => {
  it('lowering applies at once', () => {
    expect(classifyLimitChange(limitState(60), 30)).toBe('now');
    expect(applyLimitChange(limitState(60), 30, today, tomorrow)).toEqual(limitState(30));
  });

  it('raising applies from the next logical day', () => {
    expect(classifyLimitChange(limitState(60), 100)).toBe('next_day');
    expect(applyLimitChange(limitState(60), 100, today, tomorrow)).toEqual({
      effective: 60,
      pending: 100,
      pendingFromDay: tomorrow,
    });
  });

  it('promotes a pending raise on its day and not before', () => {
    const waiting = { effective: 60, pending: 100, pendingFromDay: tomorrow };
    expect(resolveLimit(waiting, today)).toEqual(waiting);
    expect(resolveLimit(waiting, tomorrow)).toEqual(limitState(100));
    expect(resolveLimit(waiting, '2026-11-01')).toEqual(limitState(100));
  });

  it('lowering below the limit drops a pending raise; returning to it cancels the raise', () => {
    const waiting = { effective: 60, pending: 100, pendingFromDay: tomorrow };
    expect(applyLimitChange(waiting, 30, today, tomorrow)).toEqual(limitState(30));
    expect(applyLimitChange(waiting, 60, today, tomorrow)).toEqual(limitState(60));
    expect(applyLimitChange(waiting, 80, today, tomorrow)).toEqual({
      effective: 60,
      pending: 80,
      pendingFromDay: tomorrow,
    });
  });

  it('an edit after the pending day starts from the promoted limit', () => {
    const waiting = { effective: 60, pending: 100, pendingFromDay: tomorrow };
    expect(applyLimitChange(waiting, 90, tomorrow, '2026-10-29')).toEqual(limitState(90));
  });

  it('steps and clamps the stepper', () => {
    expect(stepLimit(60, 1)).toBe(65);
    expect(stepLimit(60, -1)).toBe(55);
    expect(stepLimit(5, -1)).toBe(5);
    expect(stepLimit(500, 1)).toBe(500);
    expect(clampLimit(2)).toBe(5);
    expect(clampLimit(9999)).toBe(500);
  });

  it('estimates minutes at about 25 seconds a reel', () => {
    expect(estimateMinutes(60)).toBe(25);
    expect(estimateMinutes(30)).toBe(13);
    expect(estimateMinutes(100)).toBe(42);
  });
});
