/**
 * @fileoverview Looping animated GIF89a from same-size RGB frames, with no dependency.
 * One 255-color median-cut palette serves every frame; a 4×4 ordered dither keeps
 * unchanged paint identical from frame to frame, so each frame after the first stores
 * only the rectangle that changed, unchanged pixels inside it transparent over the last.
 * @module image/gif
 */

/** Growable byte buffer. */
class ByteSink {
  private buf = new Uint8Array(1 << 16);
  n = 0;

  push(b: number): void {
    if (this.n === this.buf.length) {
      const g = new Uint8Array(this.buf.length * 2);
      g.set(this.buf);
      this.buf = g;
    }
    this.buf[this.n++] = b;
  }

  u16(v: number): void {
    this.push(v & 0xff);
    this.push((v >> 8) & 0xff);
  }

  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.push(s.charCodeAt(i));
  }

  bytes(): Uint8Array {
    return this.buf.slice(0, this.n);
  }
}

/**
 * Variance-split median cut over a 5-bit histogram: the last frame counted in full,
 * every third earlier frame sampled, so the ground and the early thin layers keep
 * their colors in the shared palette.
 */
function medianCut(frames: readonly Uint8Array[], k: number): number[][] {
  const cnt = new Float64Array(32768);
  const sr = new Float64Array(32768);
  const sg = new Float64Array(32768);
  const sb = new Float64Array(32768);
  const add = (rgb: Uint8Array, stride: number, wgt: number) => {
    for (let p = 0; p + 2 < rgb.length; p += 3 * stride) {
      const r = rgb[p]!;
      const g = rgb[p + 1]!;
      const b = rgb[p + 2]!;
      const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      cnt[bin]! += wgt;
      sr[bin]! += r * wgt;
      sg[bin]! += g * wgt;
      sb[bin]! += b * wgt;
    }
  };
  add(frames[frames.length - 1]!, 1, 1);
  for (let f = 0; f < frames.length - 1; f += 3) add(frames[f]!, 7, 2);
  const col: number[][] = [];
  const wt: number[] = [];
  for (let i = 0; i < 32768; i++)
    if (cnt[i]! > 0) {
      col.push([sr[i]! / cnt[i]!, sg[i]! / cnt[i]!, sb[i]! / cnt[i]!]);
      wt.push(cnt[i]!);
    }
  interface Box {
    axis: number;
    items: number[];
    mean: number[];
    sse: number;
  }
  const stats = (items: number[]): Box => {
    let W = 0;
    const m = [0, 0, 0];
    const q = [0, 0, 0];
    for (const i of items)
      for (let c = 0; c < 3; c++) {
        m[c]! += col[i]![c]! * wt[i]!;
        q[c]! += col[i]![c]! ** 2 * wt[i]!;
      }
    for (const i of items) W += wt[i]!;
    const v = [0, 1, 2].map((c) => q[c]! / W - (m[c]! / W) ** 2);
    const axis = v[0]! >= v[1]! && v[0]! >= v[2]! ? 0 : v[1]! >= v[2]! ? 1 : 2;
    return {
      items,
      sse: items.length > 1 ? (v[0]! + v[1]! + v[2]!) * W : -1,
      axis,
      mean: m.map((s) => s / W),
    };
  };
  const boxes = [stats(col.map((_, i) => i))];
  while (boxes.length < k) {
    let bi = -1;
    for (let i = 0; i < boxes.length; i++)
      if (boxes[i]!.sse > 0 && (bi < 0 || boxes[i]!.sse > boxes[bi]!.sse)) bi = i;
    if (bi < 0) break;
    const { items, axis } = boxes[bi]!;
    items.sort((a, b) => col[a]![axis]! - col[b]![axis]!);
    let half = 0;
    let tot = 0;
    let cut = 1;
    for (const i of items) tot += wt[i]!;
    for (let j = 0; j < items.length - 1; j++) {
      half += wt[items[j]!]!;
      if (half >= tot / 2) {
        cut = j + 1;
        break;
      }
    }
    boxes.splice(bi, 1, stats(items.slice(0, cut)), stats(items.slice(cut)));
  }
  return boxes.map((b) => b.mean.map((v) => Math.round(v)));
}

let lzwCode: Int32Array | null = null;
let lzwStamp: Int32Array | null = null;
let lzwGen = 0;

/** GIF LZW with an 8-bit minimum code size, written as length-prefixed sub-blocks. */
function lzw(data: Uint8Array, out: ByteSink): void {
  lzwCode ??= new Int32Array(4096 * 256);
  lzwStamp ??= new Int32Array(4096 * 256);
  const code = lzwCode;
  const stamp = lzwStamp;
  const CLEAR = 256;
  const EOI = 257;
  const packed = new ByteSink();
  let size = 9;
  let next = EOI + 1;
  let acc = 0;
  let nbits = 0;
  const emit = (c: number) => {
    acc |= c << nbits;
    nbits += size;
    while (nbits >= 8) {
      packed.push(acc & 0xff);
      acc >>>= 8;
      nbits -= 8;
    }
  };
  lzwGen++;
  emit(CLEAR);
  let cur = data[0]!;
  for (let i = 1; i < data.length; i++) {
    const k = data[i]!;
    const key = (cur << 8) | k;
    if (stamp[key] === lzwGen) {
      cur = code[key]!;
      continue;
    }
    emit(cur);
    if (next === 4096) {
      emit(CLEAR);
      next = EOI + 1;
      size = 9;
      lzwGen++;
    } else {
      if (next >= 1 << size) size++;
      code[key] = next++;
      stamp[key] = lzwGen;
    }
    cur = k;
  }
  emit(cur);
  emit(EOI);
  if (nbits > 0) packed.push(acc & 0xff);
  const v = packed.bytes();
  out.push(8);
  for (let p = 0; p < v.length; p += 255) {
    const len = Math.min(255, v.length - p);
    out.push(len);
    for (let j = 0; j < len; j++) out.push(v[p + j]!);
  }
  out.push(0);
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A finished GIF. */
export interface EncodedGif {
  bytes: Uint8Array;
  /** Frames stored (identical consecutive frames merge into one with the summed delay). */
  frames: number;
}

/**
 * Encode same-size RGB frames (3 bytes per pixel) as a looping GIF. `delays` are
 * centiseconds, one per frame.
 */
export function encodeGif(
  w: number,
  h: number,
  frames: readonly Uint8Array[],
  delays: readonly number[],
): EncodedGif {
  const T = 255;
  const pal = medianCut(frames, 255);
  const lut = new Int16Array(1 << 18).fill(-1);
  const nearest = (r: number, g: number, b: number) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let v = lut[key]!;
    if (v < 0) {
      const cr = (r & ~3) + 2;
      const cg = (g & ~3) + 2;
      const cb = (b & ~3) + 2;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < pal.length; i++) {
        const [pr, pg, pb] = pal[i]!;
        const d = 2 * (pr! - cr) ** 2 + 4 * (pg! - cg) ** 2 + 3 * (pb! - cb) ** 2;
        if (d < best) {
          best = d;
          v = i;
        }
      }
      lut[key] = v;
    }
    return v;
  };
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  const index = (rgb: Uint8Array) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const d = (BAYER4[(y & 3) * 4 + (x & 3)]! / 16 - 0.47) * 10;
        out[i] = nearest(
          clamp(rgb[i * 3]! + d),
          clamp(rgb[i * 3 + 1]! + d),
          clamp(rgb[i * 3 + 2]! + d),
        );
      }
    return out;
  };
  interface Frame {
    data: Uint8Array;
    delay: number;
    h: number;
    transparent: boolean;
    w: number;
    x: number;
    y: number;
  }
  const list: Frame[] = [];
  let prev: Uint8Array | null = null;
  for (let f = 0; f < frames.length; f++) {
    const cur = index(frames[f]!);
    if (!prev) {
      list.push({ x: 0, y: 0, w, h, data: cur, delay: delays[f]!, transparent: false });
      prev = cur;
      continue;
    }
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < cur.length; i++)
      if (cur[i] !== prev[i]) {
        const x = i % w;
        const y = (i / w) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    if (x1 < 0) {
      list[list.length - 1]!.delay += delays[f]!;
      continue;
    }
    const fw = x1 - x0 + 1;
    const fh = y1 - y0 + 1;
    const data = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        const i = (y0 + y) * w + x0 + x;
        data[y * fw + x] = cur[i] === prev[i] ? T : cur[i]!;
      }
    list.push({ x: x0, y: y0, w: fw, h: fh, data, delay: delays[f]!, transparent: true });
    prev = cur;
  }
  const out = new ByteSink();
  out.ascii('GIF89a');
  out.u16(w);
  out.u16(h);
  out.push(0xf7);
  out.push(0);
  out.push(0);
  for (let i = 0; i < 256; i++) {
    const c = pal[i] ?? [0, 0, 0];
    out.push(c[0]!);
    out.push(c[1]!);
    out.push(c[2]!);
  }
  out.push(0x21);
  out.push(0xff);
  out.push(11);
  out.ascii('NETSCAPE2.0');
  out.push(3);
  out.push(1);
  out.u16(0);
  out.push(0);
  for (const f of list) {
    out.push(0x21);
    out.push(0xf9);
    out.push(4);
    out.push(f.transparent ? 0x05 : 0x04);
    out.u16(Math.min(65535, f.delay));
    out.push(T);
    out.push(0);
    out.push(0x2c);
    out.u16(f.x);
    out.u16(f.y);
    out.u16(f.w);
    out.u16(f.h);
    out.push(0);
    lzw(f.data, out);
  }
  out.push(0x3b);
  return { bytes: out.bytes(), frames: list.length };
}
