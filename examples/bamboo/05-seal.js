/**
 * Passage 5: the seal.
 *
 * A square seal in cinnabar paste, pressed low on the left where the paper is empty.
 * It is cut in the red-line style: a border and two characters standing in red on the
 * paper, read from the right column to the left. The right column is 雨 (rain) and
 * the left 竹 (bamboo): bamboo in the rain, the subject. The strokes are square-
 * cornered as a stone cutter leaves them, and lightly loaded paste breaks on the paper
 * here and there, as a real impression does.
 */

// Cinnabar paste: vermilion warmed toward orange, a little carmine for depth.
palette('vermilion', '#d23c1c');
palette('carmine', '#9a1430');
palette('cinnabar', mix(['vermilion', 3], ['carmine', 1]));

const S = 74; // the seal's side, px
const X0 = 92;
const Y0 = 1612;
/** A point in the seal's own unit square, with a slight skew from an uneven press. */
const P = (u, v) => [X0 + u * S + v * 1.2, Y0 + v * S - u * 0.8];

/** One cut line through unit-square points, as a stroke of paste. */
function cut(points, width) {
  stroke({
    path: points.map(([u, v]) => P(u, v)),
    brush: { type: 'flat', width, streak: 0.3, stiffness: 0.9 },
    color: 'cinnabar',
    paint: 'semi_opaque',
    load: rand(0.72, 0.85),
    contact: rand(0.85, 0.95),
    corners: true,
    end: 'stop',
  });
}

// The border, a little heavier than the characters, as a worn stone's edge prints.
cut(
  [
    [0.03, 0.04],
    [0.97, 0.04],
  ],
  6,
);
cut(
  [
    [0.96, 0.03],
    [0.96, 0.97],
  ],
  6,
);
cut(
  [
    [0.97, 0.96],
    [0.03, 0.96],
  ],
  6,
);
cut(
  [
    [0.04, 0.97],
    [0.04, 0.03],
  ],
  6,
);

// 雨, the right column: a cap stroke, the frame, the central stroke, four raindrops.
cut(
  [
    [0.54, 0.15],
    [0.88, 0.15],
  ],
  4,
);
cut(
  [
    [0.57, 0.86],
    [0.57, 0.29],
    [0.86, 0.29],
    [0.86, 0.86],
  ],
  4,
);
cut(
  [
    [0.715, 0.15],
    [0.715, 0.8],
  ],
  4,
);
for (const [u, v] of [
  [0.62, 0.43],
  [0.62, 0.62],
  [0.77, 0.43],
  [0.77, 0.62],
]) {
  cut(
    [
      [u, v],
      [u + 0.05, v + 0.07],
    ],
    3.5,
  );
}

// 竹, the left column: two stems, each with its leaves hanging from the top.
for (const cx of [0.2, 0.37]) {
  cut(
    [
      [cx, 0.13],
      [cx, 0.86],
      [cx - 0.04, 0.84],
    ],
    4,
  );
  cut(
    [
      [cx, 0.15],
      [cx - 0.065, 0.36],
    ],
    3.5,
  );
  cut(
    [
      [cx, 0.15],
      [cx + 0.06, 0.32],
    ],
    3.5,
  );
}

show({ x: X0 - 30, y: Y0 - 30, w: S + 60, h: S + 60 }, { mode: 'color', maxSide: 400 });
dry();
