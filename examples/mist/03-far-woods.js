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

/**
 * The elms as passage 4 paints them: the trees, the spit's top, each crown's lobes, and
 * what step of the foliage a point of a crown takes. The reflection below mirrors these.
 */
const ELMS = [
  { x: 66, top: 150, lean: -18, spread: 112, far: 0 },
  { x: 172, top: 58, lean: 8, spread: 142, far: 0.3 },
  { x: 318, top: 128, lean: 20, spread: 106, far: 1 },
  { x: 482, top: 262, lean: 12, spread: 80, far: 1.8 },
];
const spitTop = (x) => SPIT - 34 * Math.max(0, 1 - x / 600) ** 0.7 - 3 * noise(x / 40, 6.1);
const LOBES = [
  [-0.62, 0.14, 0.4, 0.12],
  [-0.3, 0.09, 0.4, 0.11],
  [0, 0.08, 0.38, 0.09],
  [0.3, 0.09, 0.4, 0.11],
  [0.62, 0.14, 0.4, 0.12],
  [-0.9, 0.4, 0.28, 0.2],
  [0.9, 0.4, 0.28, 0.2],
  [0, 0.37, 0.8, 0.26],
  [-0.6, 0.63, 0.5, 0.11],
  [0.6, 0.63, 0.5, 0.11],
  [0, 0.56, 0.45, 0.08],
];
const TREES = ELMS.map((e, k) => {
  const foot = spitTop(e.x) + 4;
  const h = foot - e.top;
  const cx = e.x + e.lean;
  const lobes = LOBES.map(([u, v, ru, rv], j) => ({
    x: cx + (u + 0.12 * noise(k * 7.3 + j, 1.9)) * e.spread,
    y: e.top + (v + 0.04 * noise(k * 5.1 + j, 4.4)) * h,
    rx: ru * e.spread * (1 + 0.15 * noise(k * 3.7 + j, 7.7)),
    ry: rv * h * (1 + 0.15 * noise(k * 2.9 + j, 2.3)),
  }));
  return { ...e, k, foot, h, cx, fork: { x: e.x + e.lean * 0.3, y: foot - 0.1 * h }, lobes };
});
function depthIn(t, x, y) {
  let d = Number.NEGATIVE_INFINITY;
  let side = 0;
  for (const l of t.lobes) {
    const dx = x - l.x;
    const dy = y - l.y;
    const q = Math.hypot(dx / l.rx, dy / l.ry);
    const r = Math.hypot(dx, dy);
    const dl = q < 1e-6 ? Math.min(l.rx, l.ry) : r * (1 / q - 1);
    if (dl > d) {
      d = dl;
      side = Math.max(-1, Math.min(1, dy / l.ry));
    }
  }
  return {
    d: d + 8 * noise(x / 34 + t.k * 13, y / 34) + 3 * noise(x / 11, y / 11 + t.k * 5),
    side,
  };
}
function crownAt(x, y) {
  let depth = Number.NEGATIVE_INFINITY;
  let step = 9;
  for (const t of TREES) {
    const { d, side } = depthIn(t, x, y);
    depth = Math.max(depth, d);
    if (d <= 0) continue;
    const v = (y - t.top) / t.h;
    const value =
      t.far +
      Math.min(3, Math.max(0, (310 - y) / 85)) +
      (d < 6 ? 1.2 : d < 14 ? 0.5 : 0) -
      0.7 * side -
      (v > 0.45 && d > 12 ? 0.6 : 0) +
      0.5 * noise(x / 45, y / 45);
    step = Math.min(step, value);
  }
  return { depth, step: Math.min(5, Math.max(0, Math.round(step))) };
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
 * point. Then the elms' reflection, as deep below the waterline as each part stands above
 * it: the trunks and their limbs hanging down, and below them the dark of the lower
 * crowns, one mass where they overlap, darker than the water and paler than the trees.
 * It is laid in level strokes of staggered length, so no edge lines up from row to row,
 * and the fog lying on the water takes it step by step as it goes down.
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
// the trunks and limbs upside down, wavering a little, the limbs lost before the crowns
const mirror = ([x, y, p]) => [x + rand(-1.5, 1.5), 2 * SPIT - y, p];
for (const t of TREES) {
  const size = t.h / 570;
  const { fork } = t;
  const bole = [
    [t.x, t.foot + 2, 0.95],
    [t.x + t.lean * 0.12, t.foot - 0.05 * t.h, 0.9],
    [fork.x, fork.y, 0.8],
  ];
  // a broad pale stroke, then the trunk's own dark down the middle of it
  for (const [w, color, load] of [
    [30, 'elmMirror', 0.6],
    [15, 'trunkMirror', 0.65],
  ])
    stroke({ path: bole.map(mirror), brush: { type: 'soft', width: w * size }, color, load });
  const rise = fork.y - (t.top + 0.62 * t.h);
  for (const u of [-0.45, 0.04, 0.48]) {
    const dx = t.cx - fork.x + (u + 0.12 * noise(t.k * 4.1, u * 3)) * t.spread;
    const lift = rise * (1 + 0.15 * noise(t.k * 2.3, u * 5));
    stroke({
      path: [
        [fork.x + u * 8 * size, fork.y + 4, 0.8],
        [fork.x + dx * 0.18, fork.y - lift * 0.4, 0.65],
        [fork.x + dx * 0.45, fork.y - lift * 0.7, 0.4],
      ].map(mirror),
      brush: { type: 'soft', width: 14 * size },
      color: 'elmMirrorPale',
      load: 0.5,
    });
  }
}
// the crowns, a row every few px, each row crossing whatever crowns hang that far down
const ELM_STEPS = ['elmMirrorDeep', 'elmMirror', 'elmMirrorPale', 'elmMirrorLost'];
const crownFoot = Math.max(...TREES.map((t) => Math.max(...t.lobes.map((l) => l.y + l.ry))));
for (let y = 2 * SPIT - crownFoot - 6; y < canvas.height + 10; y += rand(6, 9)) {
  const ty = 2 * SPIT - y;
  const spans = [];
  for (let x = -30; x < 600; x += 5) {
    if (crownAt(x, ty).depth <= 0) continue;
    const last = spans.at(-1);
    if (last && x - last.x1 <= 5) last.x1 = x;
    else spans.push({ x0: x, x1: x });
  }
  const fade = 0.4 + Math.max(0, (y - SPIT - 150) / 70);
  for (const s of spans) {
    if (s.x1 - s.x0 < 12) continue;
    for (let x = s.x0 - rand(4, 18); x < s.x1 - 8; x += rand(35, 75)) {
      const x1 = Math.min(x + rand(50, 130), s.x1 + rand(-6, 16));
      if (x1 < x + 18) continue;
      const mid = (x + x1) / 2;
      const c = crownAt(mid, ty);
      const step = [0, 0, 1, 1, 2, 3][c.step] + fade + 0.5 * noise(mid / 50, y / 30);
      stroke({
        path: [
          [x, y + rand(-1, 1), 0.15],
          [mid, y + rand(-1.5, 1.5), 0.7],
          [x1, y + rand(-1, 1), 0.15],
        ],
        brush: { type: 'soft', width: rand(22, 30), reservoir: 2 },
        color: ELM_STEPS[Math.min(3, Math.max(0, Math.round(step)))],
        load: rand(0.55, 0.65),
      });
    }
  }
}
// the water's skin breaks the reflections level: a few faint lines of the pond across them
for (let y = SPIT + 24; y < canvas.height; y += rand(26, 44)) {
  for (let x = -40; x < 580; x += rand(160, 300)) {
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
