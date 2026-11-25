import { describe, expect, it } from 'vitest';
import { layStroke } from '../../src/brush/lay-stroke.js';
import { Canvas } from '../../src/canvas/canvas.js';
import { toSpectrum } from '../../src/color/color.js';

const fresh = (seed = 3) => new Canvas(120, 60, toSpectrum('#8a8580'), seed, 'fine_weave');
const red = toSpectrum('#e92621');

describe('layStroke', () => {
  it('lays wet paint along its path and nowhere far from it', () => {
    const c = fresh();
    layStroke(c, {
      path: [
        [10, 30],
        [110, 30],
      ],
      brush: { type: 'flat', width: 12 },
      color: red,
    });
    expect(c.V[30 * 120 + 60]!).toBeGreaterThan(0);
    for (let x = 0; x < 120; x++) {
      expect(c.V[2 * 120 + x]).toBe(0);
      expect(c.V[57 * 120 + x]).toBe(0);
    }
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = fresh(3);
    const b = fresh(3);
    const d = fresh(4);
    for (const c of [a, b, d])
      layStroke(c, {
        path: [
          [10, 20],
          [60, 40],
          [110, 25],
        ],
        brush: { type: 'round', width: 9 },
        color: red,
      });
    expect(Buffer.from(a.V.buffer).equals(Buffer.from(b.V.buffer))).toBe(true);
    expect(Buffer.from(a.V.buffer).equals(Buffer.from(d.V.buffer))).toBe(false);
  });

  it('dry() moves wet paint into the base', () => {
    const c = fresh();
    layStroke(c, {
      path: [
        [10, 30],
        [110, 30],
      ],
      brush: { type: 'flat', width: 12 },
      color: red,
    });
    const i = 30 * 120 + 60;
    const before = c.baseR[i * 8 + 7]!;
    c.dry();
    expect(c.V[i]).toBe(0);
    expect(c.baseR[i * 8 + 7]).not.toBe(before);
    expect(c.baseH[i]!).toBeGreaterThan(c.weave[i]!);
  });
});
