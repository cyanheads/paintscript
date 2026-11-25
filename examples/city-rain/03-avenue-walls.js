/**
 * Passage 3: the walls of the avenue, painted around their lights.
 *
 * Each building is washed in strokes that run along its own perspective lines, the
 * courses of the wall, from the roofline down to the pavement: a cool grey high up,
 * and low down, while it is still wet, the warm tone the shop light throws up the
 * wall. The brush lifts off wherever a window or shopfront is lit, so those stay the
 * warm first wash: the lights are made by painting the dark around them, and because
 * the strokes run with the window rows, the saved shapes keep their perspective. The
 * wash comes from three dishes, strong for the near buildings, medium further up the
 * avenue, pale for the far ones, so the avenue recedes in steps. The far slivers by
 * the glow, too narrow to wash along, take upright strokes. When the walls are dry,
 * the windows go in, each a few narrow strokes along its row, and then the cornices.
 */

const W = canvas.width;
const H = canvas.height;
const VP = { x: 630, y: 780 };
const EYE = 5;
const F = 1000;
const sx = (X, D) => VP.x + (X * F) / D;
const sy = (Z, D) => VP.y + ((EYE - Z) * F) / D;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const hash = (a, b, c) => {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

// The wall piles: a warm brownstone, a cool limestone, a blue slate, a dark tower, and
// the warm low tone the shop light throws up the walls.
palette('brick', mix(['sienna', 0.7], ['crimson', 0.4], ['payne', 1], ['water', 1.6]));
palette('stone', mix(['payne', 1], ['crimson', 0.3], ['ochre', 0.25], ['water', 2.2]));
palette('slate', mix(['payne', 1.2], ['ultra', 0.3], ['crimson', 0.15], ['water', 1.6]));
palette('towerDark', mix(['payne', 1.4], ['crimson', 0.45], ['ultra', 0.25], ['water', 0.3]));
palette('wallLow', mix(['ochre', 1], ['crimson', 0.3], ['payne', 0.3], ['water', 2.5]));
palette('windowDark', mix(['payne', 1.4], ['crimson', 0.4], ['ultra', 0.3]));
palette('windowGold', mix(['gamboge', 1], ['ochre', 0.8], ['scarlet', 0.1], ['water', 3.5]));
palette('shopGold', mix(['gamboge', 1.6], ['ochre', 0.6], ['scarlet', 0.3], ['water', 3]));

/** The three dishes of wash: how much water each one carries. */
const DISH = { strong: 0.36, medium: 0.55, pale: 0.72 };
/** The dish a building at distance D takes; the boundaries are where a hand would put them, not a ruler. */
function dishAt(D) {
  const d = D + rand(-6, 6);
  if (d < 30) return 'strong';
  if (d < 90) return 'medium';
  return 'pale';
}
/** One dish paler: the shop light's warmth goes on wetter than the wall above it. */
const paler = (dish) => (dish === 'strong' ? 'medium' : 'pale');

/** The buildings along each wall: distance range (m), height (m), and pile. */
const WALLS = [
  {
    X: -7.5,
    blocks: [
      { d0: 3, d1: 22, h: 80, pile: 'towerDark' },
      { d0: 22, d1: 35, h: 34, pile: 'brick' },
      { d0: 35, d1: 52, h: 46, pile: 'stone' },
      { d0: 52, d1: 75, h: 28, pile: 'brick' },
      { d0: 75, d1: 110, h: 52, pile: 'slate' },
      { d0: 110, d1: 160, h: 36, pile: 'stone' },
      { d0: 160, d1: 260, h: 60, pile: 'slate' },
    ],
  },
  {
    X: 7.75,
    blocks: [
      { d0: 3, d1: 25, h: 90, pile: 'stone' },
      { d0: 25, d1: 40, h: 30, pile: 'brick' },
      { d0: 40, d1: 58, h: 55, pile: 'slate' },
      { d0: 58, d1: 85, h: 24, pile: 'brick' },
      { d0: 85, d1: 130, h: 44, pile: 'stone' },
      { d0: 130, d1: 240, h: 70, pile: 'slate' },
    ],
  },
];

/**
 * Whether a point of a wall (distance D, height Z, in building b) is a lit window: bays
 * every 3.2 m, a shopfront along the ground floor (most of them lit), and upper
 * windows every 3.3 m, a few of them lit. 2 is a lit shopfront, 1 a lit window, -1 an
 * unlit window, 0 wall.
 */
function windowAt(D, Z, b, wi) {
  if (D < b.d0 || D >= b.d1 || Z < 0 || Z > b.h) return 0;
  const bay = Math.floor((D - b.d0) / 3.2);
  const u = D - b.d0 - bay * 3.2;
  if (Z < 4) {
    if (u < 0.5 || u > 2.7 || Z < 0.8 || Z > 3.1) return 0;
    return hash(bay, wi, b.d0) < 0.65 ? 2 : 0;
  }
  if (Z > b.h - 2) return 0;
  const floor = Math.floor((Z - 4.6) / 3.3);
  const v = Z - 4.6 - floor * 3.3;
  if (u < 0.8 || u > 2.2 || v < 0.6 || v > 2.6) return 0;
  return hash(bay * 7 + floor, wi, b.d0 + 1) < 0.22 ? 1 : -1;
}

/** Steam from the stack in the road (as in passage 1). */
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

/** The lamp heads (as in passage 1), kept bright. */
const LAMPS = [
  { X: -3.6, D: 8 },
  { X: 3.5, D: 15 },
  { X: -3.6, D: 38 },
  { X: 3.5, D: 46 },
  { X: -3.6, D: 70 },
  { X: 3.5, D: 85 },
  { X: -3.6, D: 120 },
  { X: 3.5, D: 150 },
].map((l) => ({ x: sx(l.X, l.D), y: sy(7.5, l.D), r: (0.35 * F) / l.D }));

/**
 * How strongly the wall brush lifts at wall point (D, Z): a lit window or shopfront
 * within about a third of a brush of the brush's middle, a lamp head, the steam.
 */
function reserve(w, wi, b, D, Z, bw) {
  const x = sx(w.X, D);
  const y = sy(Z, D);
  let s = steam(x, y);
  for (const l of LAMPS)
    s = Math.max(s, clamp01(1 - (Math.hypot(x - l.x, y - l.y) - l.r) / (bw * 0.5)));
  // a third of a brush, in metres along the wall and up it: the wash creeps a little
  // into the gap, which leaves the window's edge soft
  const dD = (0.32 * bw * D * D) / (Math.abs(w.X) * F);
  const dZ = (0.32 * bw * D) / F;
  for (const [a, c] of [
    [0, 0],
    [-dD, 0],
    [dD, 0],
    [0, -dZ],
    [0, dZ],
  ]) {
    if (windowAt(D + a, Z + c, b, wi) > 0) return 1;
  }
  return s;
}

/** The distance at which a wall reaches screen x. */
const dAtX = (w, x) => (w.X * F) / (x - VP.x);

// The washes, building by building, far ones first so the near walls overlap them.
for (let wi = 0; wi < 2; wi++) {
  const w = WALLS[wi];
  for (const b of [...w.blocks].reverse()) {
    // the part of the building on the canvas
    const dn = Math.max(b.d0, dAtX(w, wi === 0 ? -60 : W + 60));
    if (dn >= b.d1) continue;
    const df = b.d1;
    const mid = (dn + df) / 2;
    const dish = dishAt(mid);
    const xSpan = Math.abs(sx(w.X, df) - sx(w.X, dn));
    const zWarm = 5.5 + rand(-1, 1.5);
    if (xSpan > 100) {
      // along the courses: one stroke per row of the wall, top down, the brush lifting
      // over the lit windows it crosses
      const bw = Math.min(46, Math.max(8, (0.75 * F) / mid));
      const dZ = (0.3 * bw * mid) / F;
      const zTop = Math.min(b.h, EYE + ((VP.y + 50) * df) / F);
      for (let Z = zTop - dZ * 0.3; Z > -dZ; Z -= dZ * rand(0.9, 1.1)) {
        // the warm foot knits into the cool wall over a metre or so
        const warm = Z < zWarm + rand(-0.8, 0.8);
        const path = [];
        // a little past each end, so the courses run into the neighbors
        const ext = (0.4 * bw * dn * dn) / (Math.abs(w.X) * F);
        const d0 = Math.max(1.5, dn - ext);
        const d1 = df + (0.4 * bw * df * df) / (Math.abs(w.X) * F);
        const n = Math.max(2, Math.ceil(xSpan / 5));
        for (let i = 0; i <= n; i++) {
          // even steps in screen x, not in distance
          const x = sx(w.X, d0) + ((sx(w.X, d1) - sx(w.X, d0)) * i) / n;
          const D = dAtX(w, x);
          const y = sy(Z, D);
          if (y < -200) continue;
          path.push([x, y, 0.75 * (1 - reserve(w, wi, b, D, Z, bw))]);
        }
        if (path.length < 2) continue;
        stroke({
          path,
          brush: { type: 'soft', width: bw, reservoir: 6 },
          color: warm ? 'wallLow' : b.pile,
          paint: 'transparent',
          thinner: DISH[warm ? paler(dish) : dish],
          load: 0.9,
        });
      }
    } else {
      // a far sliver: upright strokes from the roofline to the pavement
      const bw = Math.min(14, Math.max(5, (1.3 * F) / mid));
      const [xa, xb] = [sx(w.X, df), sx(w.X, dn)].sort((p, q) => p - q);
      for (let x = xa + bw * 0.3; x <= xb - bw * 0.2; x += bw * rand(0.32, 0.42)) {
        const D = dAtX(w, x);
        for (const [za, zb, pile, d] of [
          [b.h, 0, b.pile, dish],
          [zWarm, 0, 'wallLow', paler(dish)],
        ]) {
          const ya = Math.max(-40, sy(za, D));
          const yb = sy(zb, D) + 2;
          const n = Math.ceil((yb - ya) / 5);
          const path = [];
          for (let i = 0; i <= n; i++) {
            const y = ya + ((yb - ya) * i) / n;
            const Z = EYE - ((y - VP.y) * D) / F;
            path.push([x, y, 0.75 * (1 - reserve(w, wi, b, D, Z, bw))]);
          }
          stroke({
            path,
            brush: { type: 'soft', width: bw, reservoir: 5 },
            color: pile,
            paint: 'transparent',
            thinner: DISH[d],
            load: 0.9,
          });
        }
      }
    }
  }
}

// The walls set before their windows and edges are drawn over them.
dry();

/**
 * Fill one window of wall w, from distance Da to Db and height z0 to z1, in a single
 * stroke that zigzags up and down across it, as a hand fills a small shape: the edge
 * of the fill is the path's edge, so the window keeps its perspective, slanted top and
 * upright sides, with no stroke ends showing.
 */
function pane(w, Da, Db, z0, z1, color, dish) {
  const Dm = (Da + Db) / 2;
  const hpx = ((z1 - z0) * F) / Dm;
  const wpx = Math.abs(sx(w.X, Db) - sx(w.X, Da));
  const bw = Math.max(1.5, Math.min(14, Math.min(wpx, hpx) * 0.45));
  // half a brush in from each side, in metres along the wall and up it
  const inD = (D) => (0.5 * bw * D * D) / (Math.abs(w.X) * F);
  const inZ = (D) => (0.5 * bw * D) / F;
  const a = Da + inD(Da);
  const b = Db - inD(Db);
  const path = [];
  if (b <= a || wpx < bw * 1.3) {
    path.push([sx(w.X, Dm), sy(z1 - inZ(Dm), Dm)], [sx(w.X, Dm), sy(z0 + inZ(Dm), Dm)]);
  } else {
    const m = Math.max(1, Math.ceil(wpx / (bw * 0.55)));
    for (let k = 0; k <= m; k++) {
      const D = a + ((b - a) * k) / m;
      const top = [sx(w.X, D), sy(z1 - inZ(D), D)];
      const bottom = [sx(w.X, D), sy(z0 + inZ(D), D)];
      if (k % 2) path.push(bottom, top);
      else path.push(top, bottom);
    }
  }
  stroke({
    path,
    brush: { type: 'round', width: bw, streak: 0, reservoir: 6 },
    color,
    paint: 'transparent',
    thinner: DISH[dish],
    load: 0.9,
    pressure: 0.85,
    corners: true,
    end: 'stop',
  });
}

// Lit windows take a warm stain; shopfronts a hotter one. Unlit windows are dark,
// though most are left to the wash. Bay by bay, floor by floor, as a hand would go.
for (let wi = 0; wi < 2; wi++) {
  const w = WALLS[wi];
  for (const b of w.blocks) {
    for (let bay = 0; b.d0 + bay * 3.2 < b.d1 - 1; bay++) {
      const D0 = b.d0 + bay * 3.2;
      const onCanvas = (D) => sx(w.X, D) > -20 && sx(w.X, D) < W + 20;
      // the near windows are the darkest; up the avenue the rain air pales them
      const dish = D0 < 26 + rand(-4, 4) ? 'strong' : D0 < 70 + rand(-8, 8) ? 'medium' : 'pale';
      if (onCanvas(D0 + 0.55) && hash(bay, wi, b.d0) < 0.65)
        pane(w, D0 + 0.55, Math.min(b.d1, D0 + 2.65), 0.9, 3.0, 'shopGold', 'medium');
      for (let floor = 0; 4.6 + floor * 3.3 + 2.6 < b.h - 2; floor++) {
        const lit = hash(bay * 7 + floor, wi, b.d0 + 1) < 0.22;
        // most unlit windows are left to the wash, and up the avenue all of them are
        if (!lit && (D0 > 90 || hash(floor * 3 + bay, wi + 5, b.d0) < (D0 < 30 ? 0.45 : 0.65)))
          continue;
        const Da = D0 + 0.8;
        const Db = D0 + 2.2;
        if (Db > b.d1 || !onCanvas(Da)) continue;
        const z0 = 4.6 + floor * 3.3 + 0.6;
        const Dm = (Da + Db) / 2;
        if (sy(z0, Dm) < -40 || sy(z0 + 2, Dm) > H) continue;
        // a lit pane spreads a little over the paper saved round it, to soften its rim
        const g = lit ? 0.12 : 0;
        pane(
          w,
          Da - g,
          Db + g,
          z0 - g,
          z0 + 2 + g,
          lit ? 'windowGold' : 'windowDark',
          lit ? 'medium' : dish,
        );
      }
    }
  }
}

// Cornices and the edges between buildings: a dark line along each roofline, and the
// upright where one building stands in front of the next.
for (let wi = 0; wi < 2; wi++) {
  const w = WALLS[wi];
  for (const b of w.blocks) {
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const D = b.d0 + ((b.d1 - b.d0) * k) / 8;
      const p = [sx(w.X, D), sy(b.h, D)];
      if (p[1] > -150 && p[0] > -150 && p[0] < W + 150) pts.push(p);
    }
    const f = F / ((b.d0 + b.d1) / 2);
    if (pts.length > 1)
      stroke({
        path: pts,
        brush: { type: 'round', width: Math.max(2, 0.5 * f) },
        color: 'windowDark',
        paint: 'glaze',
        thinner: 0.4,
        load: 0.85,
      });
    const xe = sx(w.X, b.d1);
    if (xe > 0 && xe < W && b.d1 < 200)
      stroke({
        path: [
          [xe, Math.max(-10, sy(b.h, b.d1))],
          [xe, sy(0, b.d1)],
        ],
        brush: { type: 'round', width: Math.max(1.5, 0.3 * (F / b.d1)) },
        color: 'windowDark',
        paint: 'glaze',
        thinner: 0.5,
        load: 0.8,
      });
  }
}

dry();
