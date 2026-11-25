import { describe, expect, it } from 'vitest';
import { layStroke } from '../../src/brush/lay-stroke.js';
import { Canvas } from '../../src/canvas/canvas.js';
import { toSpectrum } from '../../src/color/color.js';
import { TileUndo } from '../../src/painting/tile-undo.js';

const fresh = () => new Canvas(150, 100, toSpectrum('#808080'), 5, 'fine_weave');

function state(c: Canvas) {
  return [c.K, c.S, c.V, c.baseR, c.baseH].map((a) => Buffer.from(a.slice().buffer));
}

describe('TileUndo', () => {
  it('restores strokes and a dry exactly, leaving untouched tiles alone', () => {
    const c = fresh();
    layStroke(c, {
      path: [
        [10, 20],
        [140, 30],
      ],
      brush: { type: 'flat', width: 14 },
      color: toSpectrum('#d04020'),
    });
    const before = state(c);
    const undo = new TileUndo(c);
    layStroke(
      c,
      {
        path: [
          [20, 80],
          [130, 25],
        ],
        brush: { type: 'round', width: 18 },
        color: toSpectrum('#2050c0'),
      },
      { beforeWrite: (rect) => undo.save(rect, ['film', 'volume']) },
    );
    undo.save({ x0: 0, y0: 0, x1: 150, y1: 100 }, ['volume', 'base']);
    c.dry();
    expect(state(c)).not.toEqual(before);
    undo.restore();
    expect(state(c)).toEqual(before);
  });

  it('saves only the tiles a predicate accepts, and reports their bounds', () => {
    const c = fresh();
    const undo = new TileUndo(c);
    undo.save({ x0: 0, y0: 0, x1: 150, y1: 100 }, ['base'], (t) => t.x0 >= 64);
    expect(undo.region()).toEqual({ x0: 64, y0: 0, x1: 150, y1: 100 });
    // base channel: 8 bands + height per px
    expect(undo.bytes).toBe((150 - 64) * 100 * 9 * 4);
  });

  it('saves a tile once per channel', () => {
    const c = fresh();
    const undo = new TileUndo(c);
    undo.save({ x0: 0, y0: 0, x1: 10, y1: 10 }, ['volume']);
    const once = undo.bytes;
    undo.save({ x0: 5, y0: 5, x1: 20, y1: 20 }, ['volume']);
    expect(undo.bytes).toBe(once);
    expect(new TileUndo(c).region()).toBeNull();
  });
});
