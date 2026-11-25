/**
 * @fileoverview Seeded pseudo-random numbers (mulberry32): every random choice the
 * engine makes comes from one of these, so a painting replays exactly.
 * @module random/rng
 */

/** A generator of uniform floats in [0, 1). */
export type Rng = () => number;

/** A 32-bit seed derived from two integers (murmur3 finalizer), for independent streams per purpose. */
export function hashSeed(a: number, b: number): number {
  let h = (a ^ Math.imul((b >>> 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

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
