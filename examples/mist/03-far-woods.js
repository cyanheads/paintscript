/**
 * Passage 3: the woods across the pond, and every reflection, painted into the wet paint.
 *
 * Two planes of trees: a ghost of higher ground far off on the right, and the long wood
 * on the far bank, which rises to a shoulder left of center and sinks into the light
 * under the glow. Each is filled with level strokes and topped with small arcs for the
 * crowns, all laid into the wet sky so every stroke picks up some fog and loses its
 * edge; under the glow the strokes change to the paler steps of the same green, their
 * border wandering so the steps knit. The water is still wet, so the reflections go in
 * now, as a painter puts them in with the water: the far wood hanging a little way down,
 * and on the left the dark mirror of the elms and their spit, which the next passage
 * stands up above them. Each is laid in level strokes that pale step by step as they go
 * down, until the fog lying on the water takes them, and a few level lines of the
 * water's skin break them. Last, a bank of mist along the far waterline, so the woods
 * float on it. Everything stays wet for the elms.
 */

const W = canvas.width;
const WATER = 525;
const SPIT = 660; // the waterline under the elms
const GLOW = { x: 1040, y: 300 };

/** The elms (as in passage 1): foot, lean, and how high the crown climbs into the fog. */
const ELMS = [
  { x: 92, top: 120, lean: -14, spread: 120 },
  { x: 205, top: 70, lean: 8, spread: 140 },
  { x: 318, top: 150, lean: 18, spread: 115 },
  { x: 430, top: 250, lean: 10, spread: 90 },
];

/** The long wood's skyline: a shoulder left of center, sinking toward the light. */
function farTop(x) {
  const shoulder = 72 * Math.exp(-(((x - 470) / 330) ** 2));
  const sink = Math.max(0, x - 900) * 0.055;
  return WATER - 46 - shoulder + sink - 18 * noise(x / 80, 1.7) - 9 * noise(x / 24, 3.9);
}
/** The far hills' skyline, behind the wood on the right. */
function fartherTop(x) {
  return WATER - 72 - 58 * Math.exp(-(((x - 1290) / 230) ** 2)) - 16 * noise(x / 140, 8.2);
}
/** Which light a point of the woods stands in: 2 under the glow, 1 at its edge, 0 in the shade. */
function lightAt(x, y) {
  const d = (x + 90 * noise(x / 70, y / 45) - GLOW.x) / 260;
  const g = Math.exp(-d * d);
  return g > 0.55 ? 2 : g > 0.2 ? 1 : 0;
}
/** The top of the spit's bank at x, as passage 4 paints it. */
const spitTop = (x) => SPIT - 34 * Math.max(0, 1 - x / 600) ** 0.7 - 3 * noise(x / 40, 6.1);
/** The crown of elm e at height fraction u (0 at its top, 1 at the fork), as passage 4 paints it. */
function crownAt(e, u) {
  const bottom = SPIT - (SPIT - e.top) * 0.14;
  const y = e.top + u * (bottom - e.top);
  const half =
    e.spread * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.75)) ** 0.6 * (1 - 0.45 * u ** 1.5);
  return { x: e.x + e.lean * (1 - u), y, half };
}

brush('mass', { type: 'soft', width: 30, reservoir: 3 });
brush('crown', { type: 'soft', width: 26 });
brush('veil', { type: 'soft', width: 44, reservoir: 5 });
brush('mirror', { type: 'soft', width: 14, reservoir: 3 });

/**
 * Fill a plane of trees from its skyline down to the fog, densest under the crowns and
 * thinning toward the water, then round the crowns with small arcs. `steps` are the
 * plane's piles from the shade into the light.
 */
function wood(top, steps) {
  for (let y = WATER + 4; y > 0; y -= 9) {
    for (let x = -40; x < W; x += rand(70, 120)) {
      const len = rand(90, 150);
      const cx = x + len / 2;
      const below = y - top(cx);
      if (below < 16) continue;
      stroke({
        path: [
          [x, y + rand(-2, 2)],
          [x + len, y + rand(-2, 2)],
        ],
        brush: 'mass',
        color: steps[lightAt(cx, y)],
        load: Math.max(0.4, 0.85 - below / 140) * rand(0.9, 1),
        thinner: 0.2,
      });
    }
  }
  for (let x = -20; x < W + 20; x += rand(10, 18)) {
    const r = rand(12, 26);
    const cy = top(x) + r * 0.8;
    const arc = [];
    for (let a = Math.PI + 0.3; a <= 2 * Math.PI - 0.3; a += 0.35)
      arc.push([x + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.8]);
    stroke({
      path: arc,
      brush: 'crown',
      color: steps[lightAt(x, cy)],
      load: rand(0.65, 0.8),
      pressure: 0.65,
      thinner: 0.15,
    });
  }
}

wood(fartherTop, ['farther', 'fartherHalf', 'fartherLit']);
wood(farTop, ['farWood', 'farWoodHalf', 'farWoodLit']);

/**
 * The far wood's reflection: it hangs upside down in the water, as deep as it stands, but
 * the fog on the water swallows it within a few strokes. Laid in level rows, each
 * crossing only where the wood reaches that far down, a step paler every few rows.
 */
const MIRROR_STEPS = ['woodMirror', 'woodMirrorPale', 'woodMirrorLost'];
const depthAt = (x) => (WATER - farTop(x)) * 0.8;
for (let y = WATER + 4; y < WATER + 130; y += 8) {
  const d = y - WATER;
  let x = -40;
  while (x < W + 40) {
    if (depthAt(x) < d + rand(0, 12)) {
      x += 10;
      continue;
    }
    let x1 = x;
    while (x1 < W + 40 && depthAt(x1) > d) x1 += 10;
    const mid = (x + x1) / 2;
    const step = Math.floor((3 * (d + rand(-8, 8))) / depthAt(mid)) + (lightAt(mid, y) > 0 ? 1 : 0);
    stroke({
      path: [
        [x - 6, y + rand(-1, 1), 0.2],
        [mid, y + rand(-1.5, 1.5), 0.7],
        [x1 + 6, y + rand(-1, 1), 0.2],
      ],
      brush: { type: 'soft', width: 18 },
      color: MIRROR_STEPS[Math.min(2, Math.max(0, step))],
      load: rand(0.55, 0.7),
    });
    x = x1 + rand(10, 40);
  }
}

/**
 * The spit's bank turned over: a band as deep as the bank is high, narrowing to the
 * point. Then the elms' reflection: each crown hangs below its mirrored trunk, darker
 * than the water and paler than the tree, laid in short overlapping level strokes as wide
 * as the crown is at the height it mirrors. It starts a step pale where it mirrors the
 * haze at the elms' foot, and the fog lying on the water takes it in three steps within
 * a short way, long before the crowns' mirrored tops.
 */
for (let y = SPIT + 3; y < SPIT + 36; y += 5) {
  let x1 = 0;
  while (x1 < 620 && SPIT - spitTop(x1) > y - SPIT) x1 += 6;
  if (x1 < 20) continue;
  stroke({
    path: [
      [-40, y + rand(-1, 1), 0.7],
      [x1 / 2, y + rand(-1, 1), 0.7],
      [x1 + rand(-6, 6), y + rand(-1, 1), 0.2],
    ],
    brush: 'mirror',
    color: 'spitMirror',
    load: rand(0.6, 0.7),
  });
}
// the trunks, wavering a little, gone where the crowns begin
for (const e of ELMS) {
  const forkMirror = 2 * SPIT - crownAt(e, 1).y;
  stroke({
    path: [
      [e.x, SPIT + 6, 0.7],
      [e.x + rand(-1.5, 1.5), (SPIT + forkMirror) / 2, 0.55],
      [e.x + e.lean * 0.3 + rand(-1.5, 1.5), forkMirror + 8, 0.2],
    ],
    brush: { type: 'soft', width: 10 },
    color: 'trunkMirror',
    load: 0.65,
  });
}
// the crowns, a row every few px across whichever crowns reach that far down, so where
// they overlap the mirror is one mass
const ELM_STEPS = ['elmMirror', 'elmMirrorPale', 'elmMirrorLost'];
const forkMirrors = ELMS.map((e) => 2 * SPIT - crownAt(e, 1).y);
const reaches = ELMS.map(() => rand(115, 145));
for (let y = Math.min(...forkMirrors) - 4; y < 900; y += rand(7, 10)) {
  const spans = [];
  for (const [k, e] of ELMS.entries()) {
    const d = y - forkMirrors[k];
    if (d < -4 || d > reaches[k]) continue;
    const u = (2 * SPIT - y - e.top) / (2 * SPIT - forkMirrors[k] - e.top);
    const c = crownAt(e, Math.min(1, Math.max(0, u)));
    const half = c.half * rand(0.75, 0.95);
    spans.push({ x0: c.x - half, x1: c.x + half, d });
  }
  spans.sort((a, b) => a.x0 - b.x0);
  const merged = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s.x0 < last.x1) {
      last.x1 = Math.max(last.x1, s.x1);
      last.d = Math.min(last.d, s.d);
    } else merged.push({ ...s });
  }
  for (const s of merged) {
    // overlapping level strokes of varied length, so no edge lines up with the next row's
    for (let x = s.x0 - rand(0, 20); x < s.x1 - 10; x += rand(35, 70)) {
      const x1 = Math.min(x + rand(50, 130), s.x1 + rand(-10, 15));
      if (x1 < x + 20) continue;
      const d = s.d + rand(-16, 16);
      stroke({
        path: [
          [x, y + rand(-1, 1), 0.15],
          [(x + x1) / 2, y + rand(-1.5, 1.5), 0.7],
          [x1, y + rand(-1, 1), 0.15],
        ],
        brush: { type: 'soft', width: rand(26, 36), reservoir: 2 },
        color: ELM_STEPS[d < 18 ? 1 : d < 70 ? 0 : d < 105 ? 1 : 2],
        load: rand(0.5, 0.65),
      });
    }
  }
}
// the water's skin breaks the reflections level: a few faint lines of the pond across them
for (let y = SPIT + 24; y < 860; y += rand(26, 44)) {
  for (let x = -40; x < 560; x += rand(160, 300)) {
    const len = rand(70, 170);
    stroke({
      path: [
        [x, y, 0.1],
        [x + len / 2, y + rand(-1, 1), 0.6],
        [x + len, y, 0.1],
      ],
      brush: { type: 'soft', width: 5 },
      color: 'skin',
      load: rand(0.55, 0.7),
    });
  }
}

// The bank of mist lying on the water along the far shore: the woods stand on nothing.
// Its steps match the sky low down, so it hides the wood's foot without a stripe.
const MIST_STEPS = ['mist', 'mistHalf', 'mistLit'];
for (let y = WATER - 34; y < WATER + 26; y += 6) {
  const thick = 1 - Math.abs(y - (WATER - 4)) / 32;
  for (let x = -60; x < W; x += rand(80, 150)) {
    const len = rand(180, 320);
    stroke({
      path: [
        [x, y + rand(-3, 3), 0.1],
        [x + len / 2, y + rand(-3, 3), 0.8],
        [x + len, y + rand(-3, 3), 0.1],
      ],
      brush: 'veil',
      color: MIST_STEPS[lightAt(x + len / 2, y)],
      load: (0.35 + thick * 0.45) * rand(0.9, 1.05),
      thinner: 0.35,
    });
  }
}
