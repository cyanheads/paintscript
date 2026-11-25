/**
 * Passage 3: the front culm, in nong, its nodes in jiao.
 *
 * The one culm in front of everything: it comes in at the bottom edge left of center
 * and bends right as it climbs, leaving at the top. Each segment is a single flat
 * stroke with the brush pressed at the start and squared off at the node; the paper
 * catches only some of the bristles, so the stroke breaks into the streaks of flying
 * white. The brush is reloaded every segment or two, so the ink drifts between nong
 * and a nong deepened with jiao. The nodes go on last, in jiao, while the segments
 * are still wet, so their ends soften a little into the culm.
 */

palette('nongDeep', mix(['nong', 2], ['jiao', 1]));
palette('nongDark', mix(['nong', 1], ['jiao', 1.3]));

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

// The front culm's line and its internodes, base to top (passage 4 uses the same).
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
for (const len of INTERNODES) nodes.push(Math.min(L, nodes[nodes.length - 1] + len));
if (nodes[nodes.length - 1] < L) nodes.push(L);
const width = (s) => W0 + (W1 - W0) * (s / L);

let ink = 'nongDeep';
for (let i = 0; i < nodes.length - 1; i++) {
  if (i % 2 === 0) ink = rand() < 0.5 ? 'nongDeep' : 'nongDark';
  const gap = width(nodes[i]) * 0.36;
  const a = nodes[i] + gap / 2;
  const last = i === nodes.length - 2;
  const b = nodes[i + 1] - (last ? 0 : gap / 2);
  const path = [];
  for (let s = a; s < b; s += 14) {
    const t = (s - a) / (b - a);
    // pressed at the start, eased through the middle, pressed again into the node
    path.push([...sp.at(s), t < 0.12 ? 1 : t > 0.9 ? 1 : 0.88]);
  }
  path.push([...sp.at(b), 1]);
  stroke({
    path,
    brush: {
      type: 'flat',
      width: width((a + b) / 2),
      streak: 0.7,
      toneVar: 0.4,
      stiffness: 0.45,
      splay: 0.15,
    },
    color: ink,
    paint: 'transparent',
    thinner: rand(0, 0.1),
    load: rand(0.8, 0.95),
    contact: rand(0.72, 0.86),
    end: last ? 'lift' : 'stop',
  });
}

// The nodes: one stroke across each gap, pressed at the culm's edges where the ring
// bulges, lighter through the middle, its ends curling up toward the segment above.
for (let i = 1; i < nodes.length - 1; i++) {
  const p = sp.at(nodes[i]);
  const q = sp.at(nodes[i] + 8);
  const d = [(q[0] - p[0]) / 8, (q[1] - p[1]) / 8];
  const n = [-d[1], d[0]];
  const hw = width(nodes[i]) / 2;
  const pt = (u, v, pr) => [p[0] + n[0] * u + d[0] * v, p[1] + n[1] * u + d[1] * v, pr];
  stroke({
    path: [
      pt(-hw - 5, 4, 0.75),
      pt(-hw * 0.6, -1, 1),
      pt(0, -2.5, 0.45),
      pt(hw * 0.6, -1, 1),
      pt(hw + 5, 4, 0.7),
    ],
    brush: { type: 'round', width: hw * 0.3, streak: 0.15 },
    color: 'jiao',
    paint: 'transparent',
    load: 0.95,
    end: rand() < 0.5 ? 'flick' : 'taper',
  });
}

show({ x: 160, y: 900, w: 360, h: 500 }, { mode: 'color', maxSide: 720 });
dry();
