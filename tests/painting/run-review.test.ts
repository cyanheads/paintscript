import { describe, expect, it } from 'vitest';
import {
  observe,
  reviewStrokes,
  type StrokeRecord,
  spread,
} from '../../src/painting/run-review.js';

const stroke = (over: Partial<StrokeRecord> = {}): StrokeRecord => ({
  angle: 0,
  covered: 500,
  dab: false,
  gaps: 0.05,
  length: 100,
  mixed: 0.1,
  width: 10,
  ...over,
});

describe('spread', () => {
  it('takes nearest-rank percentiles', () => {
    expect(spread([5, 1, 4, 2, 3, 6, 7, 8, 9, 10])).toEqual({ p10: 1, p50: 5, p90: 9 });
    expect(spread([])).toBeNull();
  });
});

describe('reviewStrokes', () => {
  it('measures a mechanical fill as one repeated bin and one direction', () => {
    const r = reviewStrokes(Array.from({ length: 40 }, () => stroke()));
    expect(r.repeatShare).toBe(1);
    expect(r.angleSpread).toBeCloseTo(0, 5);
    expect(r.shortShare).toBe(0);
  });

  it('treats opposite directions as one axis', () => {
    const r = reviewStrokes([stroke({ angle: 0.2 }), stroke({ angle: 0.2 - Math.PI })]);
    expect(r.angleSpread).toBeCloseTo(0, 5);
  });

  it('spreads varied strokes across bins', () => {
    const varied = Array.from({ length: 40 }, (_, i) =>
      stroke({ angle: (i * 0.37) % Math.PI, length: 30 + i * 9, width: 4 + (i % 7) * 3 }),
    );
    const r = reviewStrokes(varied);
    expect(r.repeatShare!).toBeLessThan(0.2);
    expect(r.angleSpread!).toBeGreaterThan(30);
  });

  it('keeps dabs out of length and short-stroke shares', () => {
    const r = reviewStrokes([
      stroke({ dab: true, length: 0, angle: null }),
      stroke({ length: 12 }),
    ]);
    expect(r.length).toEqual({ p10: 12, p50: 12, p90: 12 });
    expect(r.shortShare).toBe(1);
  });
});

describe('observe', () => {
  it('states repetition, mixing, and empty strokes as counted facts, at most three', () => {
    const strokes = Array.from({ length: 30 }, (_, i) =>
      stroke({ mixed: i < 20 ? 0.8 : 0.1, covered: i < 2 ? 0 : 500, gaps: 0.6 }),
    );
    expect(observe(strokes, reviewStrokes(strokes))).toEqual([
      '100% of 30 strokes repeat one length, angle, and width',
      '20 of 30 strokes took over half their color from wet paint underneath',
      '2 of 30 strokes laid no paint on the canvas',
    ]);
  });

  it('says nothing about a handful of strokes', () => {
    const strokes = [stroke(), stroke()];
    expect(observe(strokes, reviewStrokes(strokes))).toEqual([]);
  });
});
