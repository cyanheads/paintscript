/**
 * Passage 1: tone the canvas and block in the big masses.
 *
 * A warm wash goes over the grey ground first, then every mass of the picture (sky,
 * headland, sea, wet sand, dry sand, the dark accents) is laid in thin, lean paint
 * with big brushes. Nothing here is final; it fixes where the lights and darks sit,
 * and the warm ground keeps glowing through the gaps of every later passage.
 */

// The tubes on the palette. Every other color in the painting is mixed from these.
palette('white', '#f5f2ea');
palette('cadYellow', '#f6c40f');
palette('ochre', '#c48a2c');
palette('cadRed', '#cf3a1e');
palette('alizarin', '#7d1b2e');
palette('ultra', '#24308e');
palette('sienna', '#8b4522');

// Piles mixed once and reused by later passages. The sky runs from the glow around the
// sun to the cool high sky, a string of tones laid out across the palette.
palette('skyGlow', mix(['white', 8], ['cadYellow', 1.4]));
palette('skyGold', mix(['white', 6], ['cadYellow', 1], ['ochre', 0.6], ['cadRed', 0.12]));
palette('skyPeach', mix(['white', 5], ['ochre', 0.8], ['cadRed', 0.35]));
palette('skyRose', mix(['white', 5], ['alizarin', 0.5], ['ochre', 0.4], ['ultra', 0.08]));
palette('skyLilac', mix(['white', 4.5], ['ultra', 0.55], ['alizarin', 0.45]));
palette('skyBlue', mix(['white', 4], ['ultra', 1], ['alizarin', 0.3]));
palette('skyHigh', mix(['white', 2.6], ['ultra', 1], ['alizarin', 0.35], ['sienna', 0.12]));
palette('cloud', mix(['white', 3], ['ultra', 0.8], ['alizarin', 0.6], ['ochre', 0.4]));
palette('headland', mix(['white', 2], ['ultra', 1], ['alizarin', 0.6], ['ochre', 0.2]));
palette('sea', mix(['ultra', 2], ['alizarin', 1.4], ['sienna', 0.4], ['white', 0.9]));
palette('sandWet', mix(['white', 2], ['alizarin', 0.5], ['ultra', 0.5], ['sienna', 0.3]));
palette('sandDry', mix(['ochre', 2], ['white', 3], ['sienna', 0.5], ['alizarin', 0.2]));
palette('shade', mix(['sienna', 1], ['white', 1.5], ['alizarin', 0.4], ['ultra', 0.7]));
palette('darkest', mix(['ultra', 1], ['alizarin', 0.8], ['sienna', 0.6]));

const W = canvas.width;
const H = canvas.height;
const HORIZON = 332; // the sea line
const SHORE = 372; // where the sea breaks onto wet sand
const SUN = { x: 432, y: 248 };

const SKY = ['skyGlow', 'skyGold', 'skyPeach', 'skyRose', 'skyLilac', 'skyBlue', 'skyHigh'];

/**
 * Which pile of the sky string goes where: rings around the sun, wider than tall and
 * pulled warmer low down by the sea, glow inside the first ring and high sky past the
 * last. Each ring's edge is left ragged, so neighboring piles meet in broken color.
 */
const RINGS = [47, 140, 233, 327, 420, 513];
function skyPile(x, y) {
  const d =
    Math.hypot((x - SUN.x) / 1.35, (y - SUN.y) * 1.1) - Math.max(0, y - 190) * 1.1 + rand(-30, 30);
  const i = RINGS.findIndex((r) => d < r);
  return SKY[i < 0 ? SKY.length - 1 : i];
}

/** Where the wet sand gives way to dry: a wandering line, lower on the left where a channel runs. */
function dryLine(x) {
  return 615 + 38 * noise(x / 170, 7.3) + Math.max(0, 300 - x) * 0.18;
}

/** The headland's ridge on the right, rising out of the sea. */
function headTop(x) {
  if (x < 730) return HORIZON;
  const rise = Math.min(1, (x - 730) / 240) ** 0.75 * 44 + Math.max(0, x - 980) * 0.04;
  return HORIZON - rise + noise(x / 55, 2.6) * 4;
}

/** A loose horizontal stroke from (x, y), length len, with a little sag and tilt. */
function sweep(x, y, len, tilt = 0) {
  return [
    [x, y],
    [x + len * 0.5, y + rand(-3, 3) + tilt * 0.5],
    [x + len, y + rand(-4, 4) + tilt],
  ];
}

brush('wash', { type: 'flat', width: 130, reservoir: 5, streak: 0.7 });
brush('block', { type: 'filbert', width: 64, reservoir: 2 });
brush('blockSmall', { type: 'filbert', width: 26 });

// The imprimatura: a thin warm wash over the whole canvas, crossing at two angles.
const wash = mix(['ochre', 1.4], ['cadRed', 0.4], ['white', 2.5], ['sienna', 0.5]);
for (let pass = 0; pass < 2; pass++) {
  const tilt = pass === 0 ? 0.36 : -0.3;
  // strokes running downhill start above the canvas, uphill ones below it
  for (let y = pass === 0 ? -170 : 40; y < (pass === 0 ? H - 40 : H + 170); y += 95) {
    for (let x = -120; x < W - 60; x += rand(330, 430)) {
      const len = rand(380, 520);
      const end = [x + len, y + len * tilt + rand(-20, 20)];
      if (end[0] > W + 200 && y < 0) continue; // would only graze the corner
      stroke({
        path: [[x, y + rand(-20, 20)], end],
        brush: 'wash',
        color: wash,
        paint: 'semi_opaque',
        thinner: 0.7,
        load: rand(0.45, 0.7),
      });
    }
  }
}
// The wash sets before the masses go over it, so they keep their own color.
dry();

// Sky: rows of broad, lean strokes, each taking the pile of its ring around the sun.
for (let y = 10; y < HORIZON - 4; y += 34) {
  for (let x = -40; x < W; x += rand(120, 190)) {
    const len = rand(170, 260);
    stroke({
      path: sweep(x, y + rand(-6, 6), len, rand(-10, 10)),
      brush: 'block',
      color: skyPile(x + len / 2, y),
      thinner: 0.4,
      load: 0.6,
    });
  }
}

// The headland: strokes that follow its ridge, then fill down to the sea line. Fuller
// paint than the sky, since it goes into the sky's wet edge.
for (let row = 0; row < 4; row++) {
  for (let x = 720 + row * 30; x < W; x += rand(90, 130)) {
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const px = x + k * 34;
      const top = headTop(px);
      pts.push([px, top + 9 + row * ((HORIZON - top) / 4)]);
    }
    stroke({ path: pts, brush: 'blockSmall', color: 'headland', thinner: 0.1, load: 0.9 });
  }
}

// Sea: a dark band, warmer and lighter where the sun's path crosses it.
for (let y = HORIZON + 4; y < SHORE + 4; y += 16) {
  for (let x = -30; x < W; x += rand(110, 160)) {
    const len = rand(130, 200);
    const near = Math.abs(x + len / 2 - SUN.x) < 110;
    stroke({
      path: sweep(x, y, len, rand(-2, 2)),
      brush: { type: 'flat', width: 28 },
      color: near ? mix(['sea', 1], ['skyGold', 1.4]) : 'sea',
      thinner: 0.35,
    });
  }
}

// Wet sand: it mirrors the sky, darker and warmer, with the sun's path running down it.
for (let y = SHORE; y < H; y += 30) {
  for (let x = -40; x < W; x += rand(140, 200)) {
    const len = rand(170, 240);
    const cx = x + len / 2;
    if (y > dryLine(cx) + 20) continue;
    const inSunPath = Math.abs(cx - SUN.x) < 50 + (y - HORIZON) * 0.4;
    stroke({
      path: sweep(x, y + rand(-5, 5), len, rand(-6, 6)),
      brush: 'block',
      color: inSunPath
        ? mix(['sandWet', 1], ['skyGold', 2.5])
        : mix(['sandWet', 3], ['skyRose', 1]),
      thinner: 0.4,
      load: 0.6,
    });
  }
}

// Dry sand: warm, darkening toward the bottom edge, where the foreground falls into
// shade. Three piles, stepped down in value, laid in bands with ragged edges.
const SAND_BLOCK = [
  mix(['sandDry', 2.6], ['shade', 0.9], ['darkest', 0.12]),
  mix(['sandDry', 2], ['shade', 1.75], ['darkest', 0.3]),
  mix(['sandDry', 1.3], ['shade', 2.6], ['darkest', 0.48]),
];
for (let y = 560; y < H + 30; y += 32) {
  for (let x = -40; x < W; x += rand(140, 200)) {
    const len = rand(170, 240);
    const cx = x + len / 2;
    if (y < dryLine(cx) - 10) continue;
    const band = Math.min(2, Math.max(0, Math.floor((y - 620) / 90 + rand(-0.4, 0.4))));
    stroke({
      path: sweep(x, y + rand(-5, 5), len, rand(-8, 8)),
      brush: 'block',
      color: SAND_BLOCK[band],
      thinner: 0.25,
      load: 0.7,
    });
  }
}

// The darks, drawn in thin paint: the big boat, the far boat, and the line of old posts.
const thinDark = { color: 'darkest', thinner: 0.45, load: 0.7 };
for (let i = 0; i < 4; i++) {
  const y = 528 + i * 11;
  stroke({
    path: [
      [648 + i * 9, y],
      [760, y + 6 - i * 2],
      [858 - i * 14, y - 18 + i * 4],
    ],
    brush: { type: 'flat', width: 14 },
    ...thinDark,
  });
}
stroke({
  path: [
    [948, 431],
    [985, 434],
    [1022, 426],
  ],
  brush: { type: 'flat', width: 9 },
  ...thinDark,
});
for (let i = 0; i < 7; i++) {
  const t = i / 6;
  const x = 150 + t * 175;
  const foot = 870 - (870 - 398) * t ** 0.8;
  const tall = 120 * (1 - t) ** 1.4 + 10;
  stroke({
    path: [
      [x, foot],
      [x + 1, foot - tall],
    ],
    brush: { type: 'flat', width: 15 * (1 - t) + 3 },
    ...thinDark,
  });
}

// Lean paint dries before the body color goes on.
dry();
