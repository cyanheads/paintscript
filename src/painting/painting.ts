/**
 * @fileoverview A painting session: one canvas, the brushes and palette colors its
 * scripts named, and the runs committed so far. Each run executes one script in a
 * fresh sandbox and lands whole or not at all. The checkpoint counts committed runs;
 * reverting walks back through each run's saved tiles, or replays the kept scripts on
 * a fresh canvas when those tiles were dropped to stay within the undo budget.
 * @module painting/painting
 */

import type { QuickJSWASMModule } from 'quickjs-emscripten-core';
import type { BrushSpec } from '../brush/brush.js';
import { Canvas, type PixelRect, TEXTURES, type Texture, unionRect } from '../canvas/canvas.js';
import { type Color, type ColorInput, describeSpectrum, toSpectrum } from '../color/color.js';
import { NB } from '../color/spectrum.js';
import { PaintscriptError } from '../errors.js';
import { hashSeed } from '../random/rng.js';
import {
  type DiffResult,
  REFERENCE_FITS,
  Reference,
  type ReferenceFit,
} from '../reference/reference.js';
import { type RgbImage, render, SURFACES, type Surface } from '../render/render.js';
import {
  clipRegion,
  type Region,
  rectToRegion,
  regionToRect,
  renderView,
  type View,
  type ViewOptions,
} from '../render/view.js';
import { PRELUDE } from '../script/prelude.js';
import { loadQuickJS, runScript, type ScriptOutcome } from '../script/sandbox.js';
import { type Names, RunSession, type StrokeEvent } from '../script/vocabulary.js';
import {
  brushwork,
  observe,
  type RunReview,
  reviewStrokes,
  type Spread,
  strokeSpreads,
} from './run-review.js';
import { TileUndo } from './tile-undo.js';

/** Caps on what one run, and the session's undo, may use. */
export interface PaintingLimits {
  /** Bytes of log text a run keeps. */
  logBytes: number;
  /** Script heap per run, bytes. */
  memoryBytes: number;
  /** Strokes per run. */
  strokes: number;
  /** Wall time per run, ms. */
  timeMs: number;
  /** Bytes of saved tiles kept for reverting committed runs; older runs revert by replaying scripts. */
  undoBytes: number;
  /** `show()` views per run. */
  views: number;
}

/** The limits a painting gets unless its options say otherwise. */
export const DEFAULT_LIMITS: Readonly<PaintingLimits> = Object.freeze({
  logBytes: 16_384,
  memoryBytes: 128 * 1024 * 1024,
  strokes: 250_000,
  timeMs: 60_000,
  undoBytes: 512 * 1024 * 1024,
  views: 4,
});

/** A reference image and how it is placed on the canvas. */
export interface ReferenceInput {
  /** Default `cover`. */
  fit?: ReferenceFit;
  image: RgbImage;
}

/** How to create a painting. */
export interface PaintingOptions {
  /** Default `#8c8377`, a warm mid-grey. */
  ground?: ColorInput;
  /** Canvas px. Default 900, or fitted to the reference's aspect. */
  height?: number;
  limits?: Partial<PaintingLimits>;
  /** Canvas px per mm, so scripts can think in physical size. Default 4. */
  pxPerMm?: number;
  reference?: ReferenceInput;
  /** 32-bit seed for the weave and every random choice. Default random. */
  seed?: number;
  /** The finish the painting is seen under: its image, views, and timelapse. Default `satin`. */
  surface?: Surface;
  /** Default `fine_weave`. */
  texture?: Texture;
  /** Canvas px. Default 1200, or fitted to the reference's aspect. */
  width?: number;
}

/** The reference a painting was created with. */
export interface ReferenceInfo {
  fit: ReferenceFit;
  /** Source image size in px. */
  height: number;
  /** Where the image lands, in canvas px. */
  placement: Region;
  /** SHA-256 of the image's RGB bytes, hex. */
  sha256: string;
  width: number;
}

/** How to run one script. */
export interface RunOptions {
  /** Polled while the script runs; returning true stops it with status `cancelled`. */
  cancelled?: () => boolean;
  /** When the script shows nothing, render one view of the region it changed. Default true. */
  defaultView?: boolean;
  /** Run, measure, and report, then roll back. */
  dryRun?: boolean;
  /** Refuse to run (`canvas_changed`) unless the painting is at this checkpoint. */
  expectCheckpoint?: number;
  /** Kept with the run in the history. */
  label?: string;
  /** Called after each stroke lands. */
  onStroke?: (stroke: StrokeEvent) => void;
}

/** How to replay a committed script. */
export interface ReplayOptions {
  label?: string;
  onStroke?: (stroke: StrokeEvent) => void;
}

/** What a run did, whether or not it landed. */
export interface RunStats {
  covered: Spread | null;
  /** `dry()` calls. */
  dries: number;
  /** Strokes that laid no paint on the canvas. */
  emptyStrokes: number;
  gaps: Spread | null;
  mixed: Spread | null;
  /** Wall time, ms. */
  ms: number;
  strokes: number;
  /** Share of the canvas holding wet paint when the run ended. */
  wetShare: number;
}

/** What every run result carries. */
export interface RunReport {
  /** Checkpoint after the run: one more than before only when it completed and was not a dry run. */
  checkpoint: number;
  dryRun: boolean;
  /** Text from `log()`, one line per call. */
  log: string;
  /** Lines past the log byte cap were dropped. */
  logTruncated: boolean;
  /** At most three facts about the strokes, with numbers. */
  observations: string[];
  previousCheckpoint: number;
  review: RunReview;
  stats: RunStats;
  /** `show()` views in call order, or the default view. */
  views: View[];
  /** `show()` calls past the per-run cap. */
  viewsDropped: number;
}

/** Why a run stopped. Every status but `completed` leaves the painting as it was. */
export type RunStatus =
  | { status: 'completed' }
  | { error: { column?: number; line?: number; message: string }; status: 'script_error' }
  | { limit: 'memory' | 'strokes' | 'time'; status: 'budget_exceeded' }
  | { status: 'cancelled' };

/** The result of `Painting.run`. */
export type RunResult = RunReport & RunStatus;

/** A committed run as the history keeps it. */
export interface RunEntry {
  /** Brushwork summed over the run's strokes: how a timelapse spaces its frames. */
  brushwork: number;
  code: string;
  label?: string;
  strokes: number;
}

/** The result of `Painting.revert`. */
export interface RevertResult {
  checkpoint: number;
  /** Bounds of what changed, or null when nothing did. */
  region: Region | null;
  /** The kept runs were replayed on a fresh canvas, because their saved tiles were gone. */
  replayed: boolean;
  runsRemoved: number;
}

interface Before {
  brushes: Names['brushes'];
  palette: Names['palette'];
  strokeTotal: number;
}

interface Committed extends RunEntry {
  before: Before;
  undo: TileUndo | null;
}

interface Execution {
  /** Session state as the run found it, restored on rollback. */
  before: Before;
  outcome: ScriptOutcome;
  session: RunSession;
  stop: 'cancelled' | 'strokes' | 'time' | undefined;
  undo: TileUndo;
}

const DEFAULT_GROUND = '#8c8377';
const DEFAULT_SIZE = { width: 1200, height: 900 };
const MAX_SIDE = 8192;
const MAX_AREA = 4096 * 4096;
/** Stream id for the noise field, distinct from every run index. */
const NOISE_STREAM = 0x6e6f6973;

/** Set by `Painting`'s static block; read through `canvasOf`. */
let peekCanvas: (p: Painting) => Canvas;

/** One painting and its history. Create with `Painting.create`. */
export class Painting {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly texture: Texture;
  readonly surface: Surface;
  readonly pxPerMm: number;
  readonly limits: Readonly<PaintingLimits>;
  readonly reference: ReferenceInfo | null;
  private readonly groundR: Float32Array;
  private readonly ref: Reference | undefined;
  private readonly qjs: QuickJSWASMModule;
  private readonly names: Names = { brushes: new Map(), palette: new Map() };
  private canvas: Canvas;
  private runs: Committed[] = [];

  static {
    peekCanvas = (p) => p.canvas;
  }

  private constructor(init: {
    ground: Float32Array;
    height: number;
    limits: PaintingLimits;
    pxPerMm: number;
    qjs: QuickJSWASMModule;
    ref: { info: ReferenceInfo; sampler: Reference } | undefined;
    seed: number;
    surface: Surface;
    texture: Texture;
    width: number;
  }) {
    this.width = init.width;
    this.height = init.height;
    this.seed = init.seed;
    this.texture = init.texture;
    this.surface = init.surface;
    this.pxPerMm = init.pxPerMm;
    this.limits = Object.freeze(init.limits);
    this.groundR = init.ground;
    this.qjs = init.qjs;
    this.ref = init.ref?.sampler;
    this.reference = init.ref?.info ?? null;
    this.canvas = this.freshCanvas();
  }

  /** Create a painting; throws `invalid_options`, `invalid_color`, or `invalid_image` on bad options. */
  static async create(options: PaintingOptions = {}): Promise<Painting> {
    const texture = options.texture ?? 'fine_weave';
    if (!TEXTURES.includes(texture))
      invalid(`texture must be one of ${TEXTURES.join(', ')} (got ${String(texture)})`);
    const surface = options.surface ?? 'satin';
    if (!SURFACES.includes(surface))
      invalid(`surface must be one of ${SURFACES.join(', ')} (got ${String(surface)})`);
    const seed = options.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!;
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
      invalid(`seed must be an integer from 0 to 4294967295 (got ${seed})`);
    const pxPerMm = options.pxPerMm ?? 4;
    if (!Number.isFinite(pxPerMm) || pxPerMm <= 0 || pxPerMm > 1000)
      invalid(`pxPerMm must be a number above 0 and at most 1000 (got ${pxPerMm})`);
    const limits = { ...DEFAULT_LIMITS, ...options.limits };
    for (const [k, v] of Object.entries(limits))
      if (typeof v !== 'number' || Number.isNaN(v) || v <= 0)
        invalid(`limits.${k} must be a number above 0 (got ${String(v)})`);
    const ground = toSpectrum(options.ground ?? DEFAULT_GROUND, 'ground');
    const input = options.reference;
    if (input) checkImage(input.image);
    const { width, height } = canvasSize(options, input?.image);
    let ref: { info: ReferenceInfo; sampler: Reference } | undefined;
    if (input) {
      const fit = input.fit ?? 'cover';
      if (!REFERENCE_FITS.includes(fit))
        invalid(`reference.fit must be one of ${REFERENCE_FITS.join(', ')} (got ${String(fit)})`);
      const sampler = new Reference(input.image, width, height, fit);
      ref = {
        sampler,
        info: {
          width: input.image.width,
          height: input.image.height,
          fit,
          placement: sampler.placement,
          sha256: await sha256(input.image.rgb),
        },
      };
    }
    return new Painting({
      width,
      height,
      seed,
      texture,
      surface,
      pxPerMm,
      ground,
      limits,
      ref,
      qjs: await loadQuickJS(),
    });
  }

  /** Committed runs: 0 for a fresh painting. */
  get checkpoint(): number {
    return this.runs.length;
  }

  /** The ground color. */
  get ground(): Color {
    return describeSpectrum(this.groundR);
  }

  /** Committed runs, oldest first. */
  get history(): readonly RunEntry[] {
    return this.runs.map(({ code, label, strokes, brushwork }) => ({
      code,
      ...(label !== undefined && { label }),
      strokes,
      brushwork,
    }));
  }

  /** Brushes the scripts have named. */
  get brushes(): Record<string, BrushSpec> {
    return Object.fromEntries(this.names.brushes);
  }

  /** Palette colors the scripts have named. */
  get palette(): Record<string, Color> {
    return Object.fromEntries([...this.names.palette].map(([k, R]) => [k, describeSpectrum(R)]));
  }

  /**
   * Run one script. A completed run commits (unless `dryRun`) and advances the
   * checkpoint; any other status leaves the painting as it was. Throws
   * `canvas_changed` when `expectCheckpoint` doesn't match.
   */
  run(code: string, options: RunOptions = {}): RunResult {
    const previous = this.checkpoint;
    if (options.expectCheckpoint !== undefined && options.expectCheckpoint !== previous)
      throw new PaintscriptError(
        'canvas_changed',
        `The painting is at checkpoint ${previous}, not ${options.expectCheckpoint}; look at it before running again.`,
      );
    const started = performance.now();
    const x = this.execute(code, {
      render: true,
      timeMs: this.limits.timeMs,
      strokes: this.limits.strokes,
      cancelled: options.cancelled,
      onStroke: options.onStroke,
    });
    const ms = performance.now() - started;
    const { session } = x;
    const status = statusOf(x);
    if (
      status.status === 'completed' &&
      session.views.length === 0 &&
      options.defaultView !== false &&
      session.touched
    )
      session.views.push(
        renderView(this.canvas, { region: this.padded(session.touched), surface: this.surface }),
      );
    const review = reviewStrokes(session.strokes);
    const report: RunReport = {
      checkpoint: previous,
      previousCheckpoint: previous,
      dryRun: options.dryRun === true,
      log: session.log.join(''),
      logTruncated: session.logTruncated,
      views: session.views,
      viewsDropped: session.viewsDropped,
      stats: {
        strokes: session.strokes.length,
        emptyStrokes: session.strokes.filter((s) => s.covered === 0).length,
        dries: session.dries,
        ms: Math.round(ms),
        wetShare: this.canvas.wetShare(),
        ...strokeSpreads(session.strokes),
      },
      review,
      observations: observe(session.strokes, review),
    };
    if (status.status === 'completed' && !options.dryRun) {
      this.commit(code, options.label, x);
      report.checkpoint = this.checkpoint;
    } else this.rollback(x);
    return { ...report, ...status };
  }

  /**
   * Return to `checkpoint`, removing the runs after it; brushes and palette colors go
   * back with them. Throws `checkpoint_not_found` outside 0 through the current checkpoint.
   */
  revert(checkpoint: number): RevertResult {
    if (!Number.isInteger(checkpoint) || checkpoint < 0 || checkpoint > this.checkpoint)
      throw new PaintscriptError(
        'checkpoint_not_found',
        `Checkpoint ${checkpoint} does not exist; this painting has checkpoints 0 through ${this.checkpoint}.`,
      );
    const removed = this.runs.slice(checkpoint);
    if (!removed.length) return { checkpoint, runsRemoved: 0, region: null, replayed: false };
    const undos = removed.map((r) => r.undo);
    if (undos.every((u) => u !== null)) {
      let region: PixelRect | null = null;
      for (const u of undos.toReversed()) {
        u.restore();
        region = unionRect(region, u.region());
      }
      this.restoreBefore(removed[0]!.before);
      this.runs.length = checkpoint;
      return {
        checkpoint,
        runsRemoved: removed.length,
        region: region && rectToRegion(region),
        replayed: false,
      };
    }
    const kept = this.runs.slice(0, checkpoint);
    this.canvas = this.freshCanvas();
    this.names.brushes.clear();
    this.names.palette.clear();
    this.runs = [];
    for (const r of kept) this.replay(r.code, r.label === undefined ? {} : { label: r.label });
    return {
      checkpoint,
      runsRemoved: removed.length,
      region: { x: 0, y: 0, w: this.width, h: this.height },
      replayed: true,
    };
  }

  /**
   * Re-run a script that committed before (from a journal, or a run being rebuilt) and
   * commit it again: no time or stroke cap, nothing rendered. Throws `invalid_journal`
   * when it doesn't complete, which a script that once committed never does.
   */
  replay(code: string, options: ReplayOptions = {}): void {
    const x = this.execute(code, {
      render: false,
      timeMs: Number.POSITIVE_INFINITY,
      strokes: Number.POSITIVE_INFINITY,
      cancelled: undefined,
      onStroke: options.onStroke,
    });
    const status = statusOf(x);
    if (status.status !== 'completed') {
      this.rollback(x);
      throw new PaintscriptError(
        'invalid_journal',
        `Run ${this.checkpoint + 1} did not replay: ${status.status === 'script_error' ? status.error.message : status.status}.`,
      );
    }
    this.commit(code, options.label, x);
  }

  /** Render a view, by default under the painting's surface; throws `invalid_region` for a region with no pixels on the canvas. */
  view(options: ViewOptions = {}): View {
    if (options.region) this.clip(options.region);
    return renderView(this.canvas, { ...options, surface: options.surface ?? this.surface });
  }

  /** The painting at full resolution, by default under its own surface. */
  image(surface: Surface = this.surface): RgbImage {
    return render(this.canvas, surface);
  }

  /** Paint color at a canvas point (rounded and clamped to the canvas), unlit. */
  at(x: number, y: number): Color {
    return describeSpectrum(
      this.canvas.reflectanceAt(this.canvas.indexAt(x, y), new Float32Array(NB)),
    );
  }

  /** Share of the canvas holding wet paint. */
  wetShare(): number {
    return this.canvas.wetShare();
  }

  /** Compare the painting with its reference; throws `no_reference` without one, `invalid_region` off the canvas. */
  diff(region?: Region, cell = 32): DiffResult {
    if (!this.ref)
      throw new PaintscriptError('no_reference', 'This painting was created without a reference.');
    return this.ref.diff(
      this.canvas,
      regionToRect(this.clip(region)),
      Math.max(4, Math.round(cell)),
    );
  }

  /** A caller's region clipped to the canvas (default: all of it); throws `invalid_region` when none of it is on the canvas. */
  private clip(region: Region | undefined): Region {
    const r = clipRegion(this.canvas, region);
    if (!r)
      throw new PaintscriptError(
        'invalid_region',
        `Region ${JSON.stringify(region)} has no pixels on the ${this.width}×${this.height} canvas.`,
      );
    return r;
  }

  private freshCanvas(): Canvas {
    return new Canvas(this.width, this.height, this.groundR, this.seed, this.texture);
  }

  /** Run a script against the live canvas. A host failure (a bug, not a script error) rolls the run back and rethrows. */
  private execute(
    code: string,
    o: {
      cancelled: (() => boolean) | undefined;
      onStroke: ((stroke: StrokeEvent) => void) | undefined;
      render: boolean;
      strokes: number;
      timeMs: number;
    },
  ): Execution {
    const before = this.before();
    const undo = new TileUndo(this.canvas);
    const session = new RunSession({
      canvas: this.canvas,
      names: this.names,
      undo,
      reference: this.ref,
      limits: { ...this.limits, strokes: o.strokes },
      render: o.render,
      surface: this.surface,
      onStroke: o.onStroke,
    });
    // the clock only decides whether a run may finish; it never reaches the painting
    const deadline = performance.now() + o.timeMs;
    let stop: Execution['stop'];
    const outcome = runScript(this.qjs, {
      code,
      prelude: PRELUDE,
      config: JSON.stringify({
        seed: hashSeed(this.seed, this.runs.length + 1),
        noiseSeed: hashSeed(this.seed, NOISE_STREAM),
        width: this.width,
        height: this.height,
        pxPerMm: this.pxPerMm,
        reference: this.ref ? this.ref.placement : null,
      }),
      host: session.hostFunctions(),
      memoryBytes: this.limits.memoryBytes,
      shouldInterrupt: () => {
        stop ??= session.strokeCapHit
          ? 'strokes'
          : performance.now() > deadline
            ? 'time'
            : o.cancelled?.()
              ? 'cancelled'
              : undefined;
        return stop !== undefined;
      },
    });
    const x: Execution = {
      before,
      outcome,
      session,
      undo,
      stop: session.strokeCapHit ? 'strokes' : stop,
    };
    if (session.hostFailure !== undefined) {
      this.rollback(x);
      throw session.hostFailure;
    }
    return x;
  }

  private before(): Before {
    return {
      brushes: new Map(this.names.brushes),
      palette: new Map(this.names.palette),
      strokeTotal: this.canvas.strokeTotal,
    };
  }

  private restoreBefore(b: Before) {
    this.names.brushes = new Map(b.brushes);
    this.names.palette = new Map(b.palette);
    this.canvas.strokeTotal = b.strokeTotal;
  }

  private rollback(x: Execution) {
    x.undo.restore();
    this.restoreBefore(x.before);
  }

  private commit(code: string, label: string | undefined, x: Execution) {
    this.runs.push({
      code,
      ...(label !== undefined && { label }),
      strokes: x.session.strokes.length,
      brushwork: x.session.strokes.reduce((s, r) => s + brushwork(r.length, r.width), 0),
      before: x.before,
      undo: x.undo,
    });
    // drop the oldest runs' tiles past the budget; those runs then revert by replay
    let bytes = this.runs.reduce((s, r) => s + (r.undo?.bytes ?? 0), 0);
    for (const r of this.runs) {
      if (bytes <= this.limits.undoBytes) break;
      if (!r.undo) continue;
      bytes -= r.undo.bytes;
      r.undo = null;
    }
  }

  /** A touched rectangle grown by 8 px, as a region on the canvas. */
  private padded(r: PixelRect): Region {
    const x0 = Math.max(0, r.x0 - 8);
    const y0 = Math.max(0, r.y0 - 8);
    return {
      x: x0,
      y: y0,
      w: Math.min(this.width, r.x1 + 8) - x0,
      h: Math.min(this.height, r.y1 + 8) - y0,
    };
  }
}

/**
 * The live canvas behind a painting, for renderers inside this package that draw it
 * incrementally (the timelapse). Not exported from the package entry point.
 */
export function canvasOf(p: Painting): Canvas {
  return peekCanvas(p);
}

function statusOf(x: Execution): RunStatus {
  if (x.stop === 'strokes') return { status: 'budget_exceeded', limit: 'strokes' };
  const o = x.outcome;
  switch (o.kind) {
    case 'completed':
      return { status: 'completed' };
    case 'interrupted':
      return x.stop === 'cancelled'
        ? { status: 'cancelled' }
        : { status: 'budget_exceeded', limit: 'time' };
    case 'out_of_memory':
      return { status: 'budget_exceeded', limit: 'memory' };
    case 'error':
      return {
        status: 'script_error',
        error: {
          message: o.message,
          ...(o.line !== undefined && { line: o.line }),
          ...(o.column !== undefined && { column: o.column }),
        },
      };
    default: {
      const never: never = o;
      return never;
    }
  }
}

function invalid(message: string): never {
  throw new PaintscriptError('invalid_options', message);
}

function checkImage(img: RgbImage) {
  if (
    !Number.isInteger(img.width) ||
    !Number.isInteger(img.height) ||
    img.width < 1 ||
    img.height < 1 ||
    !(img.rgb instanceof Uint8Array) ||
    img.rgb.length !== img.width * img.height * 3
  )
    throw new PaintscriptError(
      'invalid_image',
      'reference.image must be { width, height, rgb } with rgb a Uint8Array of width × height × 3 bytes.',
    );
}

/** Canvas size from the options, filling what's missing from the reference's aspect. */
function canvasSize(o: PaintingOptions, img: RgbImage | undefined) {
  let { width, height } = o;
  if (img && width === undefined && height === undefined) {
    const long = DEFAULT_SIZE.width;
    if (img.width >= img.height) width = long;
    else height = long;
  }
  if (img && width !== undefined && height === undefined)
    height = Math.max(16, Math.round((width * img.height) / img.width));
  if (img && height !== undefined && width === undefined)
    width = Math.max(16, Math.round((height * img.width) / img.height));
  width ??= DEFAULT_SIZE.width;
  height ??= DEFAULT_SIZE.height;
  for (const [k, v] of [
    ['width', width],
    ['height', height],
  ] as const)
    if (!Number.isInteger(v) || v < 16 || v > MAX_SIDE)
      invalid(`${k} must be an integer from 16 to ${MAX_SIDE} px (got ${v})`);
  if (width * height > MAX_AREA)
    invalid(`width × height must be at most ${MAX_AREA} px (got ${width} × ${height})`);
  return { width, height };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  // slice: digest takes bytes backed by a plain ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
