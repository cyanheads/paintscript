/**
 * @fileoverview Rendering the canvas to 8-bit sRGB: paint color lit as relief from the
 * upper left with a faint sheen, either box-averaged at an integer step (full quality)
 * or point-sampled 2×2 per output pixel at any width (fast preview).
 * @module render/render
 */

import type { Canvas } from '../canvas/canvas.js';
import { M_B, M_G, M_R, NB } from '../color/spectrum.js';
import { linearToByte } from '../color/srgb.js';
import { layer } from '../paint/kubelka-munk.js';

/** What a render shows: the painting, or its relief alone in grey. */
export type RenderMode = 'color' | 'relief';

/** The finish the painting is seen under: no sheen, the default soft sheen, or gloss varnish. */
export type Surface = 'matte' | 'satin' | 'varnish';

/** Every surface, for validation. */
export const SURFACES: readonly Surface[] = ['matte', 'satin', 'varnish'];

/** An 8-bit RGB image, rows top to bottom, 3 bytes per pixel. */
export interface RgbImage {
  height: number;
  rgb: Uint8Array;
  width: number;
}

/** Relief light: from the upper left, Blinn half-vector for the sheen. */
const LIGHT = (() => {
  const Lx = -0.5;
  const Ly = -0.62;
  const Lz = 0.6;
  const ln = Math.hypot(Lx, Ly, Lz);
  const lx = Lx / ln;
  const ly = Ly / ln;
  const lz = Lz / ln;
  const hx = lx;
  const hy = ly;
  const hz = lz + 1;
  const hn = Math.hypot(hx, hy, hz);
  const Hz = hz / hn;
  return { lx, ly, lz, Hx: hx / hn, Hy: hy / hn, Hz, sp0: Hz ** 30 };
})();

/** Sheen strength on paint color per surface. */
const SHEEN: Record<Surface, number> = { matte: 0, satin: 0.1, varnish: 0.3 };

/** Lit linear RGB of one canvas pixel (paint color, relief shading, sheen) into `out`. */
export function shadePixel(
  c: Canvas,
  x: number,
  y: number,
  mode: RenderMode,
  surface: Surface,
  out: Float64Array,
): void {
  const { width, K, S, V, baseR } = c;
  const { lx, ly, lz, Hx, Hy, Hz, sp0 } = LIGHT;
  const i = y * width + x;
  const io = i * NB;
  const v = V[i]!;
  let r = 0;
  let g = 0;
  let b = 0;
  if (mode === 'color') {
    for (let k = 0; k < NB; k++) {
      const R = v > 0 ? layer(K[io + k]!, S[io + k]!, v, baseR[io + k]!) : baseR[io + k]!;
      r += M_R[k]! * R;
      g += M_G[k]! * R;
      b += M_B[k]! * R;
    }
    if (surface === 'varnish') {
      // varnish cuts surface scatter: darks deepen and colors saturate a little
      r = Math.max(0, r) ** 1.08;
      g = Math.max(0, g) ** 1.08;
      b = Math.max(0, b) ** 1.08;
    }
  } else {
    r = g = b = 0.42;
  }
  const gx = (c.surfaceHeight(x + 1, y) - c.surfaceHeight(x - 1, y)) * 1.1;
  const gy = (c.surfaceHeight(x, y + 1) - c.surfaceHeight(x, y - 1)) * 1.1;
  const nn = Math.hypot(gx, gy, 1);
  const nX = -gx / nn;
  const nY = -gy / nn;
  const nZ = 1 / nn;
  const diff = nX * lx + nY * ly + nZ * lz;
  const shade = Math.min(1.35, Math.max(0.65, 1 + 0.9 * (diff - lz)));
  const sp =
    Math.max(0, Math.max(0, nX * Hx + nY * Hy + nZ * Hz) ** 30 - sp0) *
    (mode === 'color' ? SHEEN[surface] : 0.5);
  out[0] = Math.max(0, r) * shade + sp;
  out[1] = Math.max(0, g) * shade + sp;
  out[2] = Math.max(0, b) * shade + sp;
}

/** Options for a full-quality render. */
export interface RenderOptions {
  mode?: RenderMode;
  /** Integer box-downscale step. Default 1. */
  step?: number;
  surface?: Surface;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
}

/** Render a region to 8-bit RGB, box-downscaled by an integer step. */
export function render(c: Canvas, opts: RenderOptions = {}): RgbImage {
  const x0 = opts.x0 ?? 0;
  const y0 = opts.y0 ?? 0;
  const x1 = opts.x1 ?? c.width;
  const y1 = opts.y1 ?? c.height;
  const st = opts.step ?? 1;
  const mode = opts.mode ?? 'color';
  const surface = opts.surface ?? 'satin';
  const ow = Math.floor((x1 - x0) / st);
  const oh = Math.floor((y1 - y0) / st);
  const rgb = new Uint8Array(ow * oh * 3);
  const px = new Float64Array(3);
  for (let oy = 0; oy < oh; oy++)
    for (let ox = 0; ox < ow; ox++) {
      let ar = 0;
      let ag = 0;
      let ab = 0;
      for (let sy = 0; sy < st; sy++)
        for (let sx = 0; sx < st; sx++) {
          shadePixel(c, x0 + ox * st + sx, y0 + oy * st + sy, mode, surface, px);
          ar += px[0]!;
          ag += px[1]!;
          ab += px[2]!;
        }
      const n = st * st;
      const o = (oy * ow + ox) * 3;
      rgb[o] = linearToByte(ar / n);
      rgb[o + 1] = linearToByte(ag / n);
      rgb[o + 2] = linearToByte(ab / n);
    }
  return { width: ow, height: oh, rgb };
}

/** Output size of a `renderFit` at `width`: the canvas aspect kept, never wider than the canvas. */
export function fitSize(c: Canvas, width: number): { height: number; width: number } {
  const ow = Math.max(1, Math.min(c.width, Math.round(width)));
  return { width: ow, height: Math.max(1, Math.round((c.height * ow) / c.width)) };
}

/**
 * Fast preview of the whole canvas at any width: 2×2 point samples per output pixel
 * instead of `render`'s full box average, so its cost follows the output size.
 */
export function renderFit(c: Canvas, width: number): RgbImage {
  const { width: ow, height: oh } = fitSize(c, width);
  const rgb = new Uint8Array(ow * oh * 3);
  fitRegion(c, rgb, ow, oh, 0, 0, c.width, c.height);
  return { width: ow, height: oh, rgb };
}

/** Re-render into a `renderFit` image only the output pixels that sample canvas region [x0, x1) × [y0, y1). */
export function fitRegion(
  c: Canvas,
  rgb: Uint8Array,
  ow: number,
  oh: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const { width: W, height: H } = c;
  const fx = W / ow;
  const fy = H / oh;
  const px = new Float64Array(3);
  const ox0 = Math.max(0, Math.floor(x0 / fx) - 1);
  const ox1 = Math.min(ow, Math.ceil(x1 / fx) + 1);
  const oy0 = Math.max(0, Math.floor(y0 / fy) - 1);
  const oy1 = Math.min(oh, Math.ceil(y1 / fy) + 1);
  for (let oy = oy0; oy < oy1; oy++)
    for (let ox = ox0; ox < ox1; ox++) {
      let ar = 0;
      let ag = 0;
      let ab = 0;
      for (let s = 0; s < 4; s++) {
        const x = Math.min(W - 1, Math.floor((ox + (s & 1 ? 0.75 : 0.25)) * fx));
        const y = Math.min(H - 1, Math.floor((oy + (s & 2 ? 0.75 : 0.25)) * fy));
        shadePixel(c, x, y, 'color', 'satin', px);
        ar += px[0]!;
        ag += px[1]!;
        ab += px[2]!;
      }
      const o = (oy * ow + ox) * 3;
      rgb[o] = linearToByte(ar / 4);
      rgb[o + 1] = linearToByte(ag / 4);
      rgb[o + 2] = linearToByte(ab / 4);
    }
}
