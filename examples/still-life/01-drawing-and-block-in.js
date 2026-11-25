/**
 * Passage 1: the drawing and a lean block-in over a warm earth ground.
 *
 * The tubes go on the palette and the piles for the whole painting are mixed from them.
 * Then the composition is drawn in thin umber with a small round brush (the table's
 * back edge, the jug, the circles of the flower heads), and every mass is scrubbed in
 * with a big flat in thinned paint: light wall at the upper left where the window light
 * falls, the olive wall darkening to the right, the cloth, the jug, the dark of the
 * bouquet. The warm ground stays open in the gaps, to glow through the knife work.
 */

// The tubes. Every color in the painting is mixed from these eight.
palette('white', '#f6f2e7');
palette('cadYellow', '#f4c20d');
palette('ochre', '#c48a2c');
palette('cadRed', '#d8381c');
palette('alizarin', '#7a1830');
palette('ultra', '#22307f');
palette('viridian', '#17644f');
palette('umber', '#4a2e1f');

// Wall: lightest where the window light lands, through ochre and olive to the shaded right.
palette('wallLight', mix(['white', 7], ['ochre', 1], ['cadRed', 0.12]));
palette('wallGold', mix(['white', 3.5], ['ochre', 1.3], ['cadRed', 0.14], ['umber', 0.1]));
palette(
  'wallOlive',
  mix(['white', 2.2], ['ochre', 1], ['umber', 0.55], ['viridian', 0.1], ['alizarin', 0.06]),
);
palette(
  'wallDeep',
  mix(
    ['umber', 1.1],
    ['ochre', 0.7],
    ['white', 0.9],
    ['viridian', 0.16],
    ['alizarin', 0.12],
    ['ultra', 0.1],
  ),
);
palette(
  'wallShadow',
  mix(['umber', 1], ['white', 0.9], ['ultra', 0.3], ['alizarin', 0.22], ['ochre', 0.3]),
);

// Cloth: warm white in the light, blue-grey turning to blue-violet in the shade.
palette('clothLight', mix(['white', 10], ['cadYellow', 0.25], ['ochre', 0.15]));
palette('clothMid', mix(['white', 6], ['ultra', 0.25], ['ochre', 0.3], ['alizarin', 0.06]));
palette('clothShade', mix(['white', 3.5], ['ultra', 0.55], ['alizarin', 0.18], ['umber', 0.15]));
palette('clothDeep', mix(['white', 1.5], ['ultra', 0.8], ['alizarin', 0.35], ['umber', 0.3]));

// The jug: a cobalt glaze, deep on the shadow side, with a cool white highlight.
palette('cobaltDeep', mix(['ultra', 2], ['alizarin', 0.25], ['umber', 0.35], ['white', 0.15]));
palette('cobalt', mix(['ultra', 2], ['white', 0.7], ['viridian', 0.12]));
palette('cobaltLight', mix(['ultra', 1], ['white', 1.6], ['viridian', 0.08]));
palette('jugGlint', mix(['white', 8], ['ultra', 0.3]));
palette('jugWarm', mix(['ultra', 1], ['white', 1.2], ['alizarin', 0.3], ['ochre', 0.45]));

// Poppies: three families, each a dark, a body, and a light.
palette('redDark', mix(['alizarin', 2], ['cadRed', 1], ['umber', 0.2]));
palette('red', mix(['cadRed', 3], ['alizarin', 0.5]));
palette('redLight', mix(['cadRed', 3], ['cadYellow', 0.5], ['white', 0.3]));
palette('orangeDark', mix(['cadRed', 2], ['alizarin', 0.4], ['ochre', 0.6]));
palette('orange', mix(['cadRed', 2], ['cadYellow', 1.4]));
palette('orangeLight', mix(['cadYellow', 2], ['cadRed', 0.7], ['white', 0.6]));
palette('coralDark', mix(['cadRed', 1.5], ['alizarin', 0.7], ['white', 0.4]));
palette('coral', mix(['cadRed', 2], ['white', 1.1], ['alizarin', 0.25]));
palette('coralLight', mix(['white', 2.4], ['cadRed', 1], ['cadYellow', 0.3]));

// Greens: the glaucous grey-green of poppy leaves, a dark for the depths, a stem green.
palette('leafDark', mix(['viridian', 1.2], ['umber', 1.3], ['ultra', 0.35]));
palette('leaf', mix(['viridian', 1], ['ochre', 1], ['umber', 0.55], ['white', 0.6]));
palette(
  'leafGrey',
  mix(['white', 2], ['viridian', 0.6], ['ochre', 0.6], ['umber', 0.3], ['ultra', 0.12]),
);
palette('stem', mix(['viridian', 0.8], ['ochre', 1.2], ['umber', 0.5], ['white', 0.4]));

// Anemones and the darks of every flower center: a chromatic black, never a tube black.
palette('petalWhite', mix(['white', 12], ['cadYellow', 0.2]));
palette('petalCool', mix(['white', 5], ['ultra', 0.3], ['alizarin', 0.15]));
palette('black', mix(['ultra', 1.2], ['alizarin', 0.9], ['umber', 1.2]));

// The lemon on the cloth.
palette('lemonLight', mix(['white', 2], ['cadYellow', 3]));
palette('lemon', mix(['cadYellow', 3], ['ochre', 0.6]));
palette('lemonShade', mix(['ochre', 2], ['umber', 0.5], ['alizarin', 0.12], ['viridian', 0.1]));

const W = canvas.width;
const H = canvas.height;
const TABLE = 975; // the table's back edge against the wall
const FRONT = 1385; // where the cloth turns down over the table's front edge
const JUG = { x: 560, lip: 818, base: 1215 };

/** The jug's half-width at height y: lip, neck, shoulder, belly, foot. */
function jugR(y) {
  const P = [
    [818, 112],
    [850, 90],
    [945, 160],
    [1075, 190],
    [1180, 170],
    [1215, 150],
  ];
  if (y <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) {
    if (y <= P[i][0]) {
      const t = (y - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
      const s = (1 - Math.cos(Math.PI * t)) / 2;
      return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * s;
    }
  }
  return P[P.length - 1][1];
}

const FLOWERS = [
  { x: 430, y: 500, r: 122 },
  { x: 705, y: 385, r: 128 },
  { x: 285, y: 725, r: 98 },
  { x: 850, y: 640, r: 108 },
  { x: 545, y: 225, r: 102 },
  { x: 945, y: 405, r: 78 },
  { x: 200, y: 440, r: 74 },
  { x: 600, y: 610, r: 90 },
  { x: 760, y: 805, r: 78 },
  { x: 320, y: 280, r: 70 },
];

brush('scrub', { type: 'flat', width: 90, reservoir: 4, streak: 0.8 });
brush('scrubSmall', { type: 'flat', width: 40, reservoir: 2 });
brush('drawing', { type: 'round', width: 4, reservoir: 3 });

/** A loose stroke of length len from (x, y) at angle a, bowed a little. */
function sweep(x, y, a, len) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const bow = rand(-0.08, 0.08) * len;
  return [
    [x, y],
    [x + c * len * 0.5 - s * bow, y + s * len * 0.5 + c * bow],
    [x + c * len, y + s * len],
  ];
}

// The drawing: thin umber lines, the table edge, the jug's sides, each flower's circle.
const line = {
  brush: 'drawing',
  color: mix(['umber', 2], ['ultra', 0.5]),
  thinner: 0.5,
  load: 0.8,
};
stroke({
  ...line,
  path: [
    [-10, TABLE + 4],
    [400, TABLE],
    [800, TABLE - 3],
    [1210, TABLE - 8],
  ],
});
for (const side of [-1, 1]) {
  const pts = [];
  for (let y = JUG.lip; y <= JUG.base; y += 30) pts.push([JUG.x + side * jugR(y), y]);
  stroke({ ...line, path: pts });
}
for (const f of FLOWERS) {
  const pts = [];
  for (let a = 0; a <= Math.PI * 2.05; a += Math.PI / 6)
    pts.push([f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r * 0.85]);
  stroke({ ...line, path: pts, load: 0.5 });
}

// The wall: broad lean strokes, lightest toward the window at the upper left. Each stays
// above the table's edge.
for (let y = -20; y < TABLE - 20; y += 60) {
  for (let x = -60; x < W; x += rand(140, 220)) {
    const d = Math.hypot(x - 60, (y - 40) * 1.3) + rand(-90, 90);
    const pile = d < 380 ? 'wallLight' : d < 700 ? 'wallGold' : d < 1000 ? 'wallOlive' : 'wallDeep';
    const a = rand(0.3, 0.6);
    const len = Math.min(rand(180, 260), (TABLE - 40 - y) / Math.sin(a));
    stroke({
      path: sweep(x, y + rand(-10, 10), a, len),
      brush: 'scrub',
      color: pile,
      thinner: 0.6,
      load: 0.55,
    });
  }
}

// The cloth: level strokes, light toward the left, the front drop in shade.
for (let y = TABLE + 10; y < H + 30; y += 48) {
  for (let x = -60; x < W; x += rand(160, 230)) {
    const pile = y > FRONT ? 'clothShade' : x > 700 && y < 1300 ? 'clothMid' : 'clothLight';
    stroke({
      path: sweep(x, y + rand(-8, 8), rand(-0.06, 0.06), rand(200, 280)),
      brush: 'scrub',
      color: pile,
      thinner: 0.55,
      load: 0.55,
    });
  }
}

// The jug: its dark body scrubbed in across the curve of the belly.
for (let y = JUG.lip + 10; y < JUG.base; y += 26) {
  const r = jugR(y);
  stroke({
    path: sweep(JUG.x - r + 8, y, rand(-0.05, 0.05), 2 * r - 16),
    brush: 'scrubSmall',
    color: 'cobaltDeep',
    thinner: 0.5,
    load: 0.7,
  });
}

// The bouquet's dark: stems fanned up out of the jug's neck to each head.
for (const f of FLOWERS) {
  const sx = JUG.x + rand(-40, 40);
  const sy = JUG.lip + 10;
  stroke({
    path: [
      [sx, sy],
      [(sx + f.x) / 2 + rand(-30, 30), (sy + f.y) / 2],
      [f.x, f.y + f.r * 0.3],
    ],
    brush: { type: 'flat', width: rand(14, 24) },
    color: 'leafDark',
    thinner: 0.55,
    load: 0.6,
  });
}
FLOWERS.forEach((f, i) => {
  const stain =
    i >= 7 ? 'petalCool' : i % 3 === 0 ? 'redDark' : i % 3 === 1 ? 'orangeDark' : 'coralDark';
  for (let k = 0; k < 4; k++) {
    const y = f.y - f.r * 0.5 + k * f.r * 0.33;
    stroke({
      path: sweep(f.x - f.r * 0.7, y + rand(-6, 6), rand(-0.15, 0.15), f.r * 1.4),
      brush: 'scrubSmall',
      color: stain,
      thinner: 0.5,
      load: 0.6,
    });
  }
});

// Lean paint dries before the knife work goes over it.
dry();
