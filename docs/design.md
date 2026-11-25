# paintscript design

paintscript turns code into paintings: opaque body color, glazes, and transparent washes, from impasto oil to ink. A **painting** holds one canvas. Each **run** executes one JavaScript passage against it in a sandbox and either lands whole or leaves no trace. The scripts are the record: replaying them on a fresh canvas with the same seed reproduces the painting byte for byte, which is how revert, the journal, and the timelapse all work.

## Layers

| Layer | Module | Holds |
|:---|:---|:---|
| Color | `src/color/` | sRGB ↔ 8-band reflectance spectra, OKLab, the `Color` values scripts receive |
| Paint | `src/paint/` | Kubelka–Munk absorption (K) and scattering (S) per paint kind, film layering, mixing by parts |
| Brush | `src/brush/` | Brush and stroke types, path resampling, the strand kernel |
| Canvas | `src/canvas/` | Weave, dry base (reflectance, height), one wet film (K, S, volume) |
| Render | `src/render/` | Lit 8-bit render, views (color, squint, value, relief, wet) |
| Script | `src/script/` | The QuickJS sandbox, the guest prelude, the host vocabulary, its declarations |
| Painting | `src/painting/` | The session: runs, tile undo, checkpoints, run review |
| Reference | `src/reference/` | A reference image resampled to the canvas: color, edge direction, comparison |
| Journal, timelapse | `src/journal/`, `src/timelapse/` | JSON Lines record and replay; GIF frames spaced by brushwork |

## Paint

Each color is an 8-band reflectance spectrum. sRGB decomposes into white plus secondary and primary basis spectra, and a fitted band-to-RGB matrix maps spectra back. Paint carries K and S per band.

- **Flat scattering.** Opaque paint takes S = density / (1 + mean K/S) across all bands, with K = (K/S)·S per band. *Why:* setting K + S constant per band compresses a dark pigment's absorption contrast, and ultramarine plus cadmium yellow then mixes to olive grey; flat S keeps the green.
- **Density 120 for opaque.** One full-load pass of opaque paint hides a mid-grey ground (OKLab ΔE about 0.005); semi-opaque (24) and transparent (4) let it through. *Why:* "opaque" has to mean what a painter expects it to.
- **Glaze** is a pure filter (K from the color, almost no S); **medium** is clear. Mixing sums K and S by volume; a film composites over the base by Kubelka's layer formula.
- **Wet over dry.** One wet film per pixel. Strokes pick up and mix with wet paint and sit cleanly on dry paint; `dry()` composites the film into the base, fixing its color and keeping its height as relief.

## Brushes

A stroke is a footprint of strands swept along a Catmull-Rom spline resampled at 1 px. Each strand has its own reservoir, tint, and wobble; it deposits by pressure, load, and contact with the weave, and picks up wet paint as it goes. Streaks, dry-brush breaks, ridges, and carried color come out of the sweep rather than being drawn.

- **Sub-pixel deposits.** Each sample splats bilinearly into four pixels. *Why:* thin and slanted strokes otherwise alias into dashes.
- **Fine brushes streak less** (streak scaled by ((width − 1) / 9)³). *Why:* a 3 px line has to hold together.
- **Round, soft, and filbert brushes thin to a point** as pressure falls, and a one-point dab with them stamps a disc; flat, fan, splayed, and knife dabs are short press-and-lift sweeps.
- **Smooth panels never speckle:** the dry-brush break scales with the weave's amplitude, so a gessoed panel takes paint fully unless `contact` is lowered.
- **Every stroke is measured** (covered, gaps, mixed, picked up, length, changed bounds) through a per-pixel mark buffer whose base value only grows, so measurements stay unique across reverts.

## The sandbox

Scripts run in QuickJS-ng compiled to WebAssembly (`quickjs-emscripten-core` with the `@jitl/quickjs-ng-wasmfile-release-sync` variant).

- **A fresh runtime and context per run**, with a heap cap, a stack cap, and an interrupt handler polled while the script runs. *Why:* nothing leaks between runs, and runaway loops stop without the host's cooperation. `node:vm` was rejected because it is not a security boundary; native isolates because they tie the package to a compiled addon.
- **The interrupt is armed after the prelude** and cannot be caught by the script. The time budget, the stroke cap, and the caller's `cancelled()` all stop a run through it.
- **A halt also holds outside the interpreter.** QuickJS polls the interrupt only every few thousand loop iterations and never during a host call, so the vocabulary asks whether the run has halted before every host call, and the stroke kernel asks every 50,000 px its bristles sweep (about 10 ms). A halted run does no more work, and its status is the halt whatever the script did afterwards. *Why:* the interrupt cannot reach a host call, so on it alone the time limit and `cancelled()` would not hold while the vocabulary works.
- **What a script stores in the host is capped,** since the heap cap covers only the script's own memory: a painting keeps at most 1,000 named brushes and 1,000 palette colors.
- **Host calls pass JSON strings** (about 6 µs a call). *Why:* one marshaling path, nothing guest-owned crosses the boundary, and validation sees plain data. The prelude sends non-finite numbers as text so error messages can name them.
- **Errors point into the script:** the first `passage.js:line:column` frame of the stack is reported, so a vocabulary error names the script line that called it.
- **No clock, no `Math.random`, no `WeakRef`:** the prelude replaces `Math.random` and `Date` with functions that throw and point to `rand()`, and deletes `performance`, `WeakRef`, and `FinalizationRegistry`. *Why:* a run must replay exactly.

## Determinism

- Stroke randomness comes from the canvas seed and a stroke counter; the counter is restored on rollback and revert.
- `rand()` is seeded by the canvas seed and the run's number, so each run has its own stream and a dry run predicts the real run exactly.
- `noise()` is one field per painting, seeded by the canvas seed alone, so passages can agree on it.
- The time budget decides only whether a run may finish; it never reaches the canvas.
- **Replaying a journal is held to the limits of the painting it replays onto** (time, strokes, script memory), and a run that passes one throws `budget_exceeded` naming the limit to raise. *Why:* a journal is code this process never saw run, so it gets the bounds a script gets; a journal painted under looser limits or on a faster machine replays once the caller raises them. Rebuilding a painting's own runs on a far revert is not held to the clock, since those scripts completed here under the limits.

## Runs, undo, and checkpoints

- **A run is atomic.** Before a stroke or `dry()` first writes a 64 px tile, the tile's affected channels (wet K and S, wet volume, dry base) are copied aside. A run that errors, exceeds a budget, is cancelled, or is a dry run is restored from those tiles, along with the brushes, palette colors, and stroke counter it started with.
- **The checkpoint is the number of committed runs.** `revert(n)` restores each later run's saved tiles, newest first.
- **Reverting past the undo budget replays.** The oldest runs' tiles are dropped once their total passes `limits.undoBytes`; reverting to before them rebuilds the canvas by replaying the kept scripts. *Why:* every checkpoint stays reachable, so callers never handle an "out of reach" error; only reverts far back pay the replay cost.
- `expectCheckpoint` refuses a run (`canvas_changed`) when the painting has moved, so a retried request can't land twice.

## The vocabulary

The script API is physics and senses: brushes, strokes, mixing, drying, reading the canvas and a reference, views, logs, and raw randomness. It has no shapes, fills, gradients, or scatter helpers. *Why:* the script author decides every form and every mix; the engine only simulates what a brush and paint would do with those decisions.

- **Arguments are checked with messages that name the function and field** (`stroke(): load must be a number from 0 to 1 (got 1.5)`), and unknown option names are rejected rather than ignored. *Why:* the main author is a model reading the message to fix its next attempt. `Painting.view`, `at`, `diff`, and `image` run the same checks (`src/arguments.ts`), so a bad number from a caller is an `invalid_options` error and never a blank image.
- **A number within 1e-9 of a bound is the bound.** *Why:* scripts compute pressures and loads, and float arithmetic lands a hair outside 0–1 (`Math.sin(2 * Math.PI)` is -2.4e-16).
- **A string color needs `#`; any other string names a palette color.** *Why:* three-letter words like `fed` and `add` are valid hex digits, so accepting bare hex would turn a mistyped palette name into a color.
- **Names persist:** `brush()` and `palette()` definitions stay for later runs and go back with a revert.
- **Senses clamp, regions clip.** `at`, `wet`, `height`, `ref.at`, and `ref.edge` clamp points to the canvas; a region is clipped, and one with no pixels on the canvas is an error.
- **Stroke bounds guard the host:** at most 10,000 path points, no point more than a canvas width or height off the canvas, at most 20 × (width + height) px of path. *Why:* the kernel runs in the host, where the interrupt can't reach it.
- `src/script/vocabulary-dts.ts` is the vocabulary as TypeScript declarations; a test checks it declares exactly the globals the prelude defines.

## Run review

Each run reports p10/p50/p90 of covered, gaps, and mixed; a review of stroke length, width, direction spread (circular, mod 180°), the share repeating one length/angle/width bin, and the share shorter than 1.5× their width; and at most three observations stated as counted facts. *Why:* a mechanical fill (hundreds of identical strokes) is the commonest way code paints badly, and the author should see it in numbers, without being told what to do.

## Reference

A reference image is resampled once to canvas resolution under `cover`, `contain`, or `stretch`. `ref.edge` is a Sobel gradient of blurred OKLab lightness, reported as the direction the contour runs. `diff` compares the painting's unlit color with the reference in OKLab, stride-sampled to at most 250,000 pixels, and names the worst cells. The journal records the image's size, fit, and SHA-256, and replay refuses any other image. `decodePng` reads at most 8192 × 8192 px and never inflates past what the header describes, since a PNG's header decides how much memory decoding it takes.

## Journal and timelapse

The journal is JSON Lines: a header with the engine version, size, ground spectrum, texture, seed, px per mm, and reference fingerprint, then one line per committed run with its code, label, stroke count, and brushwork. Reverted runs and dry runs never reach it. A timelapse replays the journal onto a fresh canvas and captures frames spaced by brushwork (√(length × width) per stroke), re-rendering only the area changed since the last frame, then encodes a looping GIF with one median-cut palette and an ordered dither, so unchanged paint stays identical between frames. Every frame is held as RGB until the palette is cut, so frames × width × height is capped at 1 GiB of RGB.

## Naming

The package is `paintscript`, unscoped, with a `paintscript` CLI. *Why:* it is a standalone engine with its own audience outside any one server, and an unscoped name gives a clean `npx paintscript`.
