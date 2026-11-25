/**
 * Passage 2: the middle grove, in zhong.
 *
 * Two culms a step nearer: one rises straight past the right of center; the other
 * starts at the bottom edge and arches over to the right, its top bowed by wet leaves.
 * Each segment is one flat stroke, lifted at the node; the nodes go on afterward in
 * nong, a shade darker, as two short strokes across the gap. Leaves hang in sprays of
 * three to six from twigs, and the arch's tip ends in a cascade of them.
 */

const W = canvas.width;
const clamp = (v) => Math.max(0, Math.min(1, v));

function bez(p, t) {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

/** A culm's spine sampled by arc length: `at(s)` is the point s px up from the base. */
function spine(ctrl) {
  const pts = [];
  for (let i = 0; i <= 300; i++) pts.push(bez(ctrl, i / 300));
  const arc = [0];
  for (let i = 1; i < pts.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const at = (s) => {
    const i = arc.findIndex((a) => a >= s);
    return pts[i < 0 ? pts.length - 1 : i];
  };
  return { at, length: arc[arc.length - 1] };
}

/**
 * Lay a culm: one flat stroke per segment, then a node across each gap in `nodeInk`.
 * Width runs from `w0` at the base to `w1` at the top. Returns the nodes.
 */
function culm(ctrl, w0, w1, ink, nodeInk, internodes) {
  const sp = spine(ctrl);
  const L = sp.length;
  const nodes = [0];
  for (const len of internodes) nodes.push(Math.min(L, nodes[nodes.length - 1] + len));
  const width = (s) => w0 + (w1 - w0) * (s / L);
  for (let i = 0; i < nodes.length - 1; i++) {
    const gap = width(nodes[i]) * 0.4;
    const a = nodes[i] + gap / 2;
    const b = nodes[i + 1] - (i === nodes.length - 2 ? 0 : gap / 2);
    if (b - a < 12) continue;
    const path = [];
    for (let s = a; s < b; s += 16) path.push([...sp.at(s), 0.95]);
    path.push([...sp.at(b), 1]);
    stroke({
      path,
      brush: {
        type: 'flat',
        width: width((a + b) / 2),
        streak: 0.55,
        toneVar: 0.35,
        stiffness: 0.5,
      },
      color: ink,
      paint: 'transparent',
      thinner: rand(0.05, 0.2),
      load: rand(0.75, 0.9),
      contact: rand(0.82, 0.95),
      end: i === nodes.length - 2 ? 'taper' : 'stop',
    });
  }
  const out = [];
  for (let i = 1; i < nodes.length - 1; i++) {
    const p = sp.at(nodes[i]);
    const q = sp.at(nodes[i] + 8);
    const d = [(q[0] - p[0]) / 8, (q[1] - p[1]) / 8];
    const n = [-d[1], d[0]];
    const hw = width(nodes[i]) / 2;
    const pt = (u, v, pr) => [p[0] + n[0] * u + d[0] * v, p[1] + n[1] * u + d[1] * v, pr];
    const nw = Math.max(3, hw * 0.32);
    stroke({
      path: [pt(-hw - 3, 2, 0.7), pt(-hw * 0.45, -1.5, 0.9), pt(-1, 0, 0.35)],
      brush: { type: 'round', width: nw, streak: 0 },
      color: nodeInk,
      paint: 'transparent',
      load: 0.9,
      end: 'taper',
    });
    stroke({
      path: [pt(1, 0, 0.35), pt(hw * 0.45, -1.5, 0.9), pt(hw + 3, 2, 0.6)],
      brush: { type: 'round', width: nw, streak: 0 },
      color: nodeInk,
      paint: 'transparent',
      load: 0.9,
      end: 'flick',
    });
    out.push({ p, d, hw });
  }
  return out;
}

/** A leaf: the tip touches, the brush presses down, and lifts away to a point. */
function leaf(x, y, ang, len, wid, ink, bend) {
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
    brush: { type: 'round', width: wid, streak: 0.12, toneVar: 0.15 },
    color: ink,
    paint: 'transparent',
    thinner: rand(0, 0.15),
    load: 0.9,
    end: rand() < 0.3 ? 'flick' : 'taper',
  });
}

/**
 * Leaves hanging from one twig end around `hang`: long and narrow, unevenly fanned,
 * the middle ones longest, each curving away from the others.
 */
function hangLeaves(tip, hang, count, scale, ink) {
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1) - 0.5;
    leaf(
      tip[0] + rand(-5, 5),
      tip[1] + rand(-5, 5),
      hang + f * rand(1.2, 1.55) + rand(-0.18, 0.18),
      rand(145, 200) * scale * (1 - Math.abs(f) * 0.4),
      rand(20, 25) * scale,
      ink,
      -f * 0.45 + rand(-0.12, 0.12),
    );
  }
}

/** A twig from a node out to one side, bending down at its end; returns its tip. */
function twig(node, side, len, ink) {
  const up = Math.atan2(node.d[1], node.d[0]);
  const out = up + side * rand(0.75, 1.05);
  const [x, y] = [
    node.p[0] + Math.cos(up + side * 1.57) * node.hw,
    node.p[1] + Math.sin(up + side * 1.57) * node.hw,
  ];
  const tip = [x + Math.cos(out) * len, y + Math.sin(out) * len + len * 0.22];
  stroke({
    path: [
      [x, y, 0.85],
      [x + Math.cos(out) * len * 0.5, y + Math.sin(out) * len * 0.5 - 4, 0.6],
      [tip[0], tip[1], 0.3],
    ],
    brush: { type: 'round', width: 6, streak: 0.25 },
    color: ink,
    paint: 'transparent',
    load: 0.85,
    end: 'flick',
  });
  return tip;
}

// The straight culm, right of center.
const straight = culm(
  [
    [790, 1890],
    [805, 1300],
    [758, 620],
    [812, -30],
  ],
  27,
  21,
  'zhong',
  'nong',
  [140, 170, 205, 225, 230, 230, 220, 210, 200, 190],
);
straight.forEach((n, i) => {
  if (n.p[1] < 60 || n.p[1] > 1350) return;
  if (i % 2 === 0)
    hangLeaves(
      twig(n, i % 4 === 0 ? 1 : -1, rand(90, 140), 'zhong'),
      Math.PI / 2 + (i % 4 === 0 ? -0.35 : 0.35),
      4 + Math.floor(rand(3)),
      1,
      'zhong',
    );
});

// The arching culm: up from the bottom edge, bowed over to the right by its wet crown.
const archCtrl = [
  [545, 1890],
  [560, 1050],
  [690, 400],
  [985, 300],
];
const arch = culm(
  archCtrl,
  26,
  9,
  'zhong',
  'nong',
  [130, 165, 200, 220, 225, 220, 205, 185, 160, 130, 105, 90, 80],
);
arch.forEach((n, i) => {
  if (n.p[1] > 1300) return;
  if (i % 2 === 1)
    hangLeaves(
      twig(n, -1, rand(70, 120), 'zhong'),
      Math.PI / 2 + rand(-0.2, 0.2),
      3 + Math.floor(rand(3)),
      0.95,
      'zhong',
    );
  else if (n.p[1] < 700)
    hangLeaves(
      twig(n, 1, rand(60, 100), 'zhong'),
      Math.PI / 2 + rand(-0.3, 0.1),
      3 + Math.floor(rand(2)),
      0.9,
      'zhong',
    );
});
// The cascade off the arch's tip: leaves stacked down from the bowed end.
const archTip = bez(archCtrl, 1);
for (let k = 0; k < 4; k++) {
  hangLeaves(
    [archTip[0] - 30 * k + rand(-8, 8), archTip[1] + 18 * k],
    Math.PI / 2 - 0.1 + k * 0.12,
    4 + (k % 2),
    1.05 - k * 0.06,
    k === 0 ? 'nong' : 'zhong',
  );
}

show({ x: 0, y: 0, w: W, h: canvas.height }, { mode: 'color', maxSide: 900 });
dry();
