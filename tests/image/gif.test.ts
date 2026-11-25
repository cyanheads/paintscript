import { describe, expect, it } from 'vitest';
import { encodeGif } from '../../src/image/gif.js';

describe('encodeGif', () => {
  it('writes a looping GIF89a and merges identical consecutive frames', () => {
    const a = new Uint8Array(16 * 8 * 3).fill(40);
    const b = a.slice();
    b.fill(220, 0, 8 * 3);
    const gif = encodeGif(16, 8, [a, a, b], [10, 10, 10]);
    expect(String.fromCharCode(...gif.bytes.subarray(0, 6))).toBe('GIF89a');
    expect(gif.bytes[gif.bytes.length - 1]).toBe(0x3b);
    expect(new TextDecoder().decode(gif.bytes).includes('NETSCAPE2.0')).toBe(true);
    expect(gif.frames).toBe(2);
  });
});
