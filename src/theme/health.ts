/** Health formula (scope §3.1). `budget` includes earned top-ups. */
export function health(reels: number, budget: number): number {
  if (budget <= 0) return reels > 0 ? 0 : 100;
  const ratio = reels / budget;
  return ratio <= 1 ? 100 - Math.round(90 * ratio) : Math.max(0, 10 - 2 * (reels - budget));
}
