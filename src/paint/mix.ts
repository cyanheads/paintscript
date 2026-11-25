/**
 * @fileoverview Kubelka–Munk mixing of paints by parts, the way a palette knife mixes
 * them: K and S of each paint, painted opaque, summed by volume.
 * @module paint/mix
 */

import { NB } from '../color/spectrum.js';
import { paintOf, reflectanceOfKs } from './kubelka-munk.js';

/** Mix reflectance spectra by parts; returns the mixture's reflectance spectrum. Parts must be > 0. */
export function mixSpectra(parts: readonly (readonly [Float32Array, number])[]): Float32Array {
  const K = new Float32Array(NB);
  const S = new Float32Array(NB);
  const k1 = new Float32Array(NB);
  const s1 = new Float32Array(NB);
  for (const [R, p] of parts) {
    paintOf(R, 'opaque', k1, s1);
    for (let b = 0; b < NB; b++) {
      K[b]! += k1[b]! * p;
      S[b]! += s1[b]! * p;
    }
  }
  const out = new Float32Array(NB);
  for (let b = 0; b < NB; b++) out[b] = reflectanceOfKs(K[b]! / S[b]!);
  return out;
}
