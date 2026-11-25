/**
 * Passage 4: the elms on the spit, standing dark in the fog.
 *
 * A low spit of land runs in from the left, and four elms stand on it, the heaviest dark
 * in the picture and still only a few steps darker than the fog. They are painted as a
 * tonalist paints trees in mist: one soft mass for the group, each crown legible by its
 * own dome against the fog, the nearer trees darker and the farther a step or two paler.
 * Each is an American elm: a short stout trunk forks low into a few limbs that rise in a
 * vase and vanish into the arched underside of a broad crown, whose sides droop.
 *
 * The sky and water are still wet, so the trees go into wet fog. The trunks and limbs go
 * in first; then each crown is built up in three layers of soft, thinned strokes laid
 * every which way but kept inside its silhouette: a lay-in over the whole crown, the body
 * inset from the edge, and the dark of the lower crown. Each layer picks up the elm paint
 * under it rather than fog, so the inside reaches its full value while the edge, touched
 * only by the lay-in, stays soft. Each lobe of foliage is darker underneath, and the
 * value rises with height, so the tops pale into the fog. Last, fog is drawn in across
 * the tops from the sky side, so it takes their edges without dragging them out.
 */

const SPIT = 660; // the waterline under the elms

/** The elms: foot, crown top, lean of the crown over the foot, half-spread, and how far (in fog steps). */
const ELMS = [
  { x: 66, top: 150, lean: -18, spread: 112, far: 0 },
  { x: 172, top: 58, lean: 8, spread: 142, far: 0.3 },
  { x: 318, top: 128, lean: 20, spread: 106, far: 1 },
  { x: 482, top: 262, lean: 12, spread: 80, far: 1.8 },
];

/** The top of the spit's grass at x: a low bank tapering out to a point. */
const spitTop = (x) => SPIT - 34 * Math.max(0, 1 - x / 600) ** 0.7 - 3 * noise(x / 40, 6.1);

/**
 * An elm crown as overlapping lobes, in units of its spread across and its height down
 * from the top: the dome, the drooping shoulders, the body, and the clumps hanging under it.
 */
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

/** Each elm's foot, height, fork, and lobes in px, varied by the noise field so no two repeat. */
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

/**
 * How far (px) a point lies inside tree t's crown (negative outside), and where it sits
 * in the lobe it is deepest in, from -1 at that lobe's top to 1 at its underside. The rim
 * wanders with the noise.
 */
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

/** The foliage piles from the dark of the lower crown up into the fog. */
const LADDER = ['crownCore', 'crown', 'crownMid', 'crownHaze', 'crownFog', 'crownLost'];

/**
 * The crown at a point: how deep inside it is, and which step of the ladder it takes.
 * Where crowns overlap, the darker (nearer) one is seen. Fog thickens with height and
 * takes the rim; each lobe is darker on its underside, and the lower crown, in its own
 * shadow, darkest of all.
 */
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

// The trunks and limbs, before the foliage, so the crowns bury the limbs' ends. Each bole
// is laid twice, the second stroke picking up the first rather than the fog behind it,
// and flares a little where it meets the bank.
for (const t of TREES) {
  const size = t.h / 570;
  const { fork } = t;
  const bole = [
    [t.x, t.foot + 2, 1],
    [t.x + t.lean * 0.12, t.foot - 0.05 * t.h, 0.92],
    [fork.x, fork.y, 0.82],
  ];
  // up from the foot, then down from the fork, so neither end is the one left pale, and
  // once more over the upper bole, where the bank of mist behind it is thickest
  stroke({ path: bole, brush: { type: 'soft', width: 24 * size }, color: 'trunk', load: 0.92 });
  stroke({
    path: bole.toReversed(),
    brush: { type: 'soft', width: 18 * size },
    color: 'trunk',
    load: 0.92,
  });
  for (const [a, b] of [
    [0, 1],
    [1, 0],
  ]) {
    const ends = [
      [fork.x, fork.y + 4, 0.85],
      [t.x + t.lean * 0.1, t.foot - 0.04 * t.h, 0.8],
    ];
    stroke({
      path: [ends[a], ends[b]],
      brush: { type: 'soft', width: 19 * size, reservoir: 2 },
      color: 'trunk',
      load: 1,
    });
  }
  stroke({
    path: [
      [t.x - 2, t.foot + 3, 1],
      [t.x, t.foot - 0.025 * t.h, 0.6],
    ],
    brush: { type: 'soft', width: 30 * size },
    color: 'trunk',
    load: 0.9,
  });
  // the limbs rise steeply out of the fork and arch outward in a vase, the outer two
  // throwing a branch wider still
  const rise = fork.y - (t.top + 0.62 * t.h);
  for (const [u, w] of [
    [-0.45, 14],
    [0.04, 12],
    [0.48, 13],
  ]) {
    const dx = t.cx - fork.x + (u + 0.12 * noise(t.k * 4.1, u * 3)) * t.spread;
    const lift = rise * (1 + 0.15 * noise(t.k * 2.3, u * 5));
    const limb = [
      [fork.x + u * 8 * size, fork.y + 4, 0.95],
      [fork.x + dx * 0.18, fork.y - lift * 0.4, 0.75],
      [fork.x + dx * 0.62, fork.y - lift * 0.82, 0.55],
      [fork.x + dx, fork.y - lift, 0.4],
    ];
    stroke({ path: limb, brush: { type: 'soft', width: w * size }, color: 'limb', load: 0.92 });
    if (Math.abs(u) < 0.3) continue;
    const [bx, by] = limb[1];
    stroke({
      path: [
        [bx, by, 0.8],
        [bx + dx * 0.55, by - lift * 0.3, 0.55],
        [bx + dx * 1.05, by - lift * 0.5, 0.35],
      ],
      brush: { type: 'soft', width: 9 * size },
      color: 'limb',
      load: 0.9,
      end: 'taper',
    });
  }
}

/**
 * One layer of a crown: strokes scattered evenly over every crown (a jittered grid of
 * `cell` px), each at its own slant, run out from its point both ways until it nears the
 * rim, so no stroke sticks out past the silhouette. `inset` keeps a layer inside the rim,
 * and `only` limits it to the darker steps.
 */
function layer({ cell, inset, width, len, only = 5 }) {
  for (let gy = 40; gy < 620; gy += cell) {
    for (let gx = -30; gx < 580; gx += cell) {
      const x = gx + rand(cell);
      const y = gy + rand(cell);
      const c = crownAt(x, y);
      if (c.depth < inset || c.step > only) continue;
      const a = rand(-0.45, 0.45) + 0.35 * noise(x / 90, y / 90);
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const reach = (dir) => {
        let s = 0;
        const want = rand(len[0], len[1]) / 2;
        while (s < want && crownAt(x + dir * ux * (s + 4), y + dir * uy * (s + 4)).depth > inset)
          s += 4;
        return s;
      };
      const s0 = reach(-1);
      const s1 = reach(1);
      if (s0 + s1 < 14) continue;
      const bow = rand(-4, 4);
      stroke({
        path: [
          [x - ux * s0, y - uy * s0, 0.42],
          [x - (ux * s0) / 3 - uy * bow, y - (uy * s0) / 3 + ux * bow, rand(0.65, 0.8)],
          [x + (ux * s1) / 3 - uy * bow, y + (uy * s1) / 3 + ux * bow, rand(0.65, 0.8)],
          [x + ux * s1, y + uy * s1, 0.42],
        ],
        brush: { type: 'soft', width },
        color: LADDER[c.step],
        load: rand(0.7, 0.8),
        thinner: 0.5,
      });
    }
  }
}

layer({ cell: 22, inset: 1, width: 32, len: [50, 110] });
layer({ cell: 18, inset: 9, width: 26, len: [40, 90] });
layer({ cell: 16, inset: 16, width: 20, len: [30, 70], only: 1 });

/**
 * The fog drifting through the tops: broad level strokes of the sky's own piles, thinned,
 * each crossing the rim of an upper crown from the fog side, so it lays sky into sky
 * until it reaches the wet foliage, then picks the foliage up and lays it down paler,
 * and never drags it out. The higher the rim, the more of them.
 */
for (let gy = 30; gy < 330; gy += 14) {
  for (let gx = -30; gx < 600; gx += 30) {
    const x = gx + rand(30);
    const y = gy + rand(14);
    if (Math.abs(crownAt(x, y).depth) > 10 || rand() > (330 - y) / 330) continue;
    // in from whichever side the fog is on, and only a little way into the foliage
    const dir = crownAt(x + 12, y).depth > crownAt(x - 12, y).depth ? 1 : -1;
    const out = rand(50, 110);
    const want = rand(30, 90);
    let inn = 6;
    while (inn < want && crownAt(x + dir * inn, y).depth < 18) inn += 6;
    const tilt = rand(-5, 5);
    stroke({
      path: [
        [x - dir * out, y - tilt, 0.1],
        [x - (dir * out) / 3, y - tilt / 3 + rand(-2, 2), rand(0.5, 0.6)],
        [x + (dir * inn) / 3, y + tilt / 3 + rand(-2, 2), rand(0.45, 0.55)],
        [x + dir * inn, y + tilt, 0.05],
      ],
      brush: { type: 'soft', width: rand(34, 56), reservoir: 3 },
      color: y + rand(-40, 40) < 330 ? 'sky4' : 'sky3',
      load: rand(0.5, 0.6),
      thinner: 0.5,
    });
  }
}

dry();
