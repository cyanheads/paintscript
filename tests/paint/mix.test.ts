import { describe, expect, it } from 'vitest';
import { describeSpectrum, toSpectrum } from '../../src/color/color.js';
import { mixSpectra } from '../../src/paint/mix.js';

const mix = (...parts: [string, number][]) =>
  describeSpectrum(mixSpectra(parts.map(([h, p]) => [toSpectrum(h), p] as const)));

describe('mixSpectra', () => {
  it('mixes ultramarine and cadmium yellow to a green, as pigments do', () => {
    const { oklab, rgb } = mix(['#1f2a8c', 1], ['#f2c200', 1]);
    expect(oklab.a).toBeLessThan(-0.03);
    expect(rgb.g).toBeGreaterThan(rgb.r);
    expect(rgb.g).toBeGreaterThan(rgb.b);
  });

  it('mixes black and white 1:1 to a mid grey, not near-black', () => {
    const { oklab } = mix(['#111111', 1], ['#ffffff', 1]);
    expect(oklab.l).toBeGreaterThan(0.4);
    expect(oklab.l).toBeLessThan(0.75);
    expect(Math.hypot(oklab.a, oklab.b)).toBeLessThan(0.02);
  });

  it('weights by parts: more white is lighter', () => {
    const l1 = mix(['#1f2a8c', 1], ['#ffffff', 1]).oklab.l;
    const l3 = mix(['#1f2a8c', 1], ['#ffffff', 3]).oklab.l;
    expect(l3).toBeGreaterThan(l1);
  });
});
