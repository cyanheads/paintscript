# paintscript

A TypeScript engine that simulates painting (8-band Kubelka–Munk paint from opaque body color to transparent washes, bristle-strand brushes, a wet film over a dry base, relief lighting) and runs model-written JavaScript against it in a WebAssembly sandbox. Published to npm as `paintscript` (unscoped; never add a scope on any surface). Apache-2.0; runs on Bun and Node ≥22.

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
| `src/render/` | Lit 8-bit render and the view modes (`view.ts`) |
| `src/image/` | PNG encode/decode and the GIF encoder, no dependencies |
| `src/random/` | `rng.ts`: the seeded generator and seed hashing |
| `src/script/` | QuickJS sandbox (`sandbox.ts`), guest prelude (`prelude.ts`), host vocabulary (`vocabulary.ts`), its declarations (`vocabulary-dts.ts`) |
| `src/painting/` | `Painting` (runs, revert, replay, views), tile undo, run review |
| `src/reference/` | Reference placement, `ref.at`, `ref.edge`, `diff` |
| `src/journal/` | Journal JSON Lines: zod schemas, format, parse, open, replay |
| `src/timelapse/` | Journal → GIF, frames spaced by brushwork |
| `src/cli/` | `main.ts` (the command, testable via `main(argv, io)`), `bin.ts` (the executable) |
| `src/arguments.ts` | Argument checks shared by the vocabulary and the `Painting` API |
| `examples/` | Example paintings: scripts plus their PNG, journal, and GIF. Docs only; not in the package |

Design decisions and their reasons: `docs/design.md`. Update it when a decision changes.

## The rules that matter

- **No prebuilt shapes, fills, gradients, or scatter helpers** in the engine or the script vocabulary. The vocabulary is physics, senses, and raw randomness; the script author draws every form.
- **Determinism.** Every random choice comes from `src/random/rng.ts` seeded by the canvas seed and a counter; never `Math.random` or the clock in engine code. Time budgets decide only whether a run finishes, never what lands on the canvas.
- **A vocabulary change touches three files together:** `src/script/prelude.ts` (the guest globals), `src/script/vocabulary.ts` (host validation and behavior), `src/script/vocabulary-dts.ts` (the declarations models read). `tests/script/vocabulary-dts.test.ts` fails when the declarations and the prelude's `define()` globals disagree. Validation messages name the function and field and say what to change.
- **A run is atomic.** Anything a run writes to the canvas goes through `TileUndo.save` first (via `layStroke`'s `beforeWrite`), and any session state a run can change (brushes, palette, stroke counter) is restored on rollback and revert.
- **Journal format changes bump the header `version`** in `src/journal/journal.ts`. Replay must stay byte-identical for journals the engine still accepts: after a change to the kernel, the session, or the sandbox, replay every `examples/*/journal.jsonl` and compare the PNG and GIF with the committed ones.
- **Host functions run outside the interrupt.** The vocabulary asks `halted()` before every host call, so a new host function is covered once it is in `RunSession.hostFunctions`. A call whose cost scales with its arguments also needs a bound checked before the work starts (as `stroke` bounds path points and length) or a `stopped()` poll inside the work (as `layStroke` polls every `POLL_PX`). Anything a script can make the host keep across calls needs a cap (as names have `MAX_NAMES`): the heap cap covers only the script's own memory.
- **Every argument is checked where it enters,** from a script or from a `Painting` method, with the helpers in `src/arguments.ts`.
- **Generated files:** `CHANGELOG.md` (from `changelog/`). Regenerate with `bun run changelog:build`; never hand-edit.

## Publishing

**Every release goes through a release PR, straight-through** — `git-wrapup`'s "Release PR mode", mode `straight-through`. One run:
- `git-wrapup` lands the commit stack on `release/<version>` with `chore(release): <version> — <theme>` on top (version bump and `changelog/` entry), pushes it, and opens the PR (title = the release commit subject, body = the release digest: theme line, `## Changes`, `## Gates`, changelog link last).
- `release-and-publish` then fast-forwards `main` locally with `git merge --ff-only`, creates the signed, annotated `v<version>` tag on `main`'s tip, pushes `main` and the tag, deletes the branch, runs `npm publish` (`prepublishOnly` runs `bun run check` and `bun run lint:packaging`), and creates the GitHub release with `--verify-tag --notes-from-tag`. There is no MCP Registry, `.mcpb`, or Docker step.

A caller's brief may run a given release as `gated` instead, with a `release-pr-review` pass on the open PR before `release-and-publish`. **Never merge through the GitHub UI or `gh pr merge`**: squash and rebase-merge are disabled in the repo settings because both rewrite the stack (rebase-merge also strips the SSH signatures), and a merge commit breaks the linear history. Each npm publish runs only on the maintainer's word.

## Commit stance

Caller-facing work lands through the release flow above. Docs and repo config that change nothing a caller gets from the package are plain commits to `main`. Terse Conventional Commits, one concern per commit, no attribution trailers. Never `git stash`, never worktrees, never force-push.
