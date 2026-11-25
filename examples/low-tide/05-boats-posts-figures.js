/**
 * Passage 5: the darks. Boats, the old posts, two walkers at the water's edge.
 *
 * With the sun behind them everything solid on the beach turns to a near-silhouette
 * with a thread of light along the edge that faces the sun. Their shadows come first,
 * glazed over the dried sand, falling toward us and away from the sun; then the shapes,
 * laid smoothly in a few strokes (piled-up dark paint catches the light on its ridges
 * and turns grey); then their reflections; then, once those have dried, the rims of light.
 */

const HORIZON = 332;
const SUN = { x: 432, y: 248 };

/** Where the wet sand gives way to dry (as in passage 1). */
function dryLine(x) {
  return 615 + 38 * noise(x / 170, 7.3) + Math.max(0, 300 - x) * 0.18;
}

/** Unit vector pointing from the sun's foot on the horizon to a point: the way a shadow falls there. */
function away(x, y) {
  const dx = x - SUN.x;
  const dy = y - HORIZON;
  const d = Math.hypot(dx, dy);
  return [dx / d, dy / d];
}

palette('boatDark', mix(['darkest', 3], ['sea', 0.5]));
palette('wood', mix(['darkest', 2], ['sienna', 1]));
palette('rim', mix(['skyGlow', 2], ['white', 1]));
const shadowGlaze = mix(['darkest', 2], ['ultra', 0.4], ['alizarin', 0.3]);
const strake = mix(['cadRed', 1], ['alizarin', 0.8], ['darkest', 1.2]);
const silhouette = mix(['darkest', 2], ['sea', 0.5]);
/** Darks go on a little lean and not too heavy, so they lie flat instead of ridging. */
const thin = { thinner: 0.12, load: 0.8 };

brush('hull', { type: 'flat', width: 13, stiffness: 0.8 });
brush('line', { type: 'round', width: 3 });
brush('hair', { type: 'round', width: 1.6 });
brush('glazer', { type: 'flat', width: 22, streak: 0.5 });

// The big boat: sheer (gunwale) and keel as curves along its length, u from stern to bow.
const boat = {
  x: (u) => 648 + 222 * u,
  sheer: (u) => 524 + 10 * Math.sin(Math.PI * u) - 20 * u ** 3,
  keel: (u) => (u < 0.8 ? 566 - 4 * u : 562.8 - ((u - 0.8) / 0.2) ** 2 * 50),
};
const along = (fn, u0, u1, step) => {
  const pts = [];
  for (let u = u0; u <= u1 + 1e-9; u += step) pts.push(fn(u));
  return pts;
};

// The far boat, the posts, and the walkers, as numbers.
const far = { x0: 946, x1: 1024, y: 432 };
const POSTS = [];
for (let i = 0; i < 7; i++) {
  const t = i / 6;
  POSTS.push({
    x: 150 + t * 175 + noise(i, 5) * 6,
    foot: 870 - (870 - 398) * t ** 0.8,
    tall: 120 * (1 - t) ** 1.4 + 10,
    w: 15 * (1 - t) + 3,
  });
}
const WALKERS = [
  { x: 522, foot: 389, tall: 36 },
  { x: 540, foot: 391, tall: 21 },
];

// Shadows, glazed over the dry sand: each falls toward us, away from the sun.
for (let u = 0; u <= 1; u += 0.06) {
  const x = boat.x(u);
  const y = boat.keel(Math.min(u, 0.8)) + 2;
  const [dx, dy] = away(x, y);
  const len = 58 + 30 * Math.sin(Math.PI * u);
  stroke({
    path: [
      [x, y],
      [x + dx * len, y + dy * len],
    ],
    brush: 'glazer',
    color: shadowGlaze,
    paint: 'glaze',
    load: 0.55,
    end: 'taper',
  });
}
for (const p of POSTS) {
  const [dx, dy] = away(p.x, p.foot);
  const len = p.tall * 0.9;
  stroke({
    path: [
      [p.x, p.foot],
      [p.x + dx * len, p.foot + dy * len],
    ],
    brush: { type: 'flat', width: p.w * 0.9 },
    color: shadowGlaze,
    paint: 'glaze',
    load: 0.6,
    end: 'taper',
  });
}

// The big boat's hull: rows that follow its curve, a red strake under the gunwale,
// dark below.
for (let v = 0.06; v < 1; v += 0.14) {
  stroke({
    path: along(
      (u) => [boat.x(u) + v * 8 * (1 - u), boat.sheer(u) + (boat.keel(u) - boat.sheer(u)) * v],
      0,
      0.97,
      0.1,
    ),
    brush: 'hull',
    color: v < 0.2 ? strake : 'boatDark',
    pressure: 0.7,
    ...thin,
  });
}
// the transom, square across the stern
stroke({
  path: [
    [649, 523],
    [652, 545],
    [656, 566],
  ],
  brush: 'line',
  color: 'boatDark',
  end: 'stop',
  ...thin,
});
// the mast, and a furled sail lashed along its boom
stroke({
  path: [
    [743, 531],
    [745, 470],
    [747, 404],
  ],
  brush: 'line',
  color: 'wood',
  end: 'taper',
  ...thin,
});
stroke({
  path: [
    [745, 500],
    [700, 507],
    [672, 512],
  ],
  brush: { type: 'round', width: 6 },
  color: mix(['boatDark', 1.5], ['skyRose', 0.5]),
  ...thin,
});
// the mooring line, sagging from the bow to its anchor in the sand
stroke({
  path: [
    [868, 509],
    [900, 548],
    [930, 584],
    [958, 598],
  ],
  brush: 'hair',
  color: 'wood',
  load: 0.8,
});

// The far boat, a sliver on the flats with a stub of mast.
for (let v = 0; v < 1; v += 0.34) {
  stroke({
    path: [
      [far.x0 + v * 3, far.y - 2 + v * 6],
      [(far.x0 + far.x1) / 2, far.y + 2 + v * 6],
      [far.x1 - v * 6, far.y - 6 + v * 5],
    ],
    brush: { type: 'filbert', width: 4 },
    color: 'boatDark',
    ...thin,
  });
}
stroke({
  path: [
    [982, 434],
    [983, 380],
  ],
  brush: 'hair',
  color: 'wood',
  load: 0.9,
  end: 'taper',
});

// The posts: weathered wood, a dark band of weed at the foot.
for (const p of POSTS) {
  for (let k = 0; k < 2; k++) {
    stroke({
      path: [
        [p.x + (k - 0.5) * p.w * 0.3, p.foot],
        [p.x + (k - 0.5) * p.w * 0.25 + rand(-1, 1), p.foot - p.tall * rand(0.94, 1)],
      ],
      brush: { type: 'flat', width: p.w * 0.75 },
      color: 'wood',
      end: 'stop',
      ...thin,
    });
  }
  stroke({
    path: [
      [p.x - p.w * 0.5, p.foot - p.tall * 0.12],
      [p.x + p.w * 0.5, p.foot - p.tall * 0.1],
    ],
    brush: { type: 'flat', width: Math.max(2, p.tall * 0.14) },
    color: mix(['darkest', 2], ['cadYellow', 0.3], ['ultra', 0.2]),
    ...thin,
  });
}

// The walkers: a figure and a child, hand in hand, stopped at the edge of the glitter.
for (const f of WALKERS) {
  const s = f.tall / 36;
  const legs = { type: 'round', width: 3 * s + 0.6 };
  stroke({
    path: [
      [f.x, f.foot - 17 * s],
      [f.x - 3 * s, f.foot],
    ],
    brush: legs,
    color: silhouette,
    end: 'stop',
    ...thin,
  });
  stroke({
    path: [
      [f.x, f.foot - 17 * s],
      [f.x + 3.5 * s, f.foot],
    ],
    brush: legs,
    color: silhouette,
    end: 'stop',
    ...thin,
  });
  stroke({
    path: [
      [f.x, f.foot - 16 * s],
      [f.x + 0.5, f.foot - 30 * s],
    ],
    brush: { type: 'round', width: 7 * s },
    color: silhouette,
    ...thin,
  });
  stroke({
    path: [[f.x + 0.5, f.foot - 33.5 * s]],
    brush: { type: 'round', width: 5.5 * s },
    color: silhouette,
    ...thin,
  });
}
stroke({
  path: [
    [525, 363],
    [531, 370],
    [538, 375],
  ],
  brush: { type: 'round', width: 1.8 },
  color: silhouette,
  ...thin,
});

// Reflections. The hull hangs upside down under its keel, as deep as the side is tall,
// broken into level dashes by the ripples: glazed, so they darken the sand and its
// shadow instead of covering them with a flat grey. Posts and figures drop broken
// uprights. Each fades as it goes down: a dark pile under the keel, a paler one below.
const REFLECTION = [mix(['boatDark', 2], ['sea', 0.5]), mix(['boatDark', 2], ['sea', 1.1])];
const reflected = (d) => REFLECTION[d + rand(-0.15, 0.15) < 0.5 ? 0 : 1];
const mirrorBottom = (u) => boat.keel(u) + (boat.keel(u) - boat.sheer(u)) * 0.85;
for (let y = 567; y < mirrorBottom(0.5); y += rand(4, 7)) {
  const d = (y - 566) / (mirrorBottom(0.5) - 566);
  if (rand() < 0.2 + d * 0.4) continue;
  // the stretch of hull whose mirror image reaches down to this row
  const span = along((u) => u, 0, 1, 0.02).filter((u) => y >= boat.keel(u) && y <= mirrorBottom(u));
  if (span.length < 2) continue;
  const x0 = boat.x(span[0]) + rand(0, 20) + d * 16;
  const x1 = boat.x(span[span.length - 1]) - rand(0, 20) - d * 16;
  stroke({
    path: [
      [x0, y],
      [(x0 + x1) / 2, y + rand(-1, 1)],
      [x1, y + rand(-1, 1)],
    ],
    brush: { type: 'flat', width: rand(3, 5) },
    color: reflected(d),
    paint: 'glaze',
    load: 0.8 - d * 0.4,
    end: 'taper',
  });
}
function reflectUpright(x, y, len, width, color) {
  for (let d = 0; d < len; ) {
    const seg = rand(4, 10);
    stroke({
      path: [
        [x + rand(-0.8, 0.8), y + d],
        [x + rand(-1.2, 1.2), y + d + seg],
      ],
      brush: { type: 'flat', width: width * rand(0.7, 1.1) },
      color,
      thinner: 0.35,
      load: 0.7 - (0.3 * d) / len,
      end: 'taper',
    });
    d += seg + rand(2, 6) * (1 + (2 * d) / len);
  }
}
reflectUpright(746, 574, 60, 2.2, mix(['wood', 2], ['sandWet', 1]));
for (let d = 1; d < 12; d += 3) {
  stroke({
    path: [
      [far.x0 + 6 + d, far.y + 4 + d],
      [far.x1 - 8 - d, far.y + 3 + d],
    ],
    brush: { type: 'flat', width: 2.5 },
    color: reflected(d / 12),
    ...thin,
  });
}
for (const p of POSTS)
  if (p.foot < dryLine(p.x) - 4)
    reflectUpright(p.x, p.foot + 1, p.tall * 0.7, p.w * 0.7, mix(['wood', 2], ['sandWet', 1]));
for (const f of WALKERS)
  reflectUpright(
    f.x,
    f.foot + 1,
    f.tall * 0.8,
    4 * (f.tall / 36) + 1,
    mix(['darkest', 2], ['skyGold', 0.6]),
  );

// The darks set, so the rims of light lie on them clean instead of turning grey.
dry();

// Rims: a thread of light on each edge that faces the sun, in fuller paint.
stroke({
  path: along((u) => [boat.x(u), boat.sheer(u) - 1], 0.08, 1, 0.08),
  brush: { type: 'round', width: 2.2 },
  color: 'rim',
  load: 0.9,
  pressure: 0.55,
  end: 'taper',
});
stroke({
  path: [
    [744, 468],
    [745, 438],
    [746, 408],
  ],
  brush: { type: 'round', width: 1 },
  color: 'rim',
  load: 0.5,
  pressure: 0.5,
  end: 'taper',
});
stroke({
  path: [
    [868, 506],
    [862, 524],
    [855, 545],
  ],
  brush: 'hair',
  color: mix(['rim', 1], ['skyPeach', 1]),
  load: 0.7,
  end: 'taper',
});
stroke({
  path: [
    [far.x0 + 2, far.y - 3.5],
    [(far.x0 + far.x1) / 2, far.y + 0.5],
    [far.x1, far.y - 8],
  ],
  brush: { type: 'round', width: 1.2 },
  color: 'rim',
  load: 0.8,
  end: 'taper',
});
for (const p of POSTS) {
  // the posts stand left of the sun, so their right sides catch it
  stroke({
    path: [
      [p.x + p.w * 0.38, p.foot - p.tall * 0.97],
      [p.x + p.w * 0.4, p.foot - p.tall * 0.35],
    ],
    brush: { type: 'round', width: Math.max(1, p.w * 0.16) },
    color: 'rim',
    load: 0.8,
    end: 'taper',
  });
}
for (const f of WALKERS) {
  const s = f.tall / 36;
  stroke({
    path: [
      [f.x - 2.6 * s, f.foot - 35 * s],
      [f.x - 3 * s, f.foot - 28 * s],
      [f.x - 3.4 * s, f.foot - 18 * s],
    ],
    brush: { type: 'round', width: 1 },
    color: 'rim',
    load: 0.8,
    end: 'taper',
  });
}
