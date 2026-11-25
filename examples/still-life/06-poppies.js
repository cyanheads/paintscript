/**
 * Passage 6: the poppies, each petal laid with the knife from the heart out to the rim.
 *
 * A poppy is a cup of four or five petals. Each petal goes on as a fan of knife strokes
 * pulled outward from near the center and stopped at the rim, so the paint piles into a
 * ridge where the blade halts, the way a petal's edge curls. The cup is lit from the
 * window: the inner faces of the petals on the far side (lower right) turn to the light,
 * the near ones (upper left) fall into the cup's shade, and their curled rims catch it.
 * Body color first, then light and dark pressed into it wet; then each heart, a dark ring
 * of stamens round a grey-green seed head.
 */

const LIGHT = { x: -0.63, y: -0.77 };

// kind picks the pile family; tilt and squash foreshorten the cup.
const POPPIES = [
  { x: 545, y: 225, r: 102, kind: 'orange', tilt: 0.3, squash: 0.85, petals: 5 },
  { x: 705, y: 385, r: 128, kind: 'orange', tilt: -0.3, squash: 0.9, petals: 5 },
  { x: 945, y: 405, r: 78, kind: 'coral', tilt: -0.5, squash: 0.75, petals: 4 },
  { x: 200, y: 440, r: 74, kind: 'red', tilt: 0.5, squash: 0.8, petals: 4 },
  { x: 430, y: 500, r: 122, kind: 'red', tilt: 0.1, squash: 0.92, petals: 5 },
  { x: 850, y: 640, r: 108, kind: 'red', tilt: -0.75, squash: 0.62, petals: 5 },
  { x: 285, y: 725, r: 98, kind: 'coral', tilt: 0.6, squash: 0.72, petals: 4 },
];

const PILES = {
  red: ['redDark', 'red', 'redLight'],
  orange: ['orangeDark', 'orange', 'orangeLight'],
  coral: ['coralDark', 'coral', 'coralLight'],
};

/** Map a point on the flat flower (dx, dy from center) onto the canvas, foreshortened. */
function place(f, dx, dy) {
  const c = Math.cos(f.tilt);
  const s = Math.sin(f.tilt);
  const u = dx * c + dy * s;
  const v = (-dx * s + dy * c) * f.squash;
  return [f.x + u * c - v * s, f.y + u * s + v * c];
}

/** One knife pull along a petal at angle th, from radius r0 to r1, bowed by `bow`. */
function pull(f, th, r0, r1, width, color, opts = {}) {
  const bow = opts.bow ?? rand(-0.12, 0.12);
  const pts = [0, 0.5, 1].map((t) => {
    const r = r0 + (r1 - r0) * t;
    const a = th + bow * Math.sin(Math.PI * t);
    const [x, y] = place(f, Math.cos(a) * r, Math.sin(a) * r);
    return [x, y, t === 0 ? 0.55 : t === 0.5 ? 1 : rand(0.7, 1)];
  });
  stroke({
    path: pts,
    brush: { type: 'knife', width, streak: rand(0.1, 0.3), toneVar: 0.35 },
    color,
    load: opts.load ?? rand(0.85, 1),
    end: opts.end ?? 'stop',
  });
}

for (const f of POPPIES) {
  const [dark, body, light] = PILES[f.kind];
  const start = rand(Math.PI * 2);
  const step = (Math.PI * 2) / f.petals;
  const petals = [];
  for (let k = 0; k < f.petals; k++) {
    const th = start + k * step + rand(-0.15, 0.15);
    // the cup's inner face looks back toward the light from the far side
    const facing = -(Math.cos(th) * LIGHT.x + Math.sin(th) * LIGHT.y);
    petals.push({ th, facing, reach: f.r * rand(0.88, 1.05) });
  }

  // body color: a fan of four pulls per petal, overlapping its neighbours, the far petals first
  petals.sort((a, b) => a.facing - b.facing);
  for (const p of petals) {
    for (const off of [-0.42, -0.14, 0.14, 0.42]) {
      pull(
        f,
        p.th + off * step,
        f.r * 0.12,
        p.reach * (1 - Math.abs(off) * 0.2),
        f.r * rand(0.34, 0.46),
        body,
      );
    }
  }
  // light and shade pressed into the wet body
  for (const p of petals) {
    const pile = p.facing > 0.25 ? light : p.facing < -0.35 ? dark : null;
    if (pile) {
      pull(f, p.th + rand(-0.15, 0.15), f.r * 0.25, p.reach * 0.9, f.r * rand(0.28, 0.38), pile, {
        load: rand(0.7, 0.9),
      });
    }
    // the deep of the cup, dragged out from the heart
    pull(f, p.th + rand(-0.4, 0.4), f.r * 0.05, f.r * rand(0.35, 0.5), f.r * 0.2, dark, {
      load: 0.8,
      end: 'lift',
    });
  }
  // each petal's rim swept round in one curved pull, which rounds off the square ends of
  // the outward strokes; the curled rims of the near petals catch the window
  for (const p of petals) {
    const near = p.facing < -0.2;
    const a0 = p.th - step * 0.5;
    const a1 = p.th + step * 0.5;
    const rr = p.reach * 0.9;
    const pts = [a0, p.th - step * 0.2, p.th + step * 0.2, a1].map((a) => {
      const [x, y] = place(
        f,
        Math.cos(a) * rr * (1 - 0.1 * Math.abs(a - p.th)),
        Math.sin(a) * rr * (1 - 0.1 * Math.abs(a - p.th)),
      );
      return [x, y, rand(0.5, 1)];
    });
    stroke({
      path: pts,
      brush: { type: 'knife', width: f.r * (near ? 0.12 : 0.18), streak: 0.2 },
      color: near ? light : body,
      load: 0.9,
      end: 'stop',
    });
  }

  // the seams where one petal tucks under the next: the knife's edge drawn out in the dark
  for (const p of petals) {
    const a = p.th + step * 0.5 + rand(-0.08, 0.08);
    pull(f, a, f.r * 0.2, f.r * rand(0.75, 0.9), 3.5, dark, {
      load: 0.9,
      end: 'lift',
      bow: rand(-0.05, 0.05),
    });
  }

  // the heart: a ring of dark stamens, then the seed head with its lit top
  const ring = Math.round(f.r * 0.22);
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * Math.PI * 2 + rand(-0.1, 0.1);
    const rr = f.r * rand(0.13, 0.22);
    const [x, y] = place(f, Math.cos(a) * rr, Math.sin(a) * rr);
    stroke({
      path: [[x, y]],
      brush: { type: 'knife', width: rand(4, 7) },
      color: 'black',
      load: 0.9,
      angle: a,
    });
  }
  const [hx, hy] = place(f, 0, 0);
  stroke({
    path: [
      [hx - f.r * 0.08, hy - 2],
      [hx + f.r * 0.08, hy + 2],
    ],
    brush: { type: 'knife', width: f.r * 0.13 },
    color: 'leaf',
    load: 1,
    end: 'stop',
  });
  stroke({
    path: [
      [hx - f.r * 0.07, hy - f.r * 0.04],
      [hx + f.r * 0.02, hy - f.r * 0.05],
    ],
    brush: { type: 'knife', width: 4 },
    color: 'leafGrey',
    load: 1,
  });
  // pollen on a few stamens
  for (let k = 0; k < ring / 3; k++) {
    const a = rand(Math.PI * 2);
    const rr = f.r * rand(0.15, 0.24);
    const [x, y] = place(f, Math.cos(a) * rr, Math.sin(a) * rr);
    stroke({
      path: [[x, y]],
      brush: { type: 'knife', width: 3 },
      color: 'lemonLight',
      load: 0.9,
      angle: a,
    });
  }
}

dry();
