/**
 * Passage 2: the wall, laid on with the palette knife.
 *
 * Broad knife planes go on in a first course, each pressed harder at one end than the
 * other so the paint stands up unevenly; a second course of smaller planes is pressed
 * straight into it while it is wet, scraping up and dragging the first course's color
 * so neighbouring piles smear into each other. The light from the window at the upper
 * left grades the wall from cream through ochre to a shaded olive, and the bouquet and
 * jug throw a cool shadow down to the right. The wall runs behind the flowers too; they
 * go over it later.
 */

const W = canvas.width;
const TABLE = 975;

const FLOWERS = [
  { x: 430, y: 500, r: 122 },
  { x: 705, y: 385, r: 128 },
  { x: 285, y: 725, r: 98 },
  { x: 850, y: 640, r: 108 },
  { x: 545, y: 225, r: 102 },
  { x: 945, y: 405, r: 78 },
  { x: 200, y: 440, r: 74 },
  { x: 600, y: 610, r: 90 },
  { x: 760, y: 805, r: 78 },
  { x: 320, y: 280, r: 70 },
];

/** How deep the shadow of the bouquet and the jug's lip lies at (x, y): 0 out of it, 1 deep in. */
function inShadow(x, y) {
  let s = 0;
  for (const f of FLOWERS) {
    const d = Math.hypot(x - f.x - 110, (y - f.y - 70) * 1.1) / f.r;
    s = Math.max(s, 1 - d);
  }
  // the jug's shoulder, low against the wall
  s = Math.max(s, 1 - Math.hypot(x - 790, (y - 930) * 1.6) / 200);
  return Math.min(1, s * 2);
}

/** The wall's pile at (x, y), from the window's light, wandering so the bands interlock. */
function wallPile(x, y) {
  const d = Math.hypot(x - 80, (y - 60) * 1.25) + 110 * noise(x / 150, y / 150) + rand(-50, 50);
  const lit = d < 330 ? 'wallLight' : d < 610 ? 'wallGold' : d < 900 ? 'wallOlive' : 'wallDeep';
  return inShadow(x, y) > 0.45 + rand(-0.15, 0.15) ? 'wallShadow' : lit;
}

/**
 * One knife plane from (x, y): a short, slightly bowed sweep at angle a, pressed hard at
 * one end and eased at the other. Its end is kept above the table's edge.
 */
function plane(x, y, a, len, width, color, load) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const cut = s > 0 ? Math.max(10, (TABLE - 8 - y) / s) : len;
  const L = Math.min(len, cut);
  const bow = rand(-0.12, 0.12) * L;
  const p0 = rand(0.5, 1);
  const p2 = rand(0.25, 0.9);
  stroke({
    path: [
      [x, y, p0],
      [x + c * L * 0.5 - s * bow, y + s * L * 0.5 + c * bow, Math.min(1, (p0 + p2) / 2 + 0.15)],
      [x + c * L, y + s * L, p2],
    ],
    brush: { type: 'knife', width, streak: rand(0.1, 0.35), toneVar: 0.35 },
    color,
    load,
    end: rand() < 0.4 ? 'stop' : 'lift',
  });
}

// First course: broad planes, mostly falling to the right with the light, row by row.
for (let y = -30; y < TABLE - 20; y += rand(38, 52)) {
  for (let x = -60; x < W + 20; x += rand(70, 120)) {
    const a = rand() < 0.75 ? rand(0.25, 0.75) : rand(-0.5, -0.1);
    const yy = y + rand(-15, 15);
    plane(x, yy, a, rand(90, 170), rand(46, 78), wallPile(x + 50, yy + 20), rand(0.8, 1));
  }
}

// Second course, wet into wet: smaller planes at cross angles that drag the first course.
for (let i = 0; i < 420; i++) {
  const x = rand(-30, W + 10);
  const y = rand(-20, TABLE - 25);
  const a = rand() < 0.5 ? rand(0.4, 1.1) : rand(-0.9, -0.2);
  plane(x, y, a, rand(45, 110), rand(26, 52), wallPile(x, y), rand(0.6, 0.95));
}

// The shadow's edge firmed with a few long cool planes along its upper side.
for (let i = 0; i < 70; i++) {
  const x = rand(560, W);
  const y = rand(200, TABLE - 40);
  const s = inShadow(x, y);
  if (s < 0.25 || s > 0.8) continue;
  plane(x, y, rand(0.6, 1.0), rand(60, 120), rand(24, 40), 'wallShadow', 0.9);
}

dry();
