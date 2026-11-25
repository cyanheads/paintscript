/**
 * Passage 6: the light, last and thickest.
 *
 * Over the dried painting: a cool glaze deepens the foreground so the eye goes past it
 * to the light; a worn brush breaks a little gold over the sand where the light grazes
 * it; a palette knife, lightly loaded so it skips, drags thin sparkle across the glitter
 * on the sea and down the sun's column on the wet sand; the sun itself goes on as a
 * knot of thick paint inside a ring of gold; and a few gulls cross the glow.
 */

const W = canvas.width;
const H = canvas.height;
const HORIZON = 332;
const SHORE = 372;
const SUN = { x: 432, y: 248 };

palette('sunCore', mix(['white', 5], ['cadYellow', 1]));

// The foreground glaze: a violet film from a soft brush, heaviest at the bottom corners.
// Its strength is set with thinner, not load: a lightly loaded brush would dry-brush
// and print the canvas weave.
const veil = mix(['ultra', 1], ['alizarin', 1], ['sienna', 0.4]);
for (let y = H - 10; y > 720; y -= 34) {
  const depth = (y - 720) / (H - 720);
  for (let x = -80; x < W; x += rand(140, 220)) {
    const len = rand(220, 320);
    const edge = Math.abs(x + len / 2 - W / 2) / (W / 2);
    if (rand() > depth * 0.6 + edge * 0.5) continue;
    stroke({
      path: [
        [x, y + rand(-8, 8)],
        [x + len / 2, y + rand(-10, 10)],
        [x + len, y + rand(-12, 12)],
      ],
      brush: { type: 'soft', width: 110, reservoir: 2 },
      color: veil,
      paint: 'glaze',
      load: 0.5,
      // two strengths: a heavier veil in the bottom corners, a light one elsewhere
      thinner: depth > 0.5 && edge > 0.5 ? 0.75 : 0.9,
    });
  }
}

// Sparkle: a thin, lightly loaded knife dragged level across the glitter, skipping on the weave.
for (let i = 0; i < 22; i++) {
  const y = rand(HORIZON + 3, SHORE - 4);
  const half = 20 + (y - HORIZON) * 0.7;
  const x = SUN.x + rand(-half, half);
  stroke({
    path: [
      [x - rand(6, 16), y],
      [x + rand(6, 16), y + rand(-0.6, 0.6)],
    ],
    brush: { type: 'knife', width: rand(2.5, 4) },
    color: rand() < 0.5 ? 'white' : 'sunCore',
    load: rand(0.25, 0.4),
  });
}
// and down the sun's column on the wet sand: flicks of a fine round brush, crowded near
// the sea and scattering as they come forward
for (let i = 0; i < 40; i++) {
  const y = SHORE + 6 + rand() ** 1.8 * 230;
  const half = 26 + (y - SHORE) * 0.3;
  const x = SUN.x + half * (rand() + rand() - 1);
  const len = rand(5, 16) * (1 - (y - SHORE) / 400);
  stroke({
    path: [
      [x - len / 2, y],
      [x + len / 2, y + rand(-0.8, 0.8)],
    ],
    brush: { type: 'round', width: rand(1.8, 3) },
    color: rand() < 0.5 ? 'sunCore' : 'skyGlow',
    load: 0.9,
    end: 'flick',
  });
}

// The sun: a knot of thick, nearly white paint pressed on with the knife, then a clean
// soft brush taken once around it, so its edge melts into the glow.
for (let i = 0; i < 13; i++) {
  const y = SUN.y + (i - 6) * 3.2;
  const half = Math.sqrt(Math.max(0, 1 - ((i - 6) / 6.6) ** 2)) * 21;
  stroke({
    path: [
      [SUN.x - half, y],
      [SUN.x + half, y + rand(-0.5, 0.5)],
    ],
    brush: { type: 'knife', width: 6 },
    color: Math.abs(i - 6) < 3 ? mix(['white', 8], ['cadYellow', 0.5]) : 'sunCore',
    load: 0.9,
  });
}
for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
  const r = 22;
  stroke({
    path: [
      [SUN.x + Math.cos(a) * r, SUN.y + Math.sin(a) * r * 0.85],
      [SUN.x + Math.cos(a + 0.7) * r, SUN.y + Math.sin(a + 0.7) * r * 0.85],
    ],
    brush: { type: 'soft', width: 10 },
    pressure: 0.5,
  });
}

// Gulls: a bent stroke for each pair of wings, dark against the glow, smaller farther off.
const GULLS = [
  { x: 598, y: 142, s: 1, tilt: 0.1 },
  { x: 646, y: 168, s: 0.75, tilt: -0.15 },
  { x: 312, y: 108, s: 0.6, tilt: 0.2 },
  { x: 875, y: 205, s: 0.5, tilt: 0 },
  { x: 702, y: 120, s: 0.45, tilt: -0.05 },
];
for (const g of GULLS) {
  const span = 15 * g.s;
  const lift = 5 * g.s;
  const c = Math.cos(g.tilt);
  const s = Math.sin(g.tilt);
  const pt = (dx, dy) => [g.x + dx * c - dy * s, g.y + dx * s + dy * c];
  stroke({
    path: [
      pt(-span, -lift * 0.3),
      pt(-span * 0.45, -lift),
      pt(0, 0),
      pt(span * 0.45, -lift),
      pt(span, -lift * 0.2),
    ],
    brush: { type: 'round', width: 2.6 * g.s + 0.6 },
    color: mix(['darkest', 2], ['skyRose', 0.5]),
    load: 0.8,
    pressure: 0.55,
    end: 'taper',
  });
}
