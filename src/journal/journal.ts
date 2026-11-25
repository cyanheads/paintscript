/**
 * @fileoverview The journal: a painting as JSON Lines, a header with its settings and
 * then the code of each committed run, enough to replay it exactly on a fresh canvas.
 * Parsed with zod where it enters.
 * @module journal/journal
 */

import { z } from 'zod';
import { TEXTURES } from '../canvas/canvas.js';
import { PaintscriptError } from '../errors.js';
import { Painting, type PaintingLimits } from '../painting/painting.js';
import { REFERENCE_FITS } from '../reference/reference.js';
import type { RgbImage } from '../render/render.js';
import { VERSION } from '../version.js';

const HeaderSchema = z.object({
  type: z.literal('paintscript'),
  version: z.literal(1),
  /** Engine version that painted it; replay under another version may differ. */
  engine: z.string(),
  width: z.int().positive(),
  height: z.int().positive(),
  ground: z.object({ hex: z.string(), bands: z.array(z.number()).length(8) }),
  texture: z.enum(TEXTURES),
  seed: z.int().min(0).max(0xffffffff),
  pxPerMm: z.number().positive(),
  reference: z
    .object({
      width: z.int().positive(),
      height: z.int().positive(),
      fit: z.enum(REFERENCE_FITS),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .optional(),
});

const RunSchema = z.object({
  run: z.int().positive(),
  code: z.string(),
  label: z.string().optional(),
  strokes: z.int().nonnegative(),
  brushwork: z.number().nonnegative(),
});

/** The first line of a journal. */
export type JournalHeader = z.infer<typeof HeaderSchema>;

/** One committed run, numbered from 1. */
export type JournalRun = z.infer<typeof RunSchema>;

/** A painting's settings and committed runs. */
export interface Journal {
  header: JournalHeader;
  runs: JournalRun[];
}

/** How to open or replay a journal. */
export interface JournalReplayOptions {
  limits?: Partial<PaintingLimits>;
  /** The reference image the journal names, when it names one. */
  reference?: RgbImage;
}

/** A painting's journal as it stands. */
export function journalOf(painting: Painting): Journal {
  const { bands, hex } = painting.ground;
  const ref = painting.reference;
  return {
    header: {
      type: 'paintscript',
      version: 1,
      engine: VERSION,
      width: painting.width,
      height: painting.height,
      ground: { hex, bands },
      texture: painting.texture,
      seed: painting.seed,
      pxPerMm: painting.pxPerMm,
      ...(ref && {
        reference: { width: ref.width, height: ref.height, fit: ref.fit, sha256: ref.sha256 },
      }),
    },
    runs: painting.history.map((r, i) => ({ run: i + 1, ...r })),
  };
}

/** A journal as JSON Lines text. */
export function formatJournal(journal: Journal): string {
  return [journal.header, ...journal.runs].map((line) => `${JSON.stringify(line)}\n`).join('');
}

/** Parse JSON Lines text; throws `invalid_journal` naming the line and what is wrong with it. */
export function parseJournal(text: string): Journal {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) throw invalidJournal(1, 'the journal is empty');
  const header = parseLine(lines[0]!, 1, HeaderSchema);
  const runs = lines.slice(1).map((l, i) => {
    const run = parseLine(l, i + 2, RunSchema);
    if (run.run !== i + 1) throw invalidJournal(i + 2, `run must be ${i + 1} (got ${run.run})`);
    return run;
  });
  return { header, runs };
}

/**
 * A fresh painting with the journal's settings and none of its runs. Throws
 * `no_reference` when the journal names a reference and none is given,
 * `reference_mismatch` when the given image is not the one it names.
 */
export async function openJournal(
  journal: Journal,
  options: JournalReplayOptions = {},
): Promise<Painting> {
  const h = journal.header;
  const image = options.reference;
  if (h.reference && !image)
    throw new PaintscriptError(
      'no_reference',
      `This journal was painted against a ${h.reference.width}×${h.reference.height} reference image (sha256 ${h.reference.sha256}); pass that image to replay it.`,
    );
  if (!h.reference && image)
    throw new PaintscriptError(
      'reference_mismatch',
      'This journal was painted without a reference image; replay it without one.',
    );
  const painting = await Painting.create({
    width: h.width,
    height: h.height,
    ground: { bands: h.ground.bands },
    texture: h.texture,
    seed: h.seed,
    pxPerMm: h.pxPerMm,
    ...(options.limits && { limits: options.limits }),
    ...(h.reference && image && { reference: { image, fit: h.reference.fit } }),
  });
  if (h.reference && painting.reference?.sha256 !== h.reference.sha256)
    throw new PaintscriptError(
      'reference_mismatch',
      `The reference image given is not the one this journal was painted against (sha256 ${h.reference.sha256}).`,
    );
  return painting;
}

/**
 * Replay a journal onto a fresh painting, run by run. Throws as `openJournal` does,
 * and `invalid_journal` if a run does not complete.
 */
export async function replayJournal(
  journal: Journal,
  options: JournalReplayOptions = {},
): Promise<Painting> {
  const painting = await openJournal(journal, options);
  for (const run of journal.runs)
    painting.replay(run.code, run.label === undefined ? {} : { label: run.label });
  return painting;
}

function parseLine<T>(line: string, n: number, schema: z.ZodType<T>): T {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw invalidJournal(n, 'not valid JSON');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw invalidJournal(n, `${issue.path.join('.') || 'line'}: ${issue.message}`);
  }
  return parsed.data;
}

function invalidJournal(line: number, why: string): PaintscriptError {
  return new PaintscriptError('invalid_journal', `Journal line ${line}: ${why}.`);
}
