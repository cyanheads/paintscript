import { describe, expect, it } from 'vitest';
import { PaintscriptError } from '../../src/errors.js';
import { decodePng, encodePng } from '../../src/image/png.js';

describe('PNG', () => {
  it('round-trips an RGB image', () => {
    const rgb = Uint8Array.from({ length: 7 * 5 * 3 }, (_, i) => (i * 37) & 0xff);
    const back = decodePng(encodePng({ width: 7, height: 5, rgb }));
    expect(back.width).toBe(7);
    expect(back.height).toBe(5);
    expect(Array.from(back.rgb)).toEqual(Array.from(rgb));
  });

  it('rejects bytes that are not a PNG', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(PaintscriptError);
  });
});
