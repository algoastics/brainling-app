/**
 * Renders the Android overlay mascot PNGs (open + blink frame per mood) from the source SVGs in
 * src/components/mascot/art.ts. Not a project dependency; run with:
 *   (cd /tmp && mkdir rs && cd rs && npm i @resvg/resvg-js)
 *   NODE_PATH=/tmp/rs/node_modules node scripts/mascot/render-android-mascot.cjs
 * The viewBox is cropped tight around the art (it has ~25% empty margin in the full 200 box).
 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'modules/thumbwell-core/android/src/main/res/drawable-nodpi');
const art = fs.readFileSync(path.join(root, 'src/components/mascot/art.ts'), 'utf8');
const INK = '#22183F';
const lid = (d, w = 3.2) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;

// Overlay faces. The expression must read at a glance and progress with the count:
// glowing/happy = clear smile, round icon eyes; meh = flat mouth; fried/zombie = angry brows,
// frown or gritted teeth (fried also gets flames). Resting eyes are always open.
const ICON_EYES =
  `<circle cx="-18" cy="6" r="8" fill="${INK}"/><circle cx="18" cy="6" r="8" fill="${INK}"/>` +
  '<circle cx="-15.5" cy="3" r="2.8" fill="#fff"/><circle cx="20.5" cy="3" r="2.8" fill="#fff"/>';
const ANGRY_EYES =
  `<circle cx="-18" cy="6" r="7" fill="${INK}"/><circle cx="18" cy="6" r="7" fill="${INK}"/>` +
  '<circle cx="-15.5" cy="3.5" r="2.4" fill="#fff"/><circle cx="20.5" cy="3.5" r="2.4" fill="#fff"/>';
// Brows slant down toward the nose (inner end lower than outer end).
const brow = (x1, y1, x2, y2) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>`;
const ANGRY_BROWS = brow(-29, -11, -9, -3) + brow(9, -3, 29, -11);
const FROWN = `<path d="M-11 29 Q0 18 11 29" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`;
const TEETH =
  `<rect x="-12" y="19" width="24" height="12" rx="3.5" fill="#fff" stroke="${INK}" stroke-width="2.6"/>` +
  `<path d="M-4 19 V31 M4 19 V31 M-12 25 H12" stroke="${INK}" stroke-width="1.8" fill="none"/>`;
const flame = (x, b, h, w, fill) =>
  `<path d="M${x - w} ${b} C${x - w * 1.1} ${b - h * 0.45} ${x - w * 0.2} ${b - h * 0.55} ${x} ${b - h} ` +
  `C${x + w * 0.1} ${b - h * 0.6} ${x + w * 1.2} ${b - h * 0.5} ${x + w} ${b}Z" fill="${fill}"/>`;
const FLAMES =
  flame(-27, -36, 30, 10, '#FF5A14') + flame(0, -42, 42, 13, '#FF5A14') + flame(27, -36, 30, 10, '#FF5A14') +
  flame(-27, -36, 17, 5.5, '#FFC233') + flame(0, -42, 24, 7, '#FFC233') + flame(27, -36, 17, 5.5, '#FFC233');
const ANGER_CHEEKS =
  '<ellipse cx="-34" cy="20" rx="7" ry="4" fill="#FF3B30" opacity="0.4"/>' +
  '<ellipse cx="34" cy="20" rx="7" ry="4" fill="#FF3B30" opacity="0.4"/>';
const SMILE_WIDE = `<path d="M-14 17 Q0 40 14 17Z" fill="#B8335F" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
const SMILE_HAPPY = `<path d="M-12 20 Q0 35 12 20" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`;
const FLAT_MOUTH = `<path d="M-9 25 L9 25" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;

// Open-face edits per mood: list of [regex in the source SVG, replacement].
const OPEN = {
  glowing: [
    [/<path d="M-26 6 l8 -9 8 9"[^>]*\/><path d="M10 6 l8 -9 8 9"[^>]*\/>/, ICON_EYES],
    [/<path d="M-11 20 Q0 34 11 20Z"[^>]*\/>/, SMILE_WIDE],
  ],
  happy: [[/<path d="M-9 22 Q0 31 9 22"[^>]*\/>/, SMILE_HAPPY]],
  meh: [[/<ellipse cx="0" cy="26" rx="6" ry="7" fill="#22183F"\/>/, FLAT_MOUTH]],
  fried: [
    [/<path d="M-18 6 m-1 0[^>]*\/><path d="M18 6 m-1 0[^>]*\/>/, ANGRY_EYES + ANGRY_BROWS + ANGER_CHEEKS],
    [/<path d="M-10 26 q5 -5 10 0 t10 0"[^>]*\/>/, TEETH],
    [/<path d="M-14 -58[^>]*\/><path d="M16 -60[^>]*\/>/, ''],
    [/<g >/, FLAMES + '<g >'],
  ],
  zombie: [
    [/<circle cx="18" cy="6" r="6"[^>]*\/>/, '$&' + ANGRY_BROWS],
    [/<path d="M-10 26 L10 24"[^>]*\/>/, FROWN],
  ],
};

// Closed-eye replacements per mood: [regex of the open-eye elements, replacement].
const BLINK = {
  glowing: [
    /<circle cx="-18" cy="6" r="8"[^>]*\/><circle cx="18" cy="6" r="8"[^>]*\/><circle[^>]*\/><circle[^>]*\/>/,
    lid('M-26 7 L-10 7') + lid('M10 7 L26 7'),
  ],
  happy: [
    /<circle cx="-18" cy="6" r="8"[^>]*\/><circle cx="18" cy="6" r="8"[^>]*\/><circle[^>]*\/><circle[^>]*\/>/,
    lid('M-26 7 L-10 7') + lid('M10 7 L26 7'),
  ],
  meh: [
    /<circle cx="-18" cy="6" r="7"[^>]*\/><circle cx="18" cy="6" r="7"[^>]*\/><rect [^>]*\/><rect [^>]*\/><line [^>]*\/><line [^>]*\/>/,
    lid('M-27 6 L-9 6', 3) + lid('M9 6 L27 6', 3),
  ],
  fried: [
    /<circle cx="-18" cy="6" r="7"[^>]*\/><circle cx="18" cy="6" r="7"[^>]*\/><circle[^>]*\/><circle[^>]*\/>/,
    lid('M-25 7 L-11 7', 3.4) + lid('M11 7 L25 7', 3.4),
  ],
  zombie: [/<circle cx="18" cy="6" r="6"[^>]*\/>/, lid('M11 6 L25 6', 3)],
};

const crop = 'viewBox="6 -4 188 188"';
const render = (svg, file) => {
  const sized = svg.replace('viewBox="0 0 200 200"', crop);
  const png = new Resvg(sized, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
  fs.writeFileSync(path.join(out, file), png);
};

const re = /^ {2}(\w+):\s*\n?\s*'(<svg[^']*)'/gm;
let m;
while ((m = re.exec(art))) {
  const [, mood, svg] = m;
  if (!BLINK[mood]) continue;
  const [find, repl] = BLINK[mood];
  let open = svg;
  for (const [pattern, replacement] of OPEN[mood] || []) {
    if (!pattern.test(open)) throw new Error(`face pattern ${pattern} not found for ${mood}`);
    open = open.replace(pattern, replacement);
  }
  if (!find.test(open)) throw new Error(`eye pattern not found for ${mood}`);
  render(open, `thumbwell_mascot_${mood}.png`);
  render(open.replace(find, repl), `thumbwell_mascot_${mood}_blink.png`);
  console.log('rendered', mood);
}
