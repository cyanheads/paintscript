import { describe, expect, it } from 'vitest';
import type { StrokeSpec } from '../../src/brush/brush.js';
import { layStroke } from '../../src/brush/lay-stroke.js';
import { Canvas, type PixelRect, type Texture } from '../../src/canvas/canvas.js';
import { describeSpectrum, toSpectrum } from '../../src/color/color.js';
import { NB } from '../../src/color/spectrum.js';

const W = 200;
const H = 100;
const fresh = (seed = 3, texture: Texture = 'fine_weave', ground = '#808080') =>
  new Canvas(W, H, toSpectrum(ground), seed, texture);
const red = toSpectrum('#e92621');
const white = toSpectrum('#f4f1e8');

/**
 * OKLab distance from a color to the mean color of the painted pixels in a rectangle
 * (the mean, so per-bristle tint variation cancels and only show-through remains).
 */
function distanceTo(
  c: Canvas,
  color: Float32Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const target = describeSpectrum(color).oklab;
  const R = new Float32Array(NB);
  const sum = { l: 0, a: 0, b: 0 };
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (c.V[y * W + x]! < 0.05) continue;
      const { oklab } = describeSpectrum(c.reflectanceAt(y * W + x, R));
      sum.l += oklab.l;
      sum.a += oklab.a;
      sum.b += oklab.b;
      n++;
    }
  return Math.hypot(sum.l / n - target.l, sum.a / n - target.a, sum.b / n - target.b);
}

const painted = (c: Canvas, x: number, y: number) => c.V[y * W + x]! > 0.004;

describe('layStroke', () => {
  it('lays wet paint along its path and nowhere far from it', () => {
    const c = fresh();
    layStroke(c, {
      path: [
        [10, 50],
        [190, 50],
      ],
      brush: { type: 'flat', width: 12 },
      color: red,
    });
    expect(c.V[50 * W + 100]!).toBeGreaterThan(0);
    for (let x = 0; x < W; x++) {
      expect(c.V[30 * W + x]).toBe(0);
      expect(c.V[70 * W + x]).toBe(0);
    }
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = fresh(3);
    const b = fresh(3);
    const d = fresh(4);
    const st: StrokeSpec = {
      path: [
        [10, 30],
        [100, 60],
        [190, 35],
      ],
      brush: { type: 'round', width: 9 },
      color: red,
    };
    for (const c of [a, b, d]) layStroke(c, st);
    expect(Buffer.from(a.V.buffer).equals(Buffer.from(b.V.buffer))).toBe(true);
    expect(Buffer.from(a.V.buffer).equals(Buffer.from(d.V.buffer))).toBe(false);
  });

  it('hides the ground in one full-load opaque pass; semi-opaque and glaze let it through', () => {
    const hide = (paint: StrokeSpec['paint']) => {
      const c = fresh();
      layStroke(c, {
        path: [
          [10, 50],
          [190, 50],
        ],
        brush: { type: 'flat', width: 30 },
        color: red,
        load: 1,
        ...(paint ? { paint } : {}),
      });
      return distanceTo(c, red, 80, 45, 120, 55);
    };
    expect(hide('opaque')).toBeLessThan(0.01);
    expect(hide('semi_opaque')).toBeGreaterThan(0.03);
    expect(hide('glaze')).toBeGreaterThan(0.1);
  });

  it('dry() moves wet paint into the base', () => {
    const c = fresh();
    layStroke(c, {
      path: [
        [10, 50],
        [190, 50],
      ],
      brush: { type: 'flat', width: 12 },
      color: red,
    });
    const i = 50 * W + 100;
    const before = c.baseR[i * NB + 7]!;
    c.dry();
    expect(c.V[i]).toBe(0);
    expect(c.baseR[i * NB + 7]).not.toBe(before);
    expect(c.baseH[i]!).toBeGreaterThan(c.weave[i]!);
  });

  it('holds a thin line without dashes', () => {
    for (const width of [2, 3, 4]) {
      const c = fresh();
      layStroke(c, {
        path: [
          [20, 20],
          [180, 70],
        ],
        brush: { type: 'round', width },
        color: red,
      });
      for (let x = 30; x <= 170; x++) {
        const y = Math.round(20 + ((x - 20) * 50) / 160);
        expect(painted(c, x, y - 1) || painted(c, x, y) || painted(c, x, y + 1)).toBe(true);
      }
    }
  });

  it('thins a round brush to a point with end: "taper"', () => {
    const c = fresh();
    layStroke(c, {
      path: [
        [20, 50],
        [180, 50],
      ],
      brush: { type: 'round', width: 20 },
      color: red,
      end: 'taper',
    });
    const across = (x: number) => {
      let n = 0;
      for (let y = 30; y < 70; y++) if (painted(c, x, y)) n++;
      return n;
    };
    expect(across(100)).toBeGreaterThan(12);
    expect(across(178)).toBeLessThan(6);
  });

  it('presses a one-point round dab into a disc', () => {
    const c = fresh(3, 'smooth');
    const res = layStroke(c, {
      path: [[100, 50]],
      brush: { type: 'round', width: 20 },
      color: red,
    });
    expect(res.bbox).not.toBeNull();
    const { x0, x1, y0, y1 } = res.bbox!;
    const ratio = (x1 - x0) / (y1 - y0);
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
    expect(res.covered).toBeGreaterThan(0.5 * Math.PI * 8 * 8);
    expect(res.length).toBe(0);
  });

  it('leaves no holes inside a soft dab on a smooth panel', () => {
    const c = fresh(3, 'smooth');
    for (let k = 0; k < 20; k++)
      layStroke(c, {
        path: [[20 + k * 8, 50]],
        brush: { type: 'soft', width: 8 },
        color: white,
        pressure: 0.6,
      });
    for (let k = 0; k < 20; k++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) expect(painted(c, 20 + k * 8 + dx, 50 + dy)).toBe(true);
  });

  it('skips across the weave with low contact, more than at full contact', () => {
    const gaps = (contact: number) => {
      const c = fresh(3, 'coarse_weave');
      return layStroke(c, {
        path: [
          [10, 50],
          [190, 50],
        ],
        brush: { type: 'knife', width: 30 },
        color: white,
        contact,
      }).gaps;
    };
    expect(gaps(0.3)).toBeGreaterThan(gaps(1) + 0.15);
  });

  describe('measurements', () => {
    it('reports a stroke on a dry canvas as unmixed and one through wet paint as mixed', () => {
      const c = fresh();
      const first = layStroke(c, {
        path: [
          [10, 50],
          [190, 50],
        ],
        brush: { type: 'flat', width: 24 },
        color: red,
      });
      expect(first.mixed).toBeLessThan(0.1);
      expect(first.covered).toBeGreaterThan(160 * 20);
      expect(first.length).toBeCloseTo(180, 0);
      const second = layStroke(c, {
        path: [
          [10, 50],
          [190, 50],
        ],
        brush: { type: 'flat', width: 20 },
        color: white,
      });
      expect(second.mixed).toBeGreaterThan(0.3);
      expect(second.pickedUp).toBeGreaterThan(0);
    });

    it('bounds what it changed inside the rectangle it announced', () => {
      const c = fresh();
      let announced: PixelRect | undefined;
      const res = layStroke(
        c,
        {
          path: [
            [30, 20],
            [100, 80],
            [170, 30],
          ],
          brush: { type: 'splayed', width: 18 },
          color: red,
        },
        {
          beforeWrite: (rect) => {
            announced = rect;
          },
        },
      );
      const b = res.bbox!;
      expect(announced).toBeDefined();
      expect(b.x0).toBeGreaterThanOrEqual(announced!.x0);
      expect(b.y0).toBeGreaterThanOrEqual(announced!.y0);
      expect(b.x1).toBeLessThanOrEqual(announced!.x1);
      expect(b.y1).toBeLessThanOrEqual(announced!.y1);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (c.V[y * W + x]! > 0)
            expect(x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1).toBe(true);
    });

    it('reports a stroke entirely off the canvas as empty', () => {
      const c = fresh();
      const res = layStroke(c, {
        path: [
          [-300, -300],
          [-200, -250],
        ],
        brush: { type: 'flat', width: 10 },
        color: red,
      });
      expect(res).toMatchObject({ bbox: null, covered: 0 });
    });
  });
});
