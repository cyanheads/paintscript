/**
 * @fileoverview Color values crossing the engine boundary: what a caller may pass
 * (hex, float sRGB, OKLab, or a spectrum the engine handed back) and how the engine
 * reports a color (hex, float sRGB, OKLab, and the 8 bands that carry it exactly).
 * @module color/color
 */

import { PaintscriptError } from '../errors.js';
import { linearRgbToOklab, oklabToLinearRgb } from './oklab.js';
import {
  bytesToSpectrum,
  linearRgbToSpectrum,
  NB,
  parseHex,
  RMAX,
  RMIN,
  spectrumToHex,
  spectrumToLinearRgb,
} from './spectrum.js';
import { toLinear, toSrgb } from './srgb.js';

/** Encoded sRGB, each channel 0–1 at full float precision. */
export interface RgbColor {
  b: number;
  g: number;
  r: number;
}

/** OKLab: `l` lightness 0–1, `a` green→red, `b` blue→yellow. */
export interface OklabColor {
  a: number;
  b: number;
  l: number;
}

/** A color as the engine reports it. `bands` is the reflectance spectrum the paint carries. */
export interface Color {
  bands: number[];
  hex: string;
  oklab: OklabColor;
  rgb: RgbColor;
}

/** Anything a color argument accepts. A `Color` the engine returned passes its exact spectrum. */
export type ColorInput = string | RgbColor | OklabColor | { bands: ArrayLike<number> };

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Parse a color argument into a reflectance spectrum; throws `invalid_color` naming
 * `label` (the argument, e.g. "stroke(): color") and the accepted forms.
 */
export function toSpectrum(input: unknown, label = 'color'): Float32Array {
  if (typeof input === 'string') {
    const bytes = parseHex(input);
    if (bytes) return bytesToSpectrum(bytes[0], bytes[1], bytes[2]);
    throw invalidColor(label, `"${input.slice(0, 40)}" is not a hex color`);
  }
  if (typeof input === 'object' && input !== null) {
    const o = input as Record<string, unknown>;
    if ('bands' in o) {
      const bands = o.bands as ArrayLike<unknown> | undefined;
      if (bands && typeof bands === 'object' && bands.length === NB) {
        const out = new Float32Array(NB);
        for (let i = 0; i < NB; i++) {
          const v = bands[i];
          if (!finite(v)) throw invalidColor(label, 'bands must be 8 finite numbers');
          out[i] = Math.min(RMAX, Math.max(RMIN, v));
        }
        return out;
      }
      throw invalidColor(label, 'bands must be 8 finite numbers');
    }
    if (finite(o.r) && finite(o.g) && finite(o.b)) {
      return linearRgbToSpectrum(toLinear(o.r), toLinear(o.g), toLinear(o.b));
    }
    if (finite(o.l) && finite(o.a) && finite(o.b)) {
      const [r, g, b] = oklabToLinearRgb(o.l, o.a, o.b);
      return linearRgbToSpectrum(r, g, b);
    }
  }
  throw invalidColor(label, 'unrecognized color');
}

function invalidColor(label: string, why: string): PaintscriptError {
  return new PaintscriptError(
    'invalid_color',
    `${label}: ${why}. A color is "#rrggbb", { r, g, b } (sRGB 0–1), { l, a, b } (OKLab), or a color returned by mix(), palette(), at(), or ref.at().`,
  );
}

/** Report a spectrum as a `Color`: its hex, float sRGB, and OKLab are clamped to the sRGB gamut. */
export function describeSpectrum(R: ArrayLike<number>): Color {
  const [lr, lg, lb] = spectrumToLinearRgb(R);
  const cr = Math.min(1, Math.max(0, lr));
  const cg = Math.min(1, Math.max(0, lg));
  const cb = Math.min(1, Math.max(0, lb));
  const [l, a, b] = linearRgbToOklab(cr, cg, cb);
  return {
    hex: spectrumToHex(R),
    rgb: { r: toSrgb(cr), g: toSrgb(cg), b: toSrgb(cb) },
    oklab: { l, a, b },
    bands: Array.from(R, (v) => v),
  };
}
