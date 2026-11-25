# paintscript

A TypeScript engine that simulates oil painting (8-band Kubelka–Munk paint, bristle-strand brushes, a wet film over a dry base, relief lighting) and runs model-written JavaScript against it in a WebAssembly sandbox. Published to npm as `paintscript` (unscoped; never add a scope on any surface). Apache-2.0; runs on Bun and Node ≥22.

**Orientation:** this file is the behavioral layer; `README.md` has the API and CLI surface.

## Stack & gate

TypeScript strict ESM (`tsc` 7, NodeNext), Bun for development, Biome for lint and format, Vitest.

```sh
bun install
bun run check   # the gate: typecheck, Biome with zero warnings, tests, changelog sync
```

## Architecture

| Path | Role |
|:---|:---|
| `src/color/` | sRGB ↔ 8-band spectra, OKLab, the `Color` values that cross the API |
| `src/paint/` | Kubelka–Munk K and S per paint kind, film layering, mixing by parts |
| `src/brush/` | Brush and stroke types, path resampling, the strand kernel (`lay-stroke.ts`) |
| `src/canvas/` | Canvas state: weave, dry base, wet film; `dry()` |
| `src/render/` | Lit 8-bit render, full quality and fast preview |
| `src/image/` | PNG encode/decode and the GIF encoder, no dependencies |

## The rules that matter

- **No prebuilt shapes, fills, gradients, or scatter helpers** in the engine or the script vocabulary. The vocabulary is physics, senses, and raw randomness; the script author draws every form.
- **Determinism.** Every random choice comes from `src/random/rng.ts` seeded by the canvas seed and a counter; never `Math.random` or the clock in engine code.
- **Generated files:** `CHANGELOG.md` (from `changelog/`). Regenerate with `bun run changelog:build`; never hand-edit.

## Commit stance

Commit and push as verified work lands, after `bun run check` is green. Terse Conventional Commits, one concern per commit, no attribution trailers. Never `git stash`, never worktrees, never force-push. npm publishing and making the repo public are the maintainer's call.
