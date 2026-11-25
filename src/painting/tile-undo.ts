/**
 * @fileoverview Undo for one run: before the run first writes a 64 px tile, the tile's
 * pixels are copied aside per channel (the wet film's K and S, its volume, the dry
 * base), so restoring puts back exactly what the run changed and nothing else.
 * @module painting/tile-undo
 */

import type { Canvas, PixelRect } from '../canvas/canvas.js';
import { NB } from '../color/spectrum.js';

/** What a write changes: wet film K and S, wet film volume, or the dry base (reflectance and height). */
export type Channel = 'film' | 'volume' | 'base';

const TILE = 64;

type Tile = Partial<Record<Channel, Float32Array>>;

/** Saved tiles of one run, restorable once. */
export class TileUndo {
  private readonly canvas: Canvas;
  private readonly cols: number;
  private readonly tiles = new Map<number, Tile>();
  private saved = 0;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.cols = Math.ceil(canvas.width / TILE);
  }

  /** Bytes held by saved tiles. */
  get bytes(): number {
    return this.saved;
  }

  /**
   * Save `channels` of every tile overlapping `rect` not saved for them yet; with
   * `only`, just the tiles it accepts (given each tile's rectangle on the canvas).
   */
  save(rect: PixelRect, channels: readonly Channel[], only?: (tile: PixelRect) => boolean): void {
    const tx0 = Math.floor(rect.x0 / TILE);
    const ty0 = Math.floor(rect.y0 / TILE);
    const tx1 = Math.ceil(rect.x1 / TILE);
    const ty1 = Math.ceil(rect.y1 / TILE);
    for (let ty = ty0; ty < ty1; ty++)
      for (let tx = tx0; tx < tx1; tx++) {
        const key = ty * this.cols + tx;
        let tile = this.tiles.get(key);
        if (tile && channels.every((ch) => tile![ch])) continue;
        const r = this.tileRect(tx, ty);
        if (only && !only(r)) continue;
        if (!tile) {
          tile = {};
          this.tiles.set(key, tile);
        }
        for (const ch of channels)
          if (!tile[ch]) {
            const data = this.copy(r, ch);
            tile[ch] = data;
            this.saved += data.byteLength;
          }
      }
  }

  /** Put every saved tile back. */
  restore(): void {
    for (const [key, tile] of this.tiles) {
      const r = this.tileRect(key % this.cols, Math.floor(key / this.cols));
      for (const ch of ['film', 'volume', 'base'] as const) {
        const data = tile[ch];
        if (data) this.paste(r, ch, data);
      }
    }
  }

  /** Bounds of every saved tile, or null when nothing was saved. */
  region(): PixelRect | null {
    let out: PixelRect | null = null;
    for (const key of this.tiles.keys()) {
      const r = this.tileRect(key % this.cols, Math.floor(key / this.cols));
      out = out
        ? {
            x0: Math.min(out.x0, r.x0),
            y0: Math.min(out.y0, r.y0),
            x1: Math.max(out.x1, r.x1),
            y1: Math.max(out.y1, r.y1),
          }
        : r;
    }
    return out;
  }

  private tileRect(tx: number, ty: number): PixelRect {
    return {
      x0: tx * TILE,
      y0: ty * TILE,
      x1: Math.min(this.canvas.width, (tx + 1) * TILE),
      y1: Math.min(this.canvas.height, (ty + 1) * TILE),
    };
  }

  /** The arrays a channel covers, with values per pixel for each. */
  private arrays(ch: Channel): [Float32Array, number][] {
    const c = this.canvas;
    if (ch === 'film')
      return [
        [c.K, NB],
        [c.S, NB],
      ];
    if (ch === 'volume') return [[c.V, 1]];
    return [
      [c.baseR, NB],
      [c.baseH, 1],
    ];
  }

  private copy(r: PixelRect, ch: Channel): Float32Array {
    const W = this.canvas.width;
    const n = r.x1 - r.x0;
    const parts = this.arrays(ch);
    const per = parts.reduce((s, [, k]) => s + k, 0);
    const out = new Float32Array(n * (r.y1 - r.y0) * per);
    let o = 0;
    for (const [arr, k] of parts)
      for (let y = r.y0; y < r.y1; y++) {
        const start = (y * W + r.x0) * k;
        out.set(arr.subarray(start, start + n * k), o);
        o += n * k;
      }
    return out;
  }

  private paste(r: PixelRect, ch: Channel, data: Float32Array) {
    const W = this.canvas.width;
    const n = r.x1 - r.x0;
    let o = 0;
    for (const [arr, k] of this.arrays(ch))
      for (let y = r.y0; y < r.y1; y++) {
        arr.set(data.subarray(o, o + n * k), (y * W + r.x0) * k);
        o += n * k;
      }
  }
}
