/**
 * Passage 1: the palette, a toned panel, and a lean rub-in of the darks.
 *
 * Seven tubes go on the palette, and every pile the painting uses is mixed from them
 * here, at fixed parts, before a brush touches the panel. Where a color has to shift
 * across the picture (the sky from the grey overhead to the glow, the woods from shadow
 * into the light, the elms from their dark core up into the fog), it is mixed as a few
 * separate steps, and later passages lay the steps side by side. A thin warm wash tones
 * the panel, and the few dark shapes (the elms on the spit, their reflection, the mud
 * bar) are rubbed in with lean umber so the design is fixed before any body color goes on.
 */

// The tubes. Every other color in the painting is mixed from these.
palette('white', '#f2eee3');
palette('ochre', '#c09a4e');
palette('umber', '#5f4f3a');
palette('sienna', '#8c4f2e');
palette('ultra', '#2b3a8a');
palette('terre', '#6f7d5e');
palette('rose', '#a85a68');

// The sky in six steps, from the glow where the sun is behind the fog to the grey overhead.
palette('sky0', mix(['white', 12], ['ochre', 1], ['rose', 0.12]));
palette('sky1', mix(['white', 10], ['ochre', 1], ['rose', 0.18], ['umber', 0.15]));
palette('sky2', mix(['white', 8], ['ochre', 0.8], ['rose', 0.2], ['umber', 0.35], ['ultra', 0.06]));
palette('sky3', mix(['white', 7], ['ochre', 0.6], ['rose', 0.2], ['umber', 0.55], ['ultra', 0.14]));
palette(
  'sky4',
  mix(['white', 6], ['ochre', 0.45], ['rose', 0.18], ['umber', 0.7], ['ultra', 0.24]),
);
palette(
  'sky5',
  mix(['white', 5], ['ochre', 0.35], ['rose', 0.15], ['umber', 0.8], ['ultra', 0.34]),
);
// The fog itself: white warmed a breath.
palette('fog', mix(['white', 14], ['ochre', 0.6], ['rose', 0.2], ['ultra', 0.12]));

// The pond: the tint still water lays over whatever it mirrors, a little darker and greener.
palette('pond', mix(['terre', 1], ['umber', 0.6], ['white', 1.5], ['ultra', 0.15]));
// The water mirrors the sky step for step, the near water greener than the far.
palette('pool3', mix(['sky3', 5], ['pond', 0.8]));
palette('pool4', mix(['sky4', 5], ['pond', 1.2]));
palette('pool5', mix(['sky5', 5], ['pond', 1.6]));
palette('poolNear', mix(['sky5', 5], ['pond', 2.1]));
// The glow's reflection keeps more of its light.
palette('glint3', mix(['sky3', 5], ['pond', 0.55]));
palette('glint2', mix(['sky2', 5], ['pond', 0.4]));
palette('glint1', mix(['sky1', 5], ['pond', 0.3]));
palette('glint0', mix(['sky0', 5], ['pond', 0.2]));

// The woods across the pond, two planes, each in three steps from shade into the light.
palette('farther', mix(['sky4', 5], ['terre', 0.5], ['ultra', 0.1]));
palette('fartherHalf', mix(['farther', 2], ['sky2', 0.6]));
palette('fartherLit', mix(['farther', 2], ['sky2', 1.3]));
palette('farWood', mix(['sky5', 3], ['terre', 1], ['umber', 0.3], ['ultra', 0.15]));
palette('farWoodHalf', mix(['farWood', 2], ['sky2', 1.1]));
palette('farWoodLit', mix(['farWood', 2], ['sky2', 2.3]));
// Their reflections, in three steps as the fog on the water takes them.
palette('woodMirror', mix(['farWood', 2], ['pond', 0.6], ['sky2', 0.9]));
palette('woodMirrorPale', mix(['farWood', 2], ['pond', 0.6], ['sky2', 1.8]));
palette('woodMirrorLost', mix(['farWood', 2], ['pond', 0.6], ['sky2', 2.8]));
// The bank of fog lying on the water, grey in the shade and warm under the glow.
palette('mist', mix(['sky3', 2], ['fog', 1]));
palette('mistHalf', mix(['sky3', 2], ['fog', 1], ['sky1', 1]));
palette('mistLit', mix(['sky3', 2], ['fog', 1], ['sky1', 2]));

// The elms: green-grey foliage, a deeper core, bark; then the steps they take into the fog.
palette('elm', mix(['terre', 2], ['umber', 1.3], ['white', 1.6], ['ultra', 0.25], ['rose', 0.1]));
palette('elmDeep', mix(['terre', 1.5], ['umber', 1.6], ['white', 0.8], ['ultra', 0.35]));
palette('bark', mix(['umber', 2], ['ultra', 0.4], ['white', 0.9], ['rose', 0.15]));
palette('crownCore', mix(['elmDeep', 2], ['fog', 0.15]));
palette('crown', mix(['elm', 2], ['fog', 0.25]));
palette('crownHaze', mix(['elm', 2], ['fog', 0.9]));
palette('crownFog', mix(['elm', 2], ['fog', 2]));
palette('crownLost', mix(['elm', 1], ['fog', 3], ['sky4', 2]));
palette('trunk', mix(['bark', 2], ['fog', 1]));
palette('limb', mix(['bark', 2], ['fog', 1.3]));
// Their reflection: the crown dulled by the pond and taken by the fog in three steps.
palette('elmMirror', mix(['crown', 2], ['pond', 0.8], ['sky4', 1.4]));
palette('elmMirrorPale', mix(['crown', 2], ['pond', 0.8], ['sky4', 3]));
palette('elmMirrorLost', mix(['crown', 1], ['pond', 0.6], ['sky4', 3.6]));
palette('trunkMirror', mix(['bark', 2], ['pond', 0.8], ['sky4', 2.5]));
// The level lines of the water's skin that break a reflection.
palette('skin', mix(['sky3', 3], ['pond', 1]));

// The banks: the spit under the elms, greyer toward its point, and the nearer mud bar.
palette('bank', mix(['umber', 2], ['terre', 1], ['sienna', 0.3], ['white', 1.1]));
palette('spit', mix(['bank', 2], ['fog', 2.2]));
palette('spitPale', mix(['bank', 2], ['fog', 2.9]));
palette('spitPoint', mix(['bank', 2], ['fog', 3.7]));
palette('spitMirror', mix(['bank', 2], ['pond', 1], ['fog', 3.2]));
palette('grass', mix(['bank', 2], ['fog', 2.2]));
palette('grassPale', mix(['bank', 2], ['fog', 3.4]));
palette('bar', mix(['bank', 2], ['fog', 1.7]));
palette('barTip', mix(['bank', 2], ['fog', 2.5]));
palette('barLip', mix(['bank', 2], ['umber', 0.5], ['fog', 0.6]));
palette('barMirror', mix(['bank', 2], ['pond', 1], ['fog', 2.2]));
palette('rush', mix(['bank', 2], ['ochre', 0.1], ['fog', 1.1]));
palette('rushPale', mix(['bank', 2], ['ochre', 0.1], ['fog', 1.7]));
palette('rushLost', mix(['bank', 2], ['ochre', 0.1], ['fog', 2.3]));
palette('windLine', mix(['sky1', 3], ['pond', 0.6]));

// The two hard notes: the heron and the silver of the wind-lane.
palette('heron', mix(['umber', 2], ['ultra', 1], ['white', 0.7]));
palette('heronLit', mix(['heron', 1], ['sky1', 2]));
palette('heronMirror', mix(['heron', 1], ['pond', 0.6], ['sky2', 0.8]));
palette('heronMirrorPale', mix(['heron', 1], ['pond', 0.8], ['sky2', 1.2]));
palette('silver', mix(['white', 10], ['ochre', 0.5]));
palette('ripple', mix(['silver', 1], ['sky2', 3]));

const W = canvas.width;
const H = canvas.height;
const SPIT = 660; // the waterline under the elms

/** The elms on the spit: foot, lean, and how high the crown climbs into the fog. */
const ELMS = [
  { x: 92, top: 120, lean: -14, spread: 120 },
  { x: 205, top: 70, lean: 8, spread: 140 },
  { x: 318, top: 150, lean: 18, spread: 115 },
  { x: 430, top: 250, lean: 10, spread: 90 },
];

brush('wash', { type: 'soft', width: 220, reservoir: 6 });
brush('rub', { type: 'soft', width: 70, reservoir: 2 });

// The toning: a thin warm film over the whole panel in big crossing sweeps.
palette('toning', mix(['ochre', 1], ['white', 3], ['sienna', 0.3], ['umber', 0.2]));
for (let pass = 0; pass < 2; pass++) {
  const tilt = pass === 0 ? 0.18 : -0.14;
  for (let y = -120; y < H + 120; y += 150) {
    stroke({
      path: [
        [-60, y + rand(-20, 20)],
        [W / 2, y + (W / 2) * tilt + rand(-30, 30)],
        [W + 60, y + W * tilt + rand(-20, 20)],
      ],
      brush: 'wash',
      color: 'toning',
      paint: 'semi_opaque',
      thinner: 0.75,
      load: rand(0.55, 0.75),
    });
  }
}
dry();

// The rub-in: lean umber where the darks will stand.
palette('rubIn', mix(['umber', 2], ['terre', 1], ['white', 2]));
const rubIn = { color: 'rubIn', thinner: 0.7, load: 0.6, paint: 'semi_opaque' };
for (const e of ELMS) {
  // the crown as a few loose sweeps, the trunk as one line
  const fork = SPIT - (SPIT - e.top) * 0.14;
  for (let y = e.top + 40; y < fork - 20; y += 55) {
    const u = (y - e.top) / (fork - e.top);
    const half = e.spread * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.8)) ** 0.6;
    const cx = e.x + e.lean * (1 - u);
    stroke({
      path: [
        [cx - half, y + rand(-8, 8)],
        [cx + half, y + rand(-8, 8)],
      ],
      brush: 'rub',
      ...rubIn,
    });
  }
  stroke({
    path: [
      [e.x, SPIT],
      [e.x + e.lean * 0.3, fork],
    ],
    brush: { type: 'soft', width: 18 },
    ...rubIn,
  });
}
// the spit, its reflection hanging a short way below it, and the mud bar from the right
for (let y = SPIT - 30; y < SPIT + 170; y += 40)
  stroke({
    path: [
      [-40, y],
      [260, y + rand(-6, 6)],
      [560 - (y - SPIT) * 0.8, y],
    ],
    brush: 'rub',
    ...rubIn,
    load: 0.45,
  });
stroke({
  path: [
    [760, 796],
    [1100, 788],
    [W + 40, 780],
  ],
  brush: { type: 'soft', width: 24 },
  ...rubIn,
});

dry();
