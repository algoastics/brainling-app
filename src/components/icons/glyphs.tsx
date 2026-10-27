import Svg, { Path } from 'react-native-svg';

/**
 * Thumbwell's 22 pebble glyphs (Figma "Icon system"), precompiled to react-native-svg paths.
 * 48 unit grid (24 dp x 2), round caps and joins. Outline = stroke only; filled = the enclosed
 * "tint" shape also gets the tint colour. Generated from the Figma icon set, not hand-edited
 * per path.
 */
export type GlyphProps = {
  size: number;
  /** Stroke colour. */
  color: string;
  /** Tint colour for the enclosed shape; used when `filled`. */
  tint: string;
  filled: boolean;
  /** Stroke width in 24 dp units (the Figma set uses 2). */
  strokeWidth: number;
};

function Frame({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      {children}
    </Svg>
  );
}

function stroke(p: GlyphProps) {
  return {
    stroke: p.color,
    strokeWidth: p.strokeWidth * 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** Tint fill softens to 28 % when it would equal the stroke colour (dark theme) so it stays a tint. */
function tintFill(p: GlyphProps) {
  if (!p.filled) return { fill: 'none' };
  return p.tint === p.color ? { fill: p.tint, fillOpacity: 0.28 } : { fill: p.tint };
}

export function BackGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path d="M39 24H11" {...stroke(p)} />
      <Path d="M23 11C19 16 15 20 10 24C15 28 19 32 23 37" {...stroke(p)} />
    </Frame>
  );
}

export function ChevronRightGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M18 10C23.6 16 27.6 20 31.6 24L31.6 24L31.6 24C27.6 28 23.6 32 18 38"
        {...stroke(p)}
      />
    </Frame>
  );
}

export function CloseGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path d="M13 13L35 35" {...stroke(p)} />
      <Path d="M35 13L13 35" {...stroke(p)} />
    </Frame>
  );
}

export function CheckGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path d="M9 25.6C13.2 29.2 16.6 32.6 19.2 36.6C24.4 25.2 31.2 16 39 11.2" {...stroke(p)} />
    </Frame>
  );
}

export function HomeGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M7 22L20.6 8.8C22.6 6.8 25.4 6.8 27.4 8.8L41 22V35C41 38.4 38.4 41 35 41H13C9.6 41 7 38.4 7 35V22Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M24 31.2V31.24" {...stroke(p)} />
    </Frame>
  );
}

export function ChartGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M23 7H25C33.84 7 41 14.16 41 23V33C41 37.42 37.42 41 33 41H15C10.58 41 7 37.42 7 33V23C7 14.16 14.16 7 23 7Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M16 33V29" {...stroke(p)} />
      <Path d="M24 33V23" {...stroke(p)} />
      <Path d="M32 33V17" {...stroke(p)} />
    </Frame>
  );
}

export function SlidersGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path d="M7 16H18.8" {...stroke(p)} />
      <Path d="M29.2 16H41" {...stroke(p)} />
      <Path d="M7 32H10.8" {...stroke(p)} />
      <Path d="M21.2 32H41" {...stroke(p)} />
      <Path
        d="M29.2 16C29.2 18.88 26.88 21.2 24 21.2C21.12 21.2 18.8 18.88 18.8 16C18.8 13.12 21.12 10.8 24 10.8C26.88 10.8 29.2 13.12 29.2 16Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path
        d="M21.2 32C21.2 34.88 18.88 37.2 16 37.2C13.12 37.2 10.8 34.88 10.8 32C10.8 29.12 13.12 26.8 16 26.8C18.88 26.8 21.2 29.12 21.2 32Z"
        {...stroke(p)}
      />
    </Frame>
  );
}

export function LockGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M17 21H31C35.42 21 39 24.58 39 29V35C39 38.32 36.32 41 33 41H15C11.68 41 9 38.32 9 35V29C9 24.58 12.58 21 17 21Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M16 21V16C16 11.6 19.6 8 24 8C28.4 8 32 11.6 32 16V21" {...stroke(p)} />
      <Path d="M24 29.2V32.8" {...stroke(p)} />
    </Frame>
  );
}

export function ShieldGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M24 7C28.8 10.2 34 11.4 39 11.4V22.4C39 31.2 33.2 37.8 24 41.4C14.8 37.8 9 31.2 9 22.4V11.4C14 11.4 19.2 10.2 24 7Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M18 24C19.6 25.4 21 27 22 28.8C23.8 24.8 26.4 21.6 30 19.2" {...stroke(p)} />
    </Frame>
  );
}

export function InfoGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M41 24C41 33.38 33.38 41 24 41C14.62 41 7 33.38 7 24C7 14.62 14.62 7 24 7C33.38 7 41 14.62 41 24Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M24 15.8V15.84" {...stroke(p)} />
      <Path d="M24 22.4V32.4" {...stroke(p)} />
    </Frame>
  );
}

export function BellGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M24 10C17.6 10 13.6 15.2 13.6 21.6V26.4C13.6 29.4 12.4 31.6 10.4 34C10 34.6 10.4 35.6 11.2 35.6H36.8C37.6 35.6 38 34.6 37.6 34C35.6 31.6 34.4 29.4 34.4 26.4V21.6C34.4 15.2 30.4 10 24 10Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M24 6.4V10" {...stroke(p)} />
      <Path d="M19.6 40.8C20.8 43 27.2 43 28.4 40.8" {...stroke(p)} />
    </Frame>
  );
}

export function AccessibilityGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M41.6 24C41.6 33.72 33.72 41.6 24 41.6C14.28 41.6 6.4 33.72 6.4 24C6.4 14.28 14.28 6.4 24 6.4C33.72 6.4 41.6 14.28 41.6 24Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M24 15.2V15.24" {...stroke(p)} />
      <Path d="M15.2 21.6C20.4 23.2 27.6 23.2 32.8 21.6" {...stroke(p)} />
      <Path d="M24 22.8V28.4" {...stroke(p)} />
      <Path d="M24 28.4L20 34.8" {...stroke(p)} />
      <Path d="M24 28.4L28 34.8" {...stroke(p)} />
    </Frame>
  );
}

export function ExternalGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M21 11H16C12.2 11 9 14.2 9 18V32C9 35.8 12.2 39 16 39H30C33.8 39 37 35.8 37 32V27"
        {...stroke(p)}
      />
      <Path d="M27 9H39V21" {...stroke(p)} />
      <Path d="M39 9L23 25" {...stroke(p)} />
    </Frame>
  );
}

export function PlusGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path d="M24 11V37" {...stroke(p)} />
      <Path d="M11 24H37" {...stroke(p)} />
    </Frame>
  );
}

export function MinusGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path d="M11 24H37" {...stroke(p)} />
    </Frame>
  );
}

export function TrashGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path d="M9 14H39" {...stroke(p)} />
      <Path d="M19 14V11.6C19 9.8 20.4 9 22 9H26C27.6 9 29 9.8 29 11.6V14" {...stroke(p)} />
      <Path
        d="M13 14H35L33.4 36C33.2 38.8 31 41 28 41H20C17 41 14.8 38.8 14.6 36L13 14Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M20.8 22V32" {...stroke(p)} />
      <Path d="M27.2 22V32" {...stroke(p)} />
    </Frame>
  );
}

export function SparkleGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M24 7C25 16 29.2 21.8 40 24C29.2 26.2 25 32 24 41C23 32 18.8 26.2 8 24C18.8 21.8 23 16 24 7Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M38 10V10.04" {...stroke(p)} />
    </Frame>
  );
}

export function BadgeGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M17 13H31C37.08 13 42 17.92 42 24V28C42 31.86 38.86 35 35 35H13C9.14 35 6 31.86 6 28V24C6 17.92 10.92 13 17 13Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M16 24V24.04" {...stroke(p)} />
      <Path d="M25.6 24H33.2" {...stroke(p)} />
    </Frame>
  );
}

export function TimerGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M39.6 27C39.6 35.62 32.62 42.6 24 42.6C15.38 42.6 8.4 35.62 8.4 27C8.4 18.38 15.38 11.4 24 11.4C32.62 11.4 39.6 18.38 39.6 27Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M20 7.2H28" {...stroke(p)} />
      <Path d="M24 7.2V11.4" {...stroke(p)} />
      <Path d="M24 27V19.6" {...stroke(p)} />
      <Path d="M36.8 14.8L39.4 12.2" {...stroke(p)} />
    </Frame>
  );
}

export function MoonGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M40.6 29.2C38.4 30.2 35.8 30.8 33.2 30.8C24 30.8 16.8 23.6 16.8 14.4C16.8 11.8 17.4 9.4 18.4 7.2C11.4 10.2 7 16.8 7 24.6C7 34.8 15.2 43 25.4 43C33.8 43 40.6 36.6 40.6 29.2Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M35.6 11.6V11.64" {...stroke(p)} />
    </Frame>
  );
}

export function EyeOffGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M6 24C10 16 16.4 12 24 12C31.6 12 38 16 42 24C38 32 31.6 36 24 36C16.4 36 10 32 6 24Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path
        d="M28.8 24C28.8 26.66 26.66 28.8 24 28.8C21.34 28.8 19.2 26.66 19.2 24C19.2 21.34 21.34 19.2 24 19.2C26.66 19.2 28.8 21.34 28.8 24Z"
        {...stroke(p)}
      />
      <Path d="M9 9L39 39" {...stroke(p)} />
    </Frame>
  );
}

export function ContrastGlyph(p: GlyphProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M41 24C41 33.38 33.38 41 24 41C14.62 41 7 33.38 7 24C7 14.62 14.62 7 24 7C33.38 7 41 14.62 41 24Z"
        {...tintFill(p)}
        {...stroke(p)}
      />
      <Path d="M24 7C33.4 7 41 14.6 41 24C41 33.4 33.4 41 24 41V7Z" fill={p.color} {...stroke(p)} />
    </Frame>
  );
}
