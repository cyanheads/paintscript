/**
 * Passage 1: grind the ink, then the far grove in the palest washes.
 *
 * Sumi-e works in five inks from one stick: jiao (burnt, the blackest), nong (thick),
 * zhong (middle), dan (light), and qing (clear, a breath of grey). They are mixed here
 * from two soots and water and kept for every later passage. The far grove goes down
 * first, in qing and dan: thin culms that rise out of the mist and leave the top edge,
 * with small sprays of leaves. Their feet thin out into nothing, and that empty paper
 * is the mist the nearer bamboo stands in front of.
 */

// The ink stick and the water dish. Pine soot is cool and blue-black, oil soot warm.
palette('pineSoot', '#14181f');
palette('oilSoot', '#1f1915');
palette('water', '#f1efe9');

// The five inks, ground from the same black and let down with water.
palette('jiao', mix(['pineSoot', 1.4], ['oilSoot', 1]));
palette('nong', mix(['jiao', 1], ['water', 0.35]));
palette('zhong', mix(['jiao', 1], ['water', 1.6]));
palette('dan', mix(['jiao', 1], ['water', 5]));
palette('qing', mix(['jiao', 1], ['water', 16]));

const W = canvas.width;
const H = canvas.height;
const clamp = (v) => Math.max(0, Math.min(1, v));

/** A point on a cubic Bézier through four [x, y] control points. */
function bez(p, t) {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

/**
 * One distant culm: segments between nodes, each a single flat stroke, the brush lifted
 * at every node. Below `fadeY` the ink thins with each segment until it gives out.
 * Returns the nodes, for the branches.
 */
function farCulm(ctrl, width, pile, fadeY) {
  const pts = [];
  for (let i = 0; i <= 240; i++) pts.push(bez(ctrl, i / 240));
  const arc = [0];
  for (let i = 1; i < pts.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const L = arc[arc.length - 1];
  const at = (s) => {
    const i = arc.findIndex((a) => a >= s);
    return pts[i < 0 ? pts.length - 1 : i];
  };
  const nodes = [0];
  while (nodes[nodes.length - 1] < L) {
    const t = nodes[nodes.length - 1] / L;
    nodes.push(
      nodes[nodes.length - 1] +
        (110 + 120 * Math.sin(Math.PI * Math.min(1, t * 1.3))) * rand(0.9, 1.1),
    );
  }
  const gap = width * 0.45;
  const out = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i] + gap / 2;
    const b = Math.min(L, nodes[i + 1] - gap / 2);
    if (b - a < 20) continue;
    const path = [];
    for (let s = a; s <= b; s += 18) path.push(at(s));
    path.push(at(b));
    const y = at((a + b) / 2)[1];
    const fade = clamp((y - fadeY) / 260);
    if (fade >= 1) continue;
    // toward the mist each segment goes down a step: the pile let down with more water
    const step = fade <= 0 ? 0 : fade < 0.5 ? 1 : 2;
    stroke({
      path,
      brush: { type: 'flat', width: width * (1 - 0.25 * (a / L)), streak: 0.5, toneVar: 0.3 },
      color: [pile, mix([pile, 2], ['water', 1]), mix([pile, 1], ['water', 2])][step],
      paint: 'transparent',
      thinner: [0.2, 0.4, 0.65][step],
      load: [0.75, 0.7, 0.6][step],
      end: 'stop',
    });
    if (i > 0 && fade < 0.5) out.push({ s: nodes[i], p: at(nodes[i]), q: at(nodes[i] + 6) });
  }
  return out;
}

/** A leaf: the tip of the brush touches, presses down, and lifts away to a point. */
function leaf(x, y, ang, len, wid, pile, bend) {
  const pts = [];
  let h = ang;
  let px = x;
  let py = y;
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const p =
      t < 0.06 ? 0.05 : t < 0.28 ? ((t - 0.06) / 0.22) ** 0.7 : 1 - ((t - 0.28) / 0.72) ** 1.5;
    pts.push([px, py, clamp(p)]);
    h += (bend * 2 * (1 - t)) / 12;
    px += (Math.cos(h) * len) / 12;
    py += (Math.sin(h) * len) / 12;
  }
  stroke({
    path: pts,
    brush: { type: 'round', width: wid, streak: 0.12, toneVar: 0.12 },
    color: pile,
    paint: 'transparent',
    thinner: 0.15,
    load: 0.9,
    end: rand() < 0.3 ? 'flick' : 'taper',
  });
}

/** A twig off a node, and a spray of leaves hanging from its end, heavy with rain. */
function spray(node, side, pile, scale, count) {
  const [nx, ny] = node.p;
  const up = Math.atan2(node.q[1] - ny, node.q[0] - nx);
  const out = up + side * rand(0.7, 1.0);
  const len = rand(70, 130) * scale;
  const tip = [nx + Math.cos(out) * len, ny + Math.sin(out) * len + len * 0.15];
  stroke({
    path: [
      [nx, ny, 0.8],
      [(nx + tip[0]) / 2, (ny + tip[1]) / 2 - 6, 0.5],
      [tip[0], tip[1], 0.25],
    ],
    brush: { type: 'round', width: 4 * scale + 1, streak: 0.2 },
    color: pile,
    paint: 'transparent',
    load: 0.8,
    end: 'flick',
  });
  const hang = Math.PI / 2 - side * 0.35;
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1) - 0.5;
    leaf(
      tip[0] + rand(-3, 3),
      tip[1] + rand(-3, 3),
      hang + f * 1.3 + rand(-0.12, 0.12),
      rand(80, 125) * scale * (1 - Math.abs(f) * 0.35),
      rand(17, 22) * scale,
      pile,
      -f * 0.35 + rand(-0.1, 0.1),
    );
  }
}

// The farthest culms, in qing: one at the left, two at the right edge.
const FARTHEST = [
  {
    ctrl: [
      [175, 1500],
      [168, 1000],
      [150, 500],
      [128, -30],
    ],
    w: 13,
    fade: 1080,
  },
  {
    ctrl: [
      [985, 1500],
      [990, 1050],
      [1010, 500],
      [1040, -30],
    ],
    w: 14,
    fade: 1120,
  },
  {
    ctrl: [
      [1080, 1500],
      [1075, 1100],
      [1068, 500],
      [1078, -30],
    ],
    w: 11,
    fade: 980,
  },
];
// Nearer, in dan: two culms that will stand between the middle grove's.
const NEARER = [
  {
    ctrl: [
      [640, 1600],
      [650, 1100],
      [680, 500],
      [735, -30],
    ],
    w: 17,
    fade: 1230,
  },
  {
    ctrl: [
      [880, 1600],
      [872, 1150],
      [850, 600],
      [868, -30],
    ],
    w: 16,
    fade: 1300,
  },
];

for (const c of FARTHEST) {
  const nodes = farCulm(c.ctrl, c.w, 'qing', c.fade);
  for (const n of nodes) {
    if (rand() < 0.45 || n.p[1] > c.fade - 80) continue;
    spray(n, n.p[0] < W / 2 ? 1 : -1, 'qing', 0.75, 3 + Math.floor(rand(3)));
  }
}
for (const c of NEARER) {
  const nodes = farCulm(c.ctrl, c.w, 'dan', c.fade);
  nodes.forEach((n, i) => {
    if (n.p[1] > c.fade - 60 || n.p[1] < 80) return;
    if (i % 2 === 1 && rand() < 0.8)
      spray(n, i % 4 === 1 ? 1 : -1, 'dan', 0.9, 3 + Math.floor(rand(3)));
  });
}

// The grove's farthest leaves, seen through the mist: sprays in qing with no twig in
// sight, hanging off the top edge.
for (let i = 0; i < 6; i++) {
  const x = [70, 260, 560, 790, 960, 1060][i] + rand(-20, 20);
  const y = rand(-10, 60);
  const n = 3 + Math.floor(rand(3));
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1) - 0.5;
    leaf(
      x,
      y,
      Math.PI / 2 + f * 1.2 + rand(-0.15, 0.15),
      rand(70, 110),
      rand(15, 19),
      'qing',
      -f * 0.3,
    );
  }
}

show({ x: 0, y: 0, w: W, h: H }, { mode: 'color', maxSide: 900 });
dry();
