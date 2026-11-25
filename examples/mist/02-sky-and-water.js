/**
 * Passage 2: the sky and the still water, wet and blended.
 *
 * Fog light has no edges, so nothing here may show where a stroke began. The sky goes
 * on in broad level rows of thinned paint that run off both sides of the panel, from the
 * grey overhead down to the warmer grey at the waterline: each row takes the sky step of
 * its band, and where two bands meet, a row takes one step or the other at random, so the
 * steps knit together while wet. While the rows are wet, the glow is laid into them as
 * nested strokes centered under the sun, each a step lighter than the last and tapering
 * at both ends, so they melt into the rows they cross. The water is the same sky turned
 * over, in the pond's steps. Both stay wet, so the far woods can be painted into them.
 */

const W = canvas.width;
const H = canvas.height;
const WATER = 525; // the far waterline
const GLOW = { x: 1040, y: 300 };

/** The glow's rings: radius (px, before the 1.6× horizontal stretch) and the steps in sky and water. */
const RINGS = [
  { r: 330, sky: 'sky3', water: 'glint3' },
  { r: 240, sky: 'sky2', water: 'glint2' },
  { r: 160, sky: 'sky1', water: 'glint1' },
  { r: 90, sky: 'sky0', water: 'glint0' },
];

brush('broad', { type: 'soft', width: 190, reservoir: 6 });
brush('glow', { type: 'soft', width: 100, reservoir: 5 });

/** The sky step for a point at height y; the bands' borders wander by a row either way. */
function skyStep(y) {
  const j = y + rand(-45, 45);
  return j < 170 ? 'sky5' : j < 350 ? 'sky4' : 'sky3';
}
/** The water step for a row at height y: the step of the sky it mirrors, greener up close. */
function waterStep(y) {
  const j = 2 * WATER - y + rand(-45, 45);
  if (j < 170) return y + rand(-40, 40) > 880 ? 'poolNear' : 'pool5';
  return j < 350 ? 'pool4' : 'pool3';
}

/** One broad level row across the whole panel and off both sides. */
function row(y, color) {
  stroke({
    path: [
      [-80, y + rand(-4, 4)],
      [W * 0.35, y + rand(-4, 4)],
      [W * 0.7, y + rand(-4, 4)],
      [W + 80, y + rand(-4, 4)],
    ],
    brush: 'broad',
    color,
    load: rand(0.55, 0.65),
    thinner: 0.45,
  });
}

/** The glow's nested strokes at height y, for a glow centered at height cy. */
function glowRow(y, cy, side) {
  for (const ring of RINGS) {
    const dy = y - cy + rand(-12, 12);
    const r = ring.r * rand(0.9, 1.1);
    if (Math.abs(dy) >= r) continue;
    const half = Math.sqrt(r * r - dy * dy) * 1.6;
    const cx = GLOW.x + rand(-25, 25);
    stroke({
      path: [
        [cx - half - 50, y + rand(-2, 2), 0.05],
        [cx - half * 0.4, y + rand(-2, 2), 0.7],
        [cx + half * 0.4, y + rand(-2, 2), 0.7],
        [cx + half + 50, y + rand(-2, 2), 0.05],
      ],
      brush: 'glow',
      color: ring[side],
      load: rand(0.55, 0.65),
      thinner: 0.4,
    });
  }
}

// The sky, top to bottom, then the glow into it.
for (let y = -40; y < WATER + 20; y += 38) row(y, skyStep(y));
for (let y = GLOW.y - 330; y < WATER; y += 28) glowRow(y, GLOW.y, 'sky');

// The water, from the far shore toward us, then the glow's reflection into it.
for (let y = WATER - 6; y < H + 90; y += 38) row(y, waterStep(y));
for (let y = WATER + 6; y < 2 * WATER - GLOW.y + 330; y += 28)
  glowRow(y, 2 * WATER - GLOW.y, 'water');
