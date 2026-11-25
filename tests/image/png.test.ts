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

  /** A PNG with its header's width and height (bytes 16–23) overwritten. */
  function withSize(png: Uint8Array, width: number, height: number): Uint8Array {
    const out = png.slice();
    const dv = new DataView(out.buffer);
    dv.setUint32(16, width);
    dv.setUint32(20, height);
    return out;
  }

  it('refuses an image larger than it reads', () => {
    const png = encodePng({ width: 2, height: 2, rgb: new Uint8Array(12) });
    expect(() => decodePng(withSize(png, 9000, 9000))).toThrow(
      expect.objectContaining({
        code: 'invalid_image',
        message: expect.stringMatching(/9000×9000 px, and at most 67108864 px/),
      }),
    );
  });

  it('never inflates past what the header describes', () => {
    const png = encodePng({ width: 400, height: 400, rgb: new Uint8Array(400 * 400 * 3) });
    expect(() => decodePng(withSize(png, 2, 2))).toThrow(
      expect.objectContaining({ code: 'invalid_image' }),
    );
  });
});
