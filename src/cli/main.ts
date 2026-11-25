/**
 * @fileoverview The `paintscript` command: run script files as passages onto one
 * canvas and save the painting (with its journal and a timelapse GIF if asked), replay
 * a journal, or print the script vocabulary.
 * @module cli/main
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { TEXTURES } from '../canvas/canvas.js';
import { PaintscriptError } from '../errors.js';
import { decodePng, encodePng } from '../image/png.js';
import {
  formatJournal,
  type Journal,
  journalOf,
  parseJournal,
  replayJournal,
} from '../journal/journal.js';
import { Painting, type RunResult } from '../painting/painting.js';
import { REFERENCE_FITS } from '../reference/reference.js';
import { type RgbImage, SURFACES } from '../render/render.js';
import { VOCABULARY_DTS } from '../script/vocabulary-dts.js';
import { renderTimelapse } from '../timelapse/timelapse.js';
import { VERSION } from '../version.js';

const USAGE = `paintscript ${VERSION}: paint by code

Usage:
  paintscript run <script.js>... --out <painting.png> [options]
  paintscript replay <journal.jsonl> --out <painting.png> [options]
  paintscript vocabulary

run: each script file is one passage, run in order on one canvas.
  --out <file>         PNG of the finished painting (required)
  --journal <file>     write the journal (JSON Lines) that replays the painting
  --timelapse <file>   write a timelapse GIF of the painting being made
  --views <dir>        save each script's show() views there as PNG
  --width <px>        canvas width (default 1200, or fitted to the reference)
  --height <px>        canvas height (default 900, or fitted to the reference)
  --ground <hex>       ground color (default #8c8377)
  --texture <name>     ${TEXTURES.join(' | ')} (default fine_weave)
  --seed <n>           32-bit seed (default random; the journal records it)
  --reference <png>    reference image scripts can sample with ref and diff()
  --fit <name>         ${REFERENCE_FITS.join(' | ')} (default cover)
  --surface <name>     ${SURFACES.join(' | ')}, the finish it is seen under (default satin)

replay: re-run a journal on a fresh canvas, with the size, ground, texture, surface, and
seed it records.
  --out, --timelapse as above; --reference for a journal painted against one

vocabulary: print the script API as TypeScript declarations.
`;

/** Where the command writes. */
export interface CliIo {
  err: (text: string) => void;
  out: (text: string) => void;
}

const stdio: CliIo = {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
};

/** Run the command; resolves to the exit code. Throws only on a bug. */
export async function main(argv: readonly string[], io: CliIo = stdio): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (err) {
    if (err instanceof TypeError && 'code' in err) {
      io.err(`paintscript: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }
  const { values: v, positionals } = parsed;
  const [command, ...files] = positionals;
  if (v.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (v.help || !command) {
    io.out(USAGE);
    return command || v.help ? 0 : 2;
  }
  try {
    switch (command) {
      case 'vocabulary':
        io.out(VOCABULARY_DTS);
        return 0;
      case 'run':
        return await runCommand(files, v, io);
      case 'replay':
        return await replayCommand(files, v, io);
      default:
        io.err(`paintscript: unknown command "${command}"\n\n${USAGE}`);
        return 2;
    }
  } catch (err) {
    if (err instanceof PaintscriptError) {
      io.err(`paintscript: ${err.message}\n`);
      return 2;
    }
    if (isNodeError(err) && err.code === 'ENOENT') {
      io.err(`paintscript: no such file: ${err.path}\n`);
      return 2;
    }
    throw err;
  }
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      out: { type: 'string' },
      journal: { type: 'string' },
      timelapse: { type: 'string' },
      views: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      ground: { type: 'string' },
      texture: { type: 'string' },
      seed: { type: 'string' },
      reference: { type: 'string' },
      fit: { type: 'string' },
      surface: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
}

type Values = ReturnType<typeof parse>['values'];

async function runCommand(files: string[], v: Values, io: CliIo): Promise<number> {
  if (!files.length) return usage(io, 'run needs at least one script file');
  if (!v.out) return usage(io, 'run needs --out <painting.png>');
  const reference = v.reference ? decodePng(await readFile(v.reference)) : undefined;
  const painting = await Painting.create({
    ...(v.width !== undefined && { width: integer('width', v.width) }),
    ...(v.height !== undefined && { height: integer('height', v.height) }),
    ...(v.ground !== undefined && { ground: v.ground }),
    ...(v.texture !== undefined && { texture: oneOf('texture', v.texture, TEXTURES) }),
    ...(v.surface !== undefined && { surface: oneOf('surface', v.surface, SURFACES) }),
    ...(v.seed !== undefined && { seed: integer('seed', v.seed) }),
    ...(reference && {
      reference: {
        image: reference,
        ...(v.fit !== undefined && { fit: oneOf('fit', v.fit, REFERENCE_FITS) }),
      },
    }),
  });
  io.out(`canvas ${painting.width}×${painting.height}, seed ${painting.seed}\n`);
  for (const file of files) {
    const result = painting.run(await readFile(file, 'utf8'), {
      label: basename(file),
      defaultView: false,
    });
    report(io, file, result);
    await saveViews(io, v.views, file, result);
    if (result.status !== 'completed') return 1;
  }
  await writeFile(v.out, encodePng(painting.image()));
  io.out(`wrote ${v.out}\n`);
  const journal = journalOf(painting);
  if (v.journal) {
    await writeFile(v.journal, formatJournal(journal));
    io.out(`wrote ${v.journal}\n`);
  }
  if (v.timelapse) await timelapse(io, v.timelapse, journal, reference);
  return 0;
}

async function replayCommand(files: string[], v: Values, io: CliIo): Promise<number> {
  if (files.length !== 1) return usage(io, 'replay takes one journal file');
  if (!v.out) return usage(io, 'replay needs --out <painting.png>');
  const journal = parseJournal(await readFile(files[0]!, 'utf8'));
  if (journal.header.engine !== VERSION)
    io.err(
      `paintscript: this journal was painted by engine ${journal.header.engine}; replaying under ${VERSION} may not match\n`,
    );
  const reference = v.reference ? decodePng(await readFile(v.reference)) : undefined;
  const painting = await replayJournal(journal, reference ? { reference } : {});
  io.out(`replayed ${journal.runs.length} runs\n`);
  await writeFile(v.out, encodePng(painting.image()));
  io.out(`wrote ${v.out}\n`);
  if (v.timelapse) await timelapse(io, v.timelapse, journal, reference);
  return 0;
}

async function timelapse(
  io: CliIo,
  path: string,
  journal: Journal,
  reference: RgbImage | undefined,
) {
  const film = await renderTimelapse(journal, reference ? { reference } : {});
  await writeFile(path, film.bytes);
  io.out(
    `wrote ${path} (${film.width}×${film.height}, ${film.frames} frames, ${(film.durationMs / 1000).toFixed(1)} s)\n`,
  );
}

function report(io: CliIo, file: string, r: RunResult) {
  const s = r.stats;
  const head = `${basename(file)}: ${s.strokes} strokes, ${s.dries} dries, ${s.ms} ms, ${Math.round(s.wetShare * 100)}% wet`;
  switch (r.status) {
    case 'completed':
      io.out(`${head}\n`);
      break;
    case 'script_error':
      io.err(
        `${file}${r.error.line === undefined ? '' : `:${r.error.line}:${r.error.column ?? 1}`}: ${r.error.message}\n`,
      );
      break;
    case 'budget_exceeded':
      io.err(`${file}: stopped at the ${r.limit} limit; nothing from this script was kept\n`);
      break;
    case 'cancelled':
      io.err(`${file}: cancelled\n`);
      break;
  }
  for (const line of r.log.split('\n').filter(Boolean)) io.out(`  ${line}\n`);
  if (r.logTruncated) io.out('  (log truncated)\n');
  for (const o of r.observations) io.out(`  · ${o}\n`);
  if (r.viewsDropped)
    io.out(`  (${r.viewsDropped} show() calls past the per-run cap were dropped)\n`);
}

/** Write a run's `show()` views as `<dir>/<script>-<n>-<mode>.png`, or say they were not written. */
async function saveViews(io: CliIo, dir: string | undefined, file: string, r: RunResult) {
  if (!r.views.length) return;
  if (!dir) {
    io.out(`  (${r.views.length} show() views not saved; pass --views <dir>)\n`);
    return;
  }
  await mkdir(dir, { recursive: true });
  const stem = basename(file).replace(/\.[^.]*$/, '');
  for (const [i, view] of r.views.entries()) {
    const path = join(dir, `${stem}-${i + 1}-${view.mode}.png`);
    await writeFile(path, encodePng(view.image));
    io.out(`  view ${path}\n`);
  }
}

function usage(io: CliIo, why: string): number {
  io.err(`paintscript: ${why}\n\n${USAGE}`);
  return 2;
}

function integer(key: string, text: string): number {
  if (!/^\d+$/.test(text))
    throw new PaintscriptError(
      'invalid_options',
      `--${key} must be a whole number (got "${text}")`,
    );
  return Number(text);
}

function oneOf<T extends string>(key: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value))
    throw new PaintscriptError(
      'invalid_options',
      `--${key} must be one of ${allowed.join(', ')} (got "${value}")`,
    );
  return value as T;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
