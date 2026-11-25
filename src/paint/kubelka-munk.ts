/**
 * @fileoverview Kubelka–Munk paint: absorption K and scattering S per unit thickness
 * for a reflectance spectrum painted as a given kind, mixing by volume, and the
 * reflectance of a film of thickness X over a substrate.
 * @module paint/kubelka-munk
 */

import { NB, RMAX, RMIN } from '../color/spectrum.js';

/** How a paint covers: `opaque` hides in one full pass; `glaze` is a transparent filter; `medium` is clear. */
export type PaintKind = 'opaque' | 'semi_opaque' | 'transparent' | 'glaze' | 'medium';

/** Every paint kind, for validation. */
export const PAINT_KINDS: readonly PaintKind[] = [
  'opaque',
  'semi_opaque',
  'transparent',
  'glaze',
  'medium',
];

/**
 * Pigment density per unit volume. Opaque paint is dense enough that one full-load pass
 * hides the ground; semi-opaque lets some through; transparent paint is mostly filter.
 * Mixing ratios don't depend on these: K and S scale together within a kind.
 */
const DENSITY = { opaque: 120, semi_opaque: 24, transparent: 4 } as const;

/** K/S of an infinitely thick layer with reflectance R. */
function ksOf(R: number): number {
  return ((1 - R) * (1 - R)) / (2 * R);
}

/** Reflectance of an infinitely thick layer with ratio K/S = q. */
export function reflectanceOfKs(q: number): number {
  return Math.max(RMIN, 1 + q - Math.sqrt(q * q + 2 * q));
}

/**
 * Write K and S per unit thickness for spectrum R painted as `kind` into K and S at
 * offset o. S is flat across bands, set from the paint's mean K/S so that K + S ≈ c on
 * average, and K keeps the per-band K/S shape: per-band K + S = c compresses a dark
 * pigment's absorption contrast and turns blue + yellow olive grey.
 */
export function paintOf(
  R: ArrayLike<number>,
  kind: PaintKind,
  K: Float32Array,
  S: Float32Array,
  o = 0,
): void {
  let meanKs = 0;
  for (let b = 0; b < NB; b++) meanKs += ksOf(Math.min(RMAX, Math.max(RMIN, R[b]!))) / NB;
  for (let b = 0; b < NB; b++) {
    const r = Math.min(RMAX, Math.max(RMIN, R[b]!));
    const ks = ksOf(r);
    if (kind === 'medium') {
      K[o + b] = 0;
      S[o + b] = 0;
      continue;
    }
    const kGlaze = -Math.log(r) / 1.6;
    if (kind === 'glaze') {
      K[o + b] = kGlaze;
      S[o + b] = 0.002;
      continue;
    }
    const s = DENSITY[kind] / (1 + meanKs);
    const k = ks * s;
    if (kind === 'transparent') {
      K[o + b] = 0.5 * (k + kGlaze);
      S[o + b] = 0.35 * s;
    } else {
      K[o + b] = k;
      S[o + b] = s;
    }
  }
}

/** Reflectance of a film (K, S per unit thickness, thickness X) over a substrate of reflectance Rg. */
export function layer(K: number, S: number, X: number, Rg: number): number {
  if (S < 1e-3) return Rg * Math.exp(-2 * K * X);
  const a = 1 + K / S;
  const b = Math.sqrt(a * a - 1);
  const bsx = b * S * X;
  const ct = bsx > 15 ? 1 : 1 / Math.tanh(Math.max(1e-6, bsx));
  return (1 - Rg * (a - b * ct)) / (a - Rg + b * ct);
}
