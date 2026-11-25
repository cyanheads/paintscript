/**
 * Passage 3: the white cloth over the table.
 *
 * The cloth's top is laid in level knife planes, warm white where the window light
 * lands and greying toward the back right. Into that wet paint go the folds (a light
 * plane against a shaded one, run diagonally toward the front), the jug's cool shadow
 * thrown down to the right, and the drop over the table's front edge, where the cloth
 * hangs in vertical folds in shade. Last, the lit ridges get a thicker white.
 */

const W = canvas.width;
const H = canvas.height;
const TABLE = 975;
const FRONT = 1385;
const JUG = { x: 560, base: 1215 };

// Folds across the cloth's top: each runs from its back point toward the front.
const FOLDS = [
  { x0: 140, y0: 1030, x1: 290, y1: 1380 },
  { x0: 950, y0: 1010, x1: 1100, y1: 1380 },
];

/** How deep the jug's shadow lies at (x, y) on the cloth: 0 outside, 1 at the foot. */
function jugShadow(x, y) {
  const dx = x - JUG.x;
  if (dx < -150) return 0;
  const d = Math.hypot((x - 790) / 300, (y - 1238) / (48 + Math.max(0, dx) * 0.07));
  return Math.max(0, 1 - d) * (dx < 330 ? 1 : 0.7);
}

/** The cloth's pile at (x, y) on its top: light at the front left, greying to the back right. */
function clothPile(x, y) {
  if (jugShadow(x, y) > 0.35 + rand(-0.1, 0.1)) return x < 820 ? 'clothDeep' : 'clothShade';
  const d = x * 0.75 - (y - TABLE) * 0.45 + 130 * noise(x / 160, y / 70) + rand(-20, 20);
  // the bouquet's shadow lies across the back of the cloth on the right
  if (x > 700 && y < 1035 + rand(-10, 10)) return 'clothShade';
  return d < 420 ? 'clothLight' : d < 760 ? 'clothMid' : 'clothShade';
}

/** One knife plane: a bowed sweep with uneven pressure, its footprint kept in [top, bottom]. */
function plane(x, y, a, len, width, color, opts = {}) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const bow = rand(-0.1, 0.1) * len;
  const p0 = rand(0.5, 1);
  const p2 = rand(0.25, 0.9);
  stroke({
    path: [
      [x, y, p0],
      [x + c * len * 0.5 - s * bow, y + s * len * 0.5 + c * bow, Math.min(1, (p0 + p2) / 2 + 0.15)],
      [x + c * len, y + s * len, p2],
    ],
    brush: { type: 'knife', width, streak: rand(0.1, 0.3), toneVar: 0.3 },
    color,
    load: opts.load ?? rand(0.8, 1),
    end: rand() < 0.4 ? 'stop' : 'lift',
  });
}

// First course: level planes across the top, narrower toward the back where it recedes.
for (let y = TABLE + 6; y < FRONT - 6; y += rand(18, 30)) {
  const depth = (y - TABLE) / (FRONT - TABLE);
  for (let x = -60 - rand(100); x < W + 20; x += rand(60, 140)) {
    const w = (24 + depth * 34) * rand(0.7, 1.25);
    plane(x, y + rand(-7, 7), rand(-0.13, 0.13), rand(80, 200), w, clothPile(x + 60, y));
  }
}

// The folds, wet into wet: along each, a lit plane on its upper left, a shaded one below it.
for (const f of FOLDS) {
  const len = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
  const a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  for (let t = 0; t < len - 30; t += rand(50, 80)) {
    const x = f.x0 + Math.cos(a) * t;
    const y = f.y0 + Math.sin(a) * t;
    const seg = Math.min(rand(70, 110), len - t);
    const j = rand(-6, 6);
    plane(
      x - nx * (14 + j),
      y - ny * (14 + j),
      a + rand(-0.1, 0.1),
      seg,
      rand(16, 30),
      'clothLight',
    );
    plane(
      x + nx * (12 + j),
      y + ny * (12 + j),
      a + rand(-0.1, 0.1),
      seg * rand(0.6, 1),
      rand(12, 26),
      jugShadow(x, y) > 0.2 ? 'clothShade' : 'clothMid',
      { load: rand(0.6, 0.85) },
    );
  }
}

// The jug's shadow: long planes laid along it, deepest against the foot.
for (let i = 0; i < 60; i++) {
  const x = rand(JUG.x - 80, 1150);
  const y = rand(1185, 1300);
  const s = jugShadow(x, y);
  if (s < 0.2) continue;
  plane(
    x - 40,
    y,
    rand(-0.12, 0.08),
    rand(70, 140),
    rand(16, 30),
    s > 0.55 && x < 820 ? 'clothDeep' : 'clothShade',
  );
}
// the dark where the foot meets the cloth
stroke({
  path: [
    [JUG.x - 140, JUG.base - 2, 0.6],
    [JUG.x, JUG.base + 4, 1],
    [JUG.x + 150, JUG.base - 2, 0.8],
  ],
  brush: { type: 'knife', width: 12 },
  color: mix(['clothDeep', 2], ['cobaltDeep', 1]),
  load: 0.9,
});

// The drop over the front edge: vertical planes in shade, the folds lighter on their ridges.
/** How far up a fold's ridge x lies on the hanging cloth, 0 in a hollow to 1 on a ridge. */
const ridge = (x) => 0.5 + 0.5 * Math.sin(x / 95 + noise(x / 200, 3) * 2);
const dropPile = (x) => {
  const r = ridge(x) + rand(-0.15, 0.15);
  return r > 0.7 ? 'clothMid' : r < 0.25 ? 'clothDeep' : 'clothShade';
};
for (let x = -30; x < W + 30; x += rand(28, 60)) {
  plane(
    x + rand(-6, 6),
    FRONT + 18,
    Math.PI / 2 + rand(-0.08, 0.08),
    H - FRONT,
    rand(28, 50),
    dropPile(x),
  );
}
// and shorter planes pushed into them wet, so the folds turn instead of striping
for (let i = 0; i < 70; i++) {
  const x = rand(-20, W + 20);
  plane(
    x,
    rand(FRONT + 20, H - 40),
    Math.PI / 2 + rand(-0.2, 0.2),
    rand(40, 90),
    rand(18, 34),
    dropPile(x),
    { load: rand(0.6, 0.9) },
  );
}
// the cloth rolling over the edge catches the light in one long ridge
for (let x = -40; x < W; x += rand(120, 180)) {
  const lit = x < 750;
  plane(
    x,
    FRONT + rand(-4, 4),
    rand(-0.03, 0.03),
    rand(150, 220),
    rand(16, 22),
    lit ? 'clothLight' : 'clothMid',
  );
}

// Thicker whites on the lit side of the cloth, the last and heaviest paint here.
for (let i = 0; i < 40; i++) {
  const x = rand(-20, 720);
  const y = rand(TABLE + 40, FRONT - 20);
  if (jugShadow(x, y) > 0 || Math.abs(x - JUG.x) < 200) continue;
  plane(x, y, rand(-0.1, 0.1), rand(50, 100), rand(18, 34), 'clothLight', { load: 1 });
}

dry();
