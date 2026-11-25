/**
 * Passage 4: the elms on the spit, rising into the fog.
 *
 * A low spit of land runs in from the left, and four elms stand on it, the darkest
 * masses in the picture and still only a few steps darker than the fog. The sky, woods,
 * and water are still wet, so the trees are painted into wet fog as the far woods were.
 * Each crown is laid in as one soft mass in the elm's vase shape, broad at the top and
 * narrowing to the fork: strokes laid every which way, mostly near level, each picking
 * up the fog and the strokes beside it, so no single stroke keeps its edge.
 * The foliage steps from a dark core through the middle of the tree to paler and paler
 * piles toward the top and the foot, where the fog takes it; the border between steps
 * wanders, so neighbouring steps knit. The rim is feathered with small drooping strokes,
 * and a drift of fog is drawn across the upper crowns while everything is wet.
 */

const SPIT = 660; // the waterline under the elms

/** The elms (as in passage 1): foot, lean, and how high the crown climbs into the fog. */
const ELMS = [
  { x: 92, top: 120, lean: -14, spread: 120 },
  { x: 205, top: 70, lean: 8, spread: 140 },
  { x: 318, top: 150, lean: 18, spread: 115 },
  { x: 430, top: 250, lean: 10, spread: 90 },
];

/** The top of the spit's grass at x: a low bank tapering out to a point. */
const spitTop = (x) => SPIT - 34 * Math.max(0, 1 - x / 600) ** 0.7 - 3 * noise(x / 40, 6.1);

/** The crown of elm e at height fraction u (0 at its top, 1 at the fork): center and half-width. */
function crownAt(e, u) {
  const bottom = SPIT - (SPIT - e.top) * 0.14;
  const y = e.top + u * (bottom - e.top);
  const half =
    e.spread * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.75)) ** 0.6 * (1 - 0.45 * u ** 1.5);
  return { x: e.x + e.lean * (1 - u), y, half };
}

/**
 * The foliage pile at (x, y): the fog is thick high up and low over the water and thin
 * between, so the steps run lost, fog, haze, crown down the tree and back to haze at its
 * foot, with the dark core inside. The borders wander with the noise field.
 */
function foliage(x, y, core) {
  const yy = y + 45 * noise(x / 55, y / 50);
  if (yy < 140) return 'crownLost';
  if (yy < 215) return 'crownFog';
  if (yy < 295) return 'crownHaze';
  if (yy > 560) return 'crownHaze';
  return core && yy > 320 && yy < 520 ? 'crownCore' : 'crown';
}

brush('foliage', { type: 'soft', width: 30, reservoir: 2 });
brush('leaf', { type: 'soft', width: 13 });
brush('limb', { type: 'soft', width: 6 });

// The spit: level strokes of bank, greyer toward its point, its grassy top broken.
for (let y = SPIT + 3; y > SPIT - 40; y -= 6) {
  for (let x = -40; x < 620; x += rand(60, 110)) {
    const len = rand(80, 140);
    const end = Math.min(x + len, 610 - (SPIT - y) * 4);
    if (y < spitTop(x + len / 2) + 2 || end < x + 10) continue;
    const xx = x + len / 2 + 70 * noise(x / 60, y / 20);
    stroke({
      path: [
        [x, y + rand(-1.5, 1.5), 0.6],
        [end, y + rand(-1.5, 1.5), 0.2],
      ],
      brush: { type: 'soft', width: 14 },
      color: xx < 230 ? 'spit' : xx < 430 ? 'spitPale' : 'spitPoint',
      load: rand(0.7, 0.8),
      thinner: 0.2,
    });
  }
}
for (let x = -10; x < 560; x += rand(5, 11)) {
  const y = spitTop(x) + 4;
  stroke({
    path: [
      [x, y],
      [x + rand(-3, 3), y - rand(5, 14)],
    ],
    brush: { type: 'round', width: rand(2, 3.5) },
    color: x + rand(-60, 60) < 320 ? 'grass' : 'grassPale',
    load: rand(0.6, 0.75),
    end: 'taper',
  });
}

for (const e of ELMS) {
  const height = SPIT - e.top;
  const fork = crownAt(e, 1);
  // the trunk, up through the fog to the fork, and the limbs fanning from it
  stroke({
    path: [
      [e.x, spitTop(e.x) + 4, 0.9],
      [e.x + e.lean * 0.1, SPIT - height * 0.08, 0.8],
      [fork.x, fork.y + 10, 0.65],
    ],
    brush: { type: 'soft', width: 15 },
    color: 'trunk',
    load: 0.85,
  });
  for (let k = 0; k < 3; k++) {
    const side = (k - 1) * rand(0.7, 1.1);
    const tip = crownAt(e, rand(0.4, 0.6));
    stroke({
      path: [
        [fork.x, fork.y + 10, 0.8],
        [fork.x + side * tip.half * 0.35, fork.y - height * 0.1, 0.6],
        [tip.x + side * tip.half * 0.7, tip.y, 0.2],
      ],
      brush: 'limb',
      color: 'limb',
      load: rand(0.7, 0.85),
      end: 'taper',
    });
  }
  // the crown's mass: strokes into the wet fog and each other, the dark core through the
  // middle
  for (let i = 0; i < 120; i++) {
    const u = rand(0.02, 1);
    const c = crownAt(e, u);
    const x = c.x + c.half * (rand() + rand() - 1) * 0.85;
    const y = c.y + rand(-10, 10);
    const a = rand(-0.7, 0.7) + (rand() < 0.2 ? Math.PI / 2 : 0);
    const len = Math.min(c.half * 1.3, rand(30, 80));
    stroke({
      path: [
        [x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2, 0.35],
        [x, y, rand(0.6, 0.8)],
        [x + (Math.cos(a) * len) / 2, y + (Math.sin(a) * len) / 2, 0.35],
      ],
      brush: 'foliage',
      color: foliage(x, y, Math.abs(x - c.x) < c.half * 0.5),
      load: rand(0.72, 0.85),
    });
  }
  // feathered edges: small strokes drooping out from the rim of the crown
  for (let i = 0; i < 55; i++) {
    const u = rand() ** 1.3;
    const c = crownAt(e, u);
    const side = rand() < 0.5 ? -1 : 1;
    const x = c.x + side * c.half * rand(0.8, 1.02);
    const y = u < 0.1 ? c.y - rand(0, 10) : c.y + rand(-6, 6);
    stroke({
      path: [
        [x - side * 6, y - 4],
        [x + side * rand(4, 12), y + rand(4, 12)],
      ],
      brush: 'leaf',
      color: foliage(x, y, false),
      load: rand(0.5, 0.62),
      pressure: rand(0.4, 0.6),
      end: 'taper',
    });
  }
}

// A drift of fog across the upper crowns while they are wet: broad strokes that taper in
// and out, picking the crowns up and laying them down paler.
for (const e of ELMS) {
  for (const u of [0.08, 0.26]) {
    const c = crownAt(e, u + rand(-0.04, 0.04));
    stroke({
      path: [
        [c.x - c.half * 1.2, c.y + rand(-6, 6), 0.05],
        [c.x - c.half * 0.3, c.y + rand(-4, 4), 0.55],
        [c.x + c.half * 0.3, c.y + rand(-4, 4), 0.55],
        [c.x + c.half * 1.2, c.y + rand(-6, 6), 0.05],
      ],
      brush: { type: 'soft', width: 60, reservoir: 3 },
      color: 'crownLost',
      load: rand(0.5, 0.6),
      thinner: 0.3,
    });
  }
}

dry();
