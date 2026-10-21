import type { MascotState } from './tokens';

/** Health formula (scope §3.1). `budget` includes earned top-ups. */
export function health(reels: number, budget: number): number {
  if (budget <= 0) return reels > 0 ? 0 : 100;
  const ratio = reels / budget;
  return ratio <= 1 ? 100 - Math.round(90 * ratio) : Math.max(0, 10 - 2 * (reels - budget));
}

export function stateForHealth(h: number): MascotState {
  if (h >= 90) return 'glowing';
  if (h >= 70) return 'happy';
  if (h >= 45) return 'meh';
  if (h >= 10) return 'fried';
  return 'zombie';
}
