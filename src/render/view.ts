/**
 * @fileoverview Views for looking at a painting: a region scaled to fit a maximum side,
 * in one of five modes (the painting, squinted, its values, its relief, its wet paint),
 * under a matte, satin, or varnished surface, with an optional grid.
 * @module render/view
 */

import { optEnum, options, optNumber } from '../arguments.js';
import type { Canvas, PixelRect } from '../canvas/canvas.js';
import { linearRgbToOklab, oklabToLinearRgb } from '../color/oklab.js';
import { linearToByte } from '../color/srgb.js';
import { type RgbImage, SURFACES, type Surface, shadePixel } from './render.js';

/** What a view shows. */
export type ViewMode = 'color' | 'squint' | 'value' | 'relief' | 'wet';

/** Every view mode, for validation. */
export const VIEW_MODES: readonly ViewMode[] = ['color', 'squint', 'value', 'relief', 'wet'];

/** A canvas rectangle as callers give it: origin and size in canvas px. */
export interface Region {
  h: number;
  w: number;
  x: number;
  y: number;
}

/** What to render. */
export interface ViewOptions {
  /** Canvas px between grid lines, 2–100,000; every fifth line is stronger. Default none. */
  grid?: number;
  /** Longest side of the output image in px, from 16. Default 1024. */
  maxSide?: number;
  mode?: ViewMode;
  /** Default: the whole canvas. Clipped to the canvas. */
  region?: Region;
  /** Default: the painting's surface. */
  surface?: Surface;
}

/** A rendered view. Output pixel (u, v) shows canvas pixel (region.x + u / scale, region.y + v / scale). */
export interface View {
  image: RgbImage;
  mode: ViewMode;
  region: Region;
  /** Output px per canvas px (≤ 1). */
  scale: number;
}

/** Clip a region to the canvas; undefined when nothing of it is on the canvas. */
export function clipRegion(c: Canvas, r: Region | undefined): Region | undefined {
  if (!r) return { x: 0, y: 0, w: c.width, h: c.height };
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(c.width, Math.ceil(r.x + r.w));
  const y1 = Math.min(c.height, Math.ceil(r.y + r.h));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : undefined;
}

/** Pixel rectangle to region. */
export function rectToRegion(r: PixelRect): Region {
  return { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 };
}

/** Region to pixel rectangle. */
export function regionToRect(r: Region): PixelRect {
  return { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h };
}

const VIEW_KEYS = ['grid', 'maxSide', 'mode', 'surface'] as const;

/**
 * Check a view's options other than its region, as a script or a caller gave them.
 * `maxSideLimit` is the largest `maxSide` accepted. Throws `invalid_options` naming `where`.
 */
export function readViewOptions(
  v: unknown,
  where: string,
  maxSideLimit: number,
): Omit<ViewOptions, 'region'> {
  const o = options(v, where, VIEW_KEYS, 'invalid_options');
  const mode = optEnum(o, 'mode', VIEW_MODES, where, 'invalid_options');
  const surface = optEnum(o, 'surface', SURFACES, where, 'invalid_options');
  const maxSide = optNumber(o, 'maxSide', where, 16, maxSideLimit, 'invalid_options');
  // a finer grid than 2 px is a solid tint, and drawing it costs a line per step
  const grid = optNumber(o, 'grid', where, 2, 1e5, 'invalid_options');
  return {
    ...(mode && { mode }),
    ...(surface && { surface }),
    ...(maxSide !== undefined && { maxSide: Math.round(maxSide) }),
    ...(grid !== undefined && { grid }),
  };
}

/**
 * Render a view of the canvas from options already checked by `readViewOptions`.
 * Throws nothing: a region off the canvas renders the whole canvas.
 */
export function renderView(c: Canvas, opts: ViewOptions & { surface: Surface }): View {
  const mode = opts.mode ?? 'color';
  const { surface } = opts;
  const region = clipRegion(c, opts.region) ?? { x: 0, y: 0, w: c.width, h: c.height };
  const scale = Math.min(1, (opts.maxSide ?? 1024) / Math.max(region.w, region.h));
  const ow = Math.max(1, Math.round(region.w * scale));
  const oh = Math.max(1, Math.round(region.h * scale));
  const fx = region.w / ow;
  const fy = region.h / oh;
  // samples per output pixel per axis: enough to average the footprint, capped for speed
  const n = Math.min(4, Math.max(1, Math.ceil(Math.max(fx, fy))));
  const rgb = new Uint8Array(ow * oh * 3);
  const px = new Float64Array(3);
  const lin = new Float64Array(ow * oh * 3);
  for (let oy = 0; oy < oh; oy++)
    for (let ox = 0; ox < ow; ox++) {
      let ar = 0;
      let ag = 0;
      let ab = 0;
      for (let sy = 0; sy < n; sy++)
        for (let sx = 0; sx < n; sx++) {
          const x = Math.min(c.width - 1, region.x + Math.floor((ox + (sx + 0.5) / n) * fx));
          const y = Math.min(c.height - 1, region.y + Math.floor((oy + (sy + 0.5) / n) * fy));
          if (mode === 'wet') {
            const v = c.V[y * c.width + x]!;
            const t = Math.min(1, v / 0.6) ** 0.7;
            px[0] = 0.02 + 0.1 * t;
            px[1] = 0.02 + 0.55 * t;
            px[2] = 0.03 + 0.85 * t;
          } else shadePixel(c, x, y, mode === 'relief' ? 'relief' : 'color', surface, px);
          ar += px[0]!;
          ag += px[1]!;
          ab += px[2]!;
        }
      const o = (oy * ow + ox) * 3;
      lin[o] = ar / (n * n);
      lin[o + 1] = ag / (n * n);
      lin[o + 2] = ab / (n * n);
    }
  if (mode === 'squint') squint(lin, ow, oh);
  for (let p = 0; p < ow * oh; p++) {
    let r = lin[p * 3]!;
    let g = lin[p * 3 + 1]!;
    let b = lin[p * 3 + 2]!;
    if (mode === 'value' || mode === 'squint') {
      // keep lightness only (squint keeps a trace of hue so masses still read)
      const [L, A, B] = linearRgbToOklab(Math.max(0, r), Math.max(0, g), Math.max(0, b));
      const keep = mode === 'squint' ? 0.35 : 0;
      [r, g, b] = oklabToLinearRgb(L, A * keep, B * keep);
    }
    rgb[p * 3] = linearToByte(r);
    rgb[p * 3 + 1] = linearToByte(g);
    rgb[p * 3 + 2] = linearToByte(b);
  }
  if (opts.grid !== undefined) drawGrid(rgb, ow, oh, region, scale, opts.grid);
  return { image: { width: ow, height: oh, rgb }, mode, region, scale };
}

/** Blur linear RGB in place by a radius of about 1.2% of the image's long side (three box passes). */
function squint(lin: Float64Array, w: number, h: number) {
  const r = Math.max(1, Math.round(Math.max(w, h) * 0.012));
  const tmp = new Float64Array(lin.length);
  for (let pass = 0; pass < 3; pass++)
    for (let ch = 0; ch < 3; ch++) {
      boxBlur(lin.subarray(ch), tmp.subarray(ch), h, w, r, 3, 3 * w);
      boxBlur(tmp.subarray(ch), lin.subarray(ch), w, h, r, 3 * w, 3);
    }
}

/**
 * One box-blur pass of radius r along one axis: `n` lines of `len` samples, a line
 * starting every `lineStep` and its samples `step` apart. Edges average what they reach.
 */
export function boxBlur(
  src: Float32Array | Float64Array,
  dst: Float32Array | Float64Array,
  n: number,
  len: number,
  r: number,
  step: number,
  lineStep: number,
): void {
  for (let line = 0; line < n; line++) {
    const o = line * lineStep;
    let acc = 0;
    let cnt = 0;
    for (let k = 0; k < Math.min(len, r); k++) {
      acc += src[o + k * step]!;
      cnt++;
    }
    for (let k = 0; k < len; k++) {
      if (k + r < len) {
        acc += src[o + (k + r) * step]!;
        cnt++;
      }
      if (k - r - 1 >= 0) {
        acc -= src[o + (k - r - 1) * step]!;
        cnt--;
      }
      dst[o + k * step] = acc / cnt;
    }
  }
}

/** Draw grid lines every `step` canvas px (every fifth stronger), blended to read on light and dark. */
function drawGrid(
  rgb: Uint8Array,
  w: number,
  h: number,
  region: Region,
  scale: number,
  step: number,
) {
  const line = (o: number, strong: boolean) => {
    const a = strong ? 0.55 : 0.3;
    for (let k = 0; k < 3; k++) {
      const v = rgb[o + k]!;
      const target = v > 110 ? 0 : 255;
      rgb[o + k] = Math.round(v + (target - v) * a);
    }
  };
  for (let gx = Math.ceil(region.x / step) * step; gx < region.x + region.w; gx += step) {
    const ox = Math.round((gx - region.x) * scale);
    if (ox < 0 || ox >= w) continue;
    for (let oy = 0; oy < h; oy++) line((oy * w + ox) * 3, (gx / step) % 5 === 0);
  }
  for (let gy = Math.ceil(region.y / step) * step; gy < region.y + region.h; gy += step) {
    const oy = Math.round((gy - region.y) * scale);
    if (oy < 0 || oy >= h) continue;
    for (let ox = 0; ox < w; ox++) line((oy * w + ox) * 3, (gy / step) % 5 === 0);
  }
}
