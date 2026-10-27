const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

function channels(hex: string): [number, number, number, number] | null {
  const match = HEX.exec(hex);
  if (match === null) return null;
  const rgb = match[1] as string;
  const alpha = match[2] === undefined ? 255 : parseInt(match[2], 16);
  return [
    parseInt(rgb.slice(0, 2), 16),
    parseInt(rgb.slice(2, 4), 16),
    parseInt(rgb.slice(4, 6), 16),
    alpha,
  ];
}

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0').toUpperCase();
}

/** Linear mix of two `#RRGGBB` or `#RRGGBBAA` colours; `t` 0 gives `from`, 1 gives `to`. */
export function mixColors(from: string, to: string, t: number): string {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const a = channels(from);
  const b = channels(to);
  if (a === null || b === null) return t < 0.5 ? from : to;
  const mixed = a.map((value, i) => value + ((b[i] as number) - value) * t);
  const [r, g, bl, alpha] = mixed as [number, number, number, number];
  const base = `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
  return alpha >= 255 && (a[3] as number) === 255 && (b[3] as number) === 255
    ? base
    : `${base}${toHex(alpha)}`;
}

/** Mixes every colour token of two sets (A61: all tokens swap together). */
export function mixTokenSets<T extends Record<string, string>>(from: T, to: T, t: number): T {
  const out = {} as Record<string, string>;
  for (const key of Object.keys(to)) {
    out[key] = mixColors(from[key] as string, to[key] as string, t);
  }
  return out as T;
}
