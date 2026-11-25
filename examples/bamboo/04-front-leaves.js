/**
 * Passage 4: the front branches and leaves, in jiao and nong.
 *
 * The darkest strokes in the painting. Branches leave the front culm's nodes, alternating
 * sides as they climb, each a single stroke that thins as the brush lifts, with a
 * twig or two off it. The leaves hang from the twig ends in groups, wet with rain: each
 * one a single stroke, the tip of the brush touching down, the body pressed out, the
 * brush lifting away to a point. The brush is dipped in jiao for the leaves in front of
 * a group and in nong for those behind; where two overlap the ink deepens. A last few
 * young leaves at the top are left paler.
 */

const clamp = (v) => Math.max(0, Math.min(1, v));

function bez(p, t) {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

function spine(ctrl) {
  const pts = [];
  for (let i = 0; i <= 400; i++) pts.push(bez(ctrl, i / 400));
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

// The front culm, as passage 3 laid it.
const FRONT = [
  [290, 1900],
  [292, 1250],
  [355, 640],
  [530, -45],
];
const INTERNODES = [150, 175, 205, 222, 232, 236, 230, 220, 210, 200];
const W0 = 44;
const W1 = 31;
const sp = spine(FRONT);
const L = sp.length;
const nodes = [0];
for (const len of INTERNODES) nodes.push(nodes[nodes.length - 1] + len);

/** The node `i` as a point, its up-the-culm direction, and the culm's half width there. */
function node(i) {
  const p = sp.at(nodes[i]);
  const q = sp.at(nodes[i] + 8);
  return {
    p,
    d: [(q[0] - p[0]) / 8, (q[1] - p[1]) / 8],
    hw: (W0 + (W1 - W0) * (nodes[i] / L)) / 2,
  };
}

/** A leaf: the tip touches, the brush presses down, and lifts away to a point. */
function leaf(x, y, ang, len, wid, ink, bend) {
  const pts = [];
  let h = ang;
  let px = x;
  let py = y;
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    const p =
      t < 0.05 ? 0.05 : t < 0.27 ? ((t - 0.05) / 0.22) ** 0.7 : 1 - ((t - 0.27) / 0.73) ** 1.5;
    pts.push([px, py, clamp(p)]);
    h += (bend * 2 * (1 - t)) / 14;
    px += (Math.cos(h) * len) / 14;
    py += (Math.sin(h) * len) / 14;
  }
  stroke({
    path: pts,
    brush: { type: 'round', width: wid, streak: 0.12, toneVar: 0.15 },
    color: ink,
    paint: 'transparent',
    thinner: ink === 'jiao' ? 0 : rand(0, 0.1),
    load: 0.95,
    end: rand() < 0.3 ? 'flick' : 'taper',
  });
}

/**
 * A group of leaves hanging from one twig end: fanned unevenly around `hang`, the
 * middle ones longest, the first `front` of them in jiao and the rest in nong.
 */
function group(tip, hang, count, scale, front) {
  // shuffle which leaf of the fan goes on when; the last `front` laid are the jiao ones
  const order = [];
  for (let i = 0; i < count; i++) order.push(i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand(i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((i, k) => {
    const f = count === 1 ? 0 : i / (count - 1) - 0.5;
    leaf(
      tip[0] + rand(-5, 5),
      tip[1] + rand(-5, 5),
      hang + f * rand(1.4, 1.8) + rand(-0.15, 0.15),
      rand(215, 285) * scale * (1 - Math.abs(f) * 0.35),
      rand(28, 34) * scale,
      k >= count - front ? 'jiao' : 'nong',
      -f * 0.55 + rand(-0.12, 0.12),
    );
  });
}

/**
 * A branch from node `i` out to `side` (1 right, -1 left), `len` px long, drooping by
 * `droop` px at its end. Returns points along it, from the culm out, for twigs.
 */
function branch(i, side, len, droop) {
  const nd = node(i);
  const up = Math.atan2(nd.d[1], nd.d[0]);
  const out = up + side * 0.85;
  const start = [
    nd.p[0] + Math.cos(up + side * 1.57) * nd.hw,
    nd.p[1] + Math.sin(up + side * 1.57) * nd.hw,
  ];
  const pts = [];
  for (let k = 0; k <= 4; k++) {
    const t = k / 4;
    pts.push([
      start[0] + Math.cos(out) * len * t,
      start[1] + Math.sin(out) * len * t + droop * t * t,
      0.95 - t * 0.6,
    ]);
  }
  stroke({
    path: pts,
    brush: { type: 'round', width: 9, streak: 0.3 },
    color: 'nongDeep',
    paint: 'transparent',
    load: 0.9,
    end: 'flick',
  });
  // the branch's own node, a dark tick a third of the way out
  const m = pts[1];
  stroke({
    path: [
      [m[0] - 5, m[1] - 3],
      [m[0] + 5, m[1] + 3],
    ],
    brush: { type: 'round', width: 4 },
    color: 'jiao',
    paint: 'semi_opaque',
    load: 0.8,
    end: 'taper',
  });
  return pts;
}

/** A twig off a branch point, ending where a group of leaves hangs. */
function twig(from, ang, len) {
  const tip = [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len];
  stroke({
    path: [
      [from[0], from[1], 0.7],
      [(from[0] + tip[0]) / 2, (from[1] + tip[1]) / 2 - 3, 0.5],
      [tip[0], tip[1], 0.25],
    ],
    brush: { type: 'round', width: 5, streak: 0.2 },
    color: 'nong',
    paint: 'transparent',
    load: 0.85,
    end: 'flick',
  });
  return tip;
}

// Low on the left: a long branch reaching out over the empty paper, two heavy groups.
const b1 = branch(3, -1, 190, 50);
group(b1[4], Math.PI / 2 + 0.35, 7, 1, 3);
group(twig(b1[2], Math.PI - 0.2, 70), Math.PI / 2 + 0.55, 5, 0.9, 2);

// Above it on the right: a branch across the middle grove's culms.
const b2 = branch(5, 1, 170, 40);
group(b2[4], Math.PI / 2 - 0.3, 6, 1, 3);
group(twig(b2[2], -0.9, 60), Math.PI / 2 - 0.1, 4, 0.85, 2);

// Higher on the left, a shorter branch.
const b3 = branch(7, -1, 130, 30);
group(b3[4], Math.PI / 2 + 0.45, 6, 0.95, 3);

// Between them on the right, a short one.
const b6 = branch(8, 1, 100, 20);
group(b6[4], Math.PI / 2 - 0.5, 4, 0.85, 2);

// Near the top on the right: the crown, running off the top edge.
const b4 = branch(9, 1, 120, 25);
group(b4[4], Math.PI / 2 - 0.4, 6, 0.95, 3);
group(twig(b4[1], -1.2, 80), Math.PI / 2 - 0.2, 4, 0.8, 2);

// Young leaves high on the left, not yet darkened: zhong, short, held up and out.
const young = node(8);
const yx = young.p[0] - young.hw;
for (let k = 0; k < 3; k++) {
  leaf(
    yx - 4,
    young.p[1] - 6 - k * 6,
    -Math.PI / 2 - 0.55 - k * 0.32,
    rand(105, 135),
    21,
    'zhong',
    -0.15,
  );
}

// One low twig with a pair of leaves, so the culm's foot is not bare.
const b5 = branch(1, 1, 80, 10);
group(b5[4], Math.PI / 2 - 0.6, 2, 0.75, 1);

show({ x: 0, y: 0, w: canvas.width, h: canvas.height }, { mode: 'squint', maxSide: 700 });
dry();
