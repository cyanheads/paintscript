/**
 * @fileoverview A timelapse of a painting being made: its journal replayed onto a fresh
 * canvas, with frames spaced by brushwork from the bare ground to the finished
 * painting, encoded as a looping GIF. Reverted runs and dry runs never reach a journal,
 * so they never appear. Each frame re-renders only what the strokes since the last
 * frame changed.
 * @module timelapse/timelapse
 */

import { PaintscriptError } from '../errors.js';
import { encodeGif } from '../image/gif.js';
import { type Journal, type JournalReplayOptions, openJournal } from '../journal/journal.js';
import { canvasOf } from '../painting/painting.js';
import { brushwork } from '../painting/run-review.js';
import { fitRegion, renderFit } from '../render/render.js';

/** How to film the painting. */
export interface TimelapseOptions extends JournalReplayOptions {
  /** Playback rate while painting, 1–50. Default 20. */
  fps?: number;
  /** Frames from the bare ground to the finished painting, 2–1000. Default 150. */
  frames?: number;
  /** Seconds the finished painting holds before the loop restarts, 0–60. Default 3. */
  hold?: number;
  /** GIF width in px, 16–2048, at most the canvas width; height follows the canvas. Default 600. */
  width?: number;
}

/** A finished timelapse. */
export interface Timelapse {
  /** The GIF file. */
  bytes: Uint8Array;
  /** Playback length of one loop, ms. */
  durationMs: number;
  /** Frames stored (identical consecutive frames merge). */
  frames: number;
  height: number;
  width: number;
}

/** Film a journal. Throws `invalid_options` for options out of range, and as `openJournal` does. */
export async function renderTimelapse(
  journal: Journal,
  options: TimelapseOptions = {},
): Promise<Timelapse> {
  const width = check('width', options.width ?? 600, 16, 2048, true);
  const nFrames = check('frames', options.frames ?? 150, 2, 1000, true);
  const fps = check('fps', options.fps ?? 20, 1, 50, false);
  const hold = check('hold', options.hold ?? 3, 0, 60, false);
  const painting = await openJournal(journal, options);
  const canvas = canvasOf(painting);
  const total = journal.runs.reduce((s, r) => s + r.brushwork, 0);
  const first = renderFit(canvas, width);
  const frames = [first.rgb];
  // canvas area changed since the last frame, grown 1 px for the relief gradient's neighbor
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  const capture = () => {
    const rgb = frames[frames.length - 1]!.slice();
    if (x1 > x0) fitRegion(canvas, rgb, first.width, first.height, x0, y0, x1, y1);
    frames.push(rgb);
    x0 = y0 = Number.POSITIVE_INFINITY;
    x1 = y1 = Number.NEGATIVE_INFINITY;
  };
  let done = 0;
  let next = 1;
  for (const run of journal.runs)
    painting.replay(run.code, {
      ...(run.label !== undefined && { label: run.label }),
      onStroke: (s) => {
        if (s.bbox) {
          x0 = Math.min(x0, s.bbox.x - 1);
          y0 = Math.min(y0, s.bbox.y - 1);
          x1 = Math.max(x1, s.bbox.x + s.bbox.w + 1);
          y1 = Math.max(y1, s.bbox.y + s.bbox.h + 1);
        }
        done += brushwork(s.length, s.width);
        if (next < nFrames && done >= (next * total) / nFrames) {
          capture();
          next++;
        }
      },
    });
  capture();
  const step = Math.max(2, Math.round(100 / fps));
  const delays = frames.map((_, i) =>
    i === 0 ? 40 : i === frames.length - 1 ? Math.max(2, Math.round(hold * 100)) : step,
  );
  const gif = encodeGif(first.width, first.height, frames, delays);
  return {
    bytes: gif.bytes,
    frames: gif.frames,
    width: first.width,
    height: first.height,
    durationMs: delays.reduce((s, d) => s + d, 0) * 10,
  };
}

function check(key: string, v: number, min: number, max: number, integer: boolean): number {
  if (!Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v)))
    throw new PaintscriptError(
      'invalid_options',
      `timelapse ${key} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max} (got ${v})`,
    );
  return v;
}
