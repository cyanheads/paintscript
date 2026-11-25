/**
 * Passage 3: the headland and the strip of sea.
 *
 * Against the sun the headland is one flat, cool shape, warmed only where its slope
 * catches the light; it is painted in strokes that follow the ridge. The sea is a
 * dark band in short level strokes, paler toward the horizon, broken under the sun by
 * a path of glitter that widens as it comes toward us. A broken line of surf marks
 * where the sea runs out onto the sand.
 */

const W = canvas.width;
const HORIZON = 332;
const SHORE = 372;
const SUN = { x: 432, y: 248 };

function headTop(x) {
  if (x < 730) return HORIZON;
  const rise = Math.min(1, (x - 730) / 240) ** 0.75 * 44 + Math.max(0, x - 980) * 0.04;
  return HORIZON - rise + noise(x / 55, 2.6) * 4;
}

/** Half-width of the sun's path on the water at height y: narrow at the horizon, wider nearer. */
const pathHalf = (y) => 26 + (y - HORIZON) * 0.9;

brush('ridge', { type: 'filbert', width: 12, stiffness: 0.8 });
brush('water', { type: 'filbert', width: 10, stiffness: 0.8 });
brush('glint', { type: 'flat', width: 3, stiffness: 0.9 });

// Headland: ridge strokes first, then level strokes filling down to the water, darkest at the foot.
const headFar = mix(['headland', 2], ['skyLilac', 1]);
const headNear = mix(['headland', 2], ['sea', 0.6]);
// three piles for the slope, from the ridge down to the foot
const HEAD = [
  mix(['headland', 1.75], [headNear, 0.55]),
  mix(['headland', 1.5], [headNear, 1.05]),
  mix(['headland', 1.15], [headNear, 1.6]),
];
for (let x = 724; x < W; x += rand(26, 40)) {
  const len = rand(36, 60);
  stroke({
    path: [
      [x, headTop(x) + 3],
      [x + len / 2, headTop(x + len / 2) + 3],
      [x + len, headTop(x + len) + 3],
    ],
    brush: 'ridge',
    color: rand() < 0.3 ? headFar : 'headland',
    load: 0.85,
  });
}
for (let y = HORIZON - 44; y < HORIZON + 1; y += 6) {
  for (let x = 720; x < W; x += rand(40, 70)) {
    if (y < headTop(x) + 7) continue;
    const depth = (y - headTop(x)) / (HORIZON - headTop(x) + 1);
    const band = Math.min(2, Math.max(0, Math.floor(depth * 3 + rand(-0.4, 0.4))));
    stroke({
      path: [
        [x, y],
        [x + rand(45, 80), y + rand(-1.5, 1.5)],
      ],
      brush: 'ridge',
      color: HEAD[band],
      load: 0.8,
      pressure: 0.6,
    });
  }
}
// the left slope, turned toward the sun, takes a little warm light along its crest
for (let x = 734; x < 900; x += rand(16, 26)) {
  stroke({
    path: [
      [x, headTop(x) + 1.5],
      [x + 18, headTop(x + 18) + 1.5],
    ],
    brush: { type: 'round', width: 4 },
    color: mix(['skyPeach', 2], ['skyRose', 1]),
    load: 0.8,
    pressure: 0.5,
    end: 'taper',
  });
}

// Sea: long level strokes, paler and greyer at the horizon, deep violet toward the
// shore, each tipped a degree or two the way the swell lifts it. Three piles stepped
// from the horizon to the shore, each with a rose variant for broken color.
const SEA = [
  { lilac: mix(['sea', 1.2], ['skyLilac', 1]), rose: mix(['sea', 1.2], ['skyRose', 1]) },
  { lilac: mix(['sea', 1.7], ['skyLilac', 0.8]), rose: mix(['sea', 1.7], ['skyRose', 0.8]) },
  { lilac: mix(['sea', 2.2], ['skyLilac', 0.6]), rose: mix(['sea', 2.2], ['skyRose', 0.6]) },
];
for (let y = HORIZON + 3; y < SHORE + 1; y += 5) {
  const depth = (y - HORIZON) / (SHORE - HORIZON);
  for (let x = -10; x < W; x += rand(50, 100)) {
    const len = rand(60, 160);
    const cx = x + len / 2;
    const inPath = Math.abs(cx - SUN.x) < pathHalf(y) * 1.4;
    const band = SEA[Math.min(2, Math.max(0, Math.floor(depth * 3 + rand(-0.4, 0.4))))];
    const base = inPath
      ? mix(['sea', 1], ['skyGold', 1.2 + rand(0.6)])
      : rand() < 0.25
        ? band.rose
        : band.lilac;
    const tip = rand(-0.035, 0.035) * len;
    stroke({
      path: [
        [x, y - tip / 2],
        [x + len / 2, y + rand(-1, 1)],
        [x + len, y + tip / 2],
      ],
      brush: 'water',
      color: base,
      load: 0.8,
      pressure: rand(0.5, 0.8),
    });
  }
}
// a few ripples catching the sky, dragged lightly so they break on the weave
for (let i = 0; i < 36; i++) {
  const y = rand(HORIZON + 4, SHORE - 3);
  const x = rand(-20, W);
  if (Math.abs(x - SUN.x) < pathHalf(y) * 2) continue;
  stroke({
    path: [
      [x, y],
      [x + rand(30, 90), y + rand(-1.5, 1.5)],
    ],
    brush: { type: 'round', width: 2.5 },
    color: x > 700 ? 'skyLilac' : 'skyRose',
    load: 0.5,
    contact: 0.6,
    end: 'taper',
  });
}

// The water sets, so the glitter sits on top of it instead of melting in.
dry({ x: 0, y: HORIZON, w: W, h: SHORE - HORIZON + 4 });

// The glitter: short level dashes with dark water between, thickest at the path's
// center and scattering at its edges.
for (let i = 0; i < 120; i++) {
  const y = HORIZON + 2 + rand() ** 0.8 * (SHORE - HORIZON - 2);
  const spread = pathHalf(y) * (rand() + rand() - 1) * 1.6;
  const x = SUN.x + spread;
  const centre = 1 - Math.min(1, Math.abs(spread) / (pathHalf(y) * 1.6));
  const len = rand(3, 8) + centre * rand(4, 16);
  stroke({
    path: [
      [x - len / 2, y],
      [x + len / 2, y + rand(-0.5, 0.5)],
    ],
    brush: 'glint',
    color: centre > 0.55 ? mix(['white', 2], ['skyGlow', 1]) : rand() < 0.5 ? 'skyGlow' : 'skyGold',
    load: 0.9,
    pressure: 0.5 + centre * 0.4,
  });
}

// The surf line: a broken edge of foam where the last wave runs out on the sand,
// bright only under the sun and nearly lost in the violet elsewhere.
const surf = (x) => SHORE - 1 + noise(x / 90, 11) * 5 + noise(x / 23, 4) * 1.5;
for (let x = -10; x < W; x += rand(20, 70)) {
  const near = 1 - Math.min(1, Math.abs(x - SUN.x) / 420);
  if (rand() > 0.3 + near) continue;
  const len = rand(18, 60);
  stroke({
    path: [
      [x, surf(x)],
      [x + len / 2, surf(x + len / 2)],
      [x + len, surf(x + len)],
    ],
    brush: { type: 'round', width: 3 },
    color:
      near > 0.65
        ? mix(['white', 2], ['skyGlow', 1])
        : near > 0.3
          ? mix(['skyLilac', 1.5], ['sea', 0.3], ['white', 0.6])
          : mix(['skyLilac', 1.5], ['sea', 0.3], ['white', 0.15]),
    load: 0.4 + near * 0.5,
    contact: 0.55 + near * 0.45,
    pressure: 0.4 + near * 0.4,
    end: 'taper',
  });
}

dry({ x: 0, y: HORIZON - 60, w: W, h: SHORE - HORIZON + 66 });
