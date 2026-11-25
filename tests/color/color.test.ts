import { describe, expect, it } from 'vitest';
import { describeSpectrum, toSpectrum } from '../../src/color/color.js';
import { PaintscriptError } from '../../src/errors.js';

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const maxStep = (a: string, b: string) =>
  Math.max(...channels(a).map((c, i) => Math.abs(c - channels(b)[i]!)));

describe('toSpectrum', () => {
  it('reads every accepted form of the same color alike', () => {
    const hex = describeSpectrum(toSpectrum('#336699')).hex;
    expect(describeSpectrum(toSpectrum('#369')).hex).toBe(hex);
    expect(describeSpectrum(toSpectrum({ r: 0x33 / 255, g: 0x66 / 255, b: 0x99 / 255 })).hex).toBe(
      hex,
    );
    const { oklab } = describeSpectrum(toSpectrum('#336699'));
    expect(maxStep(hex, describeSpectrum(toSpectrum(oklab)).hex)).toBeLessThanOrEqual(1);
  });

  it('round-trips sRGB through the spectrum within a few 8-bit steps', () => {
    for (const hex of ['#336699', '#e92621', '#f2c200', '#1f2a8c', '#808080', '#b9946b']) {
      expect(maxStep(hex, describeSpectrum(toSpectrum(hex)).hex)).toBeLessThanOrEqual(4);
    }
  });

  it('passes a returned color through exactly by its bands', () => {
    const c = describeSpectrum(toSpectrum('#e92621'));
    expect(Array.from(toSpectrum(c))).toEqual(c.bands);
  });

  it('rejects what is not a color with invalid_color', () => {
    for (const bad of ['red', '#12345', { r: 1, g: 0 }, { bands: [1, 2] }, 42, null]) {
      expect(() => toSpectrum(bad)).toThrow(PaintscriptError);
      try {
        toSpectrum(bad);
      } catch (e) {
        expect((e as PaintscriptError).code).toBe('invalid_color');
      }
    }
  });
});
