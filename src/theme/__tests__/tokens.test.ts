import { describe, expect, it } from '@jest/globals';
import { darkColors, lightColors, maxFontScale, sizes, spacing, tracking, type } from '../tokens';

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
  ] as const)('%s: text tokens reach AA (4.5:1) on bg and surfaces', (_, c) => {
    for (const fg of [c.textPrimary, c.textSecondary, c.textMuted]) {
      for (const bg of [c.bgScreen, c.bgSurface, c.bgSurface2]) {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the primary colour readable on light backgrounds', () => {
    expect(contrast(lightColors.brandPrimary, lightColors.bgScreen)).toBeGreaterThanOrEqual(4.5);
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

describe('Figma foundations added in the design pass', () => {
  it('carries the raised, overlay, scrim and glow colours in both modes', () => {
    expect(lightColors.bgSurfaceRaised).toBe('#FFFFFF');
    expect(darkColors.bgSurfaceRaised).toBe('#2B2459');
    expect(lightColors.bgOverlay).toBe('#FFFFFF');
    expect(darkColors.bgOverlay).toBe('#241E42');
    expect(lightColors.overlayScrim).toBe('#2A1C7A80');
    expect(darkColors.overlayScrim).toBe('#000000A0');
    expect(lightColors.glowHeroStart).toBe('#6B4EFF33');
    expect(darkColors.glowHeroEnd).toBe('#8C75FF00');
  });

  it('follows the v1.4 type scale and caps font scaling', () => {
    expect(type.h1).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(type.h3).toMatchObject({ fontSize: 17, lineHeight: 24 });
    expect(type.body).toMatchObject({ fontSize: 14, lineHeight: 20 });
    expect(type.button).toMatchObject({ fontSize: 15, letterSpacing: 0.5 });
    expect(maxFontScale.h1).toBe(1.2);
    expect(maxFontScale.body).toBe(1.3);
  });

  it('converts Figma tracking percent to dp', () => {
    expect(tracking(-3, 96)).toBe(-2.88);
    expect(type.counterL.letterSpacing).toBe(-1.5);
    expect(type.overline.letterSpacing).toBe(0.88);
    expect(type.h2).not.toHaveProperty('letterSpacing');
  });

  it('uses a 16 dp screen margin and a 64 dp floating tab bar', () => {
    expect(spacing.screenMargin).toBe(16);
    expect(sizes.tabBarHeight).toBe(64);
    expect(sizes.rowHeight).toBe(56);
    expect(sizes.grabberWidth).toBe(36);
    expect(type.counterM.fontSize).toBe(32);
  });
});
