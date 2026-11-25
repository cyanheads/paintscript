/**
 * Passage 6: the night coming down, and the rain.
 *
 * Last, over everything dry: a blue-violet glaze from a big soft brush settles into
 * the corners, heaviest at the tops of the near walls and the bottom of the picture,
 * so the light pools in the middle of the avenue where the eye should go. The lamps
 * and headlights get a warm breath of halo, and the rain itself is drawn as fine
 * slanting threads, thinned almost to nothing, falling across the whole street.
 */

const W = canvas.width;
const H = canvas.height;
const VP = { x: 630, y: 780 };
const EYE = 5;
const F = 1000;
const sx = (X, D) => VP.x + (X * F) / D;
const sy = (Z, D) => VP.y + ((EYE - Z) * F) / D;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

palette('nightVeil', mix(['payne', 1], ['ultra', 0.45], ['crimson', 0.4]));
palette('rain', mix(['payne', 1], ['ultra', 0.2], ['water', 1.5]));
palette('halo', mix(['gamboge', 1.5], ['ochre', 0.5], ['water', 4]));

/** Steam from the stack (as in passage 1): the glaze leaves it alone. */
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

/** How far a point is from the light in the middle of the avenue, 0 there to 1 in the corners. */
function dark(x, y) {
  const dx = (x - VP.x) / (W * 0.55);
  const dy = y < VP.y ? (VP.y - y) / VP.y : (y - VP.y) / (H - VP.y);
  return clamp01(Math.hypot(dx * 1.1, dy * 0.8) - 0.35);
}

/** The glaze's three dishes: strong for the corners, medium between, pale nearest the light. */
const DISH = { strong: 0.62, medium: 0.76, pale: 0.9 };

// The night glaze: long soft sweeps at an even pressure, each from the dish for how
// far it lies from the light, the edges between dishes left ragged; none goes into
// the middle of the avenue.
brush('veil', { type: 'soft', width: 170, reservoir: 6 });
for (let y = -40; y < H + 60; y += 55) {
  for (let x = -120; x < W + 60; x += rand(200, 300)) {
    const len = rand(260, 380);
    const tilt = rand(-20, 20);
    const d = dark(x + len / 2, y + tilt / 2);
    if (d < 0.12 || steam(x + len / 2, y) > 0.2) continue;
    const k = d + 0.12 * noise(x / 260, y / 200) + rand(-0.05, 0.05);
    stroke({
      path: [
        [x, y + rand(-6, 6)],
        [x + len / 2, y + tilt / 2 + rand(-6, 6)],
        [x + len, y + tilt],
      ],
      brush: 'veil',
      color: 'nightVeil',
      paint: 'glaze',
      thinner: k > 0.62 ? DISH.strong : k > 0.36 ? DISH.medium : DISH.pale,
      load: 0.85,
      pressure: 0.75,
    });
  }
}

// Warm halos around the headlights and the lamps: a breath of thin gold.
for (const [X, D, Z] of [
  [-3.1, 24, 0.65],
  [-1.7, 24, 0.65],
  [-3.6, 60, 0.65],
  [-1.6, 60, 0.65],
  [-3.6, 38, 7.5],
  [3.5, 46, 7.5],
  [-3.6, 70, 7.5],
  [3.5, 85, 7.5],
  [3.5, 15, 7.5],
]) {
  stroke({
    path: [[sx(X, D), sy(Z, D)]],
    brush: { type: 'soft', width: Math.max(14, (2.2 * F) / D) },
    color: 'halo',
    paint: 'transparent',
    thinner: 0.8,
    load: 0.7,
  });
}

// The rain: fine threads, all slanting the same way, a little longer near the eye.
for (let k = 0; k < 520; k++) {
  const x = rand(-40, W + 40);
  const y = rand(-20, H);
  const len = 24 + (y / H) * 50 + rand(0, 30);
  stroke({
    path: [
      [x, y, 0.5],
      [x + len * 0.2, y + len, 0.35],
    ],
    brush: { type: 'round', width: rand(1, 1.8) },
    color: 'rain',
    paint: 'glaze',
    thinner: 0.8,
    load: 0.8,
    end: 'flick',
  });
}

dry();
