/**
 * @fileoverview Seeded pseudo-random numbers (mulberry32): every random choice the
 * engine makes comes from one of these, so a painting replays exactly.
 * @module random/rng
 */

/** A generator of uniform floats in [0, 1). */
export type Rng = () => number;

/** mulberry32 seeded with the low 32 bits of `seed`. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
