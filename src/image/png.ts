/**
 * @fileoverview PNG encode (8-bit RGB) and decode (8- and 16-bit gray, gray+alpha,
 * RGB, RGBA, and palette; non-interlaced) with node:zlib and no other dependency.
 * @module image/png
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { PaintscriptError } from '../errors.js';
import type { RgbImage } from '../render/render.js';

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Encode an 8-bit RGB image as PNG bytes. */
export function encodePng(image: RgbImage): Uint8Array {
  const { width: w, height: h, rgb } = image;
  const stride = w * 3 + 1;
  const raw = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * stride + 1);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

function invalidImage(why: string): PaintscriptError {
  return new PaintscriptError('invalid_image', `Not a readable PNG: ${why}.`);
}

/** Decode PNG bytes to 8-bit RGB. Alpha is composited over white. Throws `invalid_image`. */
export function decodePng(bytes: Uint8Array): RgbImage {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b))
    throw invalidImage('missing PNG signature');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  for (let o = 8; o + 8 <= bytes.length; ) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    const data = bytes.subarray(o + 8, o + 8 + len);
    if (data.length !== len) throw invalidImage(`truncated ${type} chunk`);
    if (type === 'IHDR') {
      width = dv.getUint32(o + 8);
      height = dv.getUint32(o + 12);
      depth = data[8]!;
      colorType = data[9]!;
      if (data[12] !== 0)
        throw invalidImage('interlaced PNGs are not supported; save it without interlacing');
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (width === 0 || height === 0 || channels === undefined)
    throw invalidImage('unsupported header');
  if (colorType === 3 ? depth !== 8 : depth !== 8 && depth !== 16)
    throw invalidImage(`bit depth ${depth} with color type ${colorType} is not supported`);
  if (colorType === 3 && !palette) throw invalidImage('palette image without a PLTE chunk');
  const bpp = channels * (depth / 8);
  const stride = width * bpp;
  let raw: Uint8Array;
  try {
    raw = inflateSync(concat(idat));
  } catch (cause) {
    throw new PaintscriptError('invalid_image', 'Not a readable PNG: corrupt image data.', {
      cause,
    });
  }
  if (raw.length < (stride + 1) * height)
    throw invalidImage('image data shorter than its header says');
  const cur = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp]! : 0;
      const b = prev[x]!;
      const c = x >= bpp ? prev[x - bpp]! : 0;
      const v = line[x]!;
      let p: number;
      if (filter === 0) p = v;
      else if (filter === 1) p = v + a;
      else if (filter === 2) p = v + b;
      else if (filter === 3) p = v + ((a + b) >> 1);
      else if (filter === 4) {
        const e = a + b - c;
        const pa = Math.abs(e - a);
        const pb = Math.abs(e - b);
        const pc = Math.abs(e - c);
        p = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw invalidImage(`unknown row filter ${filter}`);
      cur[x] = p & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const at = (ch: number) => cur[x * bpp + ch * (depth / 8)]!;
      let r: number;
      let g: number;
      let b: number;
      let alpha = 255;
      if (colorType === 3) {
        const idx = cur[x]!;
        r = palette![idx * 3] ?? 0;
        g = palette![idx * 3 + 1] ?? 0;
        b = palette![idx * 3 + 2] ?? 0;
        alpha = trns?.[idx] ?? 255;
      } else if (colorType === 0 || colorType === 4) {
        r = g = b = at(0);
        if (colorType === 4) alpha = at(1);
      } else {
        r = at(0);
        g = at(1);
        b = at(2);
        if (colorType === 6) alpha = at(3);
      }
      const o = (y * width + x) * 3;
      const t = alpha / 255;
      rgb[o] = Math.round(r * t + 255 * (1 - t));
      rgb[o + 1] = Math.round(g * t + 255 * (1 - t));
      rgb[o + 2] = Math.round(b * t + 255 * (1 - t));
    }
    prev.set(cur);
  }
  return { width, height, rgb };
}
