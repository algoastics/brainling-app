import { describe, expect, it } from '@jest/globals';
import { darkColors, lightColors, type } from '../tokens';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('color tokens', () => {
  it('defines the same semantic keys for light and dark', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('%s: ink, ink2 and muted reach AA (4.5:1) on bg and surfaces', (_, c) => {
    for (const fg of [c.ink, c.ink2, c.muted]) {
      for (const bg of [c.bg, c.surface, c.surface2]) {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the primary colour readable on light backgrounds', () => {
    expect(contrast(lightColors.primary, lightColors.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Thumbwell semantic tokens (Figma 02 Foundations)', () => {
  it('uses the violet brand in both modes', () => {
    expect(lightColors.brandPrimary).toBe('#6B4EFF');
    expect(darkColors.brandPrimary).toBe('#6B4EFF');
    expect(lightColors.bgScreen).toBe('#F4F1FF');
    expect(darkColors.bgScreen).toBe('#0E0B1F');
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('%s: text tokens reach AA on screen, surface and soft fills', (_, c) => {
    for (const fg of [c.textPrimary, c.textSecondary, c.textMuted]) {
      for (const bg of [c.bgScreen, c.bgSurface, c.bgSurface2]) {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(c.brandOnPrimary, c.brandPrimary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.brandAccentText, c.bgPrimarySoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('types headings and numbers in Nunito and text in Inter', () => {
    expect(type.counterXl.fontFamily).toBe('Nunito_900Black');
    expect(type.h2.fontFamily).toBe('Nunito_800ExtraBold');
    expect(type.h3.fontFamily).toBe('Nunito_700Bold');
    expect(type.body.fontFamily).toBe('Inter_400Regular');
  });
});
