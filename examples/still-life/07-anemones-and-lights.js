/**
 * Passage 7: the white anemones, the lemon and fallen petals, and the last thick lights.
 *
 * Each anemone is six rounded petals, warm white where they face the window and cool
 * where they turn from it, laid with the knife like the poppies and finished with a
 * black heart and a ring of stamens. On the cloth, a lemon is turned in curved planes
 * over its own small shadow, and two fallen petals lie in front of the jug. Last, the
 * heaviest paint in the picture: the window's highlight on the jug and a few lights on
 * the wall and cloth, pressed on with a fully loaded knife and left standing.
 */

const LIGHT = { x: -0.63, y: -0.77 };
const JUG = { x: 560 };

const ANEMONES = [
  { x: 600, y: 610, r: 90, tilt: -0.2, squash: 0.85 },
  { x: 760, y: 805, r: 78, tilt: 0.4, squash: 0.68 },
  { x: 320, y: 280, r: 70, tilt: 0.2, squash: 0.8 },
];

/** Map a point on the flat flower (dx, dy from center) onto the canvas, foreshortened. */
function place(f, dx, dy) {
  const c = Math.cos(f.tilt);
  const s = Math.sin(f.tilt);
  const u = dx * c + dy * s;
  const v = (-dx * s + dy * c) * f.squash;
  return [f.x + u * c - v * s, f.y + u * s + v * c];
}

/** A knife stroke through points given in the flower's own polar terms [angle, radius, pressure]. */
function polar(f, pts, width, color, opts = {}) {
  stroke({
    path: pts.map(([a, r, p]) => [...place(f, Math.cos(a) * r, Math.sin(a) * r), p]),
    brush: { type: 'knife', width, streak: opts.streak ?? 0.2, toneVar: 0.3 },
    color,
    load: opts.load ?? 0.95,
    end: opts.end ?? 'stop',
  });
}

for (const f of ANEMONES) {
  const start = rand(Math.PI * 2);
  const step = (Math.PI * 2) / 6;
  for (let k = 0; k < 6; k++) {
    const th = start + k * step + rand(-0.1, 0.1);
    const facing = Math.cos(th) * LIGHT.x + Math.sin(th) * LIGHT.y;
    const pile =
      facing > 0.2
        ? 'petalWhite'
        : facing < -0.4
          ? 'petalCool'
          : mix(['petalWhite', 1], ['petalCool', 1]);
    const reach = f.r * rand(0.9, 1.02);
    for (const off of [-0.3, 0, 0.3]) {
      const a = th + off * step;
      polar(
        f,
        [
          [a, f.r * 0.15, 0.6],
          [a + rand(-0.08, 0.08), reach * 0.55, 1],
          [a, reach * (1 - Math.abs(off) * 0.2), rand(0.6, 1)],
        ],
        f.r * 0.34,
        pile,
      );
    }
    // the rounded rim, swept across the petal's end
    polar(
      f,
      [
        [th - step * 0.45, reach * 0.82, 0.6],
        [th, reach * 0.95, 1],
        [th + step * 0.45, reach * 0.82, 0.7],
      ],
      f.r * 0.16,
      facing > 0.2 ? mix(['petalWhite', 3], ['white', 1]) : pile,
      { load: 0.9 },
    );
  }
  // a shadow pressed into the wet whites round the heart, then the black heart
  for (let k = 0; k < 5; k++) {
    const a = rand(Math.PI * 2);
    polar(
      f,
      [
        [a, f.r * 0.15, 0.8],
        [a, f.r * 0.42, 0.4],
      ],
      f.r * 0.16,
      'petalCool',
      { load: 0.7, end: 'lift' },
    );
  }
  for (let k = 0; k < 3; k++) {
    const a = rand(Math.PI);
    polar(
      f,
      [
        [a, f.r * 0.14, 0.9],
        [a + Math.PI, f.r * 0.14, 0.9],
      ],
      f.r * 0.13,
      'black',
      { load: 1 },
    );
  }
  const n = Math.round(f.r * 0.28);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rand(-0.12, 0.12);
    const [x, y] = place(
      f,
      Math.cos(a) * f.r * rand(0.22, 0.3),
      Math.sin(a) * f.r * rand(0.22, 0.3),
    );
    stroke({
      path: [[x, y]],
      brush: { type: 'knife', width: rand(3.5, 6) },
      color: 'black',
      load: 0.9,
      angle: a,
    });
  }
  const [hx, hy] = place(f, -f.r * 0.05, -f.r * 0.06);
  stroke({ path: [[hx, hy]], brush: { type: 'knife', width: 5 }, color: 'petalCool', load: 1 });
}

// The lemon: its shadow on the cloth, then planes turned along its length, lit top left.
const LEMON = { x: 935, y: 1272, rx: 64, ry: 42, a: -0.22 };
const lc = Math.cos(LEMON.a);
const ls = Math.sin(LEMON.a);
const onLemon = (u, v) => [
  LEMON.x + u * LEMON.rx * lc - v * LEMON.ry * ls,
  LEMON.y + u * LEMON.rx * ls + v * LEMON.ry * lc,
];
for (let k = 0; k < 4; k++) {
  stroke({
    path: [
      [LEMON.x - 30, LEMON.y + 34 + k * 5],
      [LEMON.x + 40, LEMON.y + 40 + k * 4],
      [LEMON.x + 110, LEMON.y + 26 + k * 3],
    ],
    brush: { type: 'knife', width: 16 },
    color: k < 2 ? 'clothDeep' : 'clothShade',
    load: 0.85,
  });
}
for (let v = -0.8; v <= 0.81; v += 0.32) {
  const span = Math.sqrt(1 - v * v) * 0.95;
  const pile = v < -0.4 ? 'lemonLight' : v > 0.5 ? 'lemonShade' : 'lemon';
  stroke({
    path: [onLemon(-span, v + 0.12), onLemon(0, v), onLemon(span, v + 0.12)].map(([x, y]) => [
      x,
      y,
      rand(0.6, 1),
    ]),
    brush: { type: 'knife', width: 19, streak: 0.2, toneVar: 0.3 },
    color: pile,
    load: 0.95,
  });
}
for (const u of [-1.08, 1.08]) {
  stroke({
    path: [onLemon(u, 0)],
    brush: { type: 'knife', width: 9 },
    color: 'lemon',
    load: 0.9,
    angle: LEMON.a,
  });
}
stroke({
  path: [onLemon(-0.35, -0.55), onLemon(0.1, -0.62)],
  brush: { type: 'knife', width: 6 },
  color: 'white',
  load: 1,
  end: 'stop',
});

// Fallen petals in front of the jug, each over a sliver of its own shadow.
const FALLEN = [
  { x: 370, y: 1300, a: 0.35, piles: ['red', 'redLight'] },
  { x: 705, y: 1350, a: -0.5, piles: ['orange', 'orangeLight'] },
];
for (const p of FALLEN) {
  const c = Math.cos(p.a);
  const s = Math.sin(p.a);
  stroke({
    path: [
      [p.x - c * 26 + 5, p.y - s * 26 + 9],
      [p.x + c * 26 + 5, p.y + s * 26 + 9],
    ],
    brush: { type: 'knife', width: 20 },
    color: 'clothShade',
    load: 0.8,
  });
  // a cupped petal: its body, then the lit inner curve pressed into it wet
  [0, 1, 2].forEach((k) => {
    const cup = 10 - k * 6;
    stroke({
      path: [
        [p.x - c * 34, p.y - s * 34 - k * 4, 0.6],
        [p.x + s * cup, p.y - c * cup - k * 4, 1],
        [p.x + c * 32, p.y + s * 32 - k * 4, 0.8],
      ],
      brush: { type: 'knife', width: k === 2 ? 10 : 22, streak: 0.2 },
      color: p.piles[k === 2 ? 1 : 0],
      load: 0.95,
      end: 'stop',
    });
  });
}

// The last lights, thick: the window on the jug's shoulder, the wall where the light lands,
// and the lit ridge of the cloth.
stroke({
  path: [
    [JUG.x - 94, 892, 0.7],
    [JUG.x - 100, 915, 1],
    [JUG.x - 104, 940, 0.8],
  ],
  brush: { type: 'knife', width: 10 },
  color: 'jugGlint',
  load: 1,
  end: 'stop',
});
const brightWall = mix(['wallLight', 3], ['white', 1]);
for (let i = 0; i < 14; i++) {
  const x = rand(0, 300);
  const y = rand(0, 260);
  if (Math.hypot(x - 320, y - 280) < 120) continue; // clear of the anemone
  const a = rand(0.3, 0.7);
  stroke({
    path: [
      [x, y, rand(0.6, 1)],
      [x + Math.cos(a) * 50, y + Math.sin(a) * 50, 1],
      [x + Math.cos(a) * 95, y + Math.sin(a) * 95, rand(0.3, 0.8)],
    ],
    brush: { type: 'knife', width: rand(26, 44), streak: 0.25, toneVar: 0.3 },
    color: brightWall,
    load: 1,
    end: 'stop',
  });
}
const brightCloth = mix(['clothLight', 3], ['white', 1]);
for (let i = 0; i < 10; i++) {
  const x = rand(20, 300);
  const y = rand(1060, 1360);
  stroke({
    path: [
      [x, y, 0.8],
      [x + 50, y + rand(-3, 3), 1],
      [x + rand(80, 120), y + rand(-4, 4), 0.5],
    ],
    brush: { type: 'knife', width: rand(16, 28), streak: 0.2 },
    color: brightCloth,
    load: 1,
    end: 'stop',
  });
}
