/**
 * Passage 4: the sand, wet and dry.
 *
 * The wet sand is a dim mirror of the sky, so this passage looks at the sky it painted:
 * at() reads the dried color at the mirrored point above the horizon, and each upright
 * stroke carries that color, dulled with sand, down into the flats. Standing pools keep
 * the sky's full brightness; the sun's reflection runs down the middle as a column of
 * light. Level strokes of drier sand are then dragged across the uprights while both are
 * wet, the way reflections are painted on a real beach. Below, the dry sand comes
 * forward in broader strokes, lit along its ripples and falling into violet shade.
 */

const W = canvas.width;
const H = canvas.height;
const HORIZON = 332;
const SHORE = 372;
const SUN = { x: 432, y: 248 };

/** Where the wet sand gives way to dry (as in passage 1). */
function dryLine(x) {
  return 615 + 38 * noise(x / 170, 7.3) + Math.max(0, 300 - x) * 0.18;
}

/** Half-width of the sun's reflection on the sand at height y. */
const columnHalf = (y) => 30 + (y - SHORE) * 0.32;

/** The sky's dried color at the point mirrored in the wet sand. */
const mirrored = (x, y) => at(x, Math.max(2, 2 * HORIZON - y));

/**
 * Standing water: level pools, and a channel that winds in from the lower left. Each
 * pool is a flat ellipse; the channel is a chain of them along its course.
 */
const POOLS = [
  { x: 330, y: 448, rx: 270, ry: 16 },
  { x: 560, y: 402, rx: 200, ry: 8 },
  { x: 905, y: 496, rx: 160, ry: 11 },
  { x: 1090, y: 412, rx: 140, ry: 8 },
  { x: 620, y: 612, rx: 120, ry: 10 },
  { x: 1010, y: 580, rx: 150, ry: 9 },
];
for (let t = 0; t <= 1; t += 0.08) {
  POOLS.push({
    x: 300 - 250 * t + 30 * Math.sin(t * 5),
    y: 470 + 200 * t ** 1.2,
    rx: 40 + 60 * t,
    ry: 6 + 16 * t,
  });
}
/** How deep into a pool a point lies: 0 outside, up to 1 at its middle. */
function inPool(x, y) {
  let best = 0;
  for (const p of POOLS) {
    const d = ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2;
    if (d < 1) best = Math.max(best, 1 - d);
  }
  return best;
}

brush('drag', { type: 'flat', width: 18, splay: 0.35 });
// stiff bristles, so the dry sand's broken colors sit side by side instead of churning together
brush('sandBroad', { type: 'filbert', width: 48, splay: 0.3, stiffness: 0.9 });
brush('sandMid', { type: 'filbert', width: 26, splay: 0.3, stiffness: 0.9 });

// Reflections: short upright strokes carrying the mirrored sky down into the wet sand,
// dull and dark on the sand, near full strength in the pools.
for (let y = SHORE + 2; y < 700; y += 9) {
  for (let x = rand(-6, 6); x < W; x += rand(8, 16)) {
    if (y > dryLine(x) + 6) continue;
    const pool = inPool(x, y);
    const column = Math.abs(x - SUN.x) < columnHalf(y) * rand(0.7, 1.1);
    const sky = mirrored(x, y);
    const far = (y - SHORE) / 280;
    let color;
    if (column)
      color =
        pool > 0
          ? mix(['white', 1], ['skyGlow', 2])
          : mix([sky, 2], ['skyGold', 1.5], ['sandWet', 0.8]);
    else if (pool > 0) color = mix([sky, 5], ['white', 0.4], ['sandWet', 0.4]);
    else color = mix([sky, 1], ['sandWet', 1.2], ['shade', far < 0.5 ? 1 : 1.6], ['sea', 0.15]);
    const len = rand(8, 26) + far * 12;
    stroke({
      path: [
        [x, y],
        [x + rand(-1, 1), y + len],
      ],
      brush: { type: 'flat', width: rand(9, 17), stiffness: 0.7 },
      color,
      load: 0.8,
      pressure: rand(0.5, 0.75),
    });
  }
}

// Bars of drier sand dragged level across the wet reflections, skirting the pools, so
// the flats break into bands the way a beach does when the tide is out.
for (let y = SHORE + 8; y < 700; y += rand(8, 14)) {
  for (let x = rand(-30, 0); x < W; x += rand(50, 120)) {
    const len = rand(60, 170) * (0.6 + (y - SHORE) / 330);
    if (y > dryLine(x) - 2 || inPool(x + len / 2, y) > 0 || rand() < 0.3) continue;
    const column = Math.abs(x + len / 2 - SUN.x) < columnHalf(y);
    stroke({
      path: [
        [x, y],
        [x + len / 2, y + rand(-1.5, 1.5)],
        [x + len, y + rand(-2, 2)],
      ],
      brush: 'drag',
      color: column
        ? mix(['skyGold', 2], ['sandDry', 1])
        : mix(
            ['sandWet', 1.5],
            ['sienna', 0.2],
            ['shade', 1],
            [rand() < 0.5 ? 'darkest' : 'alizarin', 0.08],
          ),
      load: rand(0.4, 0.65),
      pressure: rand(0.4, 0.65),
    });
  }
}

/**
 * The dry sand's piles: three bands from the lit, warm sand at the wet line to the
 * violet-brown shade at the bottom edge, each with a rose and a violet neighbor at much
 * the same value for broken color.
 */
const SAND_BASES = [
  [
    ['sandDry', 2.3],
    ['shade', 0.8],
    ['darkest', 0.22],
    ['skyGold', 0.6],
  ],
  [
    ['sandDry', 1.5],
    ['shade', 1.2],
    ['darkest', 0.96],
    ['skyGold', 0.25],
  ],
  [
    ['sandDry', 0.7],
    ['shade', 1.6],
    ['darkest', 2],
    ['skyGold', 0.07],
  ],
];
const SAND = SAND_BASES.map((base, b) => [
  mix(...base),
  mix(...base, ['alizarin', 0.15 + b * 0.05], ['skyRose', 0.5]),
  mix(...base, ['ultra', 0.12 + b * 0.05], ['alizarin', 0.12 + b * 0.03]),
]);
const RIPPLE_SHADOW = SAND.map(([, , violet], b) => mix([violet, 2], ['darkest', 0.3 + b * 0.1]));
const RIPPLE_LIGHT = SAND.map(([sand]) => mix(['skyPeach', 1], [sand, 1.5]));

/** The band of dry sand at a depth `near` (0 at the wet line, 1 at the bottom edge), its edges ragged. */
const sandBand = (near) => Math.min(2, Math.max(0, Math.floor(near * 3 + rand(-0.35, 0.35))));

// Dry sand: strokes that widen as the beach comes toward us, each tilted by the lie of
// the ground (a noise field), broken between warm sand and its rose and violet neighbors.
for (let y = 600; y < H + 20; ) {
  const near = Math.min(1, Math.max(0, (y - 620) / 280));
  for (let x = rand(-60, 0); x < W; x += rand(60, 120) * (0.7 + near)) {
    const len = rand(90, 200) * (0.7 + near);
    const cx = x + len / 2;
    if (y < dryLine(cx) - 4) continue;
    const a = noise(cx / 260, y / 140) * 0.22;
    const r = rand();
    stroke({
      path: [
        [x, y + rand(-3, 3)],
        [x + (len / 2) * Math.cos(a), y + (len / 2) * Math.sin(a) + rand(-4, 4)],
        [x + len * Math.cos(a), y + len * Math.sin(a) + rand(-4, 4)],
      ],
      brush: near > 0.45 ? 'sandBroad' : 'sandMid',
      color: SAND[sandBand(near)][r < 0.22 ? 1 : r < 0.42 ? 2 : 0],
      load: rand(0.8, 0.95),
    });
  }
  y += 11 + near * 22;
}

// Ripple marks: long low ridges across the dry sand, each lit along its crest where the
// sun still grazes it and shadowed just below.
for (let i = 0; i < 110; i++) {
  const y = rand(640, H - 6);
  const near = Math.min(1, (y - 620) / 280);
  const x = rand(-40, W);
  if (y < dryLine(x) + 12) continue;
  const len = rand(70, 160) * (0.6 + near);
  const bow = rand(-4, 4) * (0.5 + near);
  const crest = [
    [x, y],
    [x + len / 3, y - bow],
    [x + (2 * len) / 3, y + bow * 0.5],
    [x + len, y + rand(-3, 3)],
  ];
  stroke({
    path: crest.map(([px, py]) => [px + 2, py + 2 + near * 4]),
    brush: { type: 'round', width: 4 + near * 8 },
    color: RIPPLE_SHADOW[sandBand(near)],
    load: 0.55,
    pressure: 0.55,
    end: 'taper',
  });
  stroke({
    path: crest,
    brush: { type: 'round', width: 3 + near * 4 },
    color: near < 0.5 ? mix(['skyGold', 2], ['sandDry', 1]) : RIPPLE_LIGHT[sandBand(near)],
    load: 0.7,
    pressure: 0.45 + near * 0.3,
    end: 'taper',
  });
}

dry();
