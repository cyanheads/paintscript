/**
 * Passage 4: the wet road, which is a mirror.
 *
 * Every point of the road and pavement reflects the wall or sky above it, flipped
 * about the foot of the wall it faces. So this passage looks at the painting it has
 * so far: at() reads the dried color at the mirrored point, and a short upright
 * stroke carries that color, dulled with the road's grey, down onto the wet surface.
 * The lit shopfronts, the lamps, and the glow at the far end come down as long warm
 * streaks; the dark walls as dark ones. Laid wet together, they run into each other,
 * and a clean damp brush drawn downward through them pulls them into the long smears
 * of a rainy street. The paper saved under the headlights and lamps stays bare.
 */

const W = canvas.width;
const H = canvas.height;
const VP = { x: 630, y: 780 };
const EYE = 5;
const F = 1000;
const sx = (X, D) => VP.x + (X * F) / D;
const sy = (Z, D) => VP.y + ((EYE - Z) * F) / D;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

palette('roadGrey', mix(['payne', 1], ['crimson', 0.3], ['water', 2.5]));
palette('pavement', mix(['payne', 1], ['ochre', 0.3], ['crimson', 0.2], ['water', 3]));
palette('curb', mix(['payne', 1.3], ['crimson', 0.4], ['ultra', 0.2]));

const WALL_X = { left: -7.5, right: 7.75 };
const CURB_X = { left: -4.75, right: 4.6 };

/** The road point at screen (x, y): distance D and offset X, or null above the horizon. */
function groundAt(x, y) {
  if (y <= VP.y + 1) return null;
  const D = (EYE * F) / (y - VP.y);
  const X = ((x - VP.x) * D) / F;
  if (X < WALL_X.left || X > WALL_X.right) return null;
  return { D, X };
}

/**
 * Where the reflection at screen (x, y) comes from: the reflected ray meets the wall
 * on that side at distance Dw, and the image there is the wall flipped about its foot.
 */
function mirrorY(x, y) {
  const dx = x - VP.x;
  const Xw = dx < 0 ? WALL_X.left : WALL_X.right;
  const Dw = Math.abs(dx) < 1 ? 1e4 : Math.min(1e4, (Xw * F) / dx);
  const foot = sy(0, Dw);
  return Math.max(2, 2 * foot - y);
}

/** Lamps and headlights (as in passage 1): their reflections stay bare paper. */
const LAMPS = [
  { X: -3.6, D: 8 },
  { X: 3.5, D: 15 },
  { X: -3.6, D: 38 },
  { X: 3.5, D: 46 },
  { X: -3.6, D: 70 },
  { X: 3.5, D: 85 },
  { X: -3.6, D: 120 },
  { X: 3.5, D: 150 },
].map((l) => ({ x: sx(l.X, l.D), y: sy(7.5, l.D), r: (0.35 * F) / l.D, gy: sy(0, l.D) }));
const HEADLIGHTS = [
  { X: -3.1, D: 24 },
  { X: -1.7, D: 24 },
  { X: -3.6, D: 60 },
  { X: -1.6, D: 60 },
  { X: -2.9, D: 110 },
  { X: -1.8, D: 110 },
  { X: -3.2, D: 190 },
  { X: -2.2, D: 190 },
].map((h) => ({
  x: sx(h.X, h.D),
  y: sy(0.65, h.D),
  r: Math.max(2, (0.22 * F) / h.D),
  gy: sy(0, h.D),
}));

/** Steam from the stack in the road (as in passage 1). */
const STACK = { x: sx(-3, 13), y: sy(2.4, 13) };
function steam(x, y) {
  const t = (STACK.y - y) / 420;
  if (t < -0.02 || t > 1.15) return 0;
  const u = Math.max(0, t);
  const cx = STACK.x - 150 * u ** 1.3 + 22 * noise(u * 3, 4.1);
  const half = 14 + 120 * u ** 0.8;
  const d = Math.abs(x - cx) / half;
  const n = 0.75 + 0.35 * noise(x / 40, y / 55);
  return clamp01((1 - d * d) * n * (1 - clamp01((t - 0.55) / 0.6)) * 1.25);
}

/** The crosswalk (as in passage 1): its stripes take the reflections only lightly. */
function crosswalk(x, y) {
  const g = groundAt(x, y);
  if (!g || g.D < 7 || g.D > 8.6 || g.X < -4.5 || g.X > 4.4) return 0;
  return (g.X + 10) % 1.1 < 0.6 ? 1 : 0;
}

/** How strongly the brush lifts at a point. */
function reserve(x, y, m) {
  let s = Math.max(steam(x, y), 0.5 * crosswalk(x, y));
  for (const l of LAMPS) {
    if (y < l.gy) continue;
    const len = (l.gy - l.y) * 1.3;
    const d =
      Math.hypot((x - l.x) * 2.2, Math.max(0, Math.abs(y - l.gy - len / 2) - len / 2) * 0.5) - l.r;
    s = Math.max(s, 0.8 * clamp01(1 - d / m));
  }
  for (const h of HEADLIGHTS) {
    if (y < h.gy - h.r) continue;
    const len = (h.gy - h.y) * 6;
    const d = Math.hypot((x - h.x) * 2.5, Math.max(0, y - h.gy - len) * 0.4) - h.r * 0.8;
    s = Math.max(s, 0.9 * clamp01(1 - d / m));
  }
  return s;
}

/** Three dishes for the road: the near road takes the strongest wash, the far end the palest. */
const DISH = { strong: 0.25, medium: 0.35, pale: 0.45 };
/** The dish at a point of the road, its edges ragged where the wash ran. */
function dishAt(x, y, near) {
  const k = near + 0.1 * noise(x / 110, y / 70) + rand(-0.04, 0.04);
  return k > 0.55 ? DISH.strong : k > 0.2 ? DISH.medium : DISH.pale;
}

// The reflections: rows from the far end toward us, each a run of short upright
// strokes, longer and wider as the road comes closer. Each carries the mirrored color,
// darkened with the road's grey; the pavements beyond the curbs reflect less.
for (let y = VP.y + 3; y < H + 10; y += 3 + (y - VP.y) * 0.035) {
  const near = (y - VP.y) / (H - VP.y);
  const step = 4 + near * 14;
  for (let x = rand(-8, 0); x < W + 8; x += step * rand(0.8, 1.2)) {
    const g = groundAt(x, y);
    if (!g) continue;
    const pave = g.X < CURB_X.left || g.X > CURB_X.right;
    const seen = at(x, mirrorY(x, y));
    const len = 14 + near * 120 + rand(0, 20 + near * 60);
    const m = step * 0.9;
    stroke({
      path: [
        [x, y, 0.7 * (1 - reserve(x, y, m))],
        [x + rand(-1, 1), y + len / 2, 0.75 * (1 - reserve(x, y + len / 2, m))],
        [x + rand(-1, 1), y + len, 0.6 * (1 - reserve(x, y + len, m))],
      ],
      brush: { type: 'soft', width: step * 2.6 },
      color: mix([seen, pave ? 1.4 : 2.4], [pave ? 'pavement' : 'roadGrey', 1]),
      paint: 'transparent',
      thinner: dishAt(x, y, near),
      load: 0.85,
    });
  }
}

// A clean damp brush drawn straight down through the wet reflections, again and
// again: the streaks of a rain-soaked road.
for (let k = 0; k < 420; k++) {
  const x = rand(-10, W + 10);
  const y = rand(VP.y + 10, H - 40);
  const near = (y - VP.y) / (H - VP.y);
  const len = 40 + near * rand(80, 260);
  stroke({
    path: [
      [x, y],
      [x + rand(-2, 2), y + len],
    ],
    brush: { type: 'soft', width: 10 + near * 30 },
    pressure: rand(0.5, 0.75),
    end: 'taper',
  });
}

// The curbs: a dark line each side, running up to the far end, finer as it goes.
for (const X of [CURB_X.left, CURB_X.right]) {
  for (const [D0, D1] of [
    [5, 9],
    [9, 16],
    [16, 30],
    [30, 60],
    [60, 140],
  ]) {
    stroke({
      path: [
        [sx(X, D0), sy(0, D0)],
        [sx(X, D1), sy(0, D1)],
      ],
      brush: { type: 'round', width: Math.max(1.2, (0.16 * F) / ((D0 + D1) / 2)) },
      color: 'curb',
      paint: 'glaze',
      thinner: 0.3,
      load: 0.8,
    });
  }
}

dry();
