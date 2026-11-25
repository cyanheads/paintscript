/**
 * Passage 5: the foliage, stems, and buds.
 *
 * The bouquet's mass goes in first: clumps of short, broad knife planes in the dark
 * green, packed round the jug's mouth and under each flower head, turning grey-green
 * where they face the window and darkest low on the right. The stems are drawn over it
 * with the knife's edge, a fine blade dragged up from the neck to each head and lit on
 * its left. A few long blades break the bouquet's outline, and the nodding buds go on
 * as a cluster of small planes each, wet, with a lit edge.
 */

const JUG = { x: 560, lip: 818 };

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
// Nodding buds: where each hangs and which way its stem hooks over.
const BUDS = [
  { x: 190, y: 190, hook: -1 },
  { x: 1050, y: 590, hook: 1 },
  { x: 860, y: 170, hook: 1 },
];

/** The pile at (x, y): grey-green toward the window, dark low on the right. */
function greenPile(x, y) {
  const lit = -(x - 560) / 600 - (y - 520) / 450 + 0.5 * noise(x / 90, y / 90) + rand(-0.25, 0.25);
  return lit > 0.6 ? 'leafGrey' : lit > -0.1 ? 'leaf' : 'leafDark';
}

/** A short broad knife plane at angle a, pressed hard and lifted. */
function plane(x, y, a, len, width, color, load = rand(0.8, 1)) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const curl = rand(-0.15, 0.15) * len;
  stroke({
    path: [
      [x, y, rand(0.7, 1)],
      [x + c * len * 0.55 - s * curl, y + s * len * 0.55 + c * curl, rand(0.6, 1)],
      [x + c * len, y + s * len, rand(0.2, 0.6)],
    ],
    brush: { type: 'knife', width, streak: 0.3, toneVar: 0.4 },
    color,
    load,
    end: rand() < 0.3 ? 'stop' : 'lift',
  });
}

/**
 * A clump of planes radiating from (x, y) within radius r: packed and dark in its middle,
 * the outer planes in the middle green so the clump's edge sits softly on the wall.
 */
function clump(x, y, r, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2);
    const d = r * Math.sqrt(rand());
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    const pile = greenPile(px, py);
    plane(
      px,
      py,
      a + rand(-0.6, 0.6),
      rand(26, 60),
      rand(20, 34),
      d > r * 0.7 && pile === 'leafDark' ? 'leaf' : pile,
    );
  }
}

// The mass: a nest spilling over the jug's lip, and clumps under and between the heads.
clump(JUG.x + 10, JUG.lip - 50, 170, 110);
for (const f of FLOWERS) {
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + rand(-1.4, 1.4);
    clump(f.x + Math.cos(a) * f.r * 0.85, f.y + Math.sin(a) * f.r * 0.85, f.r * 0.55, 16);
  }
}

// Stems: the knife's edge dragged from the neck to each head and bud, then its lit side.
const tips = [
  ...FLOWERS.map((f) => [f.x, f.y + f.r * 0.3]),
  ...BUDS.map((b) => [b.x - b.hook * 30, b.y - 40]),
];
for (const [x, y] of tips) {
  const x0 = JUG.x + (x - JUG.x) * 0.15 + rand(-20, 20);
  const y0 = JUG.lip + 4;
  const p = [
    [x0, y0],
    [(x0 + x) / 2 + (x - JUG.x) * 0.25, (y0 + y) / 2 + 30],
    [x, y],
  ];
  stroke({ path: p, brush: { type: 'knife', width: rand(6, 9) }, color: 'stem', load: 0.9 });
  stroke({
    path: p.map(([px, py]) => [px - 2.5, py - 1]),
    brush: { type: 'knife', width: 2.5 },
    color: 'leafGrey',
    load: 0.8,
  });
}

// Long blades breaking the outline, mostly at the sides and low around the lip.
for (let i = 0; i < 26; i++) {
  const side = i % 2 ? 1 : -1;
  const x = JUG.x + side * rand(120, 380);
  const y = rand(560, 830);
  const a = (side > 0 ? 0 : Math.PI) + side * rand(-0.9, 0.2);
  plane(x, y, a, rand(60, 110), rand(12, 18), greenPile(x + Math.cos(a) * 40, y));
}

// Buds: a hooked stem, then a cluster of small planes down the bud and a lit edge.
for (const b of BUDS) {
  stroke({
    path: [
      [b.x - b.hook * 30, b.y - 40],
      [b.x - b.hook * 8, b.y - 54],
      [b.x, b.y - 24],
    ],
    brush: { type: 'knife', width: 6 },
    color: 'stem',
    load: 0.9,
  });
  for (let k = 0; k < 6; k++) {
    const t = k / 5;
    const off = Math.sin(t * Math.PI) * 9 * (k % 2 ? 1 : -1);
    stroke({
      path: [
        [b.x + off * 0.4, b.y - 22 + t * 4, 0.7],
        [b.x + off + b.hook * 3, b.y - 2 + t * 6, 1],
        [b.x + off * 0.5 + b.hook * 4, b.y + 18, 0.5],
      ],
      brush: { type: 'knife', width: rand(9, 13) },
      color: off < 0 ? 'leafGrey' : k % 3 ? 'leaf' : 'leafDark',
      load: 0.95,
    });
  }
  stroke({
    path: [
      [b.x - 8, b.y - 16, 0.6],
      [b.x - 10, b.y + 8, 0.9],
    ],
    brush: { type: 'knife', width: 3.5 },
    color: mix(['leafGrey', 2], ['white', 1]),
    load: 0.9,
  });
}

dry();
