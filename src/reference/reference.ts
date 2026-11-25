/**
 * @fileoverview A reference image placed on the canvas: resampled once to canvas
 * resolution, sampled bilinearly, read for the direction edges run (Sobel on blurred
 * OKLab lightness), and compared with the painting's color cell by cell in OKLab.
 * @module reference/reference
 */

import type { Canvas, PixelRect } from '../canvas/canvas.js';
import { linearRgbToOklab, oklabDistance } from '../color/oklab.js';
import { NB, spectrumToLinearRgb } from '../color/spectrum.js';
import { toLinear } from '../color/srgb.js';
import type { RgbImage } from '../render/render.js';
import type { Region } from '../render/view.js';

/** How the image is placed: fill the canvas and crop, fit inside it, or stretch to it. */
export type ReferenceFit = 'cover' | 'contain' | 'stretch';

/** Every fit, for validation. */
export const REFERENCE_FITS: readonly ReferenceFit[] = ['cover', 'contain', 'stretch'];

/** Which way an edge runs at a point, and how sharp it is. */
export interface ReferenceEdge {
  /** Direction the edge runs along (the contour, not across it), radians in (-π/2, π/2]. */
  angle: number;
  /** Lightness change across the edge, OKLab L per canvas px. */
  strength: number;
}

/** One cell of a comparison. */
export interface DiffCell extends Region {
  /** Mean OKLab distance from the reference over the cell. */
  distance: number;
}

/** How far the painting's color is from the reference over a region. */
export interface DiffResult {
  /** Cell side in canvas px. */
  cell: number;
  /** Mean OKLab distance over the region. */
  mean: number;
  region: Region;
  /** Canvas pixels compared (every `stride`th pixel on each axis). */
  samples: number;
  stride: number;
  /** The cells farthest from the reference, worst first (at most 5). */
  worst: DiffCell[];
}

/** Most samples a comparison takes; larger regions are sampled on a stride. */
const MAX_DIFF_SAMPLES = 250_000;
const BYTE_TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => toLinear(i / 255));

/** A reference image resampled onto one canvas. */
export class Reference {
  readonly fit: ReferenceFit;
  /** Source image size in px. */
  readonly imageHeight: number;
  readonly imageWidth: number;
  /** Where the image lands, in canvas px; extends past the canvas under `cover`. */
  readonly placement: Region;
  private readonly width: number;
  private readonly height: number;
  /** Linear RGB per canvas pixel. */
  private readonly lin: Float32Array;
  /** 1 where the image covers the canvas pixel (all of it except under `contain`). */
  private readonly inside: Uint8Array;
  private gradient?: { gx: Float32Array; gy: Float32Array };

  constructor(image: RgbImage, width: number, height: number, fit: ReferenceFit) {
    this.fit = fit;
    this.imageWidth = image.width;
    this.imageHeight = image.height;
    this.width = width;
    this.height = height;
    this.placement = place(image.width, image.height, width, height, fit);
    const { x: px, y: py, w: pw, h: ph } = this.placement;
    const iw = image.width;
    const ih = image.height;
    this.lin = new Float32Array(width * height * 3);
    this.inside = new Uint8Array(width * height);
    // samples per canvas pixel per axis: enough to average a downscaled footprint
    const nx = Math.min(4, Math.max(1, Math.ceil(iw / pw)));
    const ny = Math.min(4, Math.max(1, Math.ceil(ih / ph)));
    const px3 = new Float64Array(3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (x + 0.5 < px || x + 0.5 >= px + pw || y + 0.5 < py || y + 0.5 >= py + ph) continue;
        const i = y * width + x;
        this.inside[i] = 1;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let sy = 0; sy < ny; sy++)
          for (let sx = 0; sx < nx; sx++) {
            const u = ((x + (sx + 0.5) / nx - px) / pw) * iw - 0.5;
            const v = ((y + (sy + 0.5) / ny - py) / ph) * ih - 0.5;
            bilinear(image, u, v, px3);
            r += px3[0]!;
            g += px3[1]!;
            b += px3[2]!;
          }
        const n = nx * ny;
        this.lin[i * 3] = r / n;
        this.lin[i * 3 + 1] = g / n;
        this.lin[i * 3 + 2] = b / n;
      }
  }

  /** Linear RGB at canvas point (x, y), bilinear between pixels; null where the image doesn't reach. Clamped to the canvas. */
  at(x: number, y: number): [number, number, number] | null {
    const { width: W, height: H, lin, inside } = this;
    const cx = Math.min(W - 1, Math.max(0, x));
    const cy = Math.min(H - 1, Math.max(0, y));
    if (!inside[Math.round(cy) * W + Math.round(cx)]) return null;
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const x1 = Math.min(W - 1, x0 + 1);
    const y1 = Math.min(H - 1, y0 + 1);
    const ax = cx - x0;
    const ay = cy - y0;
    const out: [number, number, number] = [0, 0, 0];
    let wsum = 0;
    for (const [px, py, wt] of [
      [x0, y0, (1 - ax) * (1 - ay)],
      [x1, y0, ax * (1 - ay)],
      [x0, y1, (1 - ax) * ay],
      [x1, y1, ax * ay],
    ] as const) {
      const j = py * W + px;
      if (!inside[j] || wt === 0) continue;
      out[0] += lin[j * 3]! * wt;
      out[1] += lin[j * 3 + 1]! * wt;
      out[2] += lin[j * 3 + 2]! * wt;
      wsum += wt;
    }
    return [out[0] / wsum, out[1] / wsum, out[2] / wsum];
  }

  /** Edge direction and strength at the nearest pixel; null where the image doesn't reach. Clamped to the canvas. */
  edge(x: number, y: number): ReferenceEdge | null {
    const { width: W, height: H } = this;
    const j =
      Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)));
    if (!this.inside[j]) return null;
    this.gradient ??= gradientOf(this.lightness(), W, H);
    const gx = this.gradient.gx[j]!;
    const gy = this.gradient.gy[j]!;
    // the contour runs perpendicular to the gradient; fold into (-π/2, π/2]
    let angle = Math.atan2(gy, gx) + Math.PI / 2;
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle <= -Math.PI / 2) angle += Math.PI;
    return { angle, strength: Math.hypot(gx, gy) };
  }

  /** Compare the painting's unlit color with the reference over `rect` in cells of `cell` px. */
  diff(canvas: Canvas, rect: PixelRect, cell: number): DiffResult {
    const { width: W, lin, inside } = this;
    const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
    const stride = Math.max(1, Math.floor(Math.sqrt(area / MAX_DIFF_SAMPLES)));
    const cols = Math.ceil((rect.x1 - rect.x0) / cell);
    const rows = Math.ceil((rect.y1 - rect.y0) / cell);
    const sum = new Float64Array(cols * rows);
    const cnt = new Uint32Array(cols * rows);
    const R = new Float32Array(NB);
    let total = 0;
    let samples = 0;
    for (let y = rect.y0; y < rect.y1; y += stride)
      for (let x = rect.x0; x < rect.x1; x += stride) {
        const i = y * W + x;
        if (!inside[i]) continue;
        const [r, g, b] = spectrumToLinearRgb(canvas.reflectanceAt(i, R));
        const d = oklabDistance(
          linearRgbToOklab(clamp01(r), clamp01(g), clamp01(b)),
          linearRgbToOklab(lin[i * 3]!, lin[i * 3 + 1]!, lin[i * 3 + 2]!),
        );
        const c = Math.floor((y - rect.y0) / cell) * cols + Math.floor((x - rect.x0) / cell);
        sum[c]! += d;
        cnt[c]!++;
        total += d;
        samples++;
      }
    const cells: DiffCell[] = [];
    for (let c = 0; c < cols * rows; c++) {
      if (!cnt[c]) continue;
      const x = rect.x0 + (c % cols) * cell;
      const y = rect.y0 + Math.floor(c / cols) * cell;
      cells.push({
        x,
        y,
        w: Math.min(cell, rect.x1 - x),
        h: Math.min(cell, rect.y1 - y),
        distance: sum[c]! / cnt[c]!,
      });
    }
    cells.sort((a, b) => b.distance - a.distance);
    return {
      region: { x: rect.x0, y: rect.y0, w: rect.x1 - rect.x0, h: rect.y1 - rect.y0 },
      mean: samples ? total / samples : 0,
      cell,
      stride,
      samples,
      worst: cells.slice(0, 5),
    };
  }

  /** OKLab lightness per canvas pixel, 0 outside the image. */
  private lightness(): Float32Array {
    const { lin, inside } = this;
    const L = new Float32Array(this.width * this.height);
    for (let i = 0; i < L.length; i++)
      if (inside[i]) L[i] = linearRgbToOklab(lin[i * 3]!, lin[i * 3 + 1]!, lin[i * 3 + 2]!)[0];
    return L;
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** The image's rectangle on the canvas for a fit. */
function place(iw: number, ih: number, W: number, H: number, fit: ReferenceFit): Region {
  if (fit === 'stretch') return { x: 0, y: 0, w: W, h: H };
  const s = fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

/** Bilinear sample of an 8-bit image at image coordinates (u, v), in linear RGB, edges clamped. */
function bilinear(img: RgbImage, u: number, v: number, out: Float64Array) {
  const { width: w, height: h, rgb } = img;
  const cu = Math.min(w - 1, Math.max(0, u));
  const cv = Math.min(h - 1, Math.max(0, v));
  const x0 = Math.floor(cu);
  const y0 = Math.floor(cv);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const ax = cu - x0;
  const ay = cv - y0;
  const a = (y0 * w + x0) * 3;
  const b = (y0 * w + x1) * 3;
  const c = (y1 * w + x0) * 3;
  const d = (y1 * w + x1) * 3;
  for (let k = 0; k < 3; k++)
    out[k] =
      (BYTE_TO_LINEAR[rgb[a + k]!]! * (1 - ax) + BYTE_TO_LINEAR[rgb[b + k]!]! * ax) * (1 - ay) +
      (BYTE_TO_LINEAR[rgb[c + k]!]! * (1 - ax) + BYTE_TO_LINEAR[rgb[d + k]!]! * ax) * ay;
}

/** Sobel gradient (per px) of lightness after a blur of about 2 px, edges clamped. */
function gradientOf(L: Float32Array, W: number, H: number) {
  const blurred = L.slice();
  const tmp = new Float32Array(L.length);
  const r = 2;
  for (let pass = 0; pass < 3; pass++) {
    boxBlur(blurred, tmp, H, W, r, 1, W);
    boxBlur(tmp, blurred, W, H, r, W, 1);
  }
  const gx = new Float32Array(L.length);
  const gy = new Float32Array(L.length);
  const at = (x: number, y: number) =>
    blurred[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // Sobel weights sum to 8 across a 2 px baseline, so /8 gives a per-px derivative
      gx[i] =
        (at(x + 1, y - 1) +
          2 * at(x + 1, y) +
          at(x + 1, y + 1) -
          at(x - 1, y - 1) -
          2 * at(x - 1, y) -
          at(x - 1, y + 1)) /
        8;
      gy[i] =
        (at(x - 1, y + 1) +
          2 * at(x, y + 1) +
          at(x + 1, y + 1) -
          at(x - 1, y - 1) -
          2 * at(x, y - 1) -
          at(x + 1, y - 1)) /
        8;
    }
  return { gx, gy };
}

/**
 * One box-blur pass of radius r along one axis: `n` lines of `len` samples, a line
 * starting every `lineStep` and its samples `step` apart. Edges average what they reach.
 */
function boxBlur(
  src: Float32Array,
  dst: Float32Array,
  n: number,
  len: number,
  r: number,
  step: number,
  lineStep: number,
) {
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
