/**
 * @fileoverview 8-band reflectance spectra: sRGB decomposes into seven basis spectra
 * (white, red, green, blue, cyan, magenta, yellow), and a 3×8 band→linear-sRGB matrix,
 * ridge-fitted so each basis round-trips to its target color, maps spectra back.
 * Bands run 400→700 nm in 37.5 nm steps.
 * @module color/spectrum
 */

import { linearToByte, toLinear } from './srgb.js';

/** Number of spectral bands. */
export const NB = 8;
/** Floor for reflectance, so K/S stays finite. */
export const RMIN = 0.002;
/** Ceiling for reflectance below a perfect diffuser. */
export const RMAX = 0.998;

function lobe(l: number, mu: number, s1: number, s2: number): number {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}

/** CIE 1931 2° color-matching functions, Wyman–Sloan–Shirley multi-lobe fit. */
function cmf(l: number): [number, number, number] {
  return [
    1.056 * lobe(l, 599.8, 37.9, 31.0) +
      0.362 * lobe(l, 442.0, 16.0, 26.7) -
      0.065 * lobe(l, 501.1, 20.4, 26.2),
    0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1),
    1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8),
  ];
}

const XYZ_TO_RGB = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.204, 1.057],
];

type BasisName = 'W' | 'R' | 'G' | 'B' | 'C' | 'M' | 'Y';

/** Basis reflectance spectra. */
const BASIS: Record<BasisName, readonly number[]> = {
  W: [1, 1, 1, 1, 1, 1, 1, 1],
  R: [0.03, 0.01, 0.01, 0.01, 0.03, 0.6, 1, 1],
  G: [0.02, 0.05, 0.55, 1, 0.9, 0.25, 0.03, 0.02],
  B: [0.95, 1, 0.75, 0.15, 0.02, 0.01, 0.01, 0.02],
  C: [0.95, 1, 1, 0.95, 0.6, 0.08, 0.02, 0.02],
  M: [0.9, 0.95, 0.4, 0.05, 0.05, 0.55, 1, 1],
  Y: [0.02, 0.05, 0.45, 0.95, 1, 1, 1, 1],
};
const TARGET: Record<BasisName, readonly number[]> = {
  W: [1, 1, 1],
  R: [1, 0, 0],
  G: [0, 1, 0],
  B: [0, 0, 1],
  C: [0, 1, 1],
  M: [1, 0, 1],
  Y: [1, 1, 0],
};
const BASIS_NAMES = Object.keys(BASIS) as BasisName[];

/** Gauss–Jordan solve of A·x = b with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const m = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    [m[c], m[piv]] = [m[piv]!, m[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** 3×8 band→linear-sRGB matrix: CMF prior, ridge-fitted so the 7 bases round-trip. */
function buildMatrix(): number[][] {
  const xb = [new Array(NB).fill(0), new Array(NB).fill(0), new Array(NB).fill(0)];
  for (let b = 0; b < NB; b++)
    for (let l = 400 + b * 37.5; l < 400 + (b + 1) * 37.5; l += 0.5) {
      const c = cmf(l);
      for (let k = 0; k < 3; k++) xb[k]![b] += c[k]! * 0.5;
    }
  const m0 = XYZ_TO_RGB.map((row) =>
    Array.from(
      { length: NB },
      (_, b) => row[0]! * xb[0]![b] + row[1]! * xb[1]![b] + row[2]! * xb[2]![b],
    ),
  );
  for (const row of m0) {
    const s = row.reduce((a, v) => a + v, 0);
    for (let b = 0; b < NB; b++) row[b]! /= s;
  }
  const lam = 1e-3;
  return m0.map((m0r, r) => {
    const A = Array.from({ length: NB }, (_, i) =>
      Array.from(
        { length: NB },
        (_, j) =>
          BASIS_NAMES.reduce((a, k) => a + BASIS[k][i]! * BASIS[k][j]!, 0) + (i === j ? lam : 0),
      ),
    );
    const rhs = Array.from(
      { length: NB },
      (_, i) => BASIS_NAMES.reduce((a, k) => a + BASIS[k][i]! * TARGET[k][r]!, 0) + lam * m0r[i]!,
    );
    return solve(A, rhs);
  });
}

const SPEC_TO_RGB = buildMatrix();
/** Band→linear-red row of the fitted matrix. */
export const M_R = Float32Array.from(SPEC_TO_RGB[0]!);
/** Band→linear-green row of the fitted matrix. */
export const M_G = Float32Array.from(SPEC_TO_RGB[1]!);
/** Band→linear-blue row of the fitted matrix. */
export const M_B = Float32Array.from(SPEC_TO_RGB[2]!);

/**
 * Linear sRGB (each 0–1) to a reflectance spectrum: white, then the secondary and
 * primary bases. Out-of-range input is clamped per channel first.
 */
export function linearRgbToSpectrum(
  rIn: number,
  gIn: number,
  bIn: number,
  out: Float32Array = new Float32Array(NB),
): Float32Array {
  let r = Math.min(1, Math.max(0, rIn));
  let g = Math.min(1, Math.max(0, gIn));
  let b = Math.min(1, Math.max(0, bIn));
  const w = Math.min(r, g, b);
  r -= w;
  g -= w;
  b -= w;
  const c = Math.min(g, b);
  const m = Math.min(r, b);
  const y = Math.min(r, g);
  const rr = Math.max(0, Math.min(r - b, r - g));
  const gg = Math.max(0, Math.min(g - b, g - r));
  const bb = Math.max(0, Math.min(b - g, b - r));
  for (let i = 0; i < NB; i++) {
    const v =
      w * BASIS.W[i]! +
      c * BASIS.C[i]! +
      m * BASIS.M[i]! +
      y * BASIS.Y[i]! +
      rr * BASIS.R[i]! +
      gg * BASIS.G[i]! +
      bb * BASIS.B[i]!;
    out[i] = Math.min(RMAX, Math.max(RMIN, v));
  }
  return out;
}

/** Reflectance spectrum to linear sRGB (unclamped). */
export function spectrumToLinearRgb(R: ArrayLike<number>): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < NB; i++) {
    r += M_R[i]! * R[i]!;
    g += M_G[i]! * R[i]!;
    b += M_B[i]! * R[i]!;
  }
  return [r, g, b];
}

/** `#rrggbb` (or `#rgb`) to its 8-bit channels; undefined when the string is not a hex color. */
export function parseHex(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  const h = m?.[1];
  if (h === undefined) return undefined;
  const full = h.length === 3 ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** 8-bit sRGB channels to a reflectance spectrum. */
export function bytesToSpectrum(r: number, g: number, b: number): Float32Array {
  return linearRgbToSpectrum(toLinear(r / 255), toLinear(g / 255), toLinear(b / 255));
}

/** Reflectance spectrum to `#rrggbb`. */
export function spectrumToHex(R: ArrayLike<number>): string {
  const [r, g, b] = spectrumToLinearRgb(R);
  const e = (v: number) => linearToByte(v).toString(16).padStart(2, '0');
  return `#${e(r)}${e(g)}${e(b)}`;
}
