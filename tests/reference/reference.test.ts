import { describe, expect, it } from 'vitest';
import { Canvas } from '../../src/canvas/canvas.js';
import { toSpectrum } from '../../src/color/color.js';
import { Reference } from '../../src/reference/reference.js';
import type { RgbImage } from '../../src/render/render.js';

/** An image filled by a function of pixel position returning an 8-bit grey. */
function image(width: number, height: number, grey: (x: number, y: number) => number): RgbImage {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      rgb.fill(grey(x, y), (y * width + x) * 3, (y * width + x) * 3 + 3);
  return { width, height, rgb };
}

describe('Reference', () => {
  it('places an image by cover, contain, or stretch', () => {
    const img = image(200, 100, () => 128);
    expect(new Reference(img, 100, 100, 'cover').placement).toEqual({
      x: -50,
      y: 0,
      w: 200,
      h: 100,
    });
    expect(new Reference(img, 100, 100, 'contain').placement).toEqual({
      x: 0,
      y: 25,
      w: 100,
      h: 50,
    });
    expect(new Reference(img, 100, 100, 'stretch').placement).toEqual({
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    });
  });

  it('samples colors at canvas points, and nothing where a contained image does not reach', () => {
    const img = image(40, 40, (x) => (x < 20 ? 0 : 255));
    const ref = new Reference(img, 100, 100, 'stretch');
    expect(ref.at(10, 50)![0]).toBeCloseTo(0, 5);
    expect(ref.at(90, 50)![1]).toBeCloseTo(1, 5);
    const mid = ref.at(49.5, 50)![0];
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
    const boxed = new Reference(
      image(200, 100, () => 255),
      100,
      100,
      'contain',
    );
    expect(boxed.at(50, 10)).toBeNull();
    expect(boxed.at(50, 50)![2]).toBeCloseTo(1, 5);
  });

  it('reads the direction an edge runs and how sharp it is', () => {
    const vertical = new Reference(
      image(100, 100, (x) => (x < 50 ? 30 : 220)),
      100,
      100,
      'stretch',
    );
    const v = vertical.edge(50, 50)!;
    expect(Math.abs(v.angle)).toBeCloseTo(Math.PI / 2, 2);
    expect(v.strength).toBeGreaterThan(0.05);
    expect(vertical.edge(10, 50)!.strength).toBeLessThan(1e-3);
    const horizontal = new Reference(
      image(100, 100, (_, y) => (y < 50 ? 30 : 220)),
      100,
      100,
      'stretch',
    );
    expect(horizontal.edge(50, 50)!.angle).toBeCloseTo(0, 2);
  });

  it('measures the painting against the reference, worst cells first', () => {
    const canvas = new Canvas(64, 64, toSpectrum('#808080'), 1, 'smooth');
    const same = new Reference(
      image(64, 64, () => 128),
      64,
      64,
      'stretch',
    );
    expect(same.diff(canvas, { x0: 0, y0: 0, x1: 64, y1: 64 }, 32).mean).toBeLessThan(0.01);
    const half = new Reference(
      image(64, 64, (x, y) => (x >= 32 && y >= 32 ? 255 : 128)),
      64,
      64,
      'stretch',
    );
    const d = half.diff(canvas, { x0: 0, y0: 0, x1: 64, y1: 64 }, 32);
    expect(d.worst[0]).toMatchObject({ x: 32, y: 32, w: 32, h: 32 });
    expect(d.worst[0]!.distance).toBeGreaterThan(0.3);
    expect(d.worst).toHaveLength(4);
    expect(d.samples).toBe(64 * 64);
  });
});
