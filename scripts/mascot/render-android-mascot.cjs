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
const out = path.join(root, 'modules/brainling-core/android/src/main/res/drawable-nodpi');
const art = fs.readFileSync(path.join(root, 'src/components/mascot/art.ts'), 'utf8');
const INK = '#22183F';
const lid = (d, w = 3.2) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;

// Closed-eye replacements per mood: [regex of the open-eye elements, replacement].
const BLINK = {
  glowing: [
    /<path d="M-26 6 l8 -9 8 9"[^>]*\/><path d="M10 6 l8 -9 8 9"[^>]*\/>/,
    lid('M-26 4 Q-18 11 -10 4') + lid('M10 4 Q18 11 26 4'),
  ],
  happy: [
    /<circle cx="-18" cy="6" r="8"[^>]*\/><circle cx="18" cy="6" r="8"[^>]*\/><circle[^>]*\/><circle[^>]*\/>/,
    lid('M-26 6 Q-18 13 -10 6') + lid('M10 6 Q18 13 26 6'),
  ],
  meh: [
    /<circle cx="-18" cy="6" r="7"[^>]*\/><circle cx="18" cy="6" r="7"[^>]*\/><rect [^>]*\/><rect [^>]*\/><line [^>]*\/><line [^>]*\/>/,
    lid('M-27 6 L-9 6', 3) + lid('M9 6 L27 6', 3),
  ],
  fried: [
    /<path d="M-18 6 m-1 0[^>]*\/><path d="M18 6 m-1 0[^>]*\/>/,
    lid('M-26 6 L-10 6', 3) + lid('M10 6 L26 6', 3),
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
  if (!find.test(svg)) throw new Error(`eye pattern not found for ${mood}`);
  render(svg, `brainling_mascot_${mood}.png`);
  render(svg.replace(find, repl), `brainling_mascot_${mood}_blink.png`);
  console.log('rendered', mood);
}
