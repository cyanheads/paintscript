/**
 * @fileoverview The script vocabulary as the host implements it. Each function a script
 * calls (brush, stroke, mix, palette, dry, at, wet, height, ref.at, ref.edge, diff,
 * show, log) checks its arguments with a message naming the function and the field,
 * acts on the canvas, saves what it is about to change for undo, and records what the
 * run did for its report.
 * @module script/vocabulary
 */

import { BRUSH_TYPES, type BrushSpec, STROKE_ENDS, type StrokeSpec } from '../brush/brush.js';
import { layStroke } from '../brush/lay-stroke.js';
import type { PathPoint } from '../brush/path.js';
import { type Canvas, type PixelRect, unionRect } from '../canvas/canvas.js';
import { type Color, describeSpectrum, toSpectrum } from '../color/color.js';
import { linearRgbToSpectrum, NB } from '../color/spectrum.js';
import { PaintscriptError, type PaintscriptErrorCode } from '../errors.js';
import { PAINT_KINDS } from '../paint/kubelka-munk.js';
import { mixSpectra } from '../paint/mix.js';
import type { StrokeRecord } from '../painting/run-review.js';
import type { TileUndo } from '../painting/tile-undo.js';
import type { DiffResult, Reference, ReferenceEdge } from '../reference/reference.js';
import { SURFACES, type Surface } from '../render/render.js';
import {
  clipRegion,
  type Region,
  rectToRegion,
  regionToRect,
  renderView,
  VIEW_MODES,
  type View,
} from '../render/view.js';
import type { HostFunction } from './sandbox.js';

/** Named things a run can define, kept across runs: brushes and palette colors. */
export interface Names {
  brushes: Map<string, BrushSpec>;
  palette: Map<string, Float32Array>;
}

/** Per-run caps the vocabulary enforces. */
export interface VocabularyLimits {
  logBytes: number;
  strokes: number;
  views: number;
}

/** What one run's vocabulary acts on. */
export interface SessionEnv {
  canvas: Canvas;
  limits: VocabularyLimits;
  names: Names;
  onStroke: ((stroke: StrokeEvent) => void) | undefined;
  reference: Reference | undefined;
  /** Render `show()` views; off when replaying, where nothing looks. */
  render: boolean;
  /** The painting's surface, for views that don't name one. */
  surface: Surface;
  undo: TileUndo;
}

/** What one stroke did, as `stroke()` returns it. */
export interface StrokeReport {
  bbox: Region | null;
  covered: number;
  gaps: number;
  length: number;
  mixed: number;
  pickedUp: number;
}

/** A stroke that just landed, as a run's `onStroke` hook sees it. */
export interface StrokeEvent extends StrokeReport {
  /** Brush width, px. */
  width: number;
}

const STROKE_KEYS = [
  'angle',
  'brush',
  'color',
  'contact',
  'corners',
  'end',
  'load',
  'paint',
  'path',
  'pressure',
  'thinner',
] as const;
const BRUSH_KEYS = [
  'reservoir',
  'splay',
  'stiffness',
  'streak',
  'toneVar',
  'type',
  'width',
] as const;
const REGION_KEYS = ['h', 'w', 'x', 'y'] as const;
const MAX_PATH_POINTS = 10_000;
const MAX_NAME = 64;
const DEFAULT_DIFF_CELL = 32;
const EMPTY_STROKE: StrokeReport = {
  bbox: null,
  covered: 0,
  gaps: 0,
  length: 0,
  mixed: 0,
  pickedUp: 0,
};
const utf8 = new TextEncoder();

type Obj = Record<string, unknown>;

/** One run's vocabulary and what it recorded. */
export class RunSession {
  readonly strokes: StrokeRecord[] = [];
  dries = 0;
  readonly views: View[] = [];
  viewsDropped = 0;
  readonly log: string[] = [];
  logTruncated = false;
  /** Bounds of every pixel the run changed, or null. */
  touched: PixelRect | null = null;
  /** A stroke past the run's cap was refused; the run cannot complete. */
  strokeCapHit = false;
  /** An error engine code threw that is not a caller mistake: a bug, rethrown after the run. */
  hostFailure: unknown;
  private readonly env: SessionEnv;
  private logUsed = 0;
  private viewCalls = 0;

  constructor(env: SessionEnv) {
    this.env = env;
  }

  /** The functions the prelude reaches through `__host`. */
  hostFunctions(): Record<string, HostFunction> {
    const table: Record<string, (args: unknown[]) => unknown> = {
      brush: (a) => this.brush(a),
      stroke: (a) => this.stroke(a),
      mix: (a) => this.mix(a),
      palette: (a) => this.palette(a),
      dry: (a) => this.dry(a),
      at: (a) => this.at(a),
      wet: (a) => this.wet(a),
      height: (a) => this.height(a),
      refAt: (a) => this.refAt(a),
      refEdge: (a) => this.refEdge(a),
      diff: (a) => this.diff(a),
      show: (a) => this.show(a),
      log: (a) => this.addLog(a),
    };
    const out: Record<string, HostFunction> = {};
    for (const [name, fn] of Object.entries(table))
      out[name] = (json) => {
        const args = parseArgs(json, name);
        try {
          const result = fn(args);
          return result === undefined ? undefined : JSON.stringify(result);
        } catch (err) {
          if (!(err instanceof PaintscriptError)) this.hostFailure ??= err;
          throw err;
        }
      };
    return out;
  }

  private brush(args: unknown[]): unknown {
    const where = 'brush()';
    const { brushes } = this.env.names;
    if (args[0] == null) return Object.fromEntries(brushes);
    const name = this.name(args[0], where, 'invalid_brush');
    if (args[1] == null) {
      const spec = brushes.get(name);
      if (!spec) fail('unknown_brush', where, `no brush named "${name}"${listing(brushes)}`);
      return spec;
    }
    brushes.set(name, this.readBrush(args[1], where));
    return name;
  }

  private stroke(args: unknown[]): StrokeReport {
    const where = 'stroke()';
    const { canvas, undo, limits } = this.env;
    if (this.strokeCapHit || this.strokes.length >= limits.strokes) {
      this.strokeCapHit = true;
      return EMPTY_STROKE;
    }
    if (args[0] == null || typeof args[0] !== 'object' || Array.isArray(args[0]))
      fail('invalid_stroke', where, 'takes one object: { path, brush, color?, ... }');
    const o = options(args[0], where, STROKE_KEYS, 'invalid_stroke');
    const path = this.readPath(o.path, where);
    const brush = this.resolveBrush(o.brush, where);
    const spec: StrokeSpec = { path, brush };
    if (o.color != null) spec.color = this.color(o.color, `${where} color`);
    const paint = optEnum(o, 'paint', PAINT_KINDS, where, 'invalid_stroke');
    if (paint) spec.paint = paint;
    const end = optEnum(o, 'end', STROKE_ENDS, where, 'invalid_stroke');
    if (end) spec.end = end;
    for (const key of ['load', 'pressure', 'thinner', 'contact'] as const) {
      const v = optNumber(o, key, where, 0, 1, 'invalid_stroke');
      if (v !== undefined) spec[key] = v;
    }
    const angle = optNumber(o, 'angle', where, -1e6, 1e6, 'invalid_stroke');
    if (angle !== undefined) spec.angle = angle;
    if (o.corners != null) {
      if (typeof o.corners !== 'boolean')
        fail('invalid_stroke', where, `corners must be true or false (got ${shown(o.corners)})`);
      spec.corners = o.corners;
    }
    const result = layStroke(canvas, spec, {
      beforeWrite: (rect) => undo.save(rect, ['film', 'volume']),
    });
    const first = path[0]!;
    const last = path[path.length - 1]!;
    const dab = result.length === 0;
    const dx = last[0]! - first[0]!;
    const dy = last[1]! - first[1]!;
    this.strokes.push({
      angle: dab ? (spec.angle ?? null) : Math.hypot(dx, dy) >= 1 ? Math.atan2(dy, dx) : null,
      covered: result.covered,
      dab,
      gaps: result.gaps,
      length: result.length,
      mixed: result.mixed,
      width: brush.width,
    });
    if (result.bbox) this.touch(result.bbox);
    const report: StrokeReport = {
      bbox: result.bbox && rectToRegion(result.bbox),
      covered: result.covered,
      gaps: result.gaps,
      length: result.length,
      mixed: result.mixed,
      pickedUp: result.pickedUp,
    };
    this.env.onStroke?.({ ...report, width: brush.width });
    return report;
  }

  private mix(args: unknown[]): Color {
    const where = 'mix()';
    if (!args.length)
      fail('invalid_color', where, 'pass one or more colors, each a color or [color, parts]');
    const parts = args.map((a, i): [Float32Array, number] => {
      const label = `${where} argument ${i + 1}`;
      if (!Array.isArray(a)) return [this.color(a, label), 1];
      const parts = a[1];
      if (
        a.length !== 2 ||
        typeof parts !== 'number' ||
        !Number.isFinite(parts) ||
        parts < 0 ||
        parts > 1e6
      )
        fail('invalid_color', label, `must be a color or [color, parts ≥ 0] (got ${shown(a)})`);
      return [this.color(a[0], label), parts];
    });
    // zero parts of a color is none of it
    const used = parts.filter(([, p]) => p > 0);
    if (!used.length) fail('invalid_color', where, 'at least one color needs parts above 0');
    return describeSpectrum(mixSpectra(used));
  }

  private palette(args: unknown[]): unknown {
    const where = 'palette()';
    const { palette } = this.env.names;
    if (args[0] == null)
      return Object.fromEntries([...palette].map(([k, R]) => [k, describeSpectrum(R)]));
    const name = this.name(args[0], where, 'invalid_color');
    if (name.trimStart().startsWith('#'))
      fail('invalid_color', where, `a palette name cannot start with "#" (got "${name}")`);
    if (args[1] == null) {
      const R = palette.get(name);
      if (!R) fail('invalid_color', where, `no palette color named "${name}"${listing(palette)}`);
      return describeSpectrum(R);
    }
    const R = this.color(args[1], `${where} color`);
    palette.set(name, R);
    return describeSpectrum(R);
  }

  private dry(args: unknown[]): void {
    const { canvas, undo } = this.env;
    this.dries++;
    const rect = args[0] == null ? this.whole() : this.region(args[0], 'dry()');
    const wet = wetBounds(canvas, rect);
    if (!wet) return;
    undo.save(wet, ['volume', 'base'], (tile) => wetBounds(canvas, intersect(tile, wet)) !== null);
    canvas.dry(wet);
    this.touch(wet);
  }

  private at(args: unknown[]): Color {
    const [x, y] = point(args, 'at()');
    const { canvas } = this.env;
    return describeSpectrum(canvas.reflectanceAt(canvas.indexAt(x, y), new Float32Array(NB)));
  }

  private wet(args: unknown[]): number {
    const [x, y] = point(args, 'wet()');
    const { canvas } = this.env;
    return canvas.V[canvas.indexAt(x, y)]!;
  }

  private height(args: unknown[]): number {
    const [x, y] = point(args, 'height()');
    return this.env.canvas.surfaceHeight(Math.round(x), Math.round(y));
  }

  private refAt(args: unknown[]): Color | null {
    const [x, y] = point(args, 'ref.at()');
    const lin = this.reference('ref.at()').at(x, y);
    return lin && describeSpectrum(linearRgbToSpectrum(lin[0], lin[1], lin[2]));
  }

  private refEdge(args: unknown[]): ReferenceEdge | null {
    const [x, y] = point(args, 'ref.edge()');
    return this.reference('ref.edge()').edge(x, y);
  }

  private diff(args: unknown[]): DiffResult {
    const where = 'diff()';
    const ref = this.reference(where);
    const rect = args[0] == null ? this.whole() : this.region(args[0], where);
    const o = options(args[1], where, ['cell'], 'invalid_options');
    const cell = optNumber(o, 'cell', where, 4, 4096, 'invalid_options');
    return ref.diff(this.env.canvas, rect, Math.round(cell ?? DEFAULT_DIFF_CELL));
  }

  private show(args: unknown[]): void {
    const where = 'show()';
    const rect = args[0] == null ? undefined : this.region(args[0], where);
    const o = options(args[1], where, ['grid', 'maxSide', 'mode', 'surface'], 'invalid_options');
    const mode = optEnum(o, 'mode', VIEW_MODES, where, 'invalid_options');
    const surface = optEnum(o, 'surface', SURFACES, where, 'invalid_options');
    const maxSide = optNumber(o, 'maxSide', where, 16, 4096, 'invalid_options');
    const grid = optNumber(o, 'grid', where, 2, 1e5, 'invalid_options');
    if (this.viewCalls++ >= this.env.limits.views) {
      this.viewsDropped++;
      return;
    }
    if (!this.env.render) return;
    this.views.push(
      renderView(this.env.canvas, {
        ...(rect && { region: rectToRegion(rect) }),
        ...(mode && { mode }),
        surface: surface ?? this.env.surface,
        ...(maxSide !== undefined && { maxSide: Math.round(maxSide) }),
        ...(grid !== undefined && { grid }),
      }),
    );
  }

  private addLog(args: unknown[]): void {
    const line = `${String(args[0])}\n`;
    const bytes = utf8.encode(line).byteLength;
    if (this.logTruncated || this.logUsed + bytes > this.env.limits.logBytes) {
      this.logTruncated = true;
      return;
    }
    this.logUsed += bytes;
    this.log.push(line);
  }

  private reference(where: string): Reference {
    const ref = this.env.reference;
    if (!ref)
      fail('no_reference', where, 'needs a reference image; create the painting with a reference');
    return ref;
  }

  private resolveBrush(v: unknown, where: string): BrushSpec {
    const { brushes } = this.env.names;
    if (typeof v === 'string') {
      const spec = brushes.get(v);
      if (!spec) fail('unknown_brush', where, `no brush named "${v}"${listing(brushes)}`);
      return spec;
    }
    if (v == null || typeof v !== 'object' || Array.isArray(v))
      fail(
        'invalid_brush',
        where,
        `brush must be a brush name or a spec { type, width, ... } (got ${shown(v)})`,
      );
    return this.readBrush(v, `${where} brush`);
  }

  private readBrush(v: unknown, where: string): BrushSpec {
    if (v == null || typeof v !== 'object' || Array.isArray(v))
      fail('invalid_brush', where, `a brush is { type, width, ... } (got ${shown(v)})`);
    const o = options(v, where, BRUSH_KEYS, 'invalid_brush');
    const { width: W, height: H } = this.env.canvas;
    const spec: BrushSpec = {
      type: oneOf(o.type, where, 'type', BRUSH_TYPES, 'invalid_brush'),
      width: number(o.width, where, 'width', 0.5, Math.max(W, H), 'invalid_brush'),
    };
    for (const key of ['splay', 'stiffness', 'streak', 'toneVar'] as const) {
      const val = optNumber(o, key, where, 0, 1, 'invalid_brush');
      if (val !== undefined) spec[key] = val;
    }
    const reservoir = optNumber(o, 'reservoir', where, 0.01, 20, 'invalid_brush');
    if (reservoir !== undefined) spec.reservoir = reservoir;
    return spec;
  }

  private readPath(v: unknown, where: string): PathPoint[] {
    const form = 'an array of [x, y] or [x, y, pressure] points';
    if (!Array.isArray(v) || v.length === 0)
      fail('invalid_stroke', where, `path must be ${form} (got ${shown(v)})`);
    if (v.length > MAX_PATH_POINTS)
      fail(
        'invalid_stroke',
        where,
        `path has ${v.length} points; a stroke takes at most ${MAX_PATH_POINTS}`,
      );
    const { width: W, height: H } = this.env.canvas;
    const maxLength = 20 * (W + H);
    let length = 0;
    for (let i = 0; i < v.length; i++) {
      const p: unknown = v[i];
      if (
        !Array.isArray(p) ||
        p.length < 2 ||
        p.length > 3 ||
        !p.every((c) => typeof c === 'number' && Number.isFinite(c))
      )
        fail(
          'invalid_stroke',
          where,
          `path[${i}] must be [x, y] or [x, y, pressure] (got ${shown(p)})`,
        );
      const [x, y, pressure] = p as number[];
      if (x! < -W || x! > 2 * W || y! < -H || y! > 2 * H)
        fail(
          'invalid_stroke',
          where,
          `path[${i}] (${x}, ${y}) is more than a canvas width or height off the ${W}×${H} canvas`,
        );
      if (pressure !== undefined && (pressure < 0 || pressure > 1))
        fail('invalid_stroke', where, `path[${i}] pressure must be from 0 to 1 (got ${pressure})`);
      if (i) {
        const q = v[i - 1] as number[];
        length += Math.hypot(x! - q[0]!, y! - q[1]!);
      }
    }
    if (length > maxLength)
      fail(
        'invalid_stroke',
        where,
        `path runs ${Math.round(length)} px; a stroke runs at most ${maxLength} px (20 × (width + height)), so split it`,
      );
    return v as PathPoint[];
  }

  /** A color argument: a palette name, or any form `toSpectrum` reads. */
  private color(v: unknown, label: string): Float32Array {
    if (typeof v === 'string' && !v.trimStart().startsWith('#')) {
      const { palette } = this.env.names;
      const R = palette.get(v);
      if (!R)
        fail(
          'invalid_color',
          label,
          `no palette color named "${v}" (hex colors start with #)${listing(palette)}`,
        );
      return R;
    }
    return toSpectrum(v, label);
  }

  private name(v: unknown, where: string, code: PaintscriptErrorCode): string {
    if (typeof v !== 'string' || v.length === 0 || v.length > MAX_NAME)
      fail(code, where, `a name is a string of 1 to ${MAX_NAME} characters (got ${shown(v)})`);
    return v;
  }

  /** A region argument clipped to the canvas; throws when nothing of it is on the canvas. */
  private region(v: unknown, where: string): PixelRect {
    const { canvas } = this.env;
    if (v == null || typeof v !== 'object' || Array.isArray(v))
      fail('invalid_region', where, `a region is { x, y, w, h } (got ${shown(v)})`);
    const { x, y, w, h } = options(v, where, REGION_KEYS, 'invalid_region');
    if (![x, y, w, h].every((c) => typeof c === 'number' && Number.isFinite(c)))
      fail(
        'invalid_region',
        where,
        `a region is { x, y, w, h } of finite numbers (got ${shown(v)})`,
      );
    const r = clipRegion(canvas, { x, y, w, h } as Region);
    if (!r)
      fail(
        'invalid_region',
        where,
        `region ${shown(v)} has no pixels on the ${canvas.width}×${canvas.height} canvas`,
      );
    return regionToRect(r);
  }

  private whole(): PixelRect {
    return { x0: 0, y0: 0, x1: this.env.canvas.width, y1: this.env.canvas.height };
  }

  private touch(r: PixelRect) {
    this.touched = unionRect(this.touched, r);
  }
}

/** Arguments as the prelude sends them; a script that replaced the JSON globals gets an error, not the host. */
function parseArgs(json: string, name: string): unknown[] {
  let args: unknown;
  try {
    args = JSON.parse(json);
  } catch {
    args = undefined;
  }
  if (!Array.isArray(args))
    throw new PaintscriptError(
      'invalid_options',
      `${name}: arguments did not arrive as a JSON array; leave JSON.stringify and JSON.parse as they are`,
    );
  return args;
}

function fail(code: PaintscriptErrorCode, where: string, message: string): never {
  throw new PaintscriptError(code, `${where}: ${message}`);
}

/** A value as an error message quotes it, cut to 60 characters. */
function shown(v: unknown): string {
  const s = v === undefined ? 'nothing' : (JSON.stringify(v) ?? String(v));
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

/** "; defined: a, b" for an error naming what exists, or a note that nothing does. */
function listing(map: ReadonlyMap<string, unknown>): string {
  return map.size ? `; defined: ${[...map.keys()].join(', ')}` : '; none are defined yet';
}

function options(
  v: unknown,
  where: string,
  keys: readonly string[],
  code: PaintscriptErrorCode,
): Obj {
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v))
    fail(code, where, `expected an options object (got ${shown(v)})`);
  for (const k of Object.keys(v))
    if (!keys.includes(k)) fail(code, where, `unknown option "${k}"; it takes ${keys.join(', ')}`);
  return v as Obj;
}

function number(
  v: unknown,
  where: string,
  key: string,
  min: number,
  max: number,
  code: PaintscriptErrorCode,
): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    fail(code, where, `${key} must be a number from ${min} to ${max} (got ${shown(v)})`);
  return v;
}

function optNumber(
  o: Obj,
  key: string,
  where: string,
  min: number,
  max: number,
  code: PaintscriptErrorCode,
): number | undefined {
  return o[key] == null ? undefined : number(o[key], where, key, min, max, code);
}

function oneOf<T extends string>(
  v: unknown,
  where: string,
  key: string,
  values: readonly T[],
  code: PaintscriptErrorCode,
): T {
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v))
    fail(code, where, `${key} must be one of ${values.join(', ')} (got ${shown(v)})`);
  return v as T;
}

function optEnum<T extends string>(
  o: Obj,
  key: string,
  values: readonly T[],
  where: string,
  code: PaintscriptErrorCode,
): T | undefined {
  return o[key] == null ? undefined : oneOf(o[key], where, key, values, code);
}

function point(args: unknown[], where: string): [number, number] {
  const [x, y] = args;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
    fail('invalid_options', where, `takes (x, y) as finite numbers (got ${shown(args)})`);
  return [x, y];
}

function intersect(a: PixelRect, b: PixelRect): PixelRect {
  return {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
}

/** Bounds of the wet pixels in `rect`, or null when none are wet. */
function wetBounds(canvas: Canvas, rect: PixelRect): PixelRect | null {
  const { V, width } = canvas;
  let x0 = rect.x1;
  let y0 = rect.y1;
  let x1 = -1;
  let y1 = -1;
  for (let y = rect.y0; y < rect.y1; y++)
    for (let x = rect.x0; x < rect.x1; x++)
      if (V[y * width + x]! > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
