import { motion } from '@/theme';

export type OdometerSlot = {
  /** 0 is the ones place, 1 the tens place, and so on (digits roll right to left). */
  place: number;
  digit: string;
  /** The digit this slot showed before the change, or null when the slot is new or unchanged. */
  from: string | null;
  /** +1 rolls up (the old digit leaves upwards), -1 rolls down. */
  direction: 1 | -1;
  /** Delay before this slot starts rolling, in ms (30 ms per place). */
  delay: number;
};

function toDigits(value: number): string {
  return String(Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
}

/**
 * Plans the odometer roll from `prev` to `next` (Figma OdometerNumber, A40c). Digits are matched
 * by place from the right, so 99 to 100 rolls the ones and tens and fades a new hundreds slot in.
 * Slots whose digit is unchanged do not move. A null `prev` means the first render: nothing rolls.
 */
export function odometerSlots(prev: number | null, next: number): OdometerSlot[] {
  const nextDigits = toDigits(next);
  const prevDigits = prev === null ? null : toDigits(prev);
  const direction = prev !== null && next < prev ? -1 : 1;
  return nextDigits.split('').map((digit, index) => {
    const place = nextDigits.length - 1 - index;
    const before = prevDigits ? (prevDigits[prevDigits.length - 1 - place] ?? null) : null;
    return {
      place,
      digit,
      from: before !== null && before !== digit ? before : null,
      direction,
      delay: place * motion.duration.digitPlace,
    };
  });
}

/** Width of one tabular digit cell (Figma): 44 dp at 64 dp type, 32 at 48, 24 at 32. */
export function odometerCellWidth(fontSize: number): number {
  if (fontSize === 48) return 32;
  if (fontSize === 32) return 24;
  return Math.round(fontSize * 0.6875);
}
