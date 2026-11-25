/**
 * Passage 4: the cobalt jug.
 *
 * The knife goes down the jug in curved planes that follow its belly, each column
 * taking the pile its side of the form wants: light on the left toward the window,
 * deep on the right, and a warm reflected light low on the right edge from the cloth.
 * The shoulder is turned with short planes across it. Then, still wet, the highlights
 * are pressed on thick with the knife's tip, the rim is drawn as one bright curve, and
 * the handle is pulled out from the shoulder in a single loop.
 */

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

/** The pile for a point on the jug at u (-1 left edge to 1 right) and height y. */
function jugPile(u, y) {
  const top = y < 960 ? 0.25 : 0; // the shoulder faces up into the light
  // the wobble is noise across the surface, so neighbouring planes agree and facets read
  const lit = -u + top + 0.35 * noise(u * 2.5, y / 70) + rand(-0.1, 0.1);
  if (u > 0.78 && y > 1000) return 'jugWarm';
  return lit > 0.5 ? 'cobaltLight' : lit > -0.15 ? 'cobalt' : 'cobaltDeep';
}

/** A knife stroke down the jug's surface along u, from y0 to y1, kept inside its silhouette. */
function meridian(u, y0, y1, width, color, load = 0.9) {
  const pts = [];
  for (let k = 0; k <= 4; k++) {
    const y = y0 + ((y1 - y0) * k) / 4;
    const r = jugR(y);
    const uu = Math.max(-1, Math.min(1, u)) * Math.max(0, 1 - width / 2 / r);
    pts.push([JUG.x + uu * r, y, rand(0.45, 1)]);
  }
  stroke({
    path: pts,
    brush: { type: 'knife', width, streak: rand(0.1, 0.3), toneVar: 0.3 },
    color,
    load,
    end: rand() < 0.5 ? 'stop' : 'lift',
  });
}

// The body: overlapping columns of curved planes, top to bottom in two or three lengths each.
for (let pass = 0; pass < 2; pass++) {
  for (let u = -0.95; u <= 0.95; u += rand(0.12, 0.18)) {
    let y = 845 + rand(0, 40) + pass * 30;
    for (let y1 = 0; y1 < 1205; y = y1 - rand(10, 30)) {
      y1 = Math.min(1205, y + rand(170, 330));
      meridian(u + rand(-0.04, 0.04), y, y1, rand(26, 40), jugPile(u, (y + y1) / 2));
    }
  }
}

// Round the belly, wet into the columns: arcs that sag toward us, since the eye is above the
// jug, lightly loaded so they drag the columns' colors across each other.
for (let y = 960; y < 1195; y += rand(20, 34)) {
  const r = jugR(y);
  for (let u = -0.92 + rand(0.2); u < 0.8; u += rand(0.4, 0.6)) {
    const u1 = Math.min(0.92, u + rand(0.35, 0.55));
    const sag = (y - 900) * 0.09;
    const at = (v) => [JUG.x + v * (r - 10), y + sag * (1 - v * v), rand(0.4, 0.9)];
    stroke({
      path: [at(u), at((u + u1) / 2), at(u1)],
      brush: { type: 'knife', width: rand(16, 28), streak: 0.25, toneVar: 0.3 },
      color: jugPile((u + u1) / 2, y),
      load: rand(0.5, 0.75),
    });
  }
}

// The shoulder turned across: short planes curving round it.
for (let y = 870; y < 980; y += rand(18, 26)) {
  const r = jugR(y);
  for (let u = -0.9; u < 0.7; u += rand(0.35, 0.5)) {
    const x0 = JUG.x + u * r;
    const x1 = JUG.x + Math.min(0.9, u + rand(0.3, 0.45)) * r;
    const sag = 10 * (1 - Math.abs((u + 0.2) / 1.2));
    stroke({
      path: [
        [x0, y, rand(0.5, 1)],
        [(x0 + x1) / 2, y + sag, 1],
        [x1, y, rand(0.4, 0.9)],
      ],
      brush: { type: 'knife', width: rand(18, 26), streak: 0.2, toneVar: 0.3 },
      color: jugPile(u + 0.2, y),
      load: 0.85,
    });
  }
}

// The neck and the rim: a dark band under a bright curved lip.
for (let y = 828; y < 870; y += 12) {
  const r = jugR(y);
  stroke({
    path: [
      [JUG.x - r + 10, y],
      [JUG.x, y + 8],
      [JUG.x + r - 10, y],
    ],
    brush: { type: 'knife', width: 16 },
    color: y < 845 ? 'cobalt' : 'cobaltDeep',
    load: 0.9,
  });
}
stroke({
  path: [
    [JUG.x - 110, 818, 0.8],
    [JUG.x - 40, 830, 1],
    [JUG.x + 50, 829, 0.8],
    [JUG.x + 108, 816, 0.5],
  ],
  brush: { type: 'knife', width: 9 },
  color: 'cobaltLight',
  load: 1,
  end: 'stop',
});

// The handle: one loop pulled from the shoulder, then its lit top edge.
const HANDLE = [
  [JUG.x + 150, 905],
  [JUG.x + 215, 915],
  [JUG.x + 248, 975],
  [JUG.x + 232, 1045],
  [JUG.x + 186, 1085],
];
stroke({
  path: HANDLE,
  brush: { type: 'knife', width: 36 },
  color: 'cobaltDeep',
  load: 1,
  end: 'stop',
});
stroke({
  path: HANDLE.slice(0, 4).map(([x, y]) => [x - 2, y - 9, 0.8]),
  brush: { type: 'knife', width: 13 },
  color: 'cobaltLight',
  load: 0.8,
});

// Highlights, thick and wet into the blue: the window on the shoulder, a softer one below.
const GLINTS = [
  { x: JUG.x - 98, y0: 888, y1: 950, w: 15, c: 'jugGlint' },
  { x: JUG.x - 118, y0: 975, y1: 1085, w: 12, c: 'cobaltLight' },
  { x: JUG.x - 127, y0: 1000, y1: 1050, w: 7, c: 'jugGlint' },
  { x: JUG.x - 62, y0: 900, y1: 925, w: 8, c: 'jugGlint' },
];
for (const g of GLINTS) {
  stroke({
    path: [
      [g.x + 4, g.y0, 0.7],
      [g.x - 2, (g.y0 + g.y1) / 2, 1],
      [g.x - 6, g.y1, 0.6],
    ],
    brush: { type: 'knife', width: g.w },
    color: g.c,
    load: 1,
    end: 'stop',
  });
}

dry();
