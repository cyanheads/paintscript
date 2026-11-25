/**
 * Passage 2: the sky, in body color, wet into wet.
 *
 * Short crossing strokes take their tone from the string of sky mixes laid out in the
 * first passage, with a stroke of a neighboring hue dropped in here and there: broken
 * color, so the sky vibrates instead of grading smoothly. Stiff bristles and a full
 * load keep each stroke its own color. Bars of cloud go in over the wet sky, each a
 * row of soft puffs whose edges toward the sun catch the light, and a clean soft brush
 * melts their far edges before the sky is left to dry.
 */

const W = canvas.width;
const HORIZON = 332;
const SUN = { x: 432, y: 248 };
const SKY = ['skyGlow', 'skyGold', 'skyPeach', 'skyRose', 'skyLilac', 'skyBlue', 'skyHigh'];

/**
 * Which pile of the sky string a point takes (as in passage 1): rings around the sun,
 * wider than tall and warmer low down, glow inside the first and high sky past the
 * last, each ring's edge left ragged.
 */
const RINGS = [47, 140, 233, 327, 420, 513];
function skyIndex(x, y) {
  const d =
    Math.hypot((x - SUN.x) / 1.35, (y - SUN.y) * 1.1) - Math.max(0, y - 190) * 1.1 + rand(-25, 25);
  const i = RINGS.findIndex((r) => d < r);
  return i < 0 ? SKY.length - 1 : i;
}
const pile = (i) => SKY[Math.min(SKY.length - 1, Math.max(0, i))];

/** The headland's ridge (as in passage 1): the sky stops at it. */
function headTop(x) {
  if (x < 730) return HORIZON;
  const rise = Math.min(1, (x - 730) / 240) ** 0.75 * 44 + Math.max(0, x - 980) * 0.04;
  return HORIZON - rise + noise(x / 55, 2.6) * 4;
}

/** The lowest the sky's paint may reach at x. */
const skyFloor = (x) => headTop(x) - 3;

brush('skyBristle', { type: 'filbert', width: 30, splay: 0.3, stiffness: 0.85 });
brush('skySmall', { type: 'filbert', width: 16, splay: 0.3, stiffness: 0.85 });
brush('rigger', { type: 'round', width: 7 });
brush('blender', { type: 'soft', width: 34 });

// The sky field: short strokes, laid level near the sea and crossing more higher up.
for (let y = 6; y < HORIZON - 4; y += 14) {
  for (let x = -20; x < W + 20; x += rand(38, 62)) {
    if (y > skyFloor(x) - 4) continue;
    const i = skyIndex(x, y);
    const len = rand(45, 95);
    const swing = Math.max(0, 1 - y / (HORIZON - 60)) * 0.55;
    // a drift from the noise field, plus a random cross one way or the other
    const a = noise(x / 160, y / 90) * swing + (rand() < 0.5 ? swing : -swing) * rand(0.3, 1);
    const dx = (Math.cos(a) * len) / 2;
    const dy = (Math.sin(a) * len) / 2;
    // one stroke in five is a neighboring hue: a rose in the gold, a gold in the lilac
    const color = rand() < 0.2 ? pile(i + (rand() < 0.5 ? -1 : 1)) : pile(i);
    stroke({
      path: [
        [x - dx, Math.min(y - dy, skyFloor(x - dx))],
        [x + dx, Math.min(y + dy + rand(-3, 3), skyFloor(x + dx))],
      ],
      brush: i <= 1 ? 'skySmall' : 'skyBristle',
      color,
      load: rand(0.75, 0.95),
      pressure: rand(0.5, 0.85),
    });
  }
}

/**
 * The bars of cloud: where each runs and how thick it gets. A bar is a row of puffs,
 * round on top and flattened underneath, thickest in the middle of the bar.
 */
const CLOUDS = [
  { x0: -40, x1: 420, y: 70, slope: 0.05, thick: 34 },
  { x0: 650, x1: 1240, y: 92, slope: -0.05, thick: 30 },
  { x0: 150, x1: 930, y: 186, slope: 0.035, thick: 24 },
  { x0: 488, x1: 720, y: 262, slope: -0.02, thick: 11 },
  { x0: 770, x1: 1240, y: 266, slope: -0.03, thick: 20 },
  { x0: -40, x1: 300, y: 298, slope: 0.02, thick: 13 },
];

for (const c of CLOUDS) {
  const span = c.x1 - c.x0;
  const sunBelow = SUN.y > c.y;
  const puffs = [];
  for (let x = c.x0 + rand(10, 30); x < c.x1; x += rand(40, 70)) {
    const u = (x - c.x0) / span;
    const env = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.7;
    puffs.push({
      x,
      y: c.y + (x - (c.x0 + c.x1) / 2) * c.slope + rand(-3, 3),
      rx: rand(38, 70),
      ry: Math.max(4, c.thick * env * rand(0.55, 1.05)),
    });
  }

  for (const p of puffs) {
    // the body: rose-violet against the glow, lilac out in the cool sky
    const i = skyIndex(p.x, p.y);
    const body =
      i <= 2
        ? mix(['cloud', 1.5], ['skyRose', 1], ['alizarin', 0.06])
        : mix(['cloud', 1.1], ['skyLilac', 1], [pile(i), 0.6]);
    const top = p.y - p.ry;
    const bottom = p.y + p.ry * 0.45;
    for (let y = top + 3; y < bottom; y += 7) {
      const v = y < p.y ? (p.y - y) / p.ry : (y - p.y) / (p.ry * 0.45);
      const half = p.rx * Math.sqrt(Math.max(0, 1 - v * v));
      if (half < 6) continue;
      stroke({
        path: [
          [p.x - half, y + rand(-1.5, 1.5)],
          [p.x + half, y + 2 * half * c.slope + rand(-1.5, 1.5)],
        ],
        brush: p.ry > 9 ? 'skySmall' : 'rigger',
        color: body,
        load: 0.85,
        pressure: rand(0.55, 0.8),
      });
    }

    // the side toward the sun catches the light, brightest nearest it
    const light = 1 - Math.hypot(p.x - SUN.x, (p.y - SUN.y) * 1.6) / 560;
    if (light > 0.05) {
      const rim =
        light > 0.5
          ? mix(['skyGlow', 3], ['white', 1])
          : light > 0.25
            ? mix(['skyGold', 1.2], ['skyPeach', 1])
            : mix(['skyGold', 0.5], ['skyPeach', 1]);
      if (sunBelow) {
        // a long line of light under the base, and a shorter, brighter one inside it
        for (const [k, y] of [
          [1.4, bottom],
          [0.7, bottom - 2],
        ]) {
          const len = p.rx * k * rand(0.8, 1.2);
          stroke({
            path: [
              [p.x - len / 2, y],
              [p.x, y + rand(-1, 1)],
              [p.x + len / 2, y + len * c.slope],
            ],
            brush: 'rigger',
            color: k < 1 ? mix([rim, 2], ['white', 1]) : rim,
            load: 1,
            pressure: 0.5 + light * 0.45,
            end: 'taper',
          });
        }
      } else {
        // an arc over the puff's crown
        const arc = [];
        for (let a = Math.PI + 0.35; a <= 2 * Math.PI - 0.35; a += 0.3)
          arc.push([p.x + Math.cos(a) * p.rx * 0.9, p.y + Math.sin(a) * p.ry * 0.95]);
        stroke({
          path: arc,
          brush: 'rigger',
          color: rim,
          load: 0.9,
          pressure: 0.45 + light * 0.4,
          end: 'taper',
        });
      }
    }
  }

  // a clean soft brush drawn along the far side melts it into the sky
  for (const p of puffs) {
    if (p.x > W - 20) continue;
    const y = sunBelow ? p.y - p.ry : p.y + p.ry * 0.45;
    stroke({
      path: [
        [p.x - p.rx * 0.7, y],
        [p.x + p.rx * 0.7, y + p.rx * 1.4 * c.slope],
      ],
      brush: 'blender',
      pressure: 0.4,
    });
  }
}

// The sun's halo: short strokes of the palest mix around the place the sun will sit.
for (let i = 0; i < 44; i++) {
  const a = rand(Math.PI * 2);
  const r = rand(12, 60);
  const x = SUN.x + Math.cos(a) * r * 1.3;
  const y = SUN.y + Math.sin(a) * r;
  stroke({
    path: [
      [x - rand(8, 16), y],
      [x + rand(8, 16), y + rand(-4, 4)],
    ],
    brush: 'skySmall',
    color: r < 32 ? mix(['white', 2], ['skyGlow', 1]) : 'skyGlow',
    load: 0.9,
  });
}

// The sky sets before the sea and headland are painted against it.
dry({ x: 0, y: 0, w: W, h: HORIZON + 2 });
