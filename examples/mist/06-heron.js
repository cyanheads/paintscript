/**
 * Passage 6: the accents, last and crispest.
 *
 * Everything so far has been soft and close in value; two notes break that, where the
 * eye should land. A thin line of silver light lies across the water under the glow,
 * a wind-lane on the still pond, drawn with a fine round brush in fuller paint. And at
 * the point of the mud bar a heron stands in the shallows, the darkest thing in the
 * picture, its edges crisp: body, folded neck, dagger bill, legs going into the water,
 * and its broken reflection. Two faint rings of ripple spread from its legs.
 */

const GLOW = { x: 1040, y: 300 };
const HERON = { x: 902, foot: 812 }; // where its legs meet the water

// The wind-lane: a long, thin line of light, brightest under the glow, fading at both
// ends, with a fainter second line below it.
for (const [y, len, w, strength] of [
  [592, 520, 2.6, 1],
  [608, 300, 1.8, 0.6],
]) {
  stroke({
    path: [
      [GLOW.x - len, y + 2, 0.05],
      [GLOW.x - len * 0.4, y + 0.5, 0.5 * strength],
      [GLOW.x + 20, y, 0.9 * strength],
      [GLOW.x + len * 0.5, y - 0.5, 0.5 * strength],
      [GLOW.x + len, y - 1, 0.05],
    ],
    brush: { type: 'round', width: w },
    color: 'silver',
    load: 0.9,
  });
}

// The heron, facing left into the fog. s scales its drawing (its height is about 70 px).
const s = 1.25;
const at0 = (dx, dy) => [HERON.x + dx * s, HERON.foot - dy * s];
const heron = { color: 'heron', load: 0.9 };
// body: a tilted teardrop, the back higher than the breast
for (let k = 0; k < 4; k++)
  stroke({
    path: [at0(16 + k, 42 - k * 2), at0(0, 47 - k * 3), at0(-14, 52 - k * 3)],
    brush: { type: 'soft', width: 10 - k * 1.5 },
    pressure: 0.9,
    end: 'taper',
    ...heron,
  });
// the drooping tail feathers and the folded wing's lower edge
stroke({
  path: [at0(-2, 40), at0(12, 36), at0(22, 33)],
  brush: { type: 'round', width: 4 },
  end: 'taper',
  ...heron,
});
// the neck, folded back in an S, and the head
stroke({
  path: [at0(-13, 52), at0(-17, 60), at0(-12, 66), at0(-15, 72)],
  brush: { type: 'round', width: 4.5 },
  pressure: 0.85,
  ...heron,
});
stroke({ path: [at0(-15, 73)], brush: { type: 'round', width: 6 }, ...heron });
// the bill, a dagger pointing left
stroke({
  path: [at0(-17, 73.5), at0(-24, 72.5), at0(-31, 71.5)],
  brush: { type: 'round', width: 2.2 },
  pressure: 0.8,
  end: 'taper',
  ...heron,
});
// a pale wash of the fog light along its back, the one soft edge on it
stroke({
  path: [at0(12, 47), at0(0, 52), at0(-10, 55)],
  brush: { type: 'round', width: 2 },
  color: 'heronLit',
  load: 0.6,
  end: 'taper',
});
// legs, into the water
for (const dx of [-2, 3])
  stroke({
    path: [at0(dx, 38), at0(dx + 0.5, 0)],
    brush: { type: 'round', width: 1.6 },
    color: 'heron',
    load: 0.9,
    end: 'stop',
  });

// Its reflection: the legs and body hanging upside down, paler, broken by the water.
for (const dx of [-2, 3]) {
  for (let d = 3; d < 38; d += rand(6, 10))
    stroke({
      path: [
        [HERON.x + dx * s, HERON.foot + d * s],
        [HERON.x + (dx + 0.5) * s, HERON.foot + (d + rand(3, 5)) * s],
      ],
      brush: { type: 'round', width: 1.4 },
      color: 'heronMirror',
      load: 0.7,
    });
}
for (let dx = -12; dx <= 16; dx += 4) {
  const d0 = 40 + Math.abs(dx - 2) * 0.35 + rand(-2, 2);
  stroke({
    path: [
      [HERON.x + dx * s, HERON.foot + d0 * s, 0.7],
      [HERON.x + dx * s + rand(-1, 1), HERON.foot + (d0 + rand(6, 14)) * s, 0.1],
    ],
    brush: { type: 'soft', width: 5 },
    color: 'heronMirrorPale',
    load: 0.7,
  });
}
// rings of ripple spreading from its legs
for (const [r, w] of [
  [16, 1.2],
  [30, 0.9],
]) {
  const ring = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.25)
    ring.push([HERON.x + Math.cos(a) * r * s, HERON.foot + 2 + Math.sin(a) * r * 0.16 * s]);
  stroke({
    path: ring,
    brush: { type: 'round', width: w },
    color: 'ripple',
    load: 0.55,
    pressure: 0.5,
  });
}
