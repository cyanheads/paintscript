/**
 * Passage 5: the mud bar and the near water.
 *
 * A low bar of mud and rushes comes in from the right edge, the nearest land in the
 * picture, and ends in a point in the water where the heron will stand. It is laid in
 * level strokes of bank greyed less by the fog than the spit is, a paler step toward
 * its tip, with rushes standing out of it in fine strokes that pale step by step and are
 * lost toward the tip. Its reflection drops straight down below it. Close to us, a few
 * faint level wind-lines lie on the water.
 */

const W = canvas.width;
const BAR = 800; // the bar's waterline at its root on the right edge
const TIP = 880; // where the bar ends, in the water

/** The bar's waterline and its top at x: it rises a little toward the right edge. */
const barWater = (x) => BAR - (x - TIP) * 0.02 + 2 * noise(x / 60, 9.4);
const barTop = (x) =>
  barWater(x) - Math.min(1, (x - TIP) / 400) ** 0.6 * 26 - 3 * noise(x / 30, 2.2);

brush('mud', { type: 'soft', width: 12 });

// Faint wind-lines on the near water, lighter than the pond, before the bar goes over them.
for (let i = 0; i < 9; i++) {
  const y = 860 + i * 15 + rand(-5, 5);
  const x = rand(560, 1100);
  const len = rand(200, 420);
  stroke({
    path: [
      [x, y, 0.1],
      [x + len / 2, y + rand(-1, 1), 0.6],
      [x + len, y, 0.1],
    ],
    brush: { type: 'soft', width: 5 },
    color: 'windLine',
    load: rand(0.5, 0.6),
  });
}

// The bar itself, a paler step where it runs out into the water.
for (let y = BAR + 4; y > BAR - 40; y -= 5) {
  for (let x = TIP - 30; x < W + 40; x += rand(60, 120)) {
    const len = rand(90, 160);
    const start = Math.max(x, TIP + (BAR - y) * 9);
    if (y < barTop(start + len / 2) + 2) continue;
    stroke({
      path: [
        [start, y + rand(-1, 1), 0.3],
        [start + len / 2, y + rand(-1.5, 1.5), 0.8],
        [start + len, y + rand(-1, 1), 0.6],
      ],
      brush: 'mud',
      color: start + 80 * noise(start / 50, y / 10) < 1080 ? 'barTip' : 'bar',
      load: rand(0.8, 0.9),
    });
  }
}
// its wet lip, a thin dark line where mud meets water
stroke({
  path: [
    [TIP - 6, barWater(TIP) + 1, 0.2],
    [1100, barWater(1100) + 2, 0.6],
    [W + 20, barWater(W) + 2, 0.7],
  ],
  brush: { type: 'soft', width: 4 },
  color: 'barLip',
  load: 0.8,
});
// rushes: fine strokes rising out of the bar, thick toward the edge, lost toward the tip
for (let x = TIP + 30; x < W + 10; x += rand(3, 8)) {
  const rise = Math.min(1, (x - TIP) / 500);
  if (rand() > 0.3 + rise * 0.6) continue;
  const foot = barTop(x) + 3;
  const tall = rand(10, 46) * (0.3 + rise);
  const zone = x + rand(-60, 60);
  stroke({
    path: [
      [x, foot, 0.8],
      [x + rand(-2, 4), foot - tall * 0.6, 0.5],
      [x + rand(-1, 8), foot - tall, 0.1],
    ],
    brush: { type: 'round', width: rand(1.5, 3) },
    color: zone < 1060 ? 'rushLost' : zone < 1240 ? 'rushPale' : 'rush',
    load: rand(0.7, 0.8),
    end: 'flick',
  });
}

// The reflection: short uprights of mud and rush below the bar, broken level.
for (let x = TIP; x < W + 10; x += rand(6, 11)) {
  const y0 = barWater(x) + 3;
  const len = (barWater(x) - barTop(x)) * rand(0.7, 1.2) + rand(4, 20);
  stroke({
    path: [
      [x, y0, 0.8],
      [x + rand(-1, 1), y0 + len, 0.1],
    ],
    brush: { type: 'soft', width: rand(6, 10) },
    color: 'barMirror',
    load: rand(0.45, 0.55),
  });
}

dry();
