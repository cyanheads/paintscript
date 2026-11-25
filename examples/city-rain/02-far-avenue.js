/**
 * Passage 2: the sky and the far end of the avenue, wet into wet.
 *
 * The rain sky darkens toward the top of the slot between the buildings, in soft
 * bands that run together. Far up the avenue the towers are only shapes in the rain:
 * pale violet-grey verticals, a stepped spire among them, laid with a soft brush and
 * then melted at their feet with a clean damp brush, so they rise out of the mist
 * instead of standing on it.
 */

const VP = { x: 630, y: 780 };
const EYE = 5;
const F = 1000;
const sx = (X, D) => VP.x + (X * F) / D;
const sy = (Z, D) => VP.y + ((EYE - Z) * F) / D;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

palette('rainSky', mix(['payne', 1], ['ultra', 0.2], ['crimson', 0.15], ['water', 3]));
palette('haze', mix(['payne', 1], ['crimson', 0.35], ['water', 5]));
palette('hazeDeep', mix(['payne', 1], ['crimson', 0.3], ['ultra', 0.2], ['water', 2.6]));

/** The steam from the stack in the road (as in passage 1): its density at a point. */
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

/** A path from (x0, y0) to (x1, y1), resampled every 6 px, lifting off through the steam. */
function spared(x0, y0, x1, y1, base) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    pts.push([x, y, base * (1 - steam(x, y))]);
  }
  return pts;
}

brush('skyWash', { type: 'soft', width: 90, reservoir: 6 });
brush('tower', { type: 'soft', width: 26, reservoir: 3 });
brush('towerFine', { type: 'soft', width: 12, reservoir: 2 });
brush('damp', { type: 'soft', width: 40 });

/** The sky's three dishes, strong at the top of the slot to pale toward the glow. */
const DISH = { strong: 0.45, medium: 0.62, pale: 0.8 };

// The rain sky: level bands across the slot, heavy at the top and thinning to nothing
// toward the glow. Each band takes its wash from one of the three dishes, the changes
// between them wandering, and the walls will cover the sides, so the bands run past
// the slot.
for (let y = -20; y < 560; y += 24) {
  const t = clamp01(y / 560);
  const k = t + 0.14 * noise(y / 90, 3.3) + rand(-0.06, 0.06);
  if (rand() < t * 0.7) continue;
  const x0 = 380 + rand(-40, 40) + t * 60;
  const x1 = 1000 + rand(-40, 40) - t * 120;
  stroke({
    path: spared(x0, y + rand(-5, 5), x1, y + rand(-8, 8), 0.75 * (1 - t) + 0.2),
    brush: 'skyWash',
    color: 'rainSky',
    paint: 'transparent',
    thinner: k < 0.34 ? DISH.strong : k < 0.68 ? DISH.medium : DISH.pale,
    load: 0.85,
  });
}

/**
 * The far towers: x, top, and width in px. The tall one with the setbacks is the
 * spire; the rest are blocks of different heights fading into the glow.
 */
const TOWERS = [
  { x: 548, top: 610, w: 30 },
  { x: 580, top: 560, w: 34 },
  { x: 612, top: 640, w: 24 },
  { x: 700, top: 590, w: 36 },
  { x: 736, top: 650, w: 30 },
  { x: 760, top: 620, w: 26 },
];
for (const t of TOWERS) {
  for (let dx = -t.w / 2 + 6; dx <= t.w / 2 - 6; dx += 9) {
    const top = t.top + rand(-3, 3);
    stroke({
      path: spared(t.x + dx, top, t.x + dx + rand(-1, 1), VP.y + 6, 0.7),
      brush: 'tower',
      color: 'haze',
      paint: 'transparent',
      thinner: 0.5,
      load: 0.8,
    });
  }
}

// The spire: a stepped tower narrowing to a mast, in the deeper haze, with crisper
// edges than the rest since it is the one shape the eye should find.
const SPIRE = { x: 662, base: VP.y + 4 };
const STEPS = [
  { top: 470, w: 46 },
  { top: 400, w: 34 },
  { top: 350, w: 24 },
  { top: 318, w: 14 },
  { top: 296, w: 8 },
];
for (const s of STEPS) {
  for (let dx = -s.w / 2 + 3; dx <= s.w / 2 - 3; dx += 5) {
    stroke({
      path: spared(SPIRE.x + dx, s.top, SPIRE.x + dx, SPIRE.base, 0.75),
      brush: 'towerFine',
      color: 'hazeDeep',
      paint: 'transparent',
      thinner: 0.45,
      load: 0.85,
    });
  }
}
stroke({
  path: [
    [SPIRE.x, 300],
    [SPIRE.x, 236, 0.2],
  ],
  brush: { type: 'round', width: 4 },
  color: 'hazeDeep',
  paint: 'transparent',
  thinner: 0.3,
  load: 0.9,
  end: 'taper',
});

// A clean damp brush drawn level through the towers' feet and up their sides: the
// mist the avenue's far end dissolves into.
for (let y = VP.y - 10; y > 640; y -= 14) {
  stroke({
    path: [
      [500, y + rand(-4, 4)],
      [640, y + rand(-4, 4)],
      [800, y + rand(-4, 4)],
    ],
    brush: 'damp',
    pressure: 0.55,
  });
}
for (const t of [...TOWERS, { x: SPIRE.x - 22, top: 470 }, { x: SPIRE.x + 22, top: 470 }]) {
  stroke({
    path: [
      [t.x + rand(-8, 8), t.top + 10],
      [t.x + rand(-8, 8), VP.y],
    ],
    brush: 'damp',
    pressure: 0.45,
  });
}

dry();
