# Examples

Each folder holds the passage scripts for one painting, the finished `painting.png`, the `journal.jsonl` that replays it with `paintscript replay`, and a `timelapse.gif` of it being made. The command under each painting repaints it from the repo root, byte for byte. Run under Node, the pixels are the same and the PNG file is not: Node's zlib compresses it differently from Bun's.

## Low tide

![Low tide: a beach at sunset, with posts, a beached boat, and the sun's glitter on wet sand](low-tide/painting.png)

A beach at low tide, painted into the setting sun: a row of old posts leads out across wet sand that mirrors the sky, past a beached boat, to a strip of sea where the sun's glitter starts. It is built the way a painter would build it, in six passages: a warm imprimatura and lean block-in, the sky wet into wet in broken color, the headland and sea, the sand (whose reflections sample the painted sky with `at()`), the dark silhouettes with glazed shadows and their rims of light, and last the thick lights, knife sparkle, and gulls. Every color is mixed with `mix()` from seven tubes named in the first passage, and `dry()` sets each layer before the next goes over it.

```sh
bun src/cli/bin.ts run examples/low-tide/0*.js --out examples/low-tide/painting.png --journal examples/low-tide/journal.jsonl --timelapse examples/low-tide/timelapse.gif --seed 1847
```

## City rain

![City rain: a Manhattan avenue in the rain at dusk, cabs and umbrellas on a road that mirrors the lights](city-rain/painting.png)

A Manhattan avenue in the rain at dusk, seen from five metres up and looking along the canyon of buildings to a spire in the haze, with yellow cabs, a steam stack, lamps, a red signal, and people under umbrellas on the wet road. It is transparent watercolor, painted light to dark in six passages. The first wash floods the sheet wet into wet with a few drops of color and saves bare paper for the lamps, headlights, and steam. Each building is washed along its own perspective lines so its lit windows can be left as clean shapes, and each window is then filled with one stroke that zigzags across it. The road is a mirror: every reflection stroke reads the painted wall above it with `at()` and drags that color down the wet street. Each zone takes its water from one of three dishes (strong, medium, and pale), and every color is mixed from nine tubes with `mix()`.

```sh
bun src/cli/bin.ts run examples/city-rain/0*.js --out examples/city-rain/painting.png --journal examples/city-rain/journal.jsonl --timelapse examples/city-rain/timelapse.gif --seed 1112 --width 1200 --height 1600 --ground '#f3efe6' --texture smooth --surface matte
```

## Bamboo

![Bamboo: a grove of bamboo in ink after rain, one dark culm in front, paler groves fading into mist, a red seal](bamboo/painting.png)

A grove of bamboo after rain, in ink on paper in the sumi-e tradition: one dark culm in front with its leaves hanging heavy and wet, a middle grove with one culm bowed over, and a far grove fading into mist, signed with a red seal reading 雨竹. It is painted in five passages from the five inks of the tradition (jiao, nong, zhong, dan, qing), mixed once from two soots and water. Each segment of a culm is one flat stroke lifted at the node, and each leaf one round stroke pressed down and lifted to a point. The paint is all transparent: value comes from water, not white, overlapping wet leaves darken where they cross, and the smooth paper takes the dry brush as flying white.

```sh
bun src/cli/bin.ts run examples/bamboo/0*.js --out examples/bamboo/painting.png --journal examples/bamboo/journal.jsonl --timelapse examples/bamboo/timelapse.gif --seed 1127 --width 1100 --height 1850 --ground '#efe9dc' --texture smooth --surface matte
```

## Poppies

![Poppies: red, orange, and coral poppies and white anemones in a cobalt jug on a white cloth, painted with a palette knife](still-life/painting.png)

A cobalt jug of red, orange, and coral poppies with three white anemones, on a white cloth with a lemon and two fallen petals. It is painted almost entirely with the palette knife, in seven passages: a lean brush drawing and block-in over a warm earth ground, then the wall, the cloth, the jug, the foliage, the poppies, and last the anemones and the thick lights. Each passage lays a course of knife planes and presses a second course into it while wet, so the blade scrapes up the paint underneath and drags it along. Every color is mixed with `mix()` from eight tubes, and `dry()` sets each passage so the next builds relief on top of it. The window light comes from the upper left, the same side as the engine's relief light, so the varnished ridges and the paint piled up where each stroke stops catch the light the painting shows.

```sh
bun src/cli/bin.ts run examples/still-life/0*.js --out examples/still-life/painting.png --journal examples/still-life/journal.jsonl --timelapse examples/still-life/timelapse.gif --seed 2511 --width 1200 --height 1500 --ground '#7d5038' --texture coarse_weave --surface varnish
```

## Mist

![Mist: a millpond at sunrise in fog, elms on a spit at the left, a heron at the point of a mud bar](mist/painting.png)

A millpond just after sunrise, in the tonalist manner: fog lying on still water, four elms on a spit at the left going dark into it, a far wood dissolving into the light, and the sun a pale glow behind the fog. The only hard notes are a heron at the point of a mud bar and a thin silver wind-lane on the water; every other value stays in a narrow band. Every pile is mixed in the first of six passages from seven tubes, and where a color has to shift across the picture there are a few steps of it, laid side by side with wandering borders so they knit while wet. The sky and water go on as broad, thinned rows that run off both edges, with the glow laid into them as nested strokes tapering at both ends. The far woods and the reflections are painted into that wet paint, so each stroke picks up some fog and loses its edge. The elms go in the same way: a short dark trunk forks into limbs that disappear under a broad, drooping crown, and each crown is laid in three layers of thinned soft strokes kept inside its outline, so the inside reaches full value while the edges stay soft and the tops pale into the fog. The mud bar and the heron go on last, over dry paint.

```sh
bun src/cli/bin.ts run examples/mist/0*.js --out examples/mist/painting.png --journal examples/mist/journal.jsonl --timelapse examples/mist/timelapse.gif --seed 1891 --width 1500 --height 1000 --ground '#9a8f7c' --texture smooth
```
