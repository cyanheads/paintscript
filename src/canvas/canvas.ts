/**
 * @fileoverview The canvas: a primed weave with a dry base (reflectance and height per
 * pixel) under one wet film (K, S, and volume per pixel). Strokes mix into the wet
 * film; `dry()` composites it into the base, fixing color and keeping relief.
 * @module canvas/canvas
 */

import { NB, RMIN } from '../color/spectrum.js';
import { layer } from '../paint/kubelka-munk.js';
import { rng } from '../random/rng.js';

/** Height added to the base per unit of dried film volume. */
export const HEIGHT_PER_VOLUME = 0.55;

/** Canvas weave. `smooth` is a gessoed panel with no weave. */
export type Texture = 'smooth' | 'fine_weave';

/** Every texture, for validation. */
export const TEXTURES: readonly Texture[] = ['smooth', 'fine_weave'];

/** An axis-aligned pixel rectangle; x1 and y1 exclusive. */
export interface PixelRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Physical state of one canvas. Pixel arrays are row-major, spectra interleaved by band. */
export class Canvas {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly texture: Texture;
  /** Ground reflectance spectrum. */
  readonly ground: Float32Array;
  /** Dry reflectance per pixel and band. */
  readonly baseR: Float32Array;
  /** Dry surface height per pixel (weave plus dried paint). */
  readonly baseH: Float32Array;
  /** Weave height per pixel. */
  readonly weave: Float32Array;
  /** Wet film absorption per unit volume, per pixel and band. */
  readonly K: Float32Array;
  /** Wet film scattering per unit volume, per pixel and band. */
  readonly S: Float32Array;
  /** Wet film volume per pixel; 0 is dry. */
  readonly V: Float32Array;
  /** Strokes laid on this canvas, the counter that seeds each stroke's randomness. */
  strokeTotal = 0;

  constructor(width: number, height: number, ground: Float32Array, seed: number, texture: Texture) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.texture = texture;
    this.ground = ground;
    const n = width * height;
    this.baseR = new Float32Array(n * NB);
    this.baseH = new Float32Array(n);
    this.weave = new Float32Array(n);
    this.K = new Float32Array(n * NB);
    this.S = new Float32Array(n * NB);
    this.V = new Float32Array(n);
    const weaveAmp = texture === 'smooth' ? 0 : 1;
    const r = rng(seed);
    const T = 6;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        this.baseR.set(ground, i * NB);
        const u = (x % T) / T;
        const v = (y % T) / T;
        const par = (Math.floor(x / T) + Math.floor(y / T)) & 1;
        const warp = Math.sin(Math.PI * u);
        const weft = Math.sin(Math.PI * v);
        const h =
          ((par ? warp * 0.75 + weft * 0.25 : weft * 0.75 + warp * 0.25) * 0.1 + r() * 0.02) *
          weaveAmp;
        this.weave[i] = h;
        this.baseH[i] = h;
      }
  }

  /** Seed for the next stroke's randomness; advances the stroke counter. */
  nextStrokeSeed(): number {
    return (this.seed * 7919 + ++this.strokeTotal * 104729) >>> 0;
  }

  /** Pixel index of a canvas coordinate, clamped to the canvas. */
  indexAt(x: number, y: number): number {
    const px = Math.min(this.width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(this.height - 1, Math.max(0, Math.round(y)));
    return py * this.width + px;
  }

  /** Composite every wet pixel in `rect` (default: the whole canvas) into the dry base. */
  dry(rect?: PixelRect): void {
    const { K, S, V, baseR, baseH, width } = this;
    const x0 = rect?.x0 ?? 0;
    const y0 = rect?.y0 ?? 0;
    const x1 = rect?.x1 ?? width;
    const y1 = rect?.y1 ?? this.height;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * width + x;
        const v = V[i]!;
        if (v <= 0) continue;
        const io = i * NB;
        for (let b = 0; b < NB; b++)
          baseR[io + b] = Math.max(RMIN, layer(K[io + b]!, S[io + b]!, v, baseR[io + b]!));
        baseH[i]! += v * HEIGHT_PER_VOLUME;
        V[i] = 0;
      }
  }

  /** Reflectance at pixel i (wet film over the dry base, no relief lighting) into `out`. */
  reflectanceAt(i: number, out: Float32Array): Float32Array {
    const io = i * NB;
    const v = this.V[i]!;
    for (let k = 0; k < NB; k++)
      out[k] =
        v > 0
          ? layer(this.K[io + k]!, this.S[io + k]!, v, this.baseR[io + k]!)
          : this.baseR[io + k]!;
    return out;
  }

  /** Surface height at pixel (x, y), clamped to the canvas: thick paint levels the weave beneath it. */
  surfaceHeight(x: number, y: number): number {
    const { width, height, baseH, weave, V } = this;
    const i = Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x));
    const paint = baseH[i]! - weave[i]! + V[i]! * HEIGHT_PER_VOLUME;
    return weave[i]! * Math.max(0.2, Math.exp(-paint * 2.2)) + paint;
  }

  /** Share of pixels holding more than a trace of wet paint. */
  wetShare(): number {
    let n = 0;
    for (let i = 0; i < this.V.length; i++) if (this.V[i]! > 0.01) n++;
    return n / this.V.length;
  }
}
