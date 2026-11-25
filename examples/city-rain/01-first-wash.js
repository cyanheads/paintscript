/**
 * Passage 1: the first wash, wet into wet over the whole sheet.
 *
 * A rainy avenue at dusk, seen from a little above the street: the buildings close in
 * on both sides, the sky is a glowing slot at the far end, and the wet road mirrors it.
 * This passage lays the lightest tones everywhere at once, the way a watercolorist
 * floods the sheet: warm glow at the far end of the avenue and down the middle of the
 * road, cooling to blue-grey at the top and the edges. The brightest lights (lamp
 * heads, headlights, the steam, the crosswalk) are saved by lifting the brush off the
 * paper around them, so they stay the paper's own white. While the wash is still wet,
 * a few bold drops of rose, gold, and blue go into it to bloom where they land, and a
 * little warm color is dropped in around each lamp head for its halo.
 */

// The tubes. Every other color is mixed from these, and lightened with water, never white.
palette('water', '#f3efe6');
palette('gamboge', '#f2b51a');
palette('scarlet', '#d8381f');
palette('crimson', '#8c1c34');
palette('ultra', '#24308e');
palette('payne', '#2f3a48');
palette('sienna', '#8b4522');
palette('ochre', '#c99a3e');
palette('cerulean', '#3f8fc0');

// Piles for the first wash, from the hot glow at the end of the avenue to the cool top.
palette('glowHot', mix(['gamboge', 1], ['ochre', 0.6], ['water', 7]));
palette('glow', mix(['ochre', 1], ['crimson', 0.18], ['water', 7]));
palette('skyRose', mix(['crimson', 0.5], ['payne', 0.5], ['ochre', 0.3], ['water', 8]));
palette('skyGrey', mix(['payne', 1], ['crimson', 0.2], ['water', 6]));
palette('skyCool', mix(['payne', 1], ['ultra', 0.3], ['water', 4]));
// The warm drop for the lamps' halos.
palette('lampWarm', mix(['gamboge', 2], ['scarlet', 0.35], ['water', 3]));

const W = canvas.width;
const H = canvas.height;

/**
 * The view: eye 5 m above the road, looking up the avenue. A point X metres right of
 * the avenue's middle, D metres away and Z metres up lands at (sx, sy).
 */
const VP = { x: 630, y: 780 };
const EYE = 5;
const F = 1000;
const sx = (X, D) => VP.x + (X * F) / D;
const sy = (Z, D) => VP.y + ((EYE - Z) * F) / D;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** The lamps: head positions (the arm reaches over the road from the curb). */
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

/** Headlights coming toward us: the cab, the bus, and pairs far up the avenue. */
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

/** The steam from the stack in the road: how dense it is at a point, 0–1. */
const STACK = { x: sx(-3, 13), y: sy(2.4, 13) };
function steam(x, y) {
  const t = (STACK.y - y) / 420; // 0 at the stack's mouth, 1 high up
  if (t < -0.02 || t > 1.15) return 0;
  const u = Math.max(0, t);
  const cx = STACK.x - 150 * u ** 1.3 + 22 * noise(u * 3, 4.1);
  const half = 14 + 120 * u ** 0.8;
  const d = Math.abs(x - cx) / half;
  const n = 0.75 + 0.35 * noise(x / 40, y / 55);
  return clamp01((1 - d * d) * n * (1 - clamp01((t - 0.55) / 0.6)) * 1.25);
}

/** The crosswalk: pale stripes running up the avenue, between D 7 and 8.6. */
function crosswalk(x, y) {
  if (y <= VP.y) return 0;
  const D = (EYE * F) / (y - VP.y);
  if (D < 7 || D > 8.6) return 0;
  const X = ((x - VP.x) * D) / F;
  if (X < -4.5 || X > 4.4) return 0;
  return (X + 10) % 1.1 < 0.6 ? 1 : 0;
}

/**
 * How strongly the brush should spare a point: 1 keeps the paper bare. `margin` is how
 * far around a light the brush starts to lift, about half its width.
 */
function reserve(x, y, margin) {
  let s = 0;
  for (const l of LAMPS) {
    const d = Math.hypot(x - l.x, (y - l.y) * 1.4) - l.r;
    s = Math.max(s, clamp01(1 - d / margin));
    // its reflection runs straight down the wet road
    const ry = l.gy + (l.gy - l.y);
    if (y > l.gy) {
      const dr =
        Math.hypot(
          (x - l.x) * 2.2,
          Math.max(0, Math.abs(y - (l.gy + ry) / 2) - (ry - l.gy) / 2) * 0.5,
        ) - l.r;
      s = Math.max(s, 0.8 * clamp01(1 - dr / margin));
    }
  }
  for (const h of HEADLIGHTS) {
    const d = Math.hypot(x - h.x, y - h.y) - h.r;
    s = Math.max(s, clamp01(1 - d / margin));
    // its reflection: a long streak from the road under it toward us
    if (y > h.gy) {
      const len = (h.gy - h.y) * 6;
      const dr = Math.hypot((x - h.x) * 2.5, Math.max(0, y - h.gy - len) * 0.4) - h.r * 0.8;
      s = Math.max(s, 0.85 * clamp01(1 - dr / margin));
    }
  }
  s = Math.max(s, steam(x, y));
  s = Math.max(s, 0.55 * crosswalk(x, y));
  return s;
}

/**
 * A stroke path from (x0, y0) to (x1, y1) with a little sag, resampled every 6 px, its
 * pressure eased off wherever reserve() asks the paper to stay bare.
 */
function spared(x0, y0, x1, y1, base, margin) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  const sag = rand(-6, 6);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + sag * Math.sin(Math.PI * t);
    pts.push([x, y, base * (1 - reserve(x, y, margin))]);
  }
  return pts;
}

/**
 * Which pile a level band takes at height y: in the middle of the avenue the sky slot
 * and its reflection in the road (hot glow at the far end, cooling away from it); out
 * at the sides the walls and pavements, a plain cool grey.
 */
function middlePile(y) {
  if (y < 260) return 'skyCool';
  if (y < 520) return 'skyRose';
  if (y < 700) return 'glow';
  if (y < 1010) return 'glowHot';
  if (y < 1320) return 'glow';
  return 'skyRose';
}
/** Half the width of the middle band at height y: the sky slot, and the glow's column in the road. */
const middleHalf = (y) => (y < VP.y ? 190 - (VP.y - y) * 0.02 : 70 + (y - VP.y) * 0.34);

brush('flood', { type: 'soft', width: 110, reservoir: 8 });
brush('floodSmall', { type: 'soft', width: 50, reservoir: 6 });

// The flood: overlapping level bands from the top down, each in three strokes (side,
// middle, side) that run into each other wet at their seams. Where a light is near,
// a smaller brush works in closer to it.
for (let y = -20; y < H + 40; y += 26) {
  const half = middleHalf(y) * rand(0.9, 1.1);
  const xl = VP.x - half;
  const xr = VP.x + half;
  const bands = [
    [-90, xl + 50, y < VP.y + 20 ? 'skyGrey' : 'skyCool'],
    [xl - 50, xr + 50, middlePile(y + rand(-30, 30))],
    [xr - 50, W + 90, y < VP.y + 20 ? 'skyGrey' : 'skyCool'],
  ];
  for (const [x0, x1, pile] of bands) {
    const near = reserve((x0 + x1) / 2, y, 60) > 0.02 || y > 1330;
    stroke({
      path: spared(x0, y + rand(-6, 6), x1, y + rand(-6, 6), rand(0.62, 0.75), near ? 24 : 46),
      brush: near ? 'floodSmall' : 'flood',
      color: pile,
      paint: 'transparent',
      thinner: 0.62,
      load: 0.85,
    });
  }
}

// A few bold drops of color into the wet flood, left to bloom where they land: rose and
// gold at the far end of the avenue, a cool blue high in the sky slot, a warm one
// down the road where the glow is reflected.
palette('dropRose', mix(['crimson', 1], ['scarlet', 0.3], ['water', 2]));
palette('dropGold', mix(['gamboge', 1], ['scarlet', 0.15], ['water', 1.5]));
palette('dropBlue', mix(['cerulean', 1], ['ultra', 0.3], ['water', 2]));
for (const [x, y, w, pile] of [
  [610, 600, 70, 'dropRose'],
  [680, 690, 60, 'dropGold'],
  [560, 120, 90, 'dropBlue'],
  [720, 260, 70, 'dropBlue'],
  [640, 1060, 80, 'dropGold'],
  [600, 1280, 70, 'dropRose'],
]) {
  stroke({
    path: [
      [x + rand(-8, 8), y + rand(-8, 8), 0.7 * (1 - reserve(x, y, 20))],
      [x + rand(-14, 14), y + rand(14, 26), 0.6 * (1 - reserve(x, y + 20, 20))],
    ],
    brush: { type: 'soft', width: w },
    color: pile,
    paint: 'transparent',
    thinner: 0.62,
    load: 0.85,
  });
}

// Warm drops into the wet wash: a small halo around each lamp head.
for (const l of LAMPS) {
  for (let k = 0; k < 3; k++) {
    const a = rand(Math.PI * 2);
    const r = l.r * rand(1.8, 3);
    const x = l.x + Math.cos(a) * r;
    const y = l.y + Math.sin(a) * r * 0.7;
    stroke({
      path: [[x, y, 0.55 * (1 - reserve(x, y, l.r))]],
      brush: { type: 'soft', width: l.r * rand(2.5, 3.5) + 6 },
      color: 'lampWarm',
      paint: 'transparent',
      thinner: 0.75,
      load: 0.8,
    });
  }
}

// The flood sets before anything goes over it.
dry();
