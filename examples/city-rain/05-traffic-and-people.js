/**
 * Passage 5: the life of the street, the crisp edges of the picture.
 *
 * Over the dried road go the things that move through it: two yellow cabs, a dark
 * car and a bus far up the avenue, the orange-and-white steam stack, the lamp posts
 * and the traffic signal, and people under umbrellas, one of them red, crossing at
 * the crosswalk. These carry the hardest edges in the painting, laid with round and
 * flat brushes in strong paint, each small form blocked in with one stroke swept back
 * and forth across it. Each one also drops its reflection into the wet road below it:
 * a soft smear of its own colors, dragged down with a damp brush.
 */

const VP = { x: 630, y: 780 };
const EYE = 5;
const F = 1000;
const sx = (X, D) => VP.x + (X * F) / D;
const sy = (Z, D) => VP.y + ((EYE - Z) * F) / D;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

palette('cabYellow', mix(['gamboge', 2], ['ochre', 0.6], ['scarlet', 0.08]));
palette('cabShade', mix(['gamboge', 1], ['ochre', 1], ['sienna', 0.4], ['payne', 0.2]));
palette('ink', mix(['payne', 1.4], ['crimson', 0.45], ['ultra', 0.3]));
palette('coat', mix(['payne', 1.2], ['sienna', 0.3], ['crimson', 0.35]));
palette('umbrellaRed', mix(['scarlet', 1.5], ['crimson', 0.7]));
palette('tail', mix(['scarlet', 2], ['crimson', 0.3]));
palette('signalRed', mix(['scarlet', 2], ['gamboge', 0.15]));
palette('stackOrange', mix(['scarlet', 1], ['gamboge', 1.2]));
palette('stackShade', mix(['payne', 1], ['crimson', 0.3], ['water', 3]));
palette('glowWarm', mix(['gamboge', 2], ['scarlet', 0.3], ['water', 3]));

/** Steam from the stack (as in passage 1): what it hides is painted faintly. */
const STACK = { X: -3, D: 13, x: sx(-3, 13), y: sy(2.4, 13) };
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

/** Pressure at a point, eased off where the steam veils it. */
const veil = (x, y, p) => p * (1 - 0.85 * steam(x, y));

/**
 * A level band of flat color from x0 to x1, centered on yc, h px tall, in as many
 * rows as it takes; `gaps` are x positions where the brush lifts (a saved light).
 */
function band(x0, x1, yc, h, color, gaps = [], gapHalf = 0) {
  const rows = Math.max(1, Math.ceil(h / 34));
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = yc - h / 2 + rh * (r + 0.5);
    const n = Math.max(2, Math.ceil((x1 - x0) / 3));
    const path = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const lift = gaps.some((g) => Math.abs(x - g) < gapHalf) ? 0 : 1;
      path.push([x, y, veil(x, y, 0.85) * lift]);
    }
    stroke({
      path,
      brush: { type: 'flat', width: rh * 1.08, streak: 0.1 },
      color,
      paint: 'transparent',
      load: 0.95,
      end: 'stop',
    });
  }
}

/** A reflection: a soft upright smear of a color under a point of the road. */
function reflect(x, y, len, width, color, thinner = 0.3) {
  stroke({
    path: [
      [x, y, veil(x, y, 0.75)],
      [x + rand(-1, 1), y + len * 0.5, 0.6],
      [x + rand(-1, 1), y + len, 0.25],
    ],
    brush: { type: 'soft', width },
    color,
    paint: 'transparent',
    thinner,
    load: 0.85,
    end: 'taper',
  });
}
/** A clean damp brush pulled down through wet paint. */
function drag(x, y, len, width) {
  stroke({
    path: [
      [x, y],
      [x + rand(-1.5, 1.5), y + len],
    ],
    brush: { type: 'soft', width },
    pressure: 0.55,
    end: 'taper',
  });
}

/**
 * One confident stroke of strong paint, level across from x0 to x1 at height y: a
 * round brush, so its ends come out rounded the way a loaded brush leaves them.
 */
function slab(x0, x1, y, h, color, p = 0.85, thinner = 0) {
  stroke({
    path: [
      [x0 + h * 0.3, y + rand(-0.5, 0.5), veil(x0, y, p)],
      [(x0 + x1) / 2, y + rand(-0.8, 0.8), veil((x0 + x1) / 2, y, p)],
      [x1 - h * 0.3, y + rand(-0.5, 0.5), veil(x1, y, p)],
    ],
    brush: { type: 'round', width: h, streak: 0.15 },
    color,
    paint: 'transparent',
    thinner,
    load: 0.95,
    end: 'stop',
  });
}

/**
 * Fill a shape in one stroke that sweeps back and forth across it, top to bottom, the
 * way a loaded brush blocks in a small form: `span(y)` gives the shape's left and right
 * edge at height y, and the fill's edge is the path's edge, so the silhouette is clean.
 * `p(t)` is the pressure from top (0) to bottom (1).
 */
function fill(span, y0, y1, bw, color, p = () => 0.85, thinner = 0) {
  const path = [];
  const rows = Math.max(1, Math.ceil((y1 - y0 - bw) / (bw * 0.5)));
  for (let r = 0; r <= rows; r++) {
    const y = y0 + bw / 2 + ((y1 - y0 - bw) * r) / rows;
    const [a, b] = span(y);
    const t = (y - y0) / (y1 - y0);
    const ends = [
      [a + bw / 2, y, veil(a, y, p(t))],
      [Math.max(a + bw / 2, b - bw / 2), y, veil(b, y, p(t))],
    ];
    if (r % 2) ends.reverse();
    path.push(...ends);
  }
  stroke({
    path,
    brush: { type: 'round', width: bw, streak: 0, splay: 0, reservoir: 6 },
    color,
    paint: 'transparent',
    thinner,
    load: 0.95,
    corners: true,
    end: 'stop',
  });
}

/**
 * A car seen from a little above, in the few strokes a painter gives a car in the
 * rain: cabin and body blocked in as one mass of color with a clean silhouette and its
 * foot lost into its own reflection, the dark glass dropped into the cabin, then the
 * lights and the dark under it. A car coming toward us keeps the paper saved for its
 * headlights in passage 1; one going away shows red taillights.
 */
function car({ X, D, w, len, body, coming, cab }) {
  const f = F / D;
  const X0 = X - w / 2;
  const X1 = X + w / 2;
  const xl = sx(X0, D);
  const xr = sx(X1, D);
  const xm = (xl + xr) / 2;
  const roofNear = D + 0.9;
  const roofFar = D + len * 0.6;
  const rl = sx(X0 + 0.25, roofNear);
  // the whole car first as one yellow mass, cabin and body together: the cabin a
  // little narrower, its corners rounded, the body's foot laid lighter so it is lost in
  // the wet
  const top = sy(1.0, D);
  const bottom = sy(0.3, D);
  const roofY = sy(1.45, roofFar);
  const bwFill = Math.max(2, Math.min(9, (bottom - roofY) / 6));
  fill(
    (y) => {
      if (y >= top) return [xl, xr];
      const t = clamp01((y - roofY) / (top - roofY));
      const inset = (rl - xl) * (1 - t) ** 0.6;
      return [xl + inset, xr - inset];
    },
    roofY,
    bottom,
    bwFill,
    body,
    (t) => (t < 0.8 ? 0.85 : 0.55),
  );
  // the glass: dark, in the cabin, with the yellow left showing round it
  const gTop = sy(1.4, roofNear);
  const gBot = sy(1.03, D + 0.2);
  if (gBot - gTop > 3)
    fill(
      (y) => {
        const t = clamp01((y - gTop) / (gBot - gTop));
        const inset = (rl - xl) * (1 - t) * 0.8 + f * 0.12;
        return [xl + inset, xr - inset];
      },
      gTop,
      gBot,
      Math.max(1.5, Math.min(6, (gBot - gTop) / 3)),
      'ink',
      () => 0.85,
    );
  // the dark under the car and the two tyres, all one dark, lost at the bottom
  const lampY = sy(0.65, D);
  const lamps = [sx(X0 + 0.3, D), sx(X1 - 0.3, D)];
  slab(xl + f * 0.05, xr - f * 0.05, sy(0.2, D), f * 0.2, 'ink', 0.8);
  for (const x of [xl + f * 0.22, xr - f * 0.22])
    stroke({
      path: [
        [x, sy(0.35, D), 0.8],
        [x + rand(-1, 1), sy(0, D) + f * 0.04, 0.5],
      ],
      brush: { type: 'round', width: f * 0.24 },
      color: 'ink',
      paint: 'transparent',
      load: 0.95,
      end: 'taper',
    });
  if (coming) {
    // the paper saved for the headlights gets a crisp dark ring of bumper round it
    slab(xl + f * 0.1, xr - f * 0.1, lampY + f * 0.16, f * 0.08, 'ink', 0.7, 0.3);
  }
  if (cab) {
    // the lit sign on the roof: a small hot stroke with a hard edge, where the eye lands
    const sD = D + len * 0.35;
    const sxm = sx(X, sD);
    slab(sxm - f * 0.24, sxm + f * 0.24, sy(1.68, sD), f * 0.14, 'glowWarm', 0.9);
  }
  if (!coming) {
    for (const lx of lamps) {
      stroke({
        path: [[lx, sy(0.78, D), 0.9]],
        brush: { type: 'soft', width: f * 0.85 },
        color: 'tail',
        paint: 'transparent',
        thinner: 0.75,
        load: 0.8,
      });
      stroke({
        path: [[lx, sy(0.78, D), 0.9]],
        brush: { type: 'round', width: Math.max(3, f * 0.22) },
        color: 'tail',
        paint: 'transparent',
        load: 1,
      });
    }
  }
  // its reflection: the body color and its lights smeared down the road toward us
  const gy = sy(0, D);
  for (let k = 0; k < 5; k++)
    reflect(
      xl + (xr - xl) * (0.1 + 0.8 * rand()),
      gy + 2,
      f * rand(0.9, 1.9),
      Math.max(4, (xr - xl) * 0.2),
      body,
      0.45,
    );
  if (!coming)
    for (const lx of lamps) reflect(lx, gy + 2, f * 2.4, Math.max(3, f * 0.24), 'tail', 0.2);
  drag(xm, gy - f * 0.1, f * 2.2, (xr - xl) * 0.7);
}

// The far traffic first: taillights as dabs up the avenue, each with its streak.
for (const [X, D] of [
  [1.4, 80],
  [2.6, 80],
  [1.6, 130],
  [2.7, 130],
  [1.5, 210],
  [2.5, 210],
]) {
  const x = sx(X, D);
  stroke({
    path: [[x, sy(0.8, D)]],
    brush: { type: 'soft', width: Math.max(3, (0.5 * F) / D) },
    color: 'tail',
    paint: 'transparent',
    load: 1,
  });
  reflect(x, sy(0, D), (2 * F) / D, Math.max(2, (0.3 * F) / D), 'tail', 0.3);
}

// The bus coming down the far avenue: dark face, its lit destination sign, and the
// headlights the paper keeps.
{
  const D = 60;
  const xl = sx(-3.9, D);
  const xr = sx(-1.3, D);
  band(xl, xr, (sy(3.1, D) + sy(1.6, D)) / 2, sy(1.6, D) - sy(3.1, D), 'ink');
  band(xl + 2, xr - 2, sy(2.85, D), 4, 'glowWarm');
  band(
    xl,
    xr,
    (sy(1.6, D) + sy(0.3, D)) / 2,
    sy(0.3, D) - sy(1.6, D),
    'coat',
    [sx(-3.6, D), sx(-1.6, D)],
    3,
  );
  reflect((xl + xr) / 2, sy(0, D), 60, (xr - xl) * 0.6, 'coat', 0.4);
}

car({ X: 1.9, D: 35, w: 1.9, len: 4.5, body: 'coat' });
car({ X: -2.4, D: 24, w: 1.9, len: 4.6, body: 'cabYellow', coming: true, cab: true });
car({ X: 2.2, D: 13.5, w: 1.9, len: 4.6, body: 'cabYellow', cab: true });

// The steam stack: a tube banded orange and white (the white is the paper), shaded on
// the side away from the light.
{
  const f = F / STACK.D;
  const x = STACK.x;
  const half = 0.2 * f;
  stroke({
    path: [
      [x + half * 0.55, sy(0, STACK.D)],
      [x + half * 0.55, sy(2.4, STACK.D)],
    ],
    brush: { type: 'soft', width: half * 0.9 },
    color: 'stackShade',
    paint: 'transparent',
    load: 0.9,
  });
  for (let z = 0.05; z < 2.35; z += 0.42) {
    band(x - half, x + half, sy(z + 0.1, STACK.D), 0.2 * f, 'stackOrange');
  }
  band(x - half * 1.1, x + half * 1.1, sy(2.38, STACK.D), 0.08 * f, 'ink');
  reflect(x, sy(0, STACK.D), 120, half * 1.6, 'stackOrange', 0.3);
}

/** A lamp post: pole up from the curb, an arm out over the road, the dark head. */
function lamp(Xc, D, side) {
  const f = F / D;
  const w = Math.max(1.5, f * 0.16);
  const x = sx(Xc, D);
  const head = sx(Xc - side * 1.6, D);
  stroke({
    path: [
      [x, sy(0, D), veil(x, sy(0, D), 0.85)],
      [x, sy(4, D), veil(x, sy(4, D), 0.8)],
      [x, sy(7.6, D), 0.7],
    ],
    brush: { type: 'round', width: w },
    color: 'ink',
    paint: 'transparent',
    load: 0.95,
    end: 'stop',
  });
  stroke({
    path: [
      [x, sy(7.6, D), 0.7],
      [sx(Xc - side * 0.8, D), sy(7.95, D), 0.6],
      [head, sy(7.72, D), 0.5],
    ],
    brush: { type: 'round', width: w * 0.8 },
    color: 'ink',
    paint: 'transparent',
    load: 0.95,
  });
  stroke({
    path: [[head, sy(7.78, D), 0.6]],
    brush: { type: 'filbert', width: f * 0.4 },
    color: 'ink',
    paint: 'transparent',
    load: 0.9,
    angle: 0,
  });
  reflect(x, sy(0, D) + 2, Math.min(400, f * 5), w * 1.6, 'ink', 0.5);
}
for (const [X, D, side] of [
  [-5.2, 150, -1],
  [5.1, 120, 1],
  [-5.2, 120, -1],
  [5.1, 85, 1],
  [-5.2, 70, -1],
  [5.1, 46, 1],
  [-5.2, 38, -1],
  [5.1, 15, 1],
  [-5.2, 8, -1],
]) {
  lamp(X, D, side);
}

// The traffic signal at the near corner: a pole, a mast arm over the road, and two
// signal heads showing red. Each head is three upright strokes, the middle one
// lifting off where the red lamp is, which goes into the paper left there.
const SIG = { X: 5.2, D: 9.5 };
{
  const f = F / SIG.D;
  const px = sx(SIG.X, SIG.D);
  stroke({
    path: [
      [px, sy(0, SIG.D), 0.85],
      [px, sy(6.2, SIG.D), 0.8],
    ],
    brush: { type: 'round', width: 9 },
    color: 'ink',
    paint: 'transparent',
    load: 1,
    end: 'stop',
  });
  stroke({
    path: [
      [px, sy(6.15, SIG.D), 0.8],
      [sx(2, SIG.D), sy(6.2, SIG.D), 0.7],
      [sx(-0.6, SIG.D), sy(6.25, SIG.D), 0.5],
    ],
    brush: { type: 'round', width: 6 },
    color: 'ink',
    paint: 'transparent',
    load: 1,
    end: 'taper',
  });
  for (const X of [2.4, 0.3]) {
    const x = sx(X, SIG.D);
    const ly = sy(5.83, SIG.D);
    const top = sy(6.15, SIG.D);
    const bottom = sy(5.0, SIG.D);
    const cw = 0.12 * f;
    for (const k of [-1, 0, 1]) {
      const path = [];
      for (let y = top; y <= bottom; y += 3)
        path.push([x + k * cw, y, k === 0 && Math.abs(y - ly) < cw * 0.9 ? 0 : 0.85]);
      stroke({
        path,
        brush: { type: 'flat', width: cw * 1.15, streak: 0 },
        color: 'ink',
        paint: 'transparent',
        load: 1,
        end: 'stop',
      });
    }
    stroke({
      path: [[x, ly]],
      brush: { type: 'round', width: cw * 1.5 },
      color: 'signalRed',
      paint: 'transparent',
      load: 1,
    });
    stroke({
      path: [[x, ly]],
      brush: { type: 'soft', width: cw * 9 },
      color: 'signalRed',
      paint: 'transparent',
      thinner: 0.8,
      load: 0.75,
    });
  }
}

/**
 * A walker under an umbrella, the way a watercolorist puts a figure in the rain: one
 * stroke for the coat, wide at the shoulders and narrowing to the hem; two quick
 * flicks for the legs, one longer, mid-stride, their feet lost in the wet; a touch for
 * the head; and the canopy as one stroke swept back and forth across its dome, with a
 * crisp dark rim, the edge the eye finds. The reflection goes down into the road.
 */
function walker(X, D, canopy, stride) {
  const f = F / D;
  const x = sx(X, D);
  const foot = sy(0, D);
  const lean = rand(-0.03, 0.03) * f;
  const hem = foot - f * 0.62;
  const shoulder = foot - f * 1.45;
  // the legs: quick, tapering to nothing at the wet pavement
  for (const s of [-1, 1]) {
    const reach = s === Math.sign(stride) ? 1 : 0.7;
    stroke({
      path: [
        [x + s * f * 0.05, hem + f * 0.02, 0.9],
        [x + s * stride * f * 0.07 * reach, foot - f * 0.06 * (1 - reach), 0.35],
      ],
      brush: { type: 'round', width: Math.max(1.4, f * 0.1) },
      color: 'ink',
      paint: 'transparent',
      load: 0.95,
      end: 'taper',
    });
  }
  // the coat: shoulders down to the hem, pressed hard at the top
  stroke({
    path: [
      [x + lean, shoulder, 1],
      [x + lean * 0.5 + f * 0.02, shoulder + (hem - shoulder) * 0.5, 0.85],
      [x + rand(-0.02, 0.02) * f, hem + f * 0.04, 0.55],
    ],
    brush: { type: 'round', width: f * 0.42, streak: 0, splay: 0 },
    color: 'coat',
    paint: 'transparent',
    load: 0.95,
    end: 'taper',
  });
  // the head, half under the canopy
  stroke({
    path: [[x + lean, shoulder - f * 0.13, 0.8]],
    brush: { type: 'round', width: f * 0.2 },
    color: 'ink',
    paint: 'transparent',
    load: 0.9,
  });
  // the handle, then the canopy over it
  const cx = x + lean + f * 0.05;
  const crown = foot - f * 2.2;
  const rim = foot - f * 1.82;
  const R = f * 0.6;
  stroke({
    path: [
      [cx, shoulder + f * 0.25],
      [cx, rim],
    ],
    brush: { type: 'round', width: Math.max(1, f * 0.025) },
    color: 'ink',
    paint: 'transparent',
    load: 0.9,
  });
  fill(
    (y) => {
      const t = clamp01((y - crown) / (rim - crown));
      const half = R * Math.sqrt(Math.max(0.04, 1 - (1 - t) ** 2));
      return [cx - half, cx + half];
    },
    crown,
    rim + f * 0.03,
    Math.max(1.5, Math.min(5, (rim - crown) / 4)),
    canopy,
  );
  // the rim: dark and crisp, dipping between the rib tips
  const rimPath = [];
  for (let k = 0; k <= 8; k++) {
    const u = k / 8;
    rimPath.push([
      cx - R + 2 * R * u,
      rim + f * 0.03 * Math.sin(Math.PI * u) + (k % 2 ? f * 0.02 : 0),
    ]);
  }
  stroke({
    path: rimPath,
    brush: { type: 'round', width: Math.max(1.2, f * 0.045) },
    color: 'ink',
    paint: 'transparent',
    load: 0.9,
    end: 'taper',
  });
  stroke({
    path: [
      [cx, crown],
      [cx, crown - f * 0.1],
    ],
    brush: { type: 'round', width: Math.max(1, f * 0.03) },
    color: 'ink',
    paint: 'transparent',
    load: 0.9,
  });
  reflect(x, foot + 2, f * 1.3, f * 0.3, 'coat', 0.4);
  reflect(cx, foot + f * 0.7, f * 1.2, f * 0.6, canopy, 0.5);
  drag(x, foot, f * 2.2, f * 0.5);
}

walker(5.6, 60, 'ink', 0.6);
walker(-6.0, 42, 'ink', 0.5);
walker(6.1, 26, 'coat', 0.7);
walker(-6.2, 17, 'ink', 0.8);
walker(-5.5, 15.5, 'coat', -0.6);
walker(5.8, 12, 'ink', 0.5);
walker(-1.2, 8, 'umbrellaRed', 0.9);

dry();
